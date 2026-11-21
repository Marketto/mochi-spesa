// Stato condiviso e unione (merge) senza server.
// Ogni elemento ha un id e un updatedAt: vince la versione più recente (spareggio: "by", poi il JSON).
// Il formato del file è descritto in docs/sync-format.md.
// Le eliminazioni restano come "tombstone" (deleted: true) per 30 giorni,
// così non ricompaiono quando l'altro telefono sincronizza.

export const TOMBSTONE_MS = 30 * 24 * 3600 * 1000;
const MAPS = ["items", "monitor", "valutazioni", "dispensa", "luoghi", "preferenze", "prezzi", "volantini"];

export function emptyState() {
  return {
    schema: SCHEMA,
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
    volantini: {}, // volantini ufficiali già letti: { id, catena, nome, fine, url, letto }
    prezzi: {}, // prezzi letti dai volantini: { id, nome, riga, prezzo, prezzoUnit, negozio, validoFino, data }
    confronto: { prodotti: [], updatedAt: 0 },
    offerte: { list: [], updatedAt: 0 },
    settings: { luogo: "", raggioKm: 5, negozi: "", amazon: true, updatedAt: 0 },
  };
}

/** Versione del formato che questa app sa scrivere ("Mochi Sync Format", vedi docs/sync-format.md). */
export const SCHEMA = 1;
const SINGLE = ["offerte", "confronto", "settings"];

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const ts = v => (isObj(v) && typeof v.updatedAt === "number" && isFinite(v.updatedAt) ? v.updatedAt : null);
const canon = v => JSON.stringify(sortKeys(v));

/** Spareggio deterministico: updatedAt più alto, poi "by" più alto, poi JSON con chiavi ordinate più alto. */
export function pick(x, y) {
  if (x === undefined) return y;
  if (y === undefined) return x;
  const tx = ts(x) ?? 0, ty = ts(y) ?? 0;
  if (tx !== ty) return ty > tx ? y : x;
  const bx = isObj(x) && typeof x.by === "string" ? x.by : "", by = isObj(y) && typeof y.by === "string" ? y.by : "";
  if (bx !== by) return by > bx ? y : x;
  return canon(y) > canon(x) ? y : x;
}

/** Una mappa è un oggetto di elementi { id, updatedAt }. Un oggetto vuoto conta come mappa. */
export const isMap = v => isObj(v) && Object.values(v).every(e => isObj(e) && ts(e) !== null);

function mergeMap(a, b, now) {
  a = isObj(a) ? a : {}; b = isObj(b) ? b : {};
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const win = pick(a[id], b[id]);
    if (isObj(win) && win.deleted && now - (ts(win) ?? 0) > TOMBSTONE_MS) continue;
    out[id] = win;
  }
  return out;
}
// chiavi non-mappa sconosciute: vince updatedAt più alto; se manca, vince il remoto
function mergeOther(x, y) {
  if (x === undefined) return y;
  if (y === undefined) return x;
  if (ts(x) === null || ts(y) === null) return y;
  return pick(x, y);
}
const schemaOf = s => (isObj(s) && Number.isInteger(s.schema) && s.schema > 0 ? s.schema : 1);

/**
 * Unisce due stati (local, remote). Puro e deterministico: l'unico input esterno è "now",
 * usato per togliere i tombstone più vecchi di 30 giorni. Conserva le chiavi e i campi sconosciuti.
 */
export function merge(local, remote, now = Date.now()) {
  if (!isObj(remote)) return normalize(local);
  if (!isObj(local)) return normalize(remote);
  const out = { schema: Math.max(schemaOf(local), schemaOf(remote)) };
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    if (k === "schema") continue;
    const x = local[k], y = remote[k];
    if (MAPS.includes(k)) out[k] = mergeMap(x, y, now);
    else if (SINGLE.includes(k)) out[k] = pick(x, y);
    else if ((x === undefined || isMap(x)) && (y === undefined || isMap(y))) out[k] = mergeMap(x, y, now);
    else out[k] = mergeOther(x, y);
  }
  return out;
}

/** false se lo stato viene da una versione del formato più nuova di questa app: allora si legge e non si scrive. */
export const canWrite = s => schemaOf(s) <= SCHEMA;

/** Riempie le parti mancanti. Non toglie mai chiavi o campi sconosciuti e non abbassa schema. */
export function normalize(s) {
  const e = emptyState();
  if (!isObj(s)) return e;
  return {
    ...s,
    schema: Math.max(schemaOf(s), SCHEMA),
    items: obj(s.items), monitor: s.monitor ? obj(s.monitor) : e.monitor, valutazioni: obj(s.valutazioni),
    dispensa: obj(s.dispensa), luoghi: s.luoghi && Object.keys(s.luoghi).length ? obj(s.luoghi) : e.luoghi, preferenze: obj(s.preferenze), prezzi: obj(s.prezzi), volantini: obj(s.volantini),
    confronto: s.confronto && Array.isArray(s.confronto.prodotti) ? s.confronto : e.confronto,
    offerte: s.offerte && Array.isArray(s.offerte.list) ? s.offerte : e.offerte,
    settings: { ...e.settings, ...(s.settings || {}) },
  };
}

/** Segna con "by" ogni elemento (e oggetto in cima) modificato in questo istante. */
export function stamp(state, now, by) {
  for (const [k, v] of Object.entries(state)) {
    if (!isObj(v)) continue;
    if (ts(v) === now) state[k] = { ...v, by };
    else if (MAPS.includes(k) || isMap(v)) for (const [id, el] of Object.entries(v)) if (ts(el) === now && el.by !== by) v[id] = { ...el, by };
  }
  return state;
}
const obj = v => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/** true se i due stati hanno lo stesso contenuto. */
export const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
export function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
  return v;
}

export const live = map => Object.values(map || {}).filter(x => !x.deleted);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
