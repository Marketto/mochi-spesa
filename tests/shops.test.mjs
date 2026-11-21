import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuery, group, sameShop, nearby } from "../js/shops.js";

test("query: raggio in metri, piccoli alimentari al massimo a 2 km", () => {
  const q = buildQuery(41.9, 12.5, 5);
  assert.match(q, /around:5000,41\.90000,12\.50000/); assert.match(q, /around:2000,/); assert.match(q, /supermarket/);
  assert.match(buildQuery(41.9, 12.5, 99), /around:30000,/);
});

test("raggruppa per insegna, conta e distanza minima", () => {
  const c = { lat: 41.9, lon: 12.5 };
  const g = group([
    { type: "node", lat: 41.901, lon: 12.5, tags: { shop: "supermarket", brand: "Lidl", name: "Lidl" } },
    { type: "way", center: { lat: 41.95, lon: 12.5 }, tags: { shop: "supermarket", name: "LIDL" } },
    { type: "node", lat: 41.91, lon: 12.5, tags: { shop: "chemist", brand: "Tigotà" } },
    { type: "node", lat: 41.91, lon: 12.5, tags: { shop: "convenience" } },
  ], c);
  assert.deepEqual(g.map(x => [x.nome, x.n]), [["Lidl", 2], ["Tigotà", 1]]);
  assert.equal(g[0].km, 0.1);
  assert.ok(sameShop("Tigota", "Tigotà")); assert.ok(sameShop("Eurospin ", "EUROSPIN"));
});

test("nearby usa il secondo server se il primo fallisce", async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  let calls = 0;
  const fetchFn = async () => (++calls === 1 ? { ok: false, status: 504 } : { ok: true, json: async () => ({ elements: [{ lat: 41.9, lon: 12.5, tags: { brand: "Conad" } }] }) });
  const r = await nearby({ lat: 41.9, lon: 12.5, raggioKm: 3 }, { fetchFn });
  assert.equal(calls, 2); assert.equal(r[0].nome, "Conad");
});
