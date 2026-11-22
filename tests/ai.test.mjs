// Router IA: scelta del modello per tag, ripiego, pause e chiavi.
import { test } from "node:test";
import assert from "node:assert/strict";
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const ai = await import("../js/ai/index.js");
const { TAG } = ai;
const reset = () => { for (const k of Object.keys(store)) delete store[k]; ai.setShared(null); };
const ok = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

test("migrazione dal vecchio formato a più chiavi", () => {
  reset();
  store["mochi.claude"] = JSON.stringify({ provider: "mistral", keys: { claude: "sk-ant-old", mistral: "mk" }, models: {} });
  assert.deepEqual(ai.localKeys().map(k => k.provider).sort(), ["claude", "mistral"]);
  assert.ok(ai.ready(true));
});

test("router: solo modelli capaci, prima i gratuiti; a pagamento per ultimo", () => {
  reset();
  ai.addKey({ provider: "claude", key: "c1" });
  ai.addKey({ provider: "openrouter", key: "o1" });
  ai.addKey({ provider: "groq", key: "g1" });
  const web = ai.route([TAG.WEB]);
  assert.ok(web.every(c => c.provider !== "openrouter"));              // OpenRouter non cerca sul web
  assert.equal(web[0].provider, "groq");
  assert.equal(web.at(-1).provider, "claude");
  assert.equal(ai.route([]).at(-1).provider, "claude");
});

test("router: i tag scelgono il modello giusto dello stesso servizio", () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  assert.equal(ai.route([TAG.WEB, TAG.REASON])[0].model, "openai/gpt-oss-120b"); // giudizio: qualità
  assert.equal(ai.route([TAG.EXTRACT])[0].model, "openai/gpt-oss-20b");          // estrazione: velocità
});

test("router: modello personale ritirato ignorato, valido usato per primo", () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1", model: "groq/compound" });
  assert.ok(!ai.route([TAG.WEB]).some(c => c.model === "groq/compound"));
  reset();
  ai.addKey({ provider: "groq", key: "g1", model: "moonshotai/kimi-k3" });
  assert.equal(ai.route([TAG.WEB])[0].model, "moonshotai/kimi-k3");
});

test("chiavi condivise via Dropbox, senza doppioni", () => {
  reset();
  ai.addKey({ provider: "mistral", key: "mine" });
  ai.setShared([{ provider: "mistral", key: "mine" }, { provider: "qwen", key: "fam" }]);
  assert.deepEqual(ai.allKeys().map(k => [k.provider, !!k.shared]), [["mistral", false], ["qwen", true]]);
  ai.setShared({ provider: "claude", key: "old-format" });
  assert.equal(ai.allKeys().length, 2);
});

test("quota esaurita: pausa sulla chiave e passaggio al servizio successivo", async () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  ai.addKey({ provider: "openrouter", key: "o1" });
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    if (url.includes("groq")) return new Response(JSON.stringify({ error: { message: "Rate limit reached: requests per day" } }), { status: 429 });
    return ok("<think>x</think>```json\n{\"prodotti\":[{\"nome\":\"Latte 1 L\",\"prezzo\":0.99}]}\n```");
  };
  const r = await ai.estraiPrezzi({ testo: "Latte 1 L 0,99", lingua: "Italiano" });
  assert.deepEqual(r, [{ nome: "Latte 1 L", prezzo: 0.99 }]);
  assert.equal(calls.length, 2);                                      // un solo tentativo per la chiave Groq
  assert.ok(ai.cooling(ai.localKeys().find(k => k.provider === "groq")));
  assert.deepEqual([...new Set(ai.route([]).map(c => c.provider))], ["openrouter"]);
});

test("modello spento: pausa solo sul modello, si prova l'altro modello della stessa chiave", async () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  const models = [];
  globalThis.fetch = async (url, o) => {
    const b = JSON.parse(o.body); models.push(b.model);
    assert.deepEqual(b.tools, [{ type: "browser_search" }]);             // ricerca web di Groq
    if (b.model === "openai/gpt-oss-120b") return new Response(JSON.stringify({ error: { message: "The model has been decommissioned" } }), { status: 400 });
    return ok('```json\n{"risultati":[{"negozio":"Lidl","prodotto":"Pod 30 pz","prezzo":4.99}]}\n```');
  };
  const r = await ai.cercaMigliore({ query: "pod lavastoviglie", luogo: "Roma", raggioKm: 5, valuta: "EUR", lingua: "Italiano" });
  assert.equal(r[0].negozio, "Lidl");
  assert.deepEqual(models, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
  const k = ai.localKeys()[0];
  assert.ok(!ai.cooling(k) && ai.cooling(k, "openai/gpt-oss-120b"));
});

test("errore all'utente con il nome del servizio, non 'Claude'", async () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Invalid API Key" } }), { status: 401 });
  await assert.rejects(ai.cercaMigliore({ query: "x", luogo: "", raggioKm: 5, valuta: "EUR", lingua: "Italiano" }), e => e.code === "ai.errBad");
});

test("testo dalle risposte", () => {
  assert.equal(ai.mistralText({ outputs: [{ type: "message.output", content: "ciao" }] }), "ciao");
  assert.equal(ai.chatText({ choices: [{ message: { content: "<think>a</think>ok" } }] }), "ok");
});

test("limite al minuto: aspetta e riprova la stessa chiave", async () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  let n = 0;
  globalThis.fetch = async () => (++n === 1
    ? new Response(JSON.stringify({ error: { message: "Rate limit reached for model" } }), { status: 429, headers: { "retry-after": "1" } })
    : ok('```json\n{"risultati":[]}\n```'));
  const t0 = Date.now();
  await ai.cercaMigliore({ query: "x", luogo: "", raggioKm: 5, valuta: "EUR", lingua: "Italiano" });
  assert.equal(n, 2); assert.ok(Date.now() - t0 >= 900);
  assert.ok(!ai.cooling(ai.localKeys()[0]));
});

test("Groq che non usa la ricerca: pausa breve, non di un giorno", async () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "tool_use_failed: model did not call a tool" } }), { status: 400 });
  await assert.rejects(ai.cercaMigliore({ query: "x", luogo: "", raggioKm: 5, valuta: "EUR", lingua: "Italiano" }));
  const c = ai.cooling(ai.localKeys()[0], "openai/gpt-oss-120b");
  assert.ok(c && c.until - Date.now() <= 61e3);
});

test("prefer: un servizio scelto viene provato per primo, gli altri restano di riserva", async () => {
  reset();
  ai.addKey({ provider: "groq", key: "g1" });
  ai.addKey({ provider: "mistral", key: "m1" });
  const hosts = [];
  globalThis.fetch = async url => { hosts.push(new URL(url).host); return ok('```json\n{"risultati":[]}\n```'); };
  await ai.cercaMigliore({ query: "x", luogo: "", raggioKm: 5, valuta: "EUR", lingua: "Italiano" }, { prefer: "mistral" });
  assert.equal(hosts[0], "api.mistral.ai");
});
