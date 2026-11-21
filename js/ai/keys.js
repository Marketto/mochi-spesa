// Chiavi IA dell'utente, uso giornaliero e pause.
//
// Le chiavi restano sul telefono (localStorage) e, se l'utente lo sceglie, anche nel file Dropbox
// condiviso in famiglia (setShared). Le pause servono al router per non riprovare un servizio
// esaurito o una chiave sbagliata: possono riguardare la chiave intera o un solo modello.
import { PROVIDERS } from "./providers.js";

const LS = "mochi.ai", OLD = "mochi.claude", USE = "mochi.aiUse", COOL = "mochi.aiCool2"; // v2: pause per chiave o per modello (le vecchie pause non valgono più)
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const rid = () => Math.random().toString(36).slice(2, 10);

/** Identificativo stabile di una chiave che non la rivela per intero. */
export const keyId = k => k.provider + ":" + k.key.slice(-12);

// formato precedente (una chiave per servizio) → elenco di chiavi
function migrate() {
  if (localStorage.getItem(LS)) return;
  const o = ls(OLD, null); if (!o) return;
  const keys = [];
  if (o.keys) for (const [p, k] of Object.entries(o.keys)) if (k && PROVIDERS[p]) keys.push({ id: rid(), provider: p, key: k, model: (o.models || {})[p] || "" });
  if (o.key && !keys.some(k => k.key === o.key)) keys.push({ id: rid(), provider: "claude", key: o.key, model: o.model || "" });
  lsSet(LS, { keys });
}

// ---------- chiavi ----------
let shared = [];
/** Chiavi condivise dal file Dropbox di famiglia (accetta anche il vecchio formato: un solo oggetto). */
export const setShared = c => { shared = (Array.isArray(c) ? c : c ? [c] : []).filter(k => k && k.key && PROVIDERS[k.provider]); };
/** Chiavi salvate su questo telefono. */
export function localKeys() { migrate(); return (ls(LS, {}).keys || []).filter(k => k.key && PROVIDERS[k.provider]); }
/** Tutte le chiavi utilizzabili: le proprie e quelle condivise (senza doppioni). */
export function allKeys() {
  const mine = localKeys(), seen = new Set(mine.map(k => k.key));
  return [...mine, ...shared.filter(k => !seen.has(k.key)).map(k => ({ ...k, id: k.id || keyId(k), shared: true }))];
}
export function addKey({ provider, key, model = "" }) {
  const keys = localKeys().filter(k => k.key !== key.trim());
  keys.push({ id: rid(), provider, key: key.trim(), model: model.trim() });
  lsSet(LS, { keys });
}
export function removeKey(id) { lsSet(LS, { keys: localKeys().filter(k => k.id !== id) }); }

// ---------- uso di oggi (per bilanciare tra più chiavi) ----------
const today = () => new Date().toISOString().slice(0, 10);
export function usage(k) { const u = ls(USE, {}); return u.date === today() ? (u.n || {})[keyId(k)] || 0 : 0; }
export function countUse(k) { let u = ls(USE, {}); if (u.date !== today()) u = { date: today(), n: {} }; u.n[keyId(k)] = (u.n[keyId(k)] || 0) + 1; lsSet(USE, u); }

// ---------- pause ----------
// chiave "provider:…1234" = tutta la chiave; "provider:…1234|modello" = solo quel modello
const coolKey = (k, model) => keyId(k) + (model ? "|" + model : "");
/** Pausa attiva sulla chiave intera (o su un suo modello), con motivo e messaggio del servizio. */
export function cooling(k, model) {
  const all = ls(COOL, {}), c = all[coolKey(k)] || (model && all[coolKey(k, model)]);
  return c && c.until > Date.now() ? c : null;
}
/** Mette in pausa una chiave (model vuoto) o un solo modello per ms millisecondi. */
export function cool(k, ms, reason, msg = "", model = "") {
  const c = ls(COOL, {});
  for (const [id, v] of Object.entries(c)) if (v.until < Date.now()) delete c[id]; // pulizia
  c[coolKey(k, model)] = { until: Date.now() + ms, reason, msg: String(msg).slice(0, 140) };
  lsSet(COOL, c);
}
