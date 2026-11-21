// Router delle richieste IA.
//
// Ogni richiesta arriva con dei tag che dicono di che tipo è (TAG). Il router guarda solo
// le chiavi configurate dall'utente, tiene i modelli che sanno fare il lavoro e li ordina
// dal più adatto: prima i gratuiti, poi quelli con la qualità o la velocità che il tag chiede,
// poi i meno usati oggi. Se un servizio risponde con un errore, mette in pausa la chiave
// (o solo il modello) e passa al candidato successivo.
import { t } from "../i18n.js";
import { PROVIDERS, RETIRED, CAP } from "./providers.js";
import { allKeys, usage, countUse, cooling, cool } from "./keys.js";
import { call, ApiError, NetError } from "./adapters.js";

/**
 * Tipi di richiesta.
 * - WEB:     serve la ricerca sul web (obbligatorio: solo modelli con CAP.WEB)
 * - REASON:  serve un giudizio accurato (preferisce i modelli di qualità)
 * - EXTRACT: estrarre dati da un testo lungo (preferisce i modelli veloci ed economici)
 * - FAST:    risposta veloce
 * - LONG:    input lungo (preferisce contesti ampi)
 * @readonly
 */
export const TAG = { WEB: "web", REASON: "reason", EXTRACT: "extract", FAST: "fast", LONG: "long" };

const TIER_COST = { free: 0, quota: 6, paid: 20 };
const midnightUTC = () => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return d.getTime(); };

/** Modelli che una chiave può usare: quello personale (se impostato e ancora attivo), poi quelli del catalogo. */
function modelsOf(k) {
  const P = PROVIDERS[k.provider], list = [...P.models];
  if (k.model && !RETIRED.has(k.model) && !list.some(m => m.id === k.model)) {
    const caps = [...new Set(P.models.flatMap(m => m.caps))];
    list.unshift({ id: k.model, caps, quality: 2, speed: 2, ctx: 64, custom: true });
  }
  return list;
}

/** Costo di un candidato per i tag della richiesta: più basso = più adatto. */
export function cost(P, m, tags, used = 0) {
  const has = x => tags.includes(x);
  return TIER_COST[P.tier]
    + (3 - m.quality) * (has(TAG.REASON) ? 4 : 1)
    + (has(TAG.FAST) || has(TAG.EXTRACT) ? (3 - m.speed) * 3 : 0)
    + (has(TAG.LONG) && m.ctx < 64 ? 8 : 0)
    + used * 0.3
    - (m.custom ? 2 : 0);
}

/**
 * @typedef {Object} Candidate
 * @property {Object} key      chiave { id, provider, key, model, shared? }
 * @property {string} provider
 * @property {import("./providers.js").Provider} P
 * @property {string} model
 * @property {number} cost
 */

/**
 * Candidati per una richiesta, dal più adatto. Esclude chiavi e modelli in pausa.
 * @param {string[]} tags
 * @param {Object[]} [keys]
 * @returns {Candidate[]}
 */
export function route(tags = [], keys = allKeys()) {
  const web = tags.includes(TAG.WEB), out = [];
  for (const k of keys) {
    const P = PROVIDERS[k.provider];
    if (!P || cooling(k)) continue;
    for (const m of modelsOf(k)) {
      if (web && !m.caps.includes(CAP.WEB)) continue;
      if (cooling(k, m.id)) continue;
      out.push({ key: k, provider: k.provider, P, model: m.id, cost: cost(P, m, tags, usage(k)) });
    }
  }
  return out.sort((a, b) => a.cost - b.cost);
}

/** C'è almeno una chiave che sa fare questo tipo di richiesta (anche se ora in pausa)? */
export const ready = (tags = [TAG.WEB]) => allKeys().some(k => modelsOf(k).some(m => !tags.includes(TAG.WEB) || m.caps.includes(CAP.WEB)));

/** JSON dalla risposta: blocco ```json o primo oggetto {...}. */
export function extractJson(text) {
  const s = String(text), fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { const e = new Error("unreadable"); e.unreadable = true; throw e; }
}

// errori che dipendono dal modello (spento, nome sbagliato, strumento non supportato) e non dalla chiave
const MODEL_ERR = /model|decommission|deprecat|not found|does not exist|not supported|unsupported|tool/i;

/** Decide quanto e cosa mettere in pausa dopo un errore. Restituisce true se la pausa è su tutta la chiave. */
function penalize(c, e) {
  const k = c.key;
  if (e instanceof NetError) { cool(k, 60e3, "network"); return true; }
  if (e.unreadable) { cool(k, 60e3, "unreadable", "", c.model); return false; }
  if (!(e instanceof ApiError)) { cool(k, 60e3, "error", e.message, c.model); return false; }
  const daily = /day|daily|quota|exceed|insufficient|balance|credit/i.test(e.message);
  if (e.status === 401 || e.status === 403) { cool(k, 24 * 3600e3, "key", e.message); return true; }
  if (e.status === 402 || (e.status === 429 && daily)) { cool(k, midnightUTC() - Date.now(), "quota", e.message); return true; }
  if (e.status === 429) { cool(k, (e.retry || 120) * 1000, "rate", e.message); return true; }
  if (e.status === 404 || (e.status === 400 && MODEL_ERR.test(e.message))) { cool(k, 24 * 3600e3, "model", `${e.status} ${e.message}`, c.model); return false; }
  if (e.status >= 500) { cool(k, 60e3, "server", e.message, c.model); return false; }
  cool(k, 15 * 60e3, "error", `${e.status} ${e.message}`, c.model); return false;
}

/** Errore da mostrare all'utente, con il nome del servizio che ha fallito per ultimo. */
function userError(last, name) {
  const mk = (key, vars) => Object.assign(new Error(t(key, vars)), { code: key });
  if (last instanceof ApiError) {
    if (last.status === 401 || last.status === 403) return mk("ai.errBad", { name });
    if (last.status === 429 || last.status === 402) return mk("ai.errRate", { name });
    return Object.assign(new Error(t("ai.errStatus", { name, status: last.status }) + (last.message ? ` – ${last.message.slice(0, 160)}` : "")), { code: "ai.errStatus" });
  }
  if (last instanceof NetError) return mk("ai.errNet", { name });
  return mk("ai.errRead", { name });
}

/**
 * Esegue una richiesta sul candidato migliore, poi sui successivi in caso di errore.
 * @param {{ system: string, prompt: string, tags?: string[], signal?: AbortSignal }} req
 * @returns {Promise<any>} JSON della risposta
 */
export async function ask({ system, prompt, tags = [TAG.WEB], signal }) {
  const cands = route(tags);
  if (!cands.length) throw Object.assign(new Error(t(ready(tags) ? "ai.allBusy" : "ai.none")), { code: "ai.none" });
  let last = null, lastName = "", skip = new Set();
  for (const c of cands) {
    if (skip.has(c.key.id)) continue; // chiave messa in pausa da un tentativo precedente
    try {
      countUse(c.key);
      const text = await call({ provider: c.provider, P: c.P, model: c.model, key: c.key.key, system, prompt, web: tags.includes(TAG.WEB), signal });
      return extractJson(text);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      last = e; lastName = c.P.nome;
      if (penalize(c, e)) skip.add(c.key.id);
    }
  }
  throw userError(last, lastName);
}
