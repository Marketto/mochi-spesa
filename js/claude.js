// Ricerche e valutazioni con l'IA: più servizi (anche gratuiti) e più chiavi, scelti in automatico.
// Chiamate dirette dal browser: le chiavi restano sul telefono (o nel file Dropbox di famiglia, se condivise).
import { t } from "./i18n.js";

// ---------- servizi supportati ----------
// free: "free" (gratis con limiti), "quota" (credito gratuito iniziale), "paid". web: sa cercare sul web.
export const PROVIDERS = {
  mistral: { nome: "Mistral", free: "free", web: true, link: "https://console.mistral.ai/api-keys",
    models: { web: "mistral-medium-latest", text: "mistral-small-latest" } },
  groq: { nome: "Groq", free: "free", web: true, link: "https://console.groq.com/keys",
    base: "https://api.groq.com/openai/v1", models: { web: "groq/compound", text: "qwen/qwen3-32b" } },
  qwen: { nome: "Qwen · Alibaba Cloud", free: "quota", web: true, link: "https://modelstudio.console.alibabacloud.com/",
    base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", models: { web: "qwen-plus", text: "qwen-flash" } },
  openrouter: { nome: "OpenRouter (DeepSeek, Qwen, GLM…)", free: "free", web: false, link: "https://openrouter.ai/settings/keys",
    base: "https://openrouter.ai/api/v1", models: { text: "openrouter/free" } },
  siliconflow: { nome: "SiliconFlow (Qwen, GLM, DeepSeek)", free: "free", web: false, link: "https://cloud.siliconflow.com/",
    base: "https://api.siliconflow.com/v1", models: { text: "Qwen/Qwen2.5-7B-Instruct" } },
  claude: { nome: "Claude (Anthropic)", free: "paid", web: true, link: "https://console.anthropic.com/settings/keys",
    models: { web: "claude-sonnet-5-5", text: "claude-haiku-5-5" } },
};
export const DEFAULT_MODEL = PROVIDERS.claude.models.web;
const FREE_RANK = { free: 0, quota: 1, paid: 2 };

// ---------- chiavi (solo su questo telefono; facoltativamente condivise in famiglia via Dropbox) ----------
const LS = "mochi.ai", OLD = "mochi.claude", USE = "mochi.aiUse", COOL = "mochi.aiCool";
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const rid = () => Math.random().toString(36).slice(2, 10);
const keyId = k => k.provider + ":" + k.key.slice(-12);

function migrate() {
  if (localStorage.getItem(LS)) return;
  const o = ls(OLD, null); if (!o) return;
  const keys = [];
  if (o.keys) for (const [p, k] of Object.entries(o.keys)) if (k && PROVIDERS[p]) keys.push({ id: rid(), provider: p, key: k, model: (o.models || {})[p] || "" });
  if (o.key && !keys.some(k => k.key === o.key)) keys.push({ id: rid(), provider: "claude", key: o.key, model: o.model || "" });
  lsSet(LS, { keys });
}
let shared = [];
/** Chiavi condivise dal file Dropbox di famiglia (vecchio formato: un solo oggetto). */
export const setShared = c => { shared = (Array.isArray(c) ? c : c ? [c] : []).filter(k => k && k.key && PROVIDERS[k.provider]); };
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
export const ready = (web = true) => allKeys().some(k => !web || PROVIDERS[k.provider].web);

// ---------- uso e pause (per bilanciare) ----------
const today = () => new Date().toISOString().slice(0, 10);
const midnightUTC = () => { const d = new Date(); d.setUTCHours(24, 0, 0, 0); return d.getTime(); };
export function usage(k) { const u = ls(USE, {}); return u.date === today() ? (u.n || {})[keyId(k)] || 0 : 0; }
function countUse(k) { let u = ls(USE, {}); if (u.date !== today()) u = { date: today(), n: {} }; u.n[keyId(k)] = (u.n[keyId(k)] || 0) + 1; lsSet(USE, u); }
export function cooling(k) { const c = ls(COOL, {})[keyId(k)]; return c && c.until > Date.now() ? c : null; }
function cool(k, ms, reason) { const c = ls(COOL, {}); c[keyId(k)] = { until: Date.now() + ms, reason }; lsSet(COOL, c); }

/** Ordine di prova per un compito: chi sa farlo, non in pausa, prima i gratuiti e i meno usati oggi. */
export function pick(web, keys = allKeys()) {
  return keys.filter(k => !web || PROVIDERS[k.provider].web)
    .filter(k => !cooling(k))
    .sort((a, b) => FREE_RANK[PROVIDERS[a.provider].free] - FREE_RANK[PROVIDERS[b.provider].free] || usage(a) - usage(b));
}

const err = (key, vars) => Object.assign(new Error(t(key, vars)), { code: key });
class ApiError extends Error { constructor(status, msg, retry) { super(msg || "HTTP " + status); this.status = status; this.retry = retry; } }

/**
 * Chiede al primo servizio adatto e, se è esaurito o in errore, passa al successivo.
 * web: il compito richiede la ricerca sul web.
 */
async function ask(system, prompt, opts = {}, { web = true } = {}) {
  const keys = pick(web);
  if (!keys.length) throw err(ready(web) ? "ai.allBusy" : "err.noKey");
  let last;
  for (const k of keys) {
    try {
      countUse(k);
      const text = await callProvider(k, system, prompt, web, opts);
      return extractJson(text);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      last = e;
      if (e instanceof ApiError) {
        const daily = /day|daily|quota|exceed|insufficient|balance|credit/i.test(e.message);
        if (e.status === 401 || e.status === 403) cool(k, 24 * 3600e3, "key");
        else if (e.status === 402 || (e.status === 429 && daily)) cool(k, midnightUTC() - Date.now(), "quota");
        else if (e.status === 429) cool(k, (e.retry || 120) * 1000, "rate");
        else if (e.status >= 500) cool(k, 60e3, "server");
        else cool(k, 3600e3, "error");
      } else if (e.code === "err.network") cool(k, 60e3, "network");
      // risposta non leggibile: si prova comunque il prossimo
    }
  }
  if (last instanceof ApiError) {
    if (last.status === 401 || last.status === 403) throw err("err.badKey");
    if (last.status === 429 || last.status === 402) throw err("err.rate");
    throw Object.assign(new Error(t("err.status", { status: last.status }) + (last.message ? ` – ${last.message.slice(0, 160)}` : "")), { code: "err.status" });
  }
  throw last || err("err.unreadable");
}

async function post(url, headers, body, signal) {
  let r;
  try { r = await fetch(url, { method: "POST", signal, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }
  catch (e) { if (e.name === "AbortError") throw e; throw err("err.network"); }
  if (!r.ok) {
    let msg = ""; try { const j = await r.json(); msg = j.error?.message || j.message || j.detail?.[0]?.msg || (typeof j.detail === "string" ? j.detail : "") || ""; } catch {}
    throw new ApiError(r.status, String(msg), +r.headers.get("retry-after") || 0);
  }
  return r.json();
}

async function callProvider(k, system, prompt, web, { signal } = {}) {
  const P = PROVIDERS[k.provider], model = k.model || P.models[web ? "web" : "text"] || P.models.text || P.models.web;
  if (k.provider === "claude") return askClaude(k.key, model, system, prompt, web, signal);
  if (k.provider === "mistral" && web) {
    const j = await post("https://api.mistral.ai/v1/conversations", { authorization: "Bearer " + k.key },
      { model, instructions: system, inputs: prompt, tools: [{ type: "web_search" }], store: false, completion_args: { temperature: 0.2, max_tokens: 6000 } }, signal);
    return mistralText(j);
  }
  const base = k.provider === "mistral" ? "https://api.mistral.ai/v1" : P.base;
  const body = { model, temperature: 0.2, max_tokens: 6000, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] };
  if (k.provider === "qwen" && web) body.enable_search = true;
  const j = await post(base + "/chat/completions", { authorization: "Bearer " + k.key }, body, signal);
  return chatText(j);
}
/** Testo di una risposta in formato OpenAI (senza eventuali ragionamenti <think>). */
export const chatText = j => String(j?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "");
/** Testo della risposta Mistral (stringa o blocchi). */
export function mistralText(j) {
  return (j.outputs || []).filter(o => o.type === "message.output").map(o =>
    typeof o.content === "string" ? o.content : (o.content || []).filter(c => c.type === "text").map(c => c.text).join("")).join("\n");
}

async function askClaude(key, model, system, prompt, web, signal) {
  const messages = [{ role: "user", content: prompt }];
  for (let turn = 0; turn < 4; turn++) {
    const j = await post("https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      { model, max_tokens: 6000, system, messages, ...(web ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10,
        user_location: { type: "approximate", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }] } : {}) }, signal);
    if (j.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: j.content }); continue; }
    return j.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  }
  throw err("err.tooLong");
}

