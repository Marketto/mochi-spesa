import { test } from "node:test";
import assert from "node:assert/strict";
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const serp = await import("../js/serp.js");

test("lettura risultati Amazon e Google Shopping", () => {
  assert.deepEqual(serp.parseAmazon({ organic_results: [{ title: "Finish caps 60", extracted_price: 11.99, link: "https://www.amazon.it/dp/X", rating: 4.7, reviews: 900 }, { title: "senza prezzo" }] }),
    [{ negozio: "Amazon", nome: "Finish caps 60", prezzo: 11.99, fonte: "https://www.amazon.it/dp/X", online: true, nota: "★ 4.7 (900)" }]);
  assert.equal(serp.parseAmazon({ organic_results: [{ title: "x", price: { raw: "1.299,00 €" } }] })[0].prezzo, 1299);
  const s = serp.parseShopping({ shopping_results: [{ title: "Svelto pod 30", source: "Carrefour.it", extracted_price: 4.5, product_link: "https://g/p" }] });
  assert.deepEqual(s[0], { negozio: "Carrefour.it", nome: "Svelto pod 30", prezzo: 4.5, fonte: "https://g/p", online: true, nota: "" });
});

test("ricerca: due chiamate, poi cache; senza chiave non chiama", async () => {
  let n = 0;
  const fetchFn = async url => { n++; assert.ok(url.includes("api_key=k1")); assert.ok(!url.includes("undefined"));
    return new Response(JSON.stringify(url.includes("engine=amazon") ? { organic_results: [{ title: "A caps", extracted_price: 9 }] } : { shopping_results: [] })); };
  assert.deepEqual((await serp.search("pod", { fetchFn })).amazon, []);
  assert.equal(n, 0);
  serp.setKey("k1");
  const r = await serp.search("pod lavastoviglie", { fetchFn });
  assert.equal(n, 2); assert.equal(r.amazon[0].prezzo, 9); assert.equal(serp.used(), 2);
  await serp.search("Pod lavastoviglie", { fetchFn });
  assert.equal(n, 2);
});
