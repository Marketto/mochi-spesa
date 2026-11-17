// Prezzi gratuiti da Open Prices (Open Food Facts): segnalati dalla community, dati ODbL. Nessuna chiave.
import { norm } from "./pantry.js";

const API = "https://prices.openfoodfacts.org/api/v1/prices";
export const SITE = "https://prices.openfoodfacts.org";
export const priceUrl = id => `${SITE}/prices/${encodeURIComponent(id)}`;
let cache = null;

const STOP = new Set(["di", "da", "per", "con", "del", "della", "dei", "delle", "al", "alla", "the", "and", "for", "with", "de", "la", "le", "les", "und", "mit"]);
/** Parole utili della ricerca (min 3 lettere, senza articoli). */
export const words = q => norm(q).replace(/[^\p{L}\p{N} ]+/gu, " ").split(" ").filter(w => w.length >= 3 && !STOP.has(w));

/** Il prodotto segnalato corrisponde alla ricerca? Tutte le parole devono comparire (anche al plurale). */
export function matches(query, text) {
  const ws = words(query); if (!ws.length) return false;
  const toks = norm(text).replace(/[^\p{L}\p{N} ]+/gu, " ").split(" ").filter(Boolean);
  return ws.every(w => { const r = w.slice(0, Math.max(4, w.length - 2)); return toks.some(t => t.startsWith(r)); });
}

/** Da un record dell'API a un oggetto semplice. */
export function simplify(x) {
  const p = x.product || {}, l = x.location || {};
  const cat = x.category_tag ? x.category_tag.replace(/^\w\w:/, "").replace(/-/g, " ") : "";
  return {
    id: x.id, nome: p.product_name || x.product_name || cat, marca: p.brands || "",
    quantita: p.product_quantity || null, unitaQ: (p.product_quantity_unit || "").toLowerCase(),
    prezzo: x.price, valuta: x.currency || "EUR", sconto: !!x.price_is_discounted, data: x.date || (x.created || "").slice(0, 10),
    negozio: l.osm_brand || l.osm_name || "", citta: l.osm_address_city || "",
  };
}

/** Prezzi entro raggioKm da lat/lon (ultimi 2 anni), con cache di un'ora. */
export async function nearby({ lat, lon, raggioKm }, { signal } = {}) {
  const key = [(+lat).toFixed(2), (+lon).toFixed(2), raggioKm].join(",");
  if (cache && cache.key === key && Date.now() - cache.at < 3600e3) return cache.items;
  const since = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10), out = [];
  for (let page = 1; page <= 10; page++) {
    const u = `${API}?lat=${(+lat).toFixed(2)}&lon=${(+lon).toFixed(2)}&radius_km=${raggioKm}&size=100&page=${page}&date__gte=${since}`;
    const r = await fetch(u, { signal });
    if (!r.ok) throw new Error("Open Prices: " + r.status);
    const d = await r.json();
    out.push(...(d.items || []).map(simplify).filter(p => p.nome && typeof p.prezzo === "number" && p.negozio));
    if (page >= (d.pages || 1)) break;
  }
  cache = { key, at: Date.now(), items: out };
  return out;
}

/** Prezzo per unità (kg o litri) se la quantità è nota in g/kg/ml/l. */
export function unitPrice(p, unita) {
  const q = +p.quantita; if (!q) return null;
  const u = p.unitaQ;
  if (unita === "kg" && (u === "g" || u === "kg")) return +(p.prezzo / (u === "g" ? q / 1000 : q)).toFixed(2);
  if (unita === "litri" && (u === "ml" || u === "cl" || u === "l")) return +(p.prezzo / (u === "ml" ? q / 1000 : u === "cl" ? q / 100 : q)).toFixed(2);
  return null;
}

/** Per un prodotto: il prezzo più recente per negozio, poi dal più economico. */
export function bestFor(query, prices, max = 5) {
  const per = new Map();
  for (const p of prices) {
    if (!matches(query, `${p.nome} ${p.marca}`)) continue;
    const k = norm(p.negozio), cur = per.get(k);
    if (!cur || p.data > cur.data || (p.data === cur.data && p.prezzo < cur.prezzo)) per.set(k, p);
  }
  return [...per.values()].sort((a, b) => a.prezzo - b.prezzo).slice(0, max);
}
