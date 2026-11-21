// Ponte locale tra le app di Marketto sullo stesso dominio (Kapibo ↔ Mochi Spesa).
// Nessun server: una "cassetta della posta" in localStorage, letta dall'altra app all'apertura
// o subito, se è aperta in un'altra scheda (evento "storage"). Stesso file in entrambi i repo.

export const KEY = "marketto.bridge";
const MAX = 20, TTL = 30 * 24 * 3600 * 1000;

const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };
function load() {
  try { const v = JSON.parse(ls()?.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function save(box) { try { ls()?.setItem(KEY, JSON.stringify(box)); return true; } catch { return false; } }
const fresh = (list, now) => (Array.isArray(list) ? list : []).filter(m => m && now - (m.ts || 0) < TTL);

/** Messaggi in attesa per un'app ("kapibo" | "mochi"), senza toglierli. */
export function peek(to, now = Date.now()) { return fresh(load()[to], now); }

/** Mette un messaggio nella cassetta dell'altra app. msg: { from, store?, date?, items: [{ name, qty?, amount? }] } */
export function send(to, msg, now = Date.now()) {
  const items = (msg.items || []).map(i => ({ name: String(i.name || "").trim().slice(0, 80), ...(i.qty ? { qty: +i.qty } : {}), ...(i.amount ? { amount: +i.amount } : {}) })).filter(i => i.name);
  if (!items.length) return false;
  const box = load();
  box[to] = [...fresh(box[to], now), { id: now.toString(36) + Math.random().toString(36).slice(2, 6), ts: now, from: msg.from, store: msg.store || "", date: msg.date || "", items }].slice(-MAX);
  return save(box);
}

/** Toglie dalla cassetta i messaggi indicati (o tutti) e li restituisce. */
export function take(to, ids = null, now = Date.now()) {
  const box = load(), all = fresh(box[to], now), out = ids ? all.filter(m => ids.includes(m.id)) : all;
  box[to] = ids ? all.filter(m => !ids.includes(m.id)) : [];
  save(box);
  return out;
}

/** L'altra app è stata usata su questo dispositivo? */
export const installed = app => { const s = ls(); if (!s) return false; return app === "mochi" ? s.getItem("mochi.state") !== null || s.getItem("mochi.seen") !== null : s.getItem("kapibo.legal") !== null; };

/** Chiama cb quando arriva posta per "to" da un'altra scheda aperta. */
export function listen(to, cb) {
  globalThis.addEventListener?.("storage", e => { if (e.key === KEY && peek(to).length) cb(); });
}
