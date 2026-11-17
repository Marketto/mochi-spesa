// Test della dispensa: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sameProduct, parseShelves, shelvesToText, placeOptions, addQty, stepQty, parsePlace } from "../js/pantry.js";
import { merge, emptyState } from "../js/store.js";

test("stesso prodotto", () => {
  assert.ok(sameProduct("Latte", "latte"));
  assert.ok(sameProduct("passata", "Passata di pomodoro"));
  assert.ok(sameProduct("caffè", "Caffe"));
  assert.ok(!sameProduct("olio", "olive"));
  assert.ok(!sameProduct("pane", "panettone"));
});

test("scaffali da testo e ritorno", () => {
  const s = parseShelves("Scaffale A: Alto, Centrale, Basso\nFreezer\n\n");
  assert.deepEqual(s, [{ nome: "Scaffale A", ripiani: ["Alto", "Centrale", "Basso"] }, { nome: "Freezer", ripiani: [] }]);
  assert.equal(shelvesToText(s), "Scaffale A: Alto, Centrale, Basso\nFreezer");
});

test("opzioni dei posti", () => {
  const l = { credenza: { id: "credenza", base: true, nome: "", scaffali: [] }, c: { id: "c", nome: "Cantina", ordine: 1, scaffali: [{ nome: "A", ripiani: ["Alto"] }] } };
  const o = placeOptions(l, x => x.nome || "Credenza").map(x => x.label);
  assert.deepEqual(o, ["Credenza", "Cantina", "Cantina › A", "Cantina › A › Alto"]);
  assert.deepEqual(parsePlace("c|A|Alto"), { luogo: "c", scaffale: "A", ripiano: "Alto" });
});

test("quantità", () => {
  assert.equal(addQty("2", "3"), "5");
  assert.equal(addQty("1 kg", "0,5 kg"), "1,5 kg");
  assert.equal(addQty("2 pz", "1 kg"), "1 kg");
  assert.equal(addQty("", "2"), "2");
  assert.equal(stepQty("2 kg", 1), "3 kg");
  assert.equal(stepQty("1", -1), "1");
  assert.equal(stepQty("", 1), "2");
});

test("merge della dispensa tra telefoni", () => {
  const a = emptyState(), b = emptyState();
  a.dispensa.x = { id: "x", nome: "pasta", luogo: "cantina", updatedAt: 5 };
  b.luoghi.cantina = { ...b.luoghi.cantina, nome: "Garage", updatedAt: 9 };
  b.preferenze.p = { id: "p", prodotto: "latte", negozio: "Lidl", tipo: "evita", updatedAt: 3 };
  const m = merge(a, b, 100);
  assert.equal(m.dispensa.x.nome, "pasta");
  assert.equal(m.luoghi.cantina.nome, "Garage");
  assert.equal(m.preferenze.p.tipo, "evita");
});

import { levelsTopDown, nextLevel, splitLevels, shelfRenamer } from "../js/pantry.js";
test("ripiani: ordine visivo, prossimo, testo", () => {
  assert.deepEqual(levelsTopDown({ ripiani: ["1", "2", "3"], basso: true }), ["3", "2", "1"]);
  assert.deepEqual(levelsTopDown({ ripiani: ["Alto", "Basso"] }), ["Alto", "Basso"]);
  assert.equal(nextLevel(["1", "2", "5"]), "6");
  assert.equal(nextLevel(["Alto", "Basso"]), "3");
  assert.equal(nextLevel([]), "1");
  assert.deepEqual(splitLevels(" 1, 2 ,,2; 3"), ["1", "2", "3"]);
});
test("rinomina scaffale e ripiani sposta i prodotti", () => {
  const f = shelfRenamer({ nome: "Angolo", ripiani: ["1", "2"] }, { nome: "Angolo grande", ripiani: ["Basso", "2"] });
  assert.deepEqual(f("Angolo", "1"), ["Angolo grande", "Basso"]);
  assert.deepEqual(f("Angolo", "2"), ["Angolo grande", "2"]);
  assert.equal(f("Altro", "1"), null);
  assert.equal(shelfRenamer({ nome: "A", ripiani: ["1"] }, { nome: "A", ripiani: ["1"] })("A", "1"), null);
});
