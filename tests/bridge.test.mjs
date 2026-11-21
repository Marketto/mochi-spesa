import test from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const B = await import("../js/bridge.js");

test("ponte: invio, lettura e ritiro", () => {
  mem.clear();
  assert.equal(B.send("mochi", { from: "kapibo", store: "Negozio finto", items: [{ name: " Latte ", qty: 2, amount: 2.5 }, { name: "" }] }, 1000), true);
  assert.equal(B.send("mochi", { from: "kapibo", items: [] }, 1000), false);
  const p = B.peek("mochi", 2000);
  assert.equal(p.length, 1);
  assert.deepEqual(p[0].items, [{ name: "Latte", qty: 2, amount: 2.5 }]);
  assert.equal(B.peek("kapibo", 2000).length, 0);
  assert.equal(B.take("mochi", null, 2000).length, 1);
  assert.equal(B.peek("mochi", 2000).length, 0);
});

test("ponte: messaggi vecchi scartati, al massimo 20", () => {
  mem.clear();
  B.send("kapibo", { from: "mochi", items: [{ name: "Pane" }] }, 0);
  assert.equal(B.peek("kapibo", 31 * 24 * 3600 * 1000).length, 0);
  for (let i = 0; i < 25; i++) B.send("kapibo", { from: "mochi", items: [{ name: "x" + i }] }, 1000 + i);
  assert.equal(B.peek("kapibo", 2000).length, 20);
  const [first] = B.peek("kapibo", 2000);
  B.take("kapibo", [first.id], 2000);
  assert.equal(B.peek("kapibo", 2000).length, 19);
});

test("ponte: app installata", () => {
  mem.clear();
  assert.equal(B.installed("mochi"), false);
  mem.set("mochi.state", "{}");
  assert.equal(B.installed("mochi"), true);
});
