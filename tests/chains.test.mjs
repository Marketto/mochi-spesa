import { test } from "node:test";
import assert from "node:assert/strict";
import { lidlSlugs, lidlFlyer, via } from "../js/chains.js";
import { allowedTarget, allowedOrigin } from "../worker/src/index.js";

test("Lidl: identificativi dalla pagina pubblica", () => {
  const html = `<a href="/l/it/volantini/offerte-valide-dal-23-11-black/ar/0">x</a><a href="https://www.lidl.it/l/it/volantini/offerte-valide-dal-23-11-black/ar/0">y</a><a href="/l/it/volantini/viaggi-del-mese/ar/0">`;
  assert.deepEqual(lidlSlugs(html), ["offerte-valide-dal-23-11-black", "viaggi-del-mese"]);
});
test("Lidl: solo volantini in corso, scaricabili e non di viaggi", () => {
  const base = { id: "a", name: "Offerte valide dal 23/11", pdfUrl: "https://assets.leaflets.schwarz/x.pdf", enableDownload: true, offerEndDate: "2026-12-02", subcategory: "Volantini speciali" };
  assert.equal(lidlFlyer(base, "2026-11-19").id, "lidl:a");
  assert.equal(lidlFlyer({ ...base, offerEndDate: "2026-11-01" }, "2026-11-19"), null);
  assert.equal(lidlFlyer({ ...base, subcategory: "Volantini Lidl Viaggi" }, "2026-11-19"), null);
  assert.equal(lidlFlyer({ ...base, enableDownload: false }, "2026-11-19"), null);
});
test("ponte: solo siti ufficiali e origini ammesse", () => {
  assert.ok(allowedTarget("https://www.lidl.it/c/volantino-lidl/s10018048"));
  assert.ok(allowedTarget("https://assets.leaflets.schwarz/leaflets/pdfs/a.pdf"));
  assert.equal(allowedTarget("https://evil.example/x"), null);
  assert.equal(allowedTarget("http://www.lidl.it/"), null);
  assert.equal(allowedTarget("https://user:pw@www.lidl.it/"), null);
  assert.equal(allowedTarget("https://www.lidl.it.evil.com/"), null);
  assert.equal(allowedOrigin("https://marketto.github.io", { ALLOWED_ORIGINS: "https://marketto.github.io" }), "https://marketto.github.io");
  assert.equal(allowedOrigin("https://altro.it", { ALLOWED_ORIGINS: "https://marketto.github.io" }), null);
  assert.equal(via("https://p.workers.dev/", "https://www.lidl.it/a?b=1"), "https://p.workers.dev/?url=https%3A%2F%2Fwww.lidl.it%2Fa%3Fb%3D1");
});
