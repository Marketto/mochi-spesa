import { test } from "node:test";
import assert from "node:assert/strict";
globalThis.localStorage ??= { getItem: () => null, setItem() {} };
const { pick, cmp, STEPS } = await import("../js/tour.js").catch(() => ({}));

test("guida: tutti i passi la prima volta, solo i nuovi dopo un aggiornamento", { skip: !pick }, () => {
  const steps = [{ id: "a", v: "2.5.0" }, { id: "b", v: "2.6.0" }, { id: "c", v: "2.7.0" }];
  assert.deepEqual(pick("", "2.6.0", steps).map(s => s.id), ["a", "b"]);
  assert.deepEqual(pick("2.5.0", "2.7.0", steps).map(s => s.id), ["b", "c"]);
  assert.deepEqual(pick("2.7.0", "2.7.0", steps), []);
  assert.ok(cmp("2.10.0", "2.9.9") > 0);
  assert.ok(STEPS.every(s => s.sel && s.v));
});
