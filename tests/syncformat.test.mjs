import { test } from "node:test";
import assert from "node:assert/strict";
import { merge, normalize, stamp, pick, same, canWrite, SCHEMA, emptyState } from "../js/store.js";

// stato com'era scritto dalla v1.9.0 (formato v1)
const v19 = () => ({
  schema: 1,
  items: { a: { id: "a", nome: "Latte", qta: "2 l", cat: "dairy", fatto: false, da: "A", nota: "", ts: 10, updatedAt: 10 } },
  monitor: { m: { id: "m", nome: "Detersivo", unita: "lavaggi", updatedAt: 1 } },
  valutazioni: {}, dispensa: { d: { id: "d", nome: "Riso", qta: "1 kg", cat: "pantry", luogo: "credenza", scaffale: "A", ripiano: "1", ts: 5, updatedAt: 5 } },
  luoghi: { credenza: { id: "credenza", nome: "", base: true, ordine: 0, scaffali: [], updatedAt: 1 } },
  preferenze: {}, prezzi: {}, volantini: {},
  confronto: { prodotti: [], updatedAt: 0 }, offerte: { list: [], updatedAt: 0 },
  settings: { luogo: "X", raggioKm: 5, negozi: "", amazon: true, updatedAt: 3 },
});

test("un file v1.9.0 si apre e si unisce senza perdite", () => {
  const f = v19();
  assert.ok(same(normalize(f), f));
  assert.ok(same(merge(normalize(emptyState()), f, 100), merge(f, normalize(emptyState()), 100)));
  const m = merge(normalize(f), f, 100);
  assert.deepEqual(m.items, f.items); assert.deepEqual(m.dispensa, f.dispensa); assert.deepEqual(m.settings, f.settings);
});

test("normalize conserva chiavi e campi sconosciuti e non abbassa schema", () => {
  const f = { ...v19(), schema: 3, altro: { x: 1 }, items: { a: { ...v19().items.a, extra: true } } };
  const n = normalize(f);
  assert.equal(n.schema, 3); assert.deepEqual(n.altro, { x: 1 }); assert.equal(n.items.a.extra, true);
  assert.equal(canWrite(n), false); assert.equal(canWrite(v19()), true); assert.equal(SCHEMA, 1);
});

test("l'unione di elementi è commutativa anche a parità di updatedAt", () => {
  const x = { id: "a", nome: "A", updatedAt: 5, by: "phone:1" }, y = { id: "a", nome: "B", updatedAt: 5, by: "phone:2" };
  assert.equal(pick(x, y), y); assert.equal(pick(y, x), y);
  const p = { id: "a", nome: "A", updatedAt: 5 }, q = { id: "a", nome: "B", updatedAt: 5 };
  assert.equal(pick(p, q), q); assert.equal(pick(q, p), q);
  const a = { schema: 1, items: { a: x }, settings: { luogo: "1", updatedAt: 7 } }, b = { schema: 1, items: { a: y }, settings: { luogo: "2", updatedAt: 7 } };
  assert.ok(same(merge(a, b, 100), merge(b, a, 100)));
});

test("stamp scrive by solo sugli elementi appena modificati", () => {
  const s = v19();
  s.items.a = { ...s.items.a, fatto: true, updatedAt: 99 };
  s.settings = { ...s.settings, updatedAt: 99 };
  stamp(s, 99, "phone:abc");
  assert.equal(s.items.a.by, "phone:abc"); assert.equal(s.settings.by, "phone:abc");
  assert.equal(s.dispensa.d.by, undefined); assert.equal(s.monitor.m.by, undefined);
});

test("mappe sconosciute: tombstone scaduti tolti come nelle mappe note", () => {
  const T = 31 * 86400000;
  const m = merge({ schema: 1, nuova: { z: { id: "z", deleted: true, updatedAt: 1 } } }, { schema: 1 }, 1 + T);
  assert.deepEqual(m.nuova, {});
});
