// Prezzi veri da Amazon e da Google Shopping (che raccoglie i negozi online) tramite SerpApi.
//
// Ogni utente usa la propria chiave SerpApi (piano gratuito: 250 ricerche al mese).
// Le ricerche restano in cache 24 ore sul telefono per non consumare la quota.
// La chiamata parte dal browser; se il browser la blocca (CORS) e il ponte Cloudflare è configurato, passa dal ponte.

import { via } from "./chains.js";
import { amazonHost } from "./amazon.js";

const LS = "mochi.serp", CACHE = "mochi.serpCache", USE = "mochi.serpUse";
const TTL = 24 * 3600e3;
const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const SIGNUP = "https://serpapi.com/users/sign_up";
export const KEY_PAGE = "https://serpapi.com/manage-api-key";

// ---------- chiave e uso del mese ----------
export const getKey = () => ls(LS, {}).key || "";
export const setKey = key => lsSet(LS, { key: String(key || "").trim() });
const month = () => new Date().toISOString().slice(0, 7);
export function used() { const u = ls(USE, {}); return u.m === month() ? u.n || 0 : 0; }
function countUse() { const u = ls(USE, {}); lsSet(USE, { m: month(), n: (u.m === month() ? u.n || 0 : 0) + 1 }); }

// ---------- paese ----------
/** Parametri SerpApi per il paese in cui si fa la spesa (dalla posizione) e la lingua dei risultati. */
export function country(paese = "", lang = "it") {
  const p = String(paese).toLowerCase();
  return { gl: p === "gb" ? "uk" : p, hl: String(lang).slice(0, 2), amazon_domain: amazonHost(p).replace(/^www\./, "") };
}

// ---------- lettura dei risultati (funzioni pure, testate) ----------
/** Prezzo da testo, sia "1.299,00 €" sia "$1,234.56": il separatore decimale è l'ultimo tra "," e ".". */
function num(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[^\d,.]/g, "");
  const dec = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  if (dec >= 0 && s.length - dec - 1 !== 3) s = s.slice(0, dec).replace(/[,.]/g, "") + "." + s.slice(dec + 1); // decimali
  else s = s.replace(/[,.]/g, ""); // solo separatori delle migliaia
  return parseFloat(s);
}

/** Risultati della ricerca Amazon di SerpApi → righe { negozio, nome, prezzo, fonte, online }. */
export function parseAmazon(j) {
  return (j?.organic_results || []).map(r => ({
    negozio: "Amazon", nome: r.title, prezzo: num(r.extracted_price ?? r.price?.value ?? r.price?.raw ?? r.price),
    fonte: r.link || r.link_clean || "", online: true, nota: r.rating ? `★ ${r.rating}${r.reviews ? ` (${r.reviews})` : ""}` : "",
  })).filter(r => r.nome && r.prezzo > 0).slice(0, 8);
}

/** Risultati di Google Shopping → righe con il negozio venditore (Amazon compreso). */
export function parseShopping(j) {
  return (j?.shopping_results || []).map(r => ({
    negozio: String(r.source || r.seller || "").replace(/\s*-\s*(Seller|Venditore).*$/i, "").trim() || "?", nome: r.title,
    prezzo: num(r.extracted_price ?? r.price), fonte: r.product_link || r.link || "", online: true,
    nota: r.delivery ? String(r.delivery).slice(0, 60) : "",
  })).filter(r => r.nome && r.prezzo > 0).slice(0, 12);
}

// ---------- chiamata ----------
async function get(params, { proxy = "", signal, fetchFn = fetch } = {}) {
  const clean = Object.fromEntries(Object.entries({ ...params, api_key: getKey(), output: "json" }).filter(([, v]) => v != null && v !== ""));
  const url = "https://serpapi.com/search.json?" + new URLSearchParams(clean);
  let r;
  try { r = await fetchFn(url, { signal }); }
  catch (e) {
    if (e.name === "AbortError" || !proxy) throw e;
    r = await fetchFn(via(proxy, url), { signal }); // CORS: via ponte
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = new Error(j.error || "SerpApi " + r.status); e.status = r.status; throw e; }
  return j;
}

/**
 * Cerca un prodotto su Amazon e su Google Shopping (2 ricerche della quota, poi 24 ore di cache).
 * @returns {Promise<{ amazon: object[], shopping: object[], cached: boolean }>}
 */
export async function search(q, { paese = "", lang = "it", proxy = "", signal, fetchFn } = {}) {
  if (!getKey()) return { amazon: [], shopping: [], cached: false };
  const c = country(paese, lang), id = [q.toLowerCase().trim(), c.gl].join("|");
  const cache = ls(CACHE, {});
  if (cache[id] && Date.now() - cache[id].at < TTL) return { ...cache[id].res, cached: true };
  const opt = { proxy, signal, fetchFn };
  const [a, s] = await Promise.allSettled([
    get({ engine: "amazon", amazon_domain: c.amazon_domain, k: q, language: c.hl === "it" ? "it_IT" : undefined }, opt).then(j => { countUse(); return parseAmazon(j); }),
    get({ engine: "google_shopping", q, gl: c.gl || undefined, hl: c.hl }, opt).then(j => { countUse(); return parseShopping(j); }),
  ]);
  if (a.status === "rejected" && s.status === "rejected") throw a.reason;
  const res = { amazon: a.status === "fulfilled" ? a.value : [], shopping: s.status === "fulfilled" ? s.value : [] };
  for (const [k, v] of Object.entries(cache)) if (Date.now() - v.at > TTL) delete cache[k];
  cache[id] = { at: Date.now(), res }; lsSet(CACHE, cache);
  return { ...res, cached: false };
}
