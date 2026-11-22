// Controllo dell'interfaccia con Playwright + axe-core (WCAG 2.2 AA).
// Larghezze 320, 390, 768, 1280, 1920 · temi chiaro, scuro, alto contrasto, daltonici · più presentazione, guida,
// tema automatico (sistema scuro e «contrasto alto») e arabo da destra a sinistra.
// Per ogni stato e scheda: scorrimento orizzontale, controlli fuori schermo, controlli sovrapposti, bersagli < 44 px, regole axe.
//   node tools/ui-audit.mjs [--shots cartella] [--quick]     → «UI OK» oppure un problema per riga (uscita 1)
// Browser: quello di Playwright, oppure CHROMIUM_PATH=/percorso/chrome.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, resolve, sep } from "node:path";
import { createRequire } from "node:module";

const ROOT = resolve(process.cwd());
const AXE = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg("--shots"), QUICK = process.argv.includes("--quick");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const srv = createServer(async (q, s) => {
  const p = decodeURIComponent(new URL(q.url, "http://x").pathname);
  if (p === "/__axe.js") { s.writeHead(200, { "content-type": "text/javascript" }); return s.end(AXE); } // stessa origine: rispetta la CSP
  if (/\/config(\.local)?\.js$/.test(p)) { s.writeHead(200, { "content-type": "text/javascript" }); return s.end("export default {};"); } // mai i dati personali
  const file = resolve(join(ROOT, p.endsWith("/") ? p + "index.html" : p));
  if (!file.startsWith(ROOT + sep)) { s.writeHead(403); return s.end(); }
  try { const b = await readFile(file); s.writeHead(200, { "content-type": MIME[extname(p)] || "text/html" }); s.end(b); }
  catch { s.writeHead(404); s.end(); }
});
await new Promise(r => srv.listen(0, "127.0.0.1", r)); // solo in locale
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const { APP_VERSION, POLICY_VERSION } = await import(new URL("../js/version.js", import.meta.url));
const WIDTHS = QUICK ? [390, 1280] : [320, 390, 768, 1280, 1920];
const THEMES = QUICK ? ["light", "dark"] : ["light", "dark", "contrast", "cb"];
const TABS = ["lista", "dispensa", "offerte", "valuta", "imp"];
const EXTRA = QUICK ? [] : [{ theme: "auto", colorScheme: "dark", w: 390 }, { theme: "auto", contrast: "more", w: 390 }, { theme: "light", lang: "ar", w: 390 }, { theme: "light", lang: "ar", w: 1280 }];
const issues = new Map();
const add = (k, v) => { if (!issues.has(k)) issues.set(k, v); };

// Eseguito nella pagina: problemi di layout.
const layout = () => {
  // dentro un <details> chiuso (Chrome dà comunque un rettangolo): non si vede
  const closed = el => { const d = el.closest("details:not([open])"); return d && !(el.tagName === "SUMMARY" && el.parentElement === d); };
  // barre fisse (schede in basso, avvisi): il contenuto ci scorre sotto, non è una sovrapposizione
  const fixed = el => { for (let e = el; e && e !== document.body; e = e.parentElement) if (getComputedStyle(e).position === "fixed") return true; return false; };
  // link dentro una frase: eccezione «in linea» di WCAG 2.5.8
  const inline = el => el.tagName === "A" && (el.parentElement?.textContent || "").trim().length > el.textContent.trim().length + 10;
  const out = [], W = innerWidth, name = el => (el.getAttribute("aria-label") || el.textContent || el.id || el.tagName).trim().replace(/\s+/g, " ").slice(0, 30);
  if (document.documentElement.scrollWidth > W + 1) out.push(`scorrimento orizzontale (${document.documentElement.scrollWidth}px > ${W}px)`);
  const ctl = [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]")]
    .filter(el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width && r.height && cs.visibility !== "hidden" && !el.closest("[hidden], .sr") && !closed(el); });
  const top = document.querySelector("dialog[open], .tour");
  const scope = top ? ctl.filter(el => top.contains(el)) : ctl.filter(el => !el.closest("dialog"));
  for (const el of scope) {
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 || r.left < -1) out.push(`fuori schermo: ${name(el)}`);
    // radio e caselle contano con la loro etichetta; i link dentro il testo sono esclusi (WCAG 2.5.8, eccezione «in linea»)
    const small = el.matches("input[type=radio], input[type=checkbox]") ? false : (r.width < 43.5 || r.height < 43.5);
    if (small && !inline(el) && !el.closest("p, li > span, .hint")) out.push(`bersaglio < 44px: ${name(el)} (${Math.round(r.width)}×${Math.round(r.height)})`);
  }
  for (let i = 0; i < scope.length; i++) for (let j = i + 1; j < scope.length; j++) {
    const a = scope[i].getBoundingClientRect(), b = scope[j].getBoundingClientRect();
    if (scope[i].contains(scope[j]) || scope[j].contains(scope[i]) || scope[i].closest("label") === scope[j].closest("label") && scope[i].closest("label") || fixed(scope[i]) !== fixed(scope[j])) continue;
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 2 && oy > 2) out.push(`sovrapposti: ${name(scope[i])} / ${name(scope[j])}`);
  }
  return out;
};

