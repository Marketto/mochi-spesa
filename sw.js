// Service worker: l'app funziona anche offline (al supermercato senza campo!).
const CACHE = "mochi-spesa-v30";
const SHELL = [
  "./", "index.html", "css/style.css", "css/icons.css", "fonts/mochi-icons.woff2", "manifest.webmanifest",
  "js/app.js", "js/i18n.js", "js/version.js", "locales/en.json", "js/mascot.js", "js/store.js", "js/categories.js", "js/dropbox.js", "js/ai/index.js", "js/ai/providers.js", "js/ai/keys.js", "js/ai/adapters.js", "js/ai/router.js", "js/ai/tasks.js", "js/geo.js", "js/voice.js", "js/pantry.js", "js/importer.js", "js/openprices.js", "js/flyer.js", "js/chains.js", "js/pricedb.js", "js/shops.js", "js/amazon.js", "js/best.js", "js/serp.js", "js/bridge.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "mochi-share").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Solo file dell'app (stessa origine): rete prima, cache se offline. Dropbox e API non passano dalla cache.
// condivisione da altre app (Android): testo/link (es. un prodotto Amazon) o screenshot/volantino
const SHARE = "mochi-share";
async function receiveShare(req) {
  const f = await req.formData(), c = await caches.open(SHARE);
  const files = f.getAll("file").filter(x => x && typeof x === "object" && x.size).slice(0, 30);
  await c.put("./shared-text", new Response(JSON.stringify({ title: f.get("title") || "", text: f.get("text") || "", url: f.get("url") || "" })));
  for (const k of await c.keys()) if (/shared-file/.test(k.url)) await c.delete(k);
  for (const [i, file] of files.entries())
    await c.put("./shared-file-" + i, new Response(file, { headers: { "content-type": file.type || "application/octet-stream", "x-name": encodeURIComponent(file.name || "screenshot-" + (i + 1)) } }));
  return Response.redirect("./?share=1", 303);
}
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.origin === location.origin && url.pathname.endsWith("/share")) { e.respondWith(receiveShare(e.request)); return; }
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith("config.local.js")) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
