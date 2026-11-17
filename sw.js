// Service worker: l'app funziona anche offline (al supermercato senza campo!).
const CACHE = "mochi-spesa-v12";
const SHELL = [
  "./", "index.html", "css/style.css", "css/icons.css", "fonts/mochi-icons.woff2", "manifest.webmanifest",
  "js/app.js", "js/i18n.js", "js/version.js", "locales/en.json", "js/mascot.js", "js/store.js", "js/categories.js", "js/dropbox.js", "js/claude.js", "js/geo.js", "js/voice.js", "js/pantry.js", "js/importer.js", "js/openprices.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Solo file dell'app (stessa origine): rete prima, cache se offline. Dropbox e API non passano dalla cache.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith("config.local.js")) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
