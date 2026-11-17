// Importazione dispensa da Invendo (export .xlsx o .csv), tutto nel browser, senza librerie.
import { norm } from "./pantry.js";
import { catOf } from "./categories.js";

// ---------- lettura xlsx (zip + XML) ----------
async function unzip(buf) {
  const b = new Uint8Array(buf), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = b.length - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not-zip");
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true);
  const files = {}, dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
    const off = v.getUint32(p + 42, true), name = dec.decode(b.subarray(p + 46, p + 46 + nl));
    files[name] = { method, size, off }; p += 46 + nl + xl + cl;
  }
  return async name => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + v.getUint16(f.off + 26, true) + v.getUint16(f.off + 28, true);
    const raw = b.subarray(start, start + f.size);
    if (f.method === 0) return dec.decode(raw);
    const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(s).text();
  };
}
const unxml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([\da-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const texts = x => [...x.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => unxml(m[1])).join("");
const colIdx = ref => { let n = 0; for (const c of ref.replace(/\d+/g, "")) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };

/** Righe del primo foglio di un .xlsx, come array di array (stringhe o numeri). */
export async function readXlsx(buf) {
  const get = await unzip(buf);
  const ss = await get("xl/sharedStrings.xml");
  const shared = ss ? [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1])) : [];
  let sheet = await get("xl/worksheets/sheet1.xml");
  if (!sheet) {
    const wbRels = await get("xl/_rels/workbook.xml.rels") || "";
    const t = (wbRels.match(/Target="([^"]*worksheets\/[^"]+)"/) || [])[1];
    if (t) sheet = await get("xl/" + t.replace(/^\/?xl\//, ""));
  }
  if (!sheet) throw new Error("no-sheet");
  const rows = [];
  for (const r of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = c[1], body = c[2] || "";
      const ref = (a.match(/r="([A-Z]+\d+)"/) || [])[1], type = (a.match(/t="(\w+)"/) || [])[1];
      const val = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let x = "";
      if (type === "s") x = shared[+val] ?? "";
      else if (type === "inlineStr") x = texts(body);
      else if (type === "str" || type === "b" || type === "e") x = val != null ? unxml(val) : "";
      else if (val != null) x = Number(val);
      row[ref ? colIdx(ref) : row.length] = x;
    }
    rows.push(Array.from(row, x => x ?? ""));
  }
  return rows;
}

/** Righe di un CSV (virgola o punto e virgola, virgolette). */
export function readCsv(text) {
  text = text.replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "", sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

// ---------- interpretazione Invendo ----------
const HEAD = {
  posto: /luogo|conserv|location|storage|lieu|ort|lugar/i,
  cat: /categor|kategor/i,
  nome: /nome|name|article|artikel|nombre|item/i,
  scad: /scad|expir|best before|ablauf|mhd|caduc|péremption/i,
  qta: /quant|qty|menge|cantidad|anzahl/i,
};
const CAT_MAP = [[/pulizi|clean|putz|limpie|nettoy/i, "clean"], [/igien|hygien|cura|body|körper|higien/i, "body"], [/bevand|drink|getränk|bebid|boisson/i, "drinks"], [/surgel|frozen|tiefk|congel/i, "frozen"]];

/** Serial di Excel (giorni dal 1899-12-30) o testo → "AAAA-MM-GG", altrimenti "". */
export function toIsoDate(x) {
  if (typeof x === "number" && x > 20000 && x < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(x) * 864e5).toISOString().slice(0, 10);
  const s = String(x || "").trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
const fmtQty = q => { const n = Number(String(q).replace(",", ".")); return q === "" || q == null ? "" : Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(q).trim(); };
export const cleanName = s => String(s || "").split("|").map(x => x.trim()).filter(Boolean).join(" · ");

/** Da righe del foglio a prodotti: { nome, qta, cat, posto: [luogo, scaffale, ripiano], scad }. */
export function parseInvendo(rows) {
  const hi = rows.findIndex(r => r.some(c => HEAD.nome.test(String(c))) && r.some(c => HEAD.posto.test(String(c))));
  const head = hi >= 0 ? rows[hi].map(String) : [];
  const col = k => { const i = head.findIndex(h => HEAD[k].test(h)); return i; };
  const C = hi >= 0 ? { posto: col("posto"), cat: col("cat"), nome: col("nome"), scad: col("scad"), qta: col("qta") } : { posto: 0, cat: 1, nome: 2, scad: 3, qta: 4 };
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const nome = cleanName(r[C.nome]); if (!nome) continue;
    const posto = String(r[C.posto] ?? "").split("|").map(x => x.trim()).filter(Boolean);
    const catTxt = String(r[C.cat] ?? "");
    const fromInvendo = (CAT_MAP.find(([re]) => re.test(catTxt)) || [])[1];
    const byName = catOf(nome);
    const cat = fromInvendo || (byName !== "other" ? byName : /aliment|food|lebensm/i.test(catTxt) ? "pantry" : "other");
    out.push({ nome, qta: C.qta >= 0 ? fmtQty(r[C.qta]) : "", cat, posto: [posto[0] || "", posto[1] || "", posto.slice(2).join(" ")], scad: C.scad >= 0 ? toIsoDate(r[C.scad]) : "" });
  }
  return out;
}

/**
 * Piano di importazione rispetto allo stato attuale.
 * Ritorna { luoghi, add, upd, del, n }. I prodotti a quantità 0 (finiti) non vengono importati e, se c'erano, si tolgono.
 * Un prodotto già presente con lo stesso nome nello stesso posto viene aggiornato (quantità e scadenza da Invendo).
 */
export function planImport(prodotti, state, nameOf, uid) {
  const luoghi = {}; const live = Object.values(state.luoghi || {}).filter(l => !l.deleted);
  const findPlace = nome => {
    if (!nome) return live.find(l => l.base) || live[0];
    const n = norm(nome);
    return live.find(l => norm(nameOf(l)) === n || norm(l.nome) === n || norm(l.id) === n) || Object.values(luoghi).find(l => norm(l.nome) === n);
  };
  const touch = l => (luoghi[l.id] ||= { ...l, scaffali: (l.scaffali || []).map(s => ({ nome: s.nome, ripiani: [...(s.ripiani || [])] })) });
  const esistenti = Object.values(state.dispensa || {}).filter(d => !d.deleted);
  const add = [], upd = [], del = [];
  for (const p of prodotti) {
    let l = findPlace(p.posto[0]);
    if (!l) { const id = uid(); l = luoghi[id] = { id, nome: p.posto[0], ordine: live.length + Object.keys(luoghi).length, scaffali: [] }; }
    const [, sc, ri] = p.posto;
    if (sc) {
      const L = touch(l); let s = L.scaffali.find(x => norm(x.nome) === norm(sc));
      if (!s) { s = { nome: sc, ripiani: [] }; L.scaffali.push(s); }
      if (ri && !s.ripiani.some(r => norm(r) === norm(ri))) s.ripiani.push(ri);
    }
    const rec = { nome: p.nome, qta: p.qta, cat: p.cat, luogo: l.id, scaffale: sc, ripiano: ri, scad: p.scad };
    const ex = esistenti.find(d => norm(d.nome) === norm(p.nome) && d.luogo === l.id && (d.scaffale || "") === sc && (d.ripiano || "") === ri);
    if (p.qta === "0") { if (ex) del.push(ex.id); continue; } // finito in Invendo: non è in casa
    if (ex) upd.push({ id: ex.id, ...rec }); else add.push(rec);
  }
  // ripiani numerici in ordine naturale
  for (const L of Object.values(luoghi)) for (const s of L.scaffali) s.ripiani.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { luoghi, add, upd, del, n: add.length + upd.length };
}

/** Legge un File (xlsx o csv) e restituisce i prodotti Invendo. */
export async function readFile(file) {
  const isZip = /\.xlsx$/i.test(file.name) || /sheet/.test(file.type);
  const rows = isZip ? await readXlsx(await file.arrayBuffer()) : readCsv(await file.text());
  return parseInvendo(rows);
}
