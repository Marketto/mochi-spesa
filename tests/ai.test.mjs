import { test } from "node:test";
import assert from "node:assert/strict";
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const ai = await import("../js/claude.js");
const reset = () => { for (const k of Object.keys(store)) delete store[k]; ai.setShared(null); };

test("migrazione dal vecchio formato a più chiavi", () => {
  reset();
  store["mochi.claude"] = JSON.stringify({ provider: "mistral", keys: { claude: "sk-ant-old", mistral: "mk" }, models: {} });
  assert.deepEqual(ai.localKeys().map(k => k.provider).sort(), ["claude", "mistral"]);
  assert.ok(ai.ready(true));
});
test("scelta: prima i gratuiti e i meno usati, rispettando la ricerca web", () => {
  reset();
  ai.addKey({ provider: "claude", key: "c1" });
  ai.addKey({ provider: "openrouter", key: "o1" });
  ai.addKey({ provider: "groq", key: "g1" });
  assert.deepEqual(ai.pick(true).map(k => k.provider), ["groq", "claude"]);          // openrouter non cerca sul web
  assert.equal(ai.pick(false)[2].provider, "claude");                                  // a pagamento per ultimo
  assert.ok(["groq", "openrouter"].includes(ai.pick(false)[0].provider));
});
test("chiavi condivise via Dropbox, senza doppioni", () => {
  reset();
  ai.addKey({ provider: "mistral", key: "mine" });
  ai.setShared([{ provider: "mistral", key: "mine" }, { provider: "qwen", key: "fam" }]);
  assert.deepEqual(ai.allKeys().map(k => [k.provider, !!k.shared]), [["mistral", false], ["qwen", true]]);
  ai.setShared({ provider: "claude", key: "old-format" });
  assert.equal(ai.allKeys().length, 2);
});
test("passa al servizio successivo se il primo è esaurito", async () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  ai.addKey({ provider: "openrouter", key: "o1" });
  const calls = [];
  globalThis.fetch = async (url, o) => {
    calls.push(url);
    if (url.includes("groq")) return new Response(JSON.stringify({ error: { message: "Rate limit reached: requests per day" } }), { status: 429 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "<think>x</think>```json\n{\"prodotti\":[{\"nome\":\"Latte 1 L\",\"prezzo\":0.99}]}\n```" } }] }), { status: 200 });
  };
  const r = await ai.estraiPrezzi({ testo: "Latte 1 L 0,99", lingua: "Italiano" });
  assert.deepEqual(r, [{ nome: "Latte 1 L", prezzo: 0.99 }]);
  assert.equal(calls.length, 2);
  assert.ok(ai.cooling(ai.localKeys().find(k => k.provider === "groq")));   // in pausa fino a mezzanotte UTC
  assert.deepEqual(ai.pick(false).map(k => k.provider), ["openrouter"]);
});
test("testo dalle risposte", () => {
  assert.equal(ai.mistralText({ outputs: [{ type: "message.output", content: "ciao" }] }), "ciao");
  assert.equal(ai.chatText({ choices: [{ message: { content: "<think>a</think>ok" } }] }), "ok");
});