async function audit(page, where) {
  for (const p of await page.evaluate(layout)) add(`${where}: ${p}`.replace(/@\d+px/, ""), `${where} · ${p}`);
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ url: "/__axe.js" });
  const res = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations
    .map(v => ({ id: v.id, n: v.nodes.length, t: v.nodes[0]?.target?.join(" ") })));
  for (const v of res) add(`axe ${v.id} ${where.split("@")[0]}`, `${where} · axe ${v.id} (${v.n}): ${v.t}`);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const RUNS = [...THEMES.flatMap(theme => WIDTHS.map(w => ({ theme, w }))), ...EXTRA];
for (const run of RUNS) {
  const { w } = run, theme = run.theme + (run.lang ? "-" + run.lang : "") + (run.contrast ? "-contrasto" : "") + (run.colorScheme ? "-" + run.colorScheme : "");
  const first = w === 390 && !run.lang && !run.colorScheme && !run.contrast; // presentazione e guida: una volta per tema
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 780 : 900 }, locale: run.lang === "ar" ? "ar" : "it-IT", reducedMotion: "reduce",
    colorScheme: run.colorScheme || "light", ...(run.contrast ? { contrast: run.contrast } : {}) });
  await ctx.addInitScript(([th, lang, first, v, pv]) => {
    if (localStorage.getItem("ui-audit")) return;
    localStorage.setItem("ui-audit", "1");
    localStorage.setItem("mochi.theme", th);
    localStorage.setItem("mochi.me", JSON.stringify({ nome: "Prova", lang: lang || "it" }));
    localStorage.setItem("mochi.installLater", String(Date.now()));
    if (!first) { localStorage.setItem("mochi.seen", JSON.stringify(v)); localStorage.setItem("mochi.policy", JSON.stringify(pv)); localStorage.setItem("mochi.tourSeen", v); }
  }, [run.theme, run.lang || "", first, APP_VERSION, POLICY_VERSION]);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.route(/^https:\/\/[^/]*(overpass-api|nominatim|openfoodfacts|serpapi|dropbox)/, r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.goto(URL0); await page.waitForTimeout(700);
  if (first && await page.locator("#wiz[open]").count()) {
    await audit(page, `presentazione ${theme}@${w}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/presentazione-${theme}-${w}.png` });
    await page.click("#wiz-skip"); await page.waitForTimeout(200);
    await audit(page, `accettazione ${theme}@${w}`);
    await page.check("#wiz-accept"); await page.check("#wiz-disc"); await page.click("#wiz-next");
    await page.waitForSelector(".tour", { timeout: 4000 }).catch(() => {});
    if (await page.locator(".tour").count()) {
      await page.click('.tour [data-t="next"]'); await page.waitForTimeout(300);
      await audit(page, `guida ${theme}@${w}`);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/guida-${theme}-${w}.png` });
    }
  }
  while (await page.locator(".tour").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }
  if (await page.locator("dialog[open]").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); }
  await page.fill("#add-nome", "Elemento di prova con un nome abbastanza lungo da andare a capo"); await page.press("#add-nome", "Enter"); await page.waitForTimeout(250);
  for (const tab of TABS) {
    await page.click(`#t-${tab}`); await page.waitForTimeout(250);
    await audit(page, `${tab} ${theme}@${w}`);
    if (SHOTS && (w === 390 || w === 1280)) await page.screenshot({ path: `${SHOTS}/${tab}-${theme}-${w}.png`, fullPage: true });
  }
  for (const e of errors) add(`errore ${e}`, `errore JavaScript: ${e}`);
  await ctx.close();
}
await browser.close(); srv.close();
if (issues.size) { for (const v of issues.values()) console.log(v); console.log(`UI: ${issues.size} problemi`); process.exit(1); }
console.log(`UI OK (${WIDTHS.length} larghezze × ${THEMES.length} temi × ${TABS.length} schede${EXTRA.length ? ` + ${EXTRA.length} stati: automatico scuro e contrasto alto, arabo` : ""})`);