export function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : String(text).slice(String(text).indexOf("{"), String(text).lastIndexOf("}") + 1);
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
export async function confrontaPrezzi({ prodotti, luogo, raggioKm, negozi, amazon, valuta, lingua, preferiti, evitati }, opts) {
  const oggi = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${oggi}. Home area: ${luogo}. Radius: ${raggioKm} km. Usual shops: ${negozi || "none"}. Currency: ${valuta}.
Shopping list (id, name, quantity): ${JSON.stringify(prodotti)}
Favourite product/shop combinations (list them first when available): ${JSON.stringify(preferiti || [])}
Combinations to AVOID (never propose them): ${JSON.stringify(evitati || [])}

For each product find where to buy it at the best price within the radius: supermarkets, discount stores, drugstores,
using current flyers, chain websites and online grocery prices of that country. Give 2 to 4 options per product, cheapest first,
for a typical pack (state brand/size in "nota" if relevant). Mark "offerta": true for promotions valid today.${amazon ? `
Also add Amazon (that country's Amazon store, delivered home) as one more option when it sells a comparable product: negozio "Amazon", fonte = the product page.` : ""}
unita must be one of: lavaggi, litri, kg, pezzi.

Format:
{"prodotti":[{"id":"same id as input","nome":"name","opzioni":[{"negozio":"shop name","prezzo":number,"prezzoUnit":number or null,
"unita":"lavaggi|litri|kg|pezzi","offerta":true|false,"validoFino":"short local date" or null,"fonte":"url","nota":"max one short sentence or empty"}]}]}`;
  const j = await ask(SYS(lingua), prompt, opts);
  return Array.isArray(j.prodotti) ? j.prodotti : [];
}

// ---------- compiti senza ricerca web (vanno bene anche i modelli gratuiti più semplici) ----------
const SYS_TEXT = lingua => `You are a careful grocery shopping assistant. You cannot browse the web: use ONLY the data given by the user,
plus general product knowledge where clearly stated as such. Never invent prices.
Write every human-readable text value in ${lingua}. Reply ONLY with valid JSON inside a \`\`\`json block.`;

/** Valuta un prezzo senza web, usando lo storico prezzi dell'utente. */
export async function valutaOffline({ testo, prezzo, quantita, unita, storico, valuta, lingua }, opts) {
  const prompt = `Product: ${testo}
Price seen: ${prezzo ? prezzo + " " + valuta : "not given"}${quantita ? `, quantity ${quantita} ${unita}` : ""}.
Prices the user collected (product, shop, price, unit price, date): ${JSON.stringify((storico || []).slice(0, 30))}

Compare the price seen with the collected prices (per unit when possible). If there is no comparable data, say so.
Format:
{"prodotto":"name","voto":"conveniente|nella media|caro","prezzo":number or null,"prezzoUnit":number or null,"unita":"lavaggi|litri|kg|pezzi",
"qualita":"short general note or empty","sintesi":"max 2 sentences","alternativa":"cheaper option from the collected prices or empty string","fonti":[]}`;
  return ask(SYS_TEXT(lingua), prompt, opts, { web: false });
}

/** Estrae prodotti e prezzi dal testo di una pagina di volantino. */
export async function estraiPrezzi({ testo, lingua }, opts) {
  const prompt = `Text of one page of a supermarket flyer (layout may be scrambled, names and prices can be on different lines):
"""
${String(testo).slice(0, 12000)}
"""
List every product with its selling price. Ignore unit prices (€/kg, €/l) except as prezzoUnit, ignore old crossed-out prices and discounts in %.
Format: {"prodotti":[{"nome":"product name with brand and size","prezzo":number,"prezzoUnit":number or null,"unita":"kg|litri|pezzi|lavaggi" or null}]}`;
  const j = await ask(SYS_TEXT(lingua), prompt, opts, { web: false });
  return (Array.isArray(j.prodotti) ? j.prodotti : []).filter(p => p && p.nome && typeof p.prezzo === "number" && p.prezzo > 0 && p.prezzo < 1000);
}
