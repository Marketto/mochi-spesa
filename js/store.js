// Stato condiviso e unione (merge) senza server.
// Ogni elemento ha un id e un updatedAt: vince la versione più recente.
// Le eliminazioni restano come "tombstone" (deleted: true) per 30 giorni,
// così non ricompaiono quando l'altro telefono sincronizza.

export const TOMBSTONE_MS = 30 * 24 * 3600 * 1000;
const MAPS = ["items", "monitor", "valutazioni", "dispensa", "luoghi", "preferenze"];

export function emptyState() {
  return {
    schema: 1,
    items: {},
    monitor: {
      "detersivo-lavatrice": { id: "detersivo-lavatrice", nome: "Detersivo lavatrice", unita: "lavaggi", updatedAt: 1 },
      "ammorbidente": { id: "ammorbidente", nome: "Ammorbidente", unita: "lavaggi", updatedAt: 1 },
    },
    valutazioni: {},
    // Dispensa: luoghi (nome vuoto = nome tradotto di default), con scaffali e ripiani
    dispensa: {},
    luoghi: {
      credenza: { id: "credenza", nome: "", base: true, ordine: 0, scaffali: [], updatedAt: 1 },
      cantina: { id: "cantina", nome: "", ordine: 1, scaffali: [], updatedAt: 1 },
    },
    preferenze: {}, // { id, prodotto, negozio, tipo: "preferito" | "evita" }
    confronto: { prodotti: [], updatedAt: 0 },
    offerte: { list: [], updatedAt: 0 },
    settings: { luogo: "", raggioKm: 5, negozi: "", amazon: true, updatedAt: 0 },
  };
}

function mergeMap(a = {}, b = {}, now) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id], y = b[id];
    const win = !x ? y : !y ? x : ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x);
    if (win.deleted && now - (win.updatedAt || 0) > TOMBSTONE_MS) continue;
    out[id] = win;
  }
  return out;
}
const newer = (x, y) => (!x ? y : !y ? x : ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x));

/** Unisce due stati. Puro e deterministico (tranne la pulizia dei tombstone). */
export function merge(local, remote, now = Date.now()) {
  if (!remote) return normalize(local);
  if (!local) return normalize(remote);
  const out = { schema: 1 };
  for (const k of MAPS) out[k] = mergeMap(local[k], remote[k], now);
  out.offerte = newer(local.offerte, remote.offerte) || { list: [], updatedAt: 0 };
  out.confronto = newer(local.confronto, remote.confronto) || { prodotti: [], updatedAt: 0 };
  out.settings = newer(local.settings, remote.settings) || emptyState().settings;
  return out;
}

export function normalize(s) {
  const e = emptyState();
  if (!s || typeof s !== "object") return e;
  return {
    schema: 1,
    items: obj(s.items), monitor: s.monitor ? obj(s.monitor) : e.monitor, valutazioni: obj(s.valutazioni),
    dispensa: obj(s.dispensa), luoghi: s.luoghi && Object.keys(s.luoghi).length ? obj(s.luoghi) : e.luoghi, preferenze: obj(s.preferenze),
    confronto: s.confronto && Array.isArray(s.confronto.prodotti) ? s.confronto : e.confronto,
    offerte: s.offerte && Array.isArray(s.offerte.list) ? s.offerte : e.offerte,
    settings: { ...e.settings, ...(s.settings || {}) },
  };
}
const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/** true se i due stati hanno lo stesso contenuto. */
export const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
  return v;
}

export const live = map => Object.values(map || {}).filter(x => !x.deleted);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
