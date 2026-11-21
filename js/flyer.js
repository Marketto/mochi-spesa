// Lettura dei volantini (PDF o foto) con OCR nel browser: tesseract.js + pdf.js, caricati solo quando servono.
// Il file non lascia il telefono: si scaricano solo le librerie e il modello della lingua dal CDN.
import { matches } from "./openprices.js";

const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
export const MAX_PAGES = 24;

// lingua dell'app → modello Tesseract
const OCR_LANG = { it: "ita", en: "eng", es: "spa", fr: "fra", de: "deu", pt: "por", nl: "nld", pl: "pol", ro: "ron", cs: "ces", sk: "slk", sl: "slv", hr: "hrv",
  hu: "hun", bg: "bul", el: "ell", sv: "swe", da: "dan", fi: "fin", et: "est", lv: "lav", lt: "lit", ga: "gle", mt: "mlt", ru: "rus", zh: "chi_sim", ja: "jpn", ko: "kor", ar: "ara" };
export const ocrLang = l => OCR_LANG[l] || "eng";

function loadScript(src) {
  return new Promise((ok, ko) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement("script"); s.src = src; s.async = true; s.crossOrigin = "anonymous";
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
    for (let i = 1; i <= n; i++) {
      onProgress?.({ step: "page", page: i, pages: n });
      const page = await doc.getPage(i), vp = page.getViewport({ scale: 2 });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      // un PDF con testo vero non ha bisogno di OCR
      const tc = await page.getTextContent(); const txt = tc.items.map(x => x.str + (x.hasEOL ? "\n" : " ")).join("");
      yield txt.replace(/\s/g, "").length > 200 ? { text: txt } : { image: c };
    }
  } else { onProgress?.({ step: "page", page: 1, pages: 1 }); yield { image: file }; }
}

/** Testo del volantino. onProgress({step, page, pages, p}) per la barra di avanzamento. */
export async function readFlyer(file, lang, onProgress) {
  let worker = null, out = "";
  try {
    for await (const pg of pages(file, onProgress)) {
      if (pg.text) { out += pg.text + "\f"; continue; }
      if (!worker) {
        onProgress?.({ step: "load" });
        await loadScript(TESS);
        worker = await window.Tesseract.createWorker(lang, 1, { logger: m => m.status === "recognizing text" && onProgress?.({ step: "ocr", p: m.progress }) });
      }
      const { data } = await worker.recognize(pg.image);
      out += data.text + "\f";
    }
  } finally { await worker?.terminate(); }
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
    out.push({ prezzo: v, perUnita: PER_UNIT.test(line.slice(m.index + m[0].length, m.index + m[0].length + 12)) || /€\s*\/\s*(kg|l)/i.test(m[0]) });
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
