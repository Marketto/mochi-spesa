// Adattatori HTTP: traducono una richiesta comune nel formato di ogni API e ne estraggono il testo.
//
// Tutte le chiamate partono dal browser (i servizi elencati in providers.js accettano CORS).
// Un errore HTTP diventa ApiError con stato e messaggio del servizio, così il router può decidere
// se mettere in pausa la chiave, il modello o passare al prossimo.

/** Errore restituito da un servizio IA. */
export class ApiError extends Error {
  /** @param {number} status @param {string} msg @param {number} [retry] secondi suggeriti dal servizio */
  constructor(status, msg, retry) { super(msg || "HTTP " + status); this.name = "ApiError"; this.status = status; this.retry = retry || 0; }
}
/** Errore di rete (nessuna risposta). */
export class NetError extends Error { constructor() { super("network"); this.name = "NetError"; } }

async function post(url, headers, body, signal) {
  let r;
  try { r = await fetch(url, { method: "POST", signal, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }
  catch (e) { if (e.name === "AbortError") throw e; throw new NetError(); }
  if (!r.ok) {
    let msg = "";
    try { const j = await r.json(); msg = j.error?.message || j.message || j.detail?.[0]?.msg || (typeof j.detail === "string" ? j.detail : "") || ""; } catch {}
    throw new ApiError(r.status, String(msg), +r.headers.get("retry-after") || 0);
  }
  return r.json();
}

/** Testo di una risposta in formato OpenAI (senza eventuali ragionamenti <think>). */
export const chatText = j => String(j?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "");
/** Testo della risposta dell'API Conversations di Mistral (stringa o blocchi). */
export function mistralText(j) {
  return (j.outputs || []).filter(o => o.type === "message.output").map(o =>
    typeof o.content === "string" ? o.content : (o.content || []).filter(c => c.type === "text").map(c => c.text).join("")).join("\n");
}

/**
 * @typedef {Object} Call
 * @property {string} provider   id del servizio
 * @property {import("./providers.js").Provider} P
 * @property {string} model
 * @property {string} key
 * @property {string} system
 * @property {string} prompt
 * @property {boolean} web       usare la ricerca web
 * @property {AbortSignal} [signal]
 */

// ---------- API compatibili OpenAI (Groq, Qwen, OpenRouter, SiliconFlow) ----------
async function openai({ provider, P, model, key, system, prompt, web, signal }) {
  const body = { model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] };
  if (provider === "groq") {
    // i modelli GPT-OSS ragionano: poco ragionamento, molto spazio per la risposta; ricerca con browser_search
    body.max_completion_tokens = 8192;
    if (/gpt-oss/.test(model)) body.reasoning_effort = "low";
    if (web) { body.tools = [{ type: "browser_search" }]; body.tool_choice = "required"; }
  } else {
    body.temperature = 0.2; body.max_tokens = 6000;
    if (provider === "qwen" && web) body.enable_search = true;
  }
  return chatText(await post(P.base + "/chat/completions", { authorization: "Bearer " + key }, body, signal));
}

// ---------- Mistral: Conversations con lo strumento web_search; chat normale senza web ----------
async function mistral(c) {
  if (!c.web) return openai({ ...c, provider: "mistral" });
  const j = await post(c.P.base + "/conversations", { authorization: "Bearer " + c.key },
    { model: c.model, instructions: c.system, inputs: c.prompt, tools: [{ type: "web_search" }], store: false, completion_args: { temperature: 0.2, max_tokens: 6000 } }, c.signal);
  return mistralText(j);
}

// ---------- Anthropic Messages, con lo strumento web_search lato server ----------
async function anthropic({ model, key, system, prompt, web, signal }) {
  const messages = [{ role: "user", content: prompt }];
  for (let turn = 0; turn < 4; turn++) {
    const j = await post("https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      { model, max_tokens: 6000, system, messages, ...(web ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10,
        user_location: { type: "approximate", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }] } : {}) }, signal);
    if (j.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: j.content }); continue; } // ricerca lunga: si continua
    return j.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  }
  throw new ApiError(408, "too long");
}

const ADAPTERS = { openai, mistral, anthropic };
/** Esegue una chiamata con l'adattatore del servizio e restituisce il testo della risposta. */
export const call = c => ADAPTERS[c.P.api](c);
