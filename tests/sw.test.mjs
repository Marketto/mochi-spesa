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
