// Lettura dei volantini (PDF o foto) con OCR nel browser: tesseract.js + pdf.js, caricati solo quando servono.
// Il file non lascia il telefono: dal CDN si scaricano solo il motore OCR e il modello della lingua.
import { matches } from "./openprices.js";

// librerie servite dal sito (vendor/, versioni fisse); dal CDN solo il motore WebAssembly a versione fissa e i dati delle lingue
const TESS = new URL("../vendor/tesseract/tesseract.min.js", import.meta.url).href;
const TESS_WORKER = new URL("../vendor/tesseract/worker.min.js", import.meta.url).href;
const TESS_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0";
const PDFJS = new URL("../vendor/pdfjs/pdf.min.mjs", import.meta.url).href;
const PDFJS_WORKER = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
export const MAX_PAGES = 24;

// lingua dell'app → modello Tesseract
const OCR_LANG = { it: "ita", en: "eng", es: "spa", fr: "fra", de: "deu", pt: "por", nl: "nld", pl: "pol", ro: "ron", cs: "ces", sk: "slk", sl: "slv", hr: "hrv",
  hu: "hun", bg: "bul", el: "ell", sv: "swe", da: "dan", fi: "fin", et: "est", lv: "lav", lt: "lit", ga: "gle", mt: "mlt", ru: "rus", zh: "chi_sim", ja: "jpn", ko: "kor", ar: "ara",
  be: "bel", bs: "bos", ca: "cat", eu: "eus", gl: "glg", is: "isl", lb: "ltz", mk: "mkd", no: "nor", sq: "sqi", sr: "srp", tr: "tur", uk: "ukr" };
export const ocrLang = l => OCR_LANG[l] || "eng";

function loadScript(src) {
  return new Promise((ok, ko) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script"); s.src = src; s.async = true;
    s.onload = () => ok(); s.onerror = () => ko(new Error("load " + src)); document.head.append(s);
  });
}

/** Immagini (canvas o file) da un PDF o da una foto. */
async function* pages(file, onProgress) {
  if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import(/* @vite-ignore */ PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const n = Math.min(doc.numPages, MAX_PAGES);
    try { for (let i = 1; i <= n; i++) {
      onProgress?.({ step: "page", page: i, pages: n });
      const page = await doc.getPage(i);
      // un PDF con testo vero non ha bisogno di OCR: si disegna la pagina solo quando serve
      const tc = await page.getTextContent(); const txt = tc.items.map(x => x.str + (x.hasEOL ? "\n" : " ")).join("");
      if (txt.replace(/\s/g, "").length > 200) { yield { text: txt }; continue; }
      const vp = page.getViewport({ scale: 2 }), c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      yield { image: c };
    } } finally { doc.destroy(); } // libera memoria e worker di pdf.js
  } else { onProgress?.({ step: "page", page: 1, pages: 1 }); yield { image: file }; }
}

/** Testo del volantino. onProgress({step, page, pages, p}) per la barra di avanzamento. */
let reading = 0;
/** Lettura di un volantino in corso (per avvisare prima di chiudere la pagina). */
export const busy = () => reading > 0;
export async function readFlyer(file, lang, onProgress) {
  let worker = null, out = "";
  reading++;
  try {
    for await (const pg of pages(file, onProgress)) {
      if (pg.text) { out += pg.text + "\f"; continue; }
      if (!worker) {
        onProgress?.({ step: "load" });
        await loadScript(TESS);
        worker = await window.Tesseract.createWorker(lang, 1, { workerPath: TESS_WORKER, corePath: TESS_CORE, logger: m => m.status === "recognizing text" && onProgress?.({ step: "ocr", p: m.progress }) });
      }
      const { data } = await worker.recognize(pg.image);
      out += data.text + "\f";
    }
  } finally {
    reading--; await worker?.terminate(); }
  return out;
}

// ---------- prezzi nel testo ----------
// 1,99 € · €1.99 · 1,99€ · 1 99,€ (euro e centesimi staccati nei volantini) · 0,99/kg
const PRICE = /(?:€\s*)?(\d{1,3})\s?[,.](\d{2})\s?€?(?!\d)|(\d{1,3})\s(\d{2}),?\s?€/g;
const PER_UNIT = /^\s*(?:€\s*)?\/?\s*(?:al\s+)?(kg|l|lt|litro|pz|lavaggio|lav)\b/i;

/** Prezzi trovati in una riga: [{ prezzo, perUnita }]. */
export function pricesIn(line) {
  const out = [];
  for (const m of line.matchAll(PRICE)) {
    const v = m[1] != null ? +`${m[1]}.${m[2]}` : +`${m[3]}.${m[4]}`;
    if (!(v > 0 && v < 1000)) continue;
    out.push({ prezzo: v, perUnita: PER_UNIT.test(line.slice(m.index + m[0].length, m.index + m[0].length + 12)) });
  }
  return out;
}

/**
 * Per ogni prodotto cercato, le righe del volantino che lo nominano e il prezzo più vicino
 * (stessa riga o fino a 4 righe sotto). Ritorna [{ nome, riga, prezzo, perUnita }].
 */
export function findProducts(text, nomi) {
  const lines = String(text).split(/\r?\n|\f/).map(l => l.trim()).filter(Boolean), out = [];
  for (const nome of nomi) {
    const seen = new Set();
    for (let i = 0; i < lines.length; i++) {
      if (!matches(nome, lines[i])) continue;
      let pr = null, ctx = [lines[i]];
      for (let k = i; k < Math.min(lines.length, i + 5) && !pr; k++) {
        if (k > i) ctx.push(lines[k]);
        const ps = pricesIn(lines[k]); const main = ps.find(p => !p.perUnita) || null;
        if (main) {
          const u = ps.find(p => p.perUnita) || (k + 1 < lines.length ? pricesIn(lines[k + 1]).find(p => p.perUnita) : null);
          pr = { ...main, unit: u ? u.prezzo : null };
        }
      }
      if (!pr) continue;
      const key = pr.prezzo + "|" + lines[i];
      if (seen.has(key)) continue; seen.add(key);
      out.push({ nome, riga: ctx.join(" · ").slice(0, 140), prezzo: pr.prezzo, prezzoUnit: pr.unit });
    }
  }
  return out;
}

/** Miglior prezzo noto (ancora valido o degli ultimi `giorni`) per un prodotto, dai volantini salvati. */
export function bestSaved(nome, prezzi, oggi = new Date().toISOString().slice(0, 10), giorni = 120) {
  const limite = new Date(Date.now() - giorni * 864e5).toISOString().slice(0, 10);
  return prezzi.filter(p => matches(nome, p.nome) || matches(p.nome, nome))
    .filter(p => (p.validoFino && p.validoFino >= oggi) || (p.data || "") >= limite)
    .sort((a, b) => a.prezzo - b.prezzo);
}
