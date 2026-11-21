// "I miei prezzi": piccolo database locale (IndexedDB) dei prezzi raccolti dall'utente per sé
// dai volantini che legge, dagli inserimenti a mano e dalle valutazioni. Resta solo sul telefono.
import { norm } from "./pantry.js";
import { matches } from "./openprices.js";

const DB = "mochi-prezzi", STORE = "prezzi";
let dbp = null, cache = null;
const hash = s => { let h = 5381; for (const c of s) h = (h * 33 + c.codePointAt(0)) >>> 0; return h.toString(36); };
export const recId = r => hash([norm(r.nome), norm(r.negozio || ""), r.prezzo, r.data || "", r.validoFino || ""].join("|"));

function open() {
  if (dbp) return dbp;
  dbp = new Promise((ok, ko) => {
    if (typeof indexedDB === "undefined") return ok(null);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { const s = req.result.createObjectStore(STORE, { keyPath: "id" }); s.createIndex("data", "data"); };
    req.onsuccess = () => ok(req.result); req.onerror = () => ko(req.error);
  }).catch(() => null);
  return dbp;
}
const tx = async (mode, fn) => {
  const db = await open(); if (!db) return null;
  return new Promise((ok, ko) => { const t = db.transaction(STORE, mode); const r = fn(t.objectStore(STORE)); t.oncomplete = () => ok(r?.result); t.onerror = () => ko(t.error); });
};

/** Pulisce e completa un record; null se non valido. */
export function clean(r, oggi = new Date().toISOString().slice(0, 10)) {
  const prezzo = typeof r.prezzo === "number" ? r.prezzo : parseFloat(String(r.prezzo).replace(",", "."));
  const nome = String(r.nome || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!nome || !(prezzo > 0 && prezzo < 10000)) return null;
  const out = { nome, prezzo: Math.round(prezzo * 100) / 100, negozio: String(r.negozio || "").trim().slice(0, 60), data: r.data || oggi,
    validoFino: r.validoFino || "", prezzoUnit: typeof r.prezzoUnit === "number" ? r.prezzoUnit : null, unita: r.unita || "", origine: r.origine || "manuale", fonte: r.fonte || "" };
  out.id = recId(out);
  return out;
}

/** Tutti i record (in memoria dopo la prima lettura). */
export async function all() {
  if (cache) return cache;
  cache = (await tx("readonly", s => s.getAll())) || [];
  return cache;
}
export const cached = () => cache || [];
export async function add(records) {
  const ok = records.map(r => clean(r)).filter(Boolean);
  if (!ok.length) return 0;
  await tx("readwrite", s => { for (const r of ok) s.put(r); });
  const cur = await all(), byId = new Map(cur.map(r => [r.id, r]));
  for (const r of ok) byId.set(r.id, r);
  cache = [...byId.values()];
  return ok.length;
}
export async function remove(id) { await tx("readwrite", s => s.delete(id)); cache = (await all()).filter(r => r.id !== id); }
export async function clear() { await tx("readwrite", s => s.clear()); cache = []; }
/** Toglie i record vecchi (default: più di 2 anni). */
export async function prune(giorni = 730) {
  const lim = new Date(Date.now() - giorni * 864e5).toISOString().slice(0, 10), old = (await all()).filter(r => r.data < lim);
  if (old.length) { await tx("readwrite", s => { for (const r of old) s.delete(r.id); }); cache = (await all()).filter(r => r.data >= lim); }
  return old.length;
}

/** Ricerca: record che nominano il prodotto, dal più recente. */
export function search(q, list = cached(), max = 200) {
  if (!String(q).trim()) return [];
  return list.filter(r => matches(q, r.nome)).sort((a, b) => (b.data || "").localeCompare(a.data || "") || a.prezzo - b.prezzo).slice(0, max);
}
/** Riassunto per negozio: prezzo minimo e ultimo visto. */
export function byStore(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = norm(r.negozio || "?"), cur = m.get(k) || { negozio: r.negozio || "?", min: r, ultimo: r, n: 0 };
    cur.n++; if (r.prezzo < cur.min.prezzo) cur.min = r; if ((r.data || "") > (cur.ultimo.data || "")) cur.ultimo = r;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => a.min.prezzo - b.min.prezzo);
}
/** Prezzi utili per oggi: ancora validi o visti negli ultimi `giorni`. */
export function recent(q, giorni = 60, oggi = new Date().toISOString().slice(0, 10)) {
  const lim = new Date(Date.now() - giorni * 864e5).toISOString().slice(0, 10);
  return search(q).filter(r => (r.validoFino ? r.validoFino >= oggi : (r.data || "") >= lim));
}

/** Senza IA: coppie nome → prezzo dal testo del volantino (meno precise). */
export function guessAll(text) {
  const lines = String(text).split(/\r?\n|\f/).map(l => l.trim()).filter(Boolean), out = [];
  const PRICE = /^(?:€\s*)?(\d{1,3})\s?[,.](\d{2})\s?€?$/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PRICE); if (!m) continue;
    const prev = []; for (let k = i - 1; k >= 0 && prev.length < 3; k--) { if (PRICE.test(lines[k]) || /€\s*\/|\/\s*(kg|l)\b|%/i.test(lines[k])) break; prev.unshift(lines[k]); }
    const nome = prev.join(" ").replace(/\s+/g, " ").trim();
    if (nome.length >= 4 && /\p{L}{3}/u.test(nome)) out.push({ nome: nome.slice(0, 120), prezzo: +`${m[1]}.${m[2]}` });
  }
  return out;
}
/** Divide il testo del volantino (pagine separate da \f) in pezzi da dare all'IA. */
export function chunks(text, max = 9000) {
  const pages = String(text).split("\f"), out = []; let cur = "";
  for (const p of pages) { if (cur && cur.length + p.length > max) { out.push(cur); cur = ""; } cur += (cur ? "\n" : "") + p.slice(0, max); }
  if (cur.trim()) out.push(cur);
  return out;
}
