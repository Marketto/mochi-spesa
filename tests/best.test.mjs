import { test } from "node:test";
import assert from "node:assert/strict";
import { qtyOf, withUnit, rank, fromShare, groupOf } from "../js/best.js";

test("quantità dal nome", () => {
  assert.deepEqual(qtyOf("Finish Quantum 40 pz"), { q: 40, unita: "pezzi" });
  assert.deepEqual(qtyOf("Dash pods x30"), { q: 30, unita: "pezzi" });
  assert.deepEqual(qtyOf("Dixan 40 lavaggi"), { q: 40, unita: "lavaggi" });
  assert.deepEqual(qtyOf("Pasta 500 g"), { q: 0.5, unita: "kg" });
  assert.deepEqual(qtyOf("Acqua 6x1,5 l"), { q: 9, unita: "litri" });
  assert.deepEqual(qtyOf("Latte 750 ml"), { q: 0.75, unita: "litri" });
  assert.equal(qtyOf("Detersivo"), null);
});

test("ordina per prezzo a unità e toglie i doppioni", () => {
  const r = rank([
    { negozio: "A", nome: "Pod 20 pz", prezzo: 4 },          // 0,20
    { negozio: "Amazon", nome: "Pod 60 pz", prezzo: 9 },     // 0,15
    { negozio: "B", nome: "Pod 30 lavaggi", prezzo: 5.1 },   // 0,17
    { negozio: "C", nome: "Pod", prezzo: 2 },                // senza quantità: in fondo
    { negozio: "A", nome: "Pod 20 pz", prezzo: 4 },          // doppione
  ]);
  assert.equal(r.gruppo, "n");
  assert.deepEqual(r.righe.map(x => x.negozio), ["Amazon", "B", "A", "C"]);
  assert.equal(r.righe[0].prezzoUnit, 0.15);
  assert.equal(groupOf("lavaggi"), groupOf("pezzi"));
  assert.equal(withUnit({ nome: "x", prezzo: 3, quantita: 2, unita: "kg" }).prezzoUnit, 1.5);
});

test("testo condiviso da Amazon", () => {
  assert.deepEqual(fromShare("", "Finish Quantum Ultimate, Pastiglie Lavastoviglie, 60 Capsule https://amzn.eu/d/abc123", ""),
    { q: "Finish Quantum Ultimate, Pastiglie Lavastoviglie, 60 Capsule", url: "https://amzn.eu/d/abc123" });
  assert.deepEqual(fromShare("", "", "https://amzn.eu/d/x"), { q: "", url: "https://amzn.eu/d/x" });
});
import { variants } from "../js/best.js";
test("sinonimi", () => {
  const v = variants("pod lavastoviglie");
  assert.ok(v.includes("caps lavastoviglie")); assert.equal(v[0], "pod lavastoviglie"); assert.ok(v.length <= 8);
  assert.deepEqual(variants("latte"), ["latte"]);
});
import { sameType, formatsOf } from "../js/best.js";
test("pod e pastiglie non si mescolano", () => {
  assert.deepEqual(formatsOf("Pod lavastoviglie"), ["pod"]);
  assert.ok(!sameType("pod lavastoviglie", "Finish Quantum pastiglie 40 pz"));
  assert.ok(sameType("pod lavastoviglie", "Svelto caps 30 pz"));
  assert.ok(sameType("pod lavastoviglie", "Detersivo lavastoviglie 30 pz"));   // formato non detto: si tiene
  assert.ok(sameType("detersivo lavastoviglie", "Finish tabs 40"));
  assert.ok(!variants("pod lavastoviglie").some(v => /pastigli|tabs/.test(v)));
  assert.deepEqual(rank([{ negozio: "A", nome: "Pastiglie 40 pz", prezzo: 4 }, { negozio: "B", nome: "Caps 30 pz", prezzo: 5 }], "pod").righe.map(r => r.negozio), ["B"]);
});
