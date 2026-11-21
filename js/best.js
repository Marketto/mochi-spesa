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
export function rank(rows) {
  const seen = new Set(), list = [];
  for (const r0 of rows) {
    if (!r0 || !(r0.prezzo > 0) || !r0.nome) continue;
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

// parole che nei volantini si scrivono in modi diversi
const SYN = [
  ["pod", "pods", "capsule", "capsula", "caps", "pastiglie", "pastiglia", "tabs", "tablet", "monodose"],
  ["detersivo", "detergente"], ["ammorbidente", "morbidezza"], ["carta igienica", "rotoli"],
  ["lavastoviglie", "lavapiatti"], ["lavatrice", "bucato"],
];
/** La ricerca e le sue varianti con sinonimi (al massimo 8), per trovare più prezzi salvati. */
export function variants(q) {
  const base = String(q || "").toLowerCase().trim(), out = new Set([base]);
  for (const g of SYN) for (const w of g) {
    if (!new RegExp(`\\b${w}\\b`).test(base)) continue;
    for (const alt of g) if (alt !== w) out.add(base.replace(new RegExp(`\\b${w}\\b`), alt));
  }
  return [...out].slice(0, 8);
}
