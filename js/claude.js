// Ricerca offerte e valutazioni prezzi con l'API di Claude + ricerca web.
// Chiamata diretta dal browser: la chiave API resta solo su questo dispositivo.
import { t } from "./i18n.js";

const LS = "mochi.claude";
export const PROVIDERS = ["claude", "mistral"];
export const DEFAULT_MODELS = { claude: "claude-sonnet-5-5", mistral: "mistral-medium-latest" };
export const DEFAULT_MODEL = DEFAULT_MODELS.claude;
const raw = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
// chiave condivisa in famiglia (arriva dal file su Dropbox, mai dal repository)
let shared = null;
export const setShared = c => { shared = c && c.key && PROVIDERS.includes(c.provider) ? c : null; };
/** Configurazione attiva: { provider, key, model }. Senza chiave propria usa quella condivisa via Dropbox. */
export function getCfg(provider, { local = false } = {}) {
  const r = raw(), p = provider || r.provider || (shared ? shared.provider : "claude");
  const keys = r.keys || { claude: r.key || "" }, models = r.models || { claude: r.model || "" };
  if (!keys[p] && !local && shared && (!provider || provider === shared.provider)) return { provider: shared.provider, key: shared.key, model: shared.model || DEFAULT_MODELS[shared.provider], shared: true };
  return { provider: p, key: keys[p] || "", model: models[p] || DEFAULT_MODELS[p] };
}
export function setCfg({ provider = "claude", key = "", model = "" }) {
  const r = raw(), keys = r.keys || { claude: r.key || "" }, models = r.models || { claude: r.model || "" };
  keys[provider] = key; models[provider] = model && model !== DEFAULT_MODELS[provider] ? model : "";
  try { localStorage.setItem(LS, JSON.stringify({ provider, keys, models })); } catch {}
}
export const ready = () => !!getCfg().key;

const err = (key, vars) => Object.assign(new Error(t(key, vars)), { code: key });

async function ask(system, prompt, opts = {}) {
  const cfg = getCfg();
  if (!cfg.key) throw err("err.noKey");
  return cfg.provider === "mistral" ? askMistral(cfg, system, prompt, opts) : askClaude(cfg, system, prompt, opts);
}

/** Mistral: Conversations API con lo strumento web_search (piano gratuito disponibile). */
async function askMistral({ key, model }, system, prompt, { signal } = {}) {
  let r;
  try {
    r = await fetch("https://api.mistral.ai/v1/conversations", {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({ model, instructions: system, inputs: prompt, tools: [{ type: "web_search" }], store: false,
        completion_args: { temperature: 0.2, max_tokens: 6000 } }),
    });
  } catch (e) { if (e.name === "AbortError") throw e; throw err("err.network"); }
  if (r.status === 401) throw err("err.badKey");
  if (r.status === 429) throw err("err.rate");
  if (!r.ok) {
    let msg = ""; try { const j = await r.json(); msg = j.message || j.detail?.[0]?.msg || j.detail || ""; } catch {}
    throw Object.assign(new Error(t("err.status", { status: r.status }) + (msg ? ` – ${String(msg).slice(0, 160)}` : "")), { code: "err.status" });
  }
  return extractJson(mistralText(await r.json()));
}
/** Testo della risposta Mistral (stringa o blocchi). */
export function mistralText(j) {
  return (j.outputs || []).filter(o => o.type === "message.output").map(o =>
    typeof o.content === "string" ? o.content : (o.content || []).filter(c => c.type === "text").map(c => c.text).join("")).join("\n");
}

async function askClaude({ key, model }, system, prompt, { signal } = {}) {
  const messages = [{ role: "user", content: prompt }];
  for (let turn = 0; turn < 4; turn++) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", signal,
        headers: {
          "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: model || DEFAULT_MODEL, max_tokens: 6000, system, messages,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10,
            user_location: { type: "approximate", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }],
        }),
      });
    } catch (e) { if (e.name === "AbortError") throw e; throw err("err.network"); }
    if (r.status === 401) throw err("err.badKey");
    if (r.status === 429) throw err("err.rate");
    if (!r.ok) throw err("err.status", { status: r.status });
    const j = await r.json();
    if (j.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: j.content }); continue; }
    const text = j.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    return extractJson(text);
  }
  throw err("err.tooLong");
}

export function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { throw err("err.unreadable"); }
}

const SYS = lingua => `You are a grocery shopping assistant. Use web search to find REAL, current prices.
Rules: only use data you verified in a source you opened; never invent or estimate prices.
If nothing reliable is found, return an empty list. Write every human-readable text value in ${lingua}.
Reply ONLY with valid JSON inside a \`\`\`json block.`;

