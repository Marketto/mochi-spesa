// «Trova il prezzo migliore»: unisce i risultati di più fonti per un solo prodotto
// e li ordina per prezzo a unità (al pezzo/lavaggio, al kg o al litro).
import { norm } from "./pantry.js";

const N = s => parseFloat(String(s).replace(",", "."));
// pezzi e lavaggi si confrontano tra loro (una pastiglia = un lavaggio)
export const groupOf = u => (u === "kg" ? "kg" : u === "litri" ? "litri" : u === "lavaggi" || u === "pezzi" ? "n" : null);

/** Quantità dal nome: "30 pz", "x40", "40 lavaggi", "1,5 kg", "3x750 ml" → { q, unita }. */
export function qtyOf(text) {
  const s = " " + String(text || "").toLowerCase().replace(/(\d),(\d)/g, "$1.$2") + " ";
  let m = s.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(ml|cl|l|lt|g|gr|kg)\b/);
  let k = 1;
  if (m) { k = +m[1]; m = [m[0], m[2], m[3]]; } else m = s.match(/(\d+(?:\.\d+)?)\s*(ml|cl|l|lt|litri|g|gr|grammi|kg)\b/);
  if (m) {
    const q = +m[1] * k, u = m[2];
    if (/^(ml)$/.test(u)) return { q: q / 1000, unita: "litri" };
    if (u === "cl") return { q: q / 100, unita: "litri" };
    if (/^(l|lt|litri)$/.test(u)) return { q, unita: "litri" };
    if (/^(g|gr|grammi)$/.test(u)) return { q: q / 1000, unita: "kg" };
    return { q, unita: "kg" };
  }
  m = s.match(/(\d+)\s*(lavaggi|lav\.?|misurini)\b/);
  if (m) return { q: +m[1], unita: "lavaggi" };
  m = s.match(/(\d+)\s*(pz|pezzi|pcs|capsule|caps|pastiglie|tabs?|tablets?|pods?|monodose|bustine|rotoli|unità)\b/) || s.match(/\b[x×]\s*(\d+)\b/) || s.match(/\b(\d+)\s*[x×]\s/);
  if (m && +m[1] > 1 && +m[1] < 1000) return { q: +m[1], unita: "pezzi" };
  return null;
}

/** Completa prezzoUnit/unita di una riga se mancano. */
export function withUnit(r) {
  if (r.prezzoUnit > 0 && groupOf(r.unita)) return r;
  const q = r.quantita > 0 && groupOf(r.unita) ? { q: N(r.quantita), unita: r.unita } : qtyOf(r.nome);
  if (!q || !(q.q > 0)) return { ...r, prezzoUnit: null };
  return { ...r, unita: q.unita, prezzoUnit: Math.round((r.prezzo / q.q) * 1000) / 1000 };
}

/**
 * Ordina le righe: prima quelle con l'unità più comune, per prezzo a unità; poi le altre per prezzo.
 * Toglie i doppioni (stesso negozio, stesso nome, stesso prezzo).
 */
export function rank(rows, q = "") {
  const seen = new Set(), list = [];
  for (const r0 of rows) {
    if (!r0 || !(r0.prezzo > 0) || !r0.nome) continue;
    if (q && !sameType(q, r0.nome)) continue; // formato diverso da quello cercato
    const r = withUnit(r0), k = [norm(r.negozio || ""), norm(r.nome), r.prezzo].join("|");
    if (seen.has(k)) continue; seen.add(k); list.push(r);
  }
  const count = {};
  for (const r of list) { const g = groupOf(r.unita); if (g && r.prezzoUnit) count[g] = (count[g] || 0) + 1; }
  const main = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const inMain = r => main && groupOf(r.unita) === main && r.prezzoUnit > 0;
  return {
    gruppo: main,
    righe: [...list.filter(inMain).sort((a, b) => a.prezzoUnit - b.prezzoUnit || a.prezzo - b.prezzo),
      ...list.filter(r => !inMain(r)).sort((a, b) => a.prezzo - b.prezzo)],
  };
}

