// Test: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { merge, emptyState, same, live, TOMBSTONE_MS } from "../js/store.js";
import { parseAdd, catOf, catId } from "../js/categories.js";

const base = () => ({ ...emptyState(), items: {} });

test("unisce elementi aggiunti su due telefoni", () => {
  const a = base(), b = base();
  a.items.x = { id: "x", nome: "latte", updatedAt: 10 };
  b.items.y = { id: "y", nome: "pane", updatedAt: 11 };
  const m = merge(a, b, 100);
  assert.deepEqual(Object.keys(m.items).sort(), ["x", "y"]);
});

test("vince la modifica più recente", () => {
  const a = base(), b = base();
  a.items.x = { id: "x", nome: "latte", fatto: true, updatedAt: 20 };
  b.items.x = { id: "x", nome: "latte", fatto: false, updatedAt: 10 };
  assert.equal(merge(a, b, 100).items.x.fatto, true);
  assert.equal(merge(b, a, 100).items.x.fatto, true);
});

test("un elemento eliminato non ricompare", () => {
  const a = base(), b = base();
  a.items.x = { id: "x", nome: "latte", deleted: true, updatedAt: 20 };
  b.items.x = { id: "x", nome: "latte", updatedAt: 10 };
  assert.equal(live(merge(a, b, 100).items).length, 0);
});

test("i tombstone vecchi vengono puliti", () => {
  const a = base();
  a.items.x = { id: "x", deleted: true, updatedAt: 1 };
  assert.equal(Object.keys(merge(a, base(), 1 + TOMBSTONE_MS + 1).items).length, 0);
});

test("merge è idempotente e commutativo", () => {
  const a = base(), b = base();
  a.items.x = { id: "x", nome: "a", updatedAt: 5 }; b.items.y = { id: "y", nome: "b", updatedAt: 6 };
  a.settings = { ...a.settings, luogo: "Torino", updatedAt: 9 };
  const m1 = merge(a, b, 100), m2 = merge(b, a, 100);
  assert.ok(same(m1, m2));
  assert.ok(same(merge(m1, m1, 100), m1));
  assert.equal(m1.settings.luogo, "Torino");
});

test("parseAdd e categorie", () => {
  assert.deepEqual(parseAdd("2 kg mele"), { nome: "mele", qta: "2 kg" });
  assert.deepEqual(parseAdd("latte"), { nome: "latte", qta: "" });
  assert.equal(catOf("detersivo lavatrice"), "clean");
  assert.equal(catOf("ammorbidente"), "clean");
  assert.equal(catOf("laundry detergent"), "clean");
  assert.equal(catOf("mozzarella"), "dairy");
  assert.equal(catId("Frutta e verdura"), "veg");
  assert.equal(catOf("salesiani"), "other");
});