/** Cerca offerte vicino a casa per i prodotti monitorati. */
export async function cercaOfferte({ prodotti, luogo, raggioKm, negozi, amazon, valuta, lingua }, opts) {
  const oggi = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${oggi}. Home area: ${luogo}. Radius: ${raggioKm} km. Favourite shops: ${negozi || "none"}. Currency: ${valuta}.
Products to look for (with comparison unit): ${prodotti.map(p => `"${p.nome}" (${p.unita})`).join(", ")}.

For each product, find deals valid TODAY in supermarkets, discount stores and drugstores within the radius of the home area
(chain websites and weekly flyers, flyer aggregators of that country). Keep at most 3 deals per product, the cheapest per unit.
${amazon ? "For each deal also find the current price of an equivalent product (same brand and size if possible) on the Amazon store of that country." : ""}
voto: "ottima" if at least 20% below the typical unit price or Amazon, "buona" if 5-20% below, otherwise "normale".
unita must be one of: lavaggi (washes), litri (litres), kg, pezzi (pieces).

Format:
{"offerte":[{"prodotto":"brand and size","categoria":"name of the watched product","negozio":"…","distanzaKm":number or null,
"prezzo":number,"quantita":number,"unita":"lavaggi|litri|kg|pezzi","prezzoUnit":number,"validoFino":"short local date" or null,"fonte":"url",
"amazon":{"prezzo":number,"prezzoUnit":number,"url":"url"} or null,"voto":"ottima|buona|normale","nota":"max one sentence or empty string"}]}`;
  const j = await ask(SYS(lingua), prompt, opts);
  return Array.isArray(j.offerte) ? j.offerte.filter(o => o && o.prodotto && typeof o.prezzo === "number") : [];
}

/** Valuta qualità/prezzo di un prodotto (nome o link Amazon). */
export async function valuta({ testo, prezzo, quantita, unita, offerte, valuta, luogo, lingua }, opts) {
  const prompt = `Product (name or Amazon link): ${testo}
Price seen: ${prezzo ? prezzo + " " + valuta : "not given (find it)"}${quantita ? `, quantity ${quantita} ${unita}` : ""}. Home area: ${luogo || "unknown"}.
Deals already known near home: ${JSON.stringify((offerte || []).slice(0, 12).map(o => ({ p: o.prodotto, n: o.negozio, u: o.prezzoUnit, un: o.unita })))}

Identify the product (open the link if it is one, or infer it from the URL), assess quality from reliable sources
(consumer tests, verified reviews), compare the unit price with the local Amazon store and with the known deals.
Format:
{"prodotto":"name","voto":"conveniente|nella media|caro","prezzo":number or null,"prezzoUnit":number or null,"unita":"lavaggi|litri|kg|pezzi",
"qualita":"short, e.g. good – 4.5★ from 3,000 reviews","sintesi":"max 2 sentences","alternativa":"one sentence or empty string","fonti":["url"]}`;
  return ask(SYS(lingua), prompt, opts);
}

/** Dove conviene comprare ogni prodotto della lista: 2-4 negozi per prodotto, con prezzi verificati. */
export async function confrontaPrezzi({ prodotti, luogo, raggioKm, negozi, valuta, lingua, preferiti, evitati }, opts) {
  const oggi = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${oggi}. Home area: ${luogo}. Radius: ${raggioKm} km. Usual shops: ${negozi || "none"}. Currency: ${valuta}.
Shopping list (id, name, quantity): ${JSON.stringify(prodotti)}
Favourite product/shop combinations (list them first when available): ${JSON.stringify(preferiti || [])}
Combinations to AVOID (never propose them): ${JSON.stringify(evitati || [])}

For each product find where to buy it at the best price within the radius: supermarkets, discount stores, drugstores,
using current flyers, chain websites and online grocery prices of that country. Give 2 to 4 options per product, cheapest first,
for a typical pack (state brand/size in "nota" if relevant). Mark "offerta": true for promotions valid today.
unita must be one of: lavaggi, litri, kg, pezzi.

Format:
{"prodotti":[{"id":"same id as input","nome":"name","opzioni":[{"negozio":"shop name","prezzo":number,"prezzoUnit":number or null,
"unita":"lavaggi|litri|kg|pezzi","offerta":true|false,"validoFino":"short local date" or null,"fonte":"url","nota":"max one short sentence or empty"}]}]}`;
  const j = await ask(SYS(lingua), prompt, opts);
  return Array.isArray(j.prodotti) ? j.prodotti : [];
}
