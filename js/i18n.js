// Traduzioni: un file JSON piatto per lingua in locales/<codice>.json.
// Inglese = lingua di riserva per le chiavi mancanti.
// Nel markup: data-i18n="chiave" (testo) e data-i18n-attr="placeholder:chiave|aria-label:chiave".

export const LANGS = {
  bg: "Български", cs: "Čeština", da: "Dansk", de: "Deutsch", el: "Ελληνικά", en: "English",
  es: "Español", et: "Eesti", fi: "Suomi", fr: "Français", ga: "Gaeilge", hr: "Hrvatski",
  hu: "Magyar", it: "Italiano", lt: "Lietuvių", lv: "Latviešu", mt: "Malti", nl: "Nederlands",
  pl: "Polski", pt: "Português", ro: "Română", sk: "Slovenčina", sl: "Slovenščina", sv: "Svenska",
  ru: "Русский", zh: "简体中文", ja: "日本語", ko: "한국어", ar: "العربية",
  be: "Беларуская", bs: "Bosanski", ca: "Català", eu: "Euskara", gl: "Galego", is: "Íslenska", lb: "Lëtzebuergesch",
  mk: "Македонски", no: "Norsk bokmål", sq: "Shqip", sr: "Српски", tr: "Türkçe", uk: "Українська",
};
export const RTL = new Set(["ar"]);
const LOCALE = { zh: "zh-CN", pt: "pt-PT", en: "en-GB", no: "nb-NO", sr: "sr-Cyrl" };

let cur = "en", dict = {}, fallback = {};
const cache = {};

async function load(code) {
  if (!cache[code]) cache[code] = fetch(new URL(`../locales/${code}.json`, import.meta.url)).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return cache[code];
}

export function detect(saved) {
  if (saved && LANGS[saved]) return saved;
  for (const l of navigator.languages || [navigator.language || "en"]) {
    const c = (l || "").toLowerCase().split("-")[0];
    if (c === "nb" || c === "nn") return "no"; // norvegese: bokmål
    if (LANGS[c]) return c;
  }
  return "en";
}

export async function setLang(code) {
  if (!LANGS[code]) code = "en";
  [fallback, dict] = await Promise.all([load("en"), load(code)]);
  cur = code;
  const html = document.documentElement;
  html.lang = LOCALE[code] || code;
  html.dir = RTL.has(code) ? "rtl" : "ltr";
  apply(document);
}

/** Traduce una chiave sostituendo {segnaposto}. */
export function t(key, vars) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
/** Elenco di frasi separate da "|". */
export const list = key => t(key).split("|").map(s => s.trim()).filter(Boolean);

export function apply(root) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-attr]").forEach(el => {
    for (const pair of el.dataset.i18nAttr.split("|")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr, t(key));
    }
  });
}

export const lang = () => cur;
export const locale = () => LOCALE[cur] || cur;
export const langName = () => LANGS[cur];
