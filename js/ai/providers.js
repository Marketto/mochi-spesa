// Catalogo dei servizi IA supportati e dei loro modelli.
//
// Ogni modello dichiara cosa sa fare (caps) e com'è (quality, speed, ctx).
// Il router (router.js) usa queste informazioni per scegliere, tra le chiavi configurate,
// il modello più adatto alla richiesta. Per aggiungere un servizio basta una voce qui
// (e, se l'API non è compatibile OpenAI, un adattatore in adapters.js).

/**
 * Capacità di un modello. Una richiesta con un tag "obbligatorio" (WEB) va solo ai modelli che lo hanno.
 * @readonly
 */
export const CAP = {
  WEB: "web",   // cerca sul web (prezzi attuali, volantini, Amazon)
  TEXT: "text", // lavora solo sul testo ricevuto
};

/**
 * Costo per l'utente: "free" (gratis con limiti), "quota" (credito gratuito iniziale), "paid" (a pagamento).
 * @typedef {"free"|"quota"|"paid"} Tier
 */

/**
 * @typedef {Object} Model
 * @property {string} id           id del modello per l'API
 * @property {string[]} caps       capacità (vedi CAP)
 * @property {1|2|3} quality       qualità delle risposte (3 = migliore)
 * @property {1|2|3} speed         velocità (3 = più veloce)
 * @property {number} ctx          contesto massimo, in migliaia di token
 */

/**
 * @typedef {Object} Provider
 * @property {string} nome         nome mostrato all'utente
 * @property {Tier} tier
 * @property {string} link         dove si crea la chiave
 * @property {"openai"|"mistral"|"anthropic"} api  formato dell'API (adattatore)
 * @property {string} [base]       URL base per le API compatibili OpenAI
 * @property {Model[]} models
 */

/** @type {Record<string, Provider>} */
export const PROVIDERS = {
  groq: {
    nome: "Groq", tier: "free", link: "https://console.groq.com/keys", api: "openai", base: "https://api.groq.com/openai/v1",
    // ricerca web con lo strumento browser_search dei modelli GPT-OSS (groq/compound è stato spento il 21/09/2026)
    models: [
      { id: "openai/gpt-oss-120b", caps: [CAP.WEB, CAP.TEXT], quality: 3, speed: 2, ctx: 131 },
      { id: "openai/gpt-oss-20b", caps: [CAP.WEB, CAP.TEXT], quality: 2, speed: 3, ctx: 131 },
    ],
  },
  mistral: {
    nome: "Mistral", tier: "free", link: "https://console.mistral.ai/api-keys", api: "mistral", base: "https://api.mistral.ai/v1",
    models: [
      { id: "mistral-medium-latest", caps: [CAP.WEB, CAP.TEXT], quality: 3, speed: 2, ctx: 128 },
      { id: "mistral-small-latest", caps: [CAP.WEB, CAP.TEXT], quality: 2, speed: 3, ctx: 128 },
    ],
  },
  qwen: {
    nome: "Qwen · Alibaba Cloud", tier: "quota", link: "https://modelstudio.console.alibabacloud.com/", api: "openai",
    base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-plus", caps: [CAP.WEB, CAP.TEXT], quality: 3, speed: 2, ctx: 128 },
      { id: "qwen-flash", caps: [CAP.WEB, CAP.TEXT], quality: 2, speed: 3, ctx: 128 },
    ],
  },
  openrouter: {
    nome: "OpenRouter (DeepSeek, Qwen, GLM…)", tier: "free", link: "https://openrouter.ai/settings/keys", api: "openai", base: "https://openrouter.ai/api/v1",
    models: [{ id: "openrouter/free", caps: [CAP.TEXT], quality: 2, speed: 2, ctx: 64 }],
  },
  siliconflow: {
    nome: "SiliconFlow (Qwen, GLM, DeepSeek)", tier: "free", link: "https://cloud.siliconflow.com/", api: "openai", base: "https://api.siliconflow.com/v1",
    models: [{ id: "Qwen/Qwen2.5-7B-Instruct", caps: [CAP.TEXT], quality: 1, speed: 3, ctx: 32 }],
  },
  claude: {
    nome: "Claude (Anthropic)", tier: "paid", link: "https://console.anthropic.com/settings/keys", api: "anthropic",
    models: [
      { id: "claude-sonnet-5-5", caps: [CAP.WEB, CAP.TEXT], quality: 3, speed: 2, ctx: 200 },
      { id: "claude-haiku-5-5", caps: [CAP.WEB, CAP.TEXT], quality: 2, speed: 3, ctx: 200 },
    ],
  },
};

/** Modelli spenti dai servizi: se una chiave li ha salvati come modello personale, vengono ignorati. */
export const RETIRED = new Set(["groq/compound", "groq/compound-mini", "compound-beta", "compound-beta-mini", "qwen/qwen3-32b", "qwen/qwen3.6-27b"]);

/** Il servizio sa cercare sul web con almeno un modello? */
export const canWeb = id => !!PROVIDERS[id]?.models.some(m => m.caps.includes(CAP.WEB));
