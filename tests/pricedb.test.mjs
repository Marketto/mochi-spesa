import { test } from "node:test";
import assert from "node:assert/strict";
import { clean, search, byStore, guessAll, chunks, recId } from "../js/pricedb.js";

test("pulizia dei record", () => {
  const r = clean({ nome: "  Latte  intero 1 L ", prezzo: "0,99", negozio: "Lidl" }, "2026-11-21");
  assert.equal(r.nome, "Latte intero 1 L"); assert.equal(r.prezzo, 0.99); assert.equal(r.data, "2026-11-21"); assert.ok(r.id);
  assert.equal(clean({ nome: "", prezzo: 1 }), null);
  assert.equal(clean({ nome: "x", prezzo: -1 }), null);
  assert.equal(recId(r), clean({ nome: "latte INTERO 1 l", prezzo: 0.99, negozio: "lidl", data: "2026-11-21" }).id);
});
test("ricerca e riassunto per negozio", () => {
  const list = [
    { nome: "Dash detersivo lavatrice 40 lav", prezzo: 9.9, negozio: "Lidl", data: "2026-11-10" },
    { nome: "Detersivo lavatrice Dixan", prezzo: 7.5, negozio: "Eurospin", data: "2026-11-12" },
    { nome: "Detersivo lavatrice Dixan", prezzo: 8.2, negozio: "Eurospin", data: "2026-10-01" },
    { nome: "Detersivo piatti", prezzo: 1.2, negozio: "Lidl", data: "2026-11-12" },
  ];
  const r = search("detersivo lavatrice", list);
  assert.equal(r.length, 3); assert.equal(r[0].data, "2026-11-12");
  const s = byStore(r);
  assert.deepEqual(s.map(x => [x.negozio, x.min.prezzo, x.n]), [["Eurospin", 7.5, 2], ["Lidl", 9.9, 1]]);
});
test("senza IA: nome dalle righe sopra il prezzo", () => {
  const t = "SILVERCREST\nMini aspirapolvere\nricaricabile\n9.99\n€/kg 3,20\nLatte intero 1 L\n0,99";
  assert.deepEqual(guessAll(t).map(x => [x.nome, x.prezzo]), [["SILVERCREST Mini aspirapolvere ricaricabile", 9.99], ["Latte intero 1 L", 0.99]]);
});
test("pezzi per l'IA", () => {
  const c = chunks(["a".repeat(5000), "b".repeat(5000), "c".repeat(100)].join("\f"), 9000);
  assert.equal(c.length, 2);
});
