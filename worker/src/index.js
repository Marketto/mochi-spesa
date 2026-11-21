// Ponte di Mochi Spesa: scarica i volantini SOLO dai siti ufficiali delle catene supportate (e SerpApi),
// per conto dell'app (il browser da solo non può: CORS). Non salva e non ripubblica nulla:
// passa la risposta al telefono che l'ha chiesta, con una cache breve per non pesare sui siti.

export const ALLOWED_HOSTS = [
  "www.lidl.it",               // pagina dei volantini Lidl
  "endpoints.leaflets.schwarz", // dati del visualizzatore volantini Lidl (stessa fonte usata da lidl.it)
  "assets.leaflets.schwarz",    // PDF ufficiale del volantino (download abilitato da Lidl)
  "serpapi.com",                // ricerche Amazon / Google Shopping con la chiave SerpApi dell'utente (se il browser blocca la chiamata diretta)
];
// siti ufficiali delle catene (con i loro sottodomini): l'utente indica la pagina del volantino del suo negozio
// e Mochi scarica il PDF che quella pagina pubblica. Tenere allineato con OFFICIAL in js/chains.js.
export const OFFICIAL_DOMAINS = ["todis.it", "eurospin.it", "mdspa.it", "conad.it", "pewex.it", "penny.it", "aldi.it", "despar.it", "carrefour.it", "tigota.it", "acquaesapone.it"];
const official = host => OFFICIAL_DOMAINS.some(d => host === d || host.endsWith("." + d));
const MAX_BYTES = 40 * 1024 * 1024;
const CACHE_SECONDS = 6 * 3600;
const UA = "MochiSpesa/1.0 (+https://github.com/Marketto/mochi-spesa; volantino per uso personale)";

/** L'indirizzo è https e su un sito ammesso? */
export function allowedTarget(raw) {
  let u; try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  return ALLOWED_HOSTS.includes(u.hostname) || official(u.hostname) ? u : null;
}
export function allowedOrigin(origin, env) {
  // predefinito: l'app pubblica (così il Worker funziona anche incollato a mano nella dashboard, senza variabili)
  const list = String(env?.ALLOWED_ORIGINS || "https://marketto.github.io").split(",").map(s => s.trim()).filter(Boolean);
  return origin && list.includes(origin) ? origin : null;
}
const cors = origin => ({ "access-control-allow-origin": origin, "access-control-allow-methods": "GET, OPTIONS", "access-control-max-age": "86400", vary: "Origin" });
const fail = (status, msg, origin) => new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8", ...(origin ? cors(origin) : {}) } });

export default {
  async fetch(req, env, ctx) {
    const origin = allowedOrigin(req.headers.get("origin"), env);
    if (req.method === "OPTIONS") return origin ? new Response(null, { status: 204, headers: cors(origin) }) : fail(403, "origin");
    if (req.method !== "GET") return fail(405, "method", origin);
    if (!origin) return fail(403, "origin");
    // chiave privata facoltativa: se nel Worker c'è la variabile CHIAVE, il ponte risponde solo a chi la conosce
    const params = new URL(req.url).searchParams;
    if (env?.CHIAVE && params.get("k") !== env.CHIAVE) return fail(403, "key", origin);
    const target = allowedTarget(params.get("url") || "");
    if (!target) return fail(400, "url", origin);

    const cache = caches.default, key = new Request("https://cache.mochi/" + encodeURIComponent(target.href));
    let res = await cache.match(key);
    if (!res) {
      const up = await fetch(target.href, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", cf: { cacheTtl: CACHE_SECONDS } });
      const final = allowedTarget(up.url || target.href);
      if (!final) return fail(502, "redirect", origin);
      if (!up.ok) return fail(up.status === 404 ? 404 : 502, "upstream " + up.status, origin);
      const len = +up.headers.get("content-length") || 0;
      if (len > MAX_BYTES) return fail(413, "too big", origin);
      res = new Response(up.body, { status: 200, headers: {
        "content-type": up.headers.get("content-type") || "application/octet-stream",
        "cache-control": `public, max-age=${CACHE_SECONDS}` } });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors(origin))) out.headers.set(k, v);
    out.headers.set("x-content-type-options", "nosniff");
    return out;
  },
};
