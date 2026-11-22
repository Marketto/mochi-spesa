// Controlla che tutte le lingue abbiano tutte le chiavi, con gli stessi segnaposto.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const load = c => JSON.parse(fs.readFileSync(path.join(root, "locales", c + ".json"), "utf8"));
const en = load("en");
const codes = fs.readdirSync(path.join(root, "locales")).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));
const ph = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(",");

test("29 lingue presenti", () => {
  const src = fs.readFileSync(path.join(root, "js/i18n.js"), "utf8");
  const block = src.slice(src.indexOf("export const LANGS"), src.indexOf("};", src.indexOf("export const LANGS")));
  const declared = [...block.matchAll(/\b([a-z]{2}): "/g)].map(m => m[1]);
  assert.equal(declared.length, 29);
  for (const c of declared) assert.ok(codes.includes(c), "manca locales/" + c + ".json");
});

for (const c of codes) {
  test(`lingua ${c}: chiavi e segnaposto`, () => {
    const d = load(c);
    const missing = Object.keys(en).filter(k => !(k in d));
    const extra = Object.keys(d).filter(k => !(k in en));
    assert.deepEqual(missing, [], "chiavi mancanti");
    assert.deepEqual(extra, [], "chiavi in più");
    for (const k of Object.keys(en)) {
      assert.equal(typeof d[k], "string", k);
      assert.ok(d[k].trim().length > 0, `${c}.${k} vuota`);
      assert.equal(ph(d[k]), ph(en[k]), `${c}.${k}: segnaposto diversi`);
    }
  });
}

test("ogni chiave usata nel codice esiste", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const js = ["app.js", "ai/router.js", "ai/tasks.js", "dropbox.js", "mascot.js", "version.js"].map(f => fs.readFileSync(path.join(root, "js", f), "utf8")).join("\n");
  const used = new Set([
    ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap(m => m[1].split("|").map(p => p.split(":")[1])),
    ...[...js.matchAll(/\bt\("([a-z0-9.]+)"/gi)].map(m => m[1]),
    ...[...js.matchAll(/\berr\("([a-z0-9.]+)"/gi)].map(m => m[1]),
    ...[...js.matchAll(/frase\("([a-z]+)"\)/g)].map(m => "phr." + m[1]),
    ...[...js.matchAll(/"((?:wiz|new|vote|verdict|legal)\.[a-z0-9.]+)"/g)].map(m => m[1]),
  ]);
  for (let i = 1; i <= 5; i++) used.add(`wiz.s${i}.title`);
  for (let i = 1; i <= 17; i++) used.add("legal.p" + i);
  for (let i = 1; i <= 7; i++) used.add("legal.t" + i);
  for (const p of ["mistral", "groq", "qwen", "openrouter", "siliconflow", "claude"]) used.add("ai.p." + p);
  for (const k of ["place.credenza", "place.cantina", "pref.lineFav", "pref.lineAvoid"]) used.add(k);
  for (const u of ["lavaggi", "litri", "kg", "pezzi"]) { used.add("units." + u); used.add("unitPer." + u); }
  for (const c of ["clean", "body", "veg", "dairy", "meat", "bread", "frozen", "drinks", "pantry", "other"]) used.add("cat." + c);
  const missing = [...used].filter(k => !(k in en) && !/^legal\.[pt]$/.test(k) && !k.endsWith("."));
  assert.deepEqual(missing, []);
});
