// Negozi vicini da OpenStreetMap (Overpass API), raggruppati per insegna.
// Dati © collaboratori OpenStreetMap, licenza ODbL. Si invia solo il centro della zona e il raggio.
import { distKm } from "./geo.js";

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const CACHE = "mochi.shops";
const TTL = 7 * 86400000;
// tipi di negozio utili per la spesa; i piccoli alimentari solo vicino a casa (sono tantissimi)
const BIG = "supermarket|discount|chemist|variety_store|department_store|frozen_food|wholesale|cosmetics|household";
const SMALL = "convenience|greengrocer|butcher";

export function buildQuery(lat, lon, km) {
  const r = Math.round(Math.min(Math.max(km, 1), 30) * 1000), near = Math.min(r, 2000);
  const p = `${(+lat).toFixed(5)},${(+lon).toFixed(5)}`;
  return `[out:json][timeout:25];(nwr["shop"~"^(${BIG})$"](around:${r},${p});nwr["shop"~"^(${SMALL})$"](around:${near},${p}););out tags center;`;
}

const clean = s => String(s || "").replace(/\s+/g, " ").trim();
const key = s => clean(s).toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");

/** Raggruppa gli elementi Overpass per insegna (brand, altrimenti nome): [{ nome, n, km }] dal più diffuso. */
export function group(elements, center) {
  const m = new Map();
  for (const e of elements || []) {
    const tg = e.tags || {}, nome = clean(tg.brand || tg.name);
    if (!nome || nome.length > 40) continue;
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const km = lat != null && center ? distKm(center, { lat, lon }) : null;
    const k = key(nome); if (!k) continue;
    const g = m.get(k) || { nome, n: 0, km: null };
    g.n++; if (km != null && (g.km == null || km < g.km)) g.km = km;
    m.set(k, g);
  }
  return [...m.values()].map(g => ({ ...g, km: g.km == null ? null : Math.round(g.km * 10) / 10 }))
    .sort((a, b) => b.n - a.n || (a.km ?? 99) - (b.km ?? 99) || a.nome.localeCompare(b.nome));
}

export const sameShop = (a, b) => key(a) === key(b);

/** Negozi entro raggioKm da lat/lon. Cache di 7 giorni sul telefono per non pesare sui server di OpenStreetMap. */
export async function nearby({ lat, lon, raggioKm }, { signal, fetchFn = fetch } = {}) {
  const id = [(+lat).toFixed(3), (+lon).toFixed(3), raggioKm].join(",");
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(CACHE)) || {}; } catch {}
  if (cache.id === id && Date.now() - cache.at < TTL) return cache.list;
  const body = new URLSearchParams({ data: buildQuery(lat, lon, raggioKm) });
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const r = await fetchFn(url, { method: "POST", body, signal });
      if (!r.ok) throw new Error("overpass " + r.status);
      const list = group((await r.json()).elements, { lat: +lat, lon: +lon });
      try { localStorage.setItem(CACHE, JSON.stringify({ id, at: Date.now(), list })); } catch {}
      return list;
    } catch (e) { if (e.name === "AbortError") throw e; lastErr = e; }
  }
  throw lastErr;
}
