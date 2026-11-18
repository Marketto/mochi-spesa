import { test } from "node:test";
import assert from "node:assert/strict";
import { pricesIn, findProducts, bestSaved } from "../js/flyer.js";

test("prezzi nei formati dei volantini", () => {
  assert.deepEqual(pricesIn("SOLO 1,99 €").map(p => p.prezzo), [1.99]);
  assert.deepEqual(pricesIn("€ 12.49"), [{ prezzo: 12.49, perUnita: false }]);
  assert.deepEqual(pricesIn("AL PZ1 99,€ 2.65 €/Kg").map(p => [p.prezzo, p.perUnita]), [[1.99, false], [2.65, true]]);
  assert.deepEqual(pricesIn("0,12 € al lavaggio"), [{ prezzo: 0.12, perUnita: true }]);
  assert.deepEqual(pricesIn("conf. 750 g"), []);
});
test("trova i prodotti e il prezzo vicino", () => {
  const txt = `DASH PODS DETERSIVO LAVATRICE
40 LAVAGGI
9,90 €
0,25 € al lavaggio
VERNEL AMMORBIDENTE 2L 3,49 €
CAFFÈ LAVAZZA`;
  const r = findProducts(txt, ["detersivo lavatrice", "ammorbidente", "caffè"]);
  assert.deepEqual(r.map(x => [x.nome, x.prezzo, x.prezzoUnit]), [["detersivo lavatrice", 9.9, 0.25], ["ammorbidente", 3.49, null]]);
});
test("miglior prezzo salvato e ancora valido", () => {
  const ps = [
    { nome: "detersivo lavatrice", prezzo: 7.9, negozio: "Coop", data: "2026-11-01", validoFino: "2026-11-30" },
    { nome: "Detersivo lavatrice Dash", prezzo: 5.9, negozio: "Lidl", data: "2026-01-01", validoFino: "2026-01-15" },
    { nome: "ammorbidente", prezzo: 2, negozio: "Lidl", data: "2026-11-10" },
  ];
  assert.deepEqual(bestSaved("detersivo lavatrice", ps, "2026-11-18").map(p => p.negozio), ["Coop"]);
});
