import { test } from "node:test";
import assert from "node:assert/strict";
import { readCsv, parseInvendo, planImport, toIsoDate, cleanName } from "../js/importer.js";
import { emptyState } from "../js/store.js";

const nameOf = l => l.nome || { credenza: "Credenza", cantina: "Cantina" }[l.id] || l.id;
const csv = `Luogo di conservazione;Categorie;Nome articolo;Data di scadenza;Quantità;Descrizione
Cantina | Angolo | 1;Pulizia casa;Capsule lavastoviglie;;166;
Cantina | Angolo | 2;Bevande;Birra | Limone ;;2;
Garage | Scaffale2 | 4;Alimentari;Pasta;30/09/2027;3,0;`;

test("CSV Invendo: posti, categorie, nomi, scadenze", () => {
  const p = parseInvendo(readCsv(csv));
  assert.equal(p.length, 3);
  assert.deepEqual(p[0], { nome: "Capsule lavastoviglie", qta: "166", cat: "clean", posto: ["Cantina", "Angolo", "1"], scad: "" });
  assert.equal(p[1].nome, "Birra · Limone"); assert.equal(p[1].cat, "drinks");
  assert.equal(p[2].scad, "2027-09-30"); assert.equal(p[2].qta, "3");
});
test("date Excel e testo", () => {
  assert.equal(toIsoDate(46660), "2027-09-30");
  assert.equal(toIsoDate("2026-4-8"), "2026-04-08");
  assert.equal(toIsoDate(""), "");
  assert.equal(cleanName(" a | b |"), "a · b");
});
test("piano: crea posti e scaffali, aggiorna i doppioni", () => {
  const s = emptyState(); let k = 0; const uid = () => "n" + k++;
  s.dispensa.x = { id: "x", nome: "capsule lavastoviglie", qta: "10", luogo: "cantina", scaffale: "Angolo", ripiano: "1", updatedAt: 1 };
  const plan = planImport(parseInvendo(readCsv(csv)), s, nameOf, uid);
  assert.equal(plan.upd.length, 1); assert.equal(plan.upd[0].id, "x"); assert.equal(plan.upd[0].qta, "166");
  assert.equal(plan.add.length, 2);
  assert.deepEqual(plan.luoghi.cantina.scaffali, [{ nome: "Angolo", ripiani: ["1", "2"] }]);
  const garage = Object.values(plan.luoghi).find(l => l.nome === "Garage");
  assert.ok(garage); assert.deepEqual(garage.scaffali, [{ nome: "Scaffale2", ripiani: ["4"] }]);
});

test("quantità 0 = finito: non importa, toglie se c'era", () => {
  const s = emptyState();
  s.dispensa.y = { id: "y", nome: "Biscotti", qta: "2", luogo: "cantina", scaffale: "", ripiano: "", updatedAt: 1 };
  const rows = readCsv("Luogo di conservazione;Categorie;Nome articolo;Data di scadenza;Quantità\nCantina;Alimentari;Biscotti;;0\nCantina;Alimentari;Crackers;;0");
  const plan = planImport(parseInvendo(rows), s, nameOf, () => "z");
  assert.deepEqual(plan.del, ["y"]); assert.equal(plan.n, 0);
});
