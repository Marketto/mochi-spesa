import { test } from "node:test";
import assert from "node:assert/strict";
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const ai = await import("../js/claude.js");

test("configurazione: vecchio formato Claude e chiavi separate per servizio", () => {
  store["mochi.claude"] = JSON.stringify({ key: "sk-ant-old", model: "" });
  assert.deepEqual(ai.getCfg(), { provider: "claude", key: "sk-ant-old", model: "claude-sonnet-5-5" });
  ai.setCfg({ provider: "mistral", key: "mk", model: "" });
  assert.equal(ai.getCfg().provider, "mistral"); assert.equal(ai.getCfg().key, "mk"); assert.equal(ai.getCfg().model, "mistral-medium-latest");
  assert.equal(ai.getCfg("claude").key, "sk-ant-old");
  assert.ok(ai.ready());
});
test("testo dalla risposta Mistral (blocchi e stringa)", () => {
  const j = { outputs: [{ type: "tool.execution", name: "web_search" },
    { type: "message.output", content: [{ type: "text", text: "```json\n{\"a\":" }, { type: "tool_reference", url: "u" }, { type: "text", text: "1}\n```" }] }] };
  assert.deepEqual(ai.extractJson(ai.mistralText(j)), { a: 1 });
  assert.equal(ai.mistralText({ outputs: [{ type: "message.output", content: "ciao" }] }), "ciao");
});