/** Testo condiviso da un'altra app (es. Amazon: "Titolo prodotto https://amzn.eu/d/…") → { q, url }. */
export function fromShare(title, text, url) {
  const all = [title, text, url].filter(Boolean).join(" ");
  const link = (all.match(/https?:\/\/\S+/) || [])[0] || "";
  const q = [title, text].filter(Boolean).join(" ").replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s*(guarda|dai un'occhiata a|check out|look at)[^:]*:\s*/i, "")
    .replace(/\s+/g, " ").trim().slice(0, 120);
  return { q, url: link };
}

// parole che nei volantini si scrivono in modi diversi (stesso formato di prodotto)
const SYN = [
  ["pod", "pods", "caps", "capsule", "capsula", "monodose"],
  ["pastiglie", "pastiglia", "tabs", "tablet", "compresse"],
  ["detersivo", "detergente"], ["ammorbidente", "morbidezza"], ["carta igienica", "rotoli"],
  ["lavastoviglie", "lavapiatti"], ["lavatrice", "bucato"],
];

// formati diversi dello stesso prodotto: chi cerca le pod non vuole le pastiglie
const FORMATS = {
  pod: /\b(pod|pods|caps|capsul[ae]|monodose|ecodos[ei])\b/i,
  tabs: /\b(pastigli[ae]|tabs?|tablets?|compresse)\b/i,
  gel: /\b(gel|liquido|liquid)\b/i,
  polvere: /\b(polvere|powder)\b/i,
};
/** Formati citati in un testo (es. "pod lavastoviglie" → ["pod"]). */
export const formatsOf = text => Object.keys(FORMATS).filter(f => FORMATS[f].test(String(text || "")));
/**
 * Il risultato è dello stesso formato cercato? Se chi cerca indica un formato (es. "pod"),
 * il risultato deve dirlo anche lui: "detersivo lavastoviglie 40 pz" non basta.
 */
export function sameType(q, nome) {
  const a = formatsOf(q), b = formatsOf(nome);
  return !a.length || a.some(f => b.includes(f));
}

const AGGR = /^(doveconviene|promoqui|volantinofacile|tiendeo|shopfully|volantino)\b\s*[(:–—-]?\s*/i;
/** Nome della catena senza l'aggregatore: "DoveConviene (Penny)" → "Penny". */
export function chainName(negozio) {
  const s = String(negozio || "").trim();
  if (!AGGR.test(s)) return s;
  return s.replace(AGGR, "").replace(/[)\s]+$/, "").trim() || s;
}

/**
 * Tiene solo i negozi fisici entro il raggio: distanza dichiarata non oltre il raggio e,
 * se conosciamo le catene della zona (OpenStreetMap), catena presente nella zona.
 * Gli acquisti online (Amazon, spesa a domicilio) restano sempre.
 */
export function inRange(r, raggioKm, catene, same = (a, b) => a.toLowerCase() === b.toLowerCase()) {
  if (r.online) return true;
  if (r.distanzaKm != null && +r.distanzaKm > raggioKm) return false;
  if (!catene || !catene.length) return true;
  const n = String(r.negozio || "").toLowerCase();
  return catene.some(c => same(c, r.negozio) || n.includes(c.toLowerCase()) || c.toLowerCase().includes(n));
}

/** La ricerca e le sue varianti con sinonimi (al massimo 8), per trovare più prezzi salvati. */
export function variants(q) {
  const base = String(q || "").toLowerCase().trim(), out = new Set([base]);
  for (const g of SYN) for (const w of g) {
    if (!new RegExp(`\\b${w}\\b`).test(base)) continue;
    for (const alt of g) if (alt !== w) out.add(base.replace(new RegExp(`\\b${w}\\b`), alt));
  }
  return [...out].slice(0, 8);
}

/** Parte di URL dal nome del prodotto: "Pod lavastoviglie" → "pod-lavastoviglie". */
export const slug = q => String(q || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
