// Il service worker deve mettere in cache tutti i moduli dell'app, altrimenti offline l'app non parte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url);
const sw = readFileSync(new URL("sw.js", root), "utf8");
// solo l'array SHELL = [ … ]
const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
test("ogni modulo js è nello SHELL del service worker", () => {
  const files = d => readdirSync(new URL(d, root), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(d + e.name + "/") : e.name.endsWith(".js") ? [d + e.name] : []);
  for (const f of files("js/")) assert.ok(shell.includes(f), f + " manca in sw.js");
});
test("i file dello SHELL esistono", () => {
  for (const f of shell.filter(f => /\.(js|css|json|png|svg|woff2|html|webmanifest)$/.test(f))) assert.ok(existsSync(new URL(f, root)), f);
});
test("nessuna risorsa da Google Fonts o librerie JS da CDN nella pagina", () => {
  const html = readFileSync(new URL("index.html", root), "utf8"), flyer = readFileSync(new URL("js/flyer.js", root), "utf8");
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html));
  assert.match(html, /Content-Security-Policy/);
  assert.ok(!/cdn\.jsdelivr\.net\/npm\/(tesseract\.js|pdfjs-dist)@/.test(flyer)); // librerie JS servite da vendor/
});

test("gli import dinamici puntano a file esistenti (config.js e config.local.js non sono nel repo)", async () => {
  const { readdirSync } = await import("node:fs");
  const files = d => readdirSync(new URL(d, root), { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(d + e.name + "/") : e.name.endsWith(".js") ? [d + e.name] : []);
  for (const f of files("js/")) {
    for (const [, a, b] of readFileSync(new URL(f, root), "utf8").matchAll(/import\(\s*(?:\w+\s*\?\s*)?"([^"]+)"(?:\s*:\s*"([^"]+)")?/g))
      for (const p of [a, b].filter(Boolean)) {
        const u = new URL(p, new URL(f, root)), ex = /\/config(\.local)?\.js$/.test(u.pathname) ? new URL("config.example.js", u) : u;
        assert.ok(existsSync(ex), `${f}: ${p}`);
      }
  }
});

test("js/ui/core.js non importa gli altri moduli UI (si caricherebbero prima della base: errori TDZ)", () => {
  const src = readFileSync(new URL("js/ui/core.js", root), "utf8");
  assert.ok(!/from "\.\/(pantry|prices|onboarding|settings|sync|location)\.js"/.test(src));
  assert.ok(!/from "\.\.\/app\.js"/.test(src), "core.js non deve importare da app.js (ciclo: errori «before initialization» sui telefoni)");
});
