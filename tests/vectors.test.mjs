// Vettori comuni del "Mochi Sync Format" (tests/vectors): gli stessi file li usano anche gli altri client.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { merge, canWrite } from "../js/store.js";

const dir = new URL("./vectors/", import.meta.url);
const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
test("ci sono i vettori", () => assert.ok(files.length >= 7));
for (const f of files) {
  const v = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  test(`vettore ${v.nome}`, () => {
    for (const k of ["nome", "local", "remote", "now", "atteso"]) assert.ok(k in v, k);
    const out = merge(structuredClone(v.local), structuredClone(v.remote), v.now);
    assert.deepEqual(out, v.atteso.stato);
    assert.equal(canWrite(out), v.atteso.scrivi);
  });
}
