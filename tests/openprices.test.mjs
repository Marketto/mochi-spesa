import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, bestFor, unitPrice, simplify } from "../js/openprices.js";

test("corrispondenza dei nomi (plurali, accenti, articoli)", () => {
  assert.ok(matches("latte", "Latte UHT scremato"));
  assert.ok(matches("caffè", "Caffe' Gusto Classico"));
  assert.ok(matches("biscotto", "Biscotti Pan di Stelle"));
  assert.ok(matches("detersivo per lavatrice", "Dash detersivo lavatrice 30 lavaggi"));
  assert.ok(!matches("detersivo lavatrice", "Detersivo piatti"));
  assert.ok(!matches("", "qualsiasi"));
});
test("migliore per negozio: il più recente, poi dal più economico", () => {
  const ps = [
    { nome: "Latte intero", prezzo: 1.2, negozio: "Lidl", data: "2026-01-01" },
    { nome: "Latte intero", prezzo: 0.9, negozio: "Lidl", data: "2026-05-01" },
    { nome: "Latte scremato", prezzo: 1.1, negozio: "Coop", data: "2026-03-01" },
    { nome: "Pane", prezzo: 2, negozio: "Coop", data: "2026-03-01" },
  ];
  assert.deepEqual(bestFor("latte", ps).map(p => [p.negozio, p.prezzo]), [["Lidl", 0.9], ["Coop", 1.1]]);
});
test("prezzo per kg o litro", () => {
  assert.equal(unitPrice({ prezzo: 1.5, quantita: 500, unitaQ: "g" }, "kg"), 3);
  assert.equal(unitPrice({ prezzo: 1.2, quantita: 1000, unitaQ: "ml" }, "litri"), 1.2);
  assert.equal(unitPrice({ prezzo: 5, quantita: 30, unitaQ: "" }, "lavaggi"), null);
});
test("record API semplificato", () => {
  const p = simplify({ id: 7, price: 0.99, currency: "EUR", date: "2026-02-01", product: { product_name: "Yogurt", brands: "X", product_quantity: 125, product_quantity_unit: "g" }, location: { osm_brand: "Pam", osm_address_city: "Torino" } });
  assert.deepEqual([p.nome, p.negozio, p.citta, p.prezzo, p.quantita], ["Yogurt", "Pam", "Torino", 0.99, 125]);
});
