// Prezzi: prezzo migliore, volantini, «I miei prezzi», dove conviene, offerte seguite, valuta un affare.
import { frase } from "../mascot.js";
import { catOf } from "../categories.js";
import { live, uid } from "../store.js";
import { t, lang, locale, langName } from "../i18n.js";
import * as ai from "../ai/index.js";
import * as pantry from "../pantry.js";
import * as op from "../openprices.js";
import * as flyer from "../flyer.js";
import * as chains from "../chains.js";
import * as pricedb from "../pricedb.js";
import * as shops from "../shops.js";
import { amazonSearch, isAmazon } from "../amazon.js";
import * as best from "../best.js";
import * as serp from "../serp.js";
import { hash } from "../util.js";
import { away, checkAway, fillCountry, renderAiKeys, renderOfferte, renderSerp } from "../app.js";
import { $, PROXY, amzLink, amzOn, amzSaved, confetti, confirmDlg, currency, esc, ic, lsGet, lsSet, me, mochi, money, money3, motionOk, mutate, num, paese, perUnit, quando, safeUrl, selectTab, sheet, sparkles, state, toast } from "./core.js";
import { OP_CREDIT, mergeOptions, oggiISO, opNote, savedOptions, searchPoint, shortDate } from "./pantry.js";

// ---------- TROVA IL PREZZO MIGLIORE (un prodotto, tutte le fonti) ----------
export const BEST_KEY = "mochi.best";
export let bestRun = 0, bestCtl = null;
export function renderBestHow() {
  if (document.activeElement?.id === "best-keyin") return;
  const s = state.settings, web = ai.ready(true);
  $("#best-how").textContent = web ? t("best.howWeb", { km: s.raggioKm || 5 }) : t("best.howFree");
  $("#best-key").innerHTML = web ? "" : `<details class="keysetup"><summary>${ic("key")} ${esc(t("best.keyTitle"))}</summary>
    <ol><li>${esc(t("best.key1"))} <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">console.groq.com/keys<span class="sr"> ${esc(t("a11y.newTab"))}</span></a></li>
    <li>${esc(t("best.key2"))}</li><li>${esc(t("best.key3"))}</li></ol>
    <label for="best-keyin" class="sr">${esc(t("best.keyLabel"))}</label>
    <div class="best-row"><input id="best-keyin" type="password" autocomplete="off" spellcheck="false" placeholder="gsk_…">
    <button class="btn primary" type="button" id="best-keysave">${ic("save")} ${esc(t("common.save"))}</button></div></details>`;
}
export const srcLabel = r => r.src === "web" ? t("best.srcWeb") : r.src === "op" ? "Open Prices" : r.src === "serp" ? t("serp.src") : t("best.srcMine");
export function bestRow(r, i, top) {
  const src = safeUrl(r.fonte), nt = `<span class="sr"> ${esc(t("a11y.newTab"))}</span>`;
  const fino = r.validoFino && /^\d{4}-\d{2}-\d{2}$/.test(r.validoFino) ? shortDate(r.validoFino) : r.validoFino;
  return `<li class="best-item${top ? " win" : ""}">
    ${top ? `<p class="best-badge">${ic("trophy")} ${esc(t("best.winner"))}</p>` : ""}
    <div class="head"><div><h3>${esc(r.negozio || "?")}</h3><p class="what">${esc(r.nome)}</p></div>
      <div class="price">${money(r.prezzo)}${r.prezzoUnit ? `<small>${esc(perUnit(r.prezzoUnit, r.unita))}</small>` : ""}</div></div>
    <p class="meta"><span class="badge">${esc(srcLabel(r))}</span>${r.offerta ? ` <span class="badge gold">${esc(t("cmp.deal"))}</span>` : ""}${r.online ? ` · ${esc(t("best.online"))}` : r.distanzaKm != null ? ` · ${esc(r.distanzaKm)} km` : ""}${fino ? ` · ${esc(t("deals.until", { date: fino }))}` : ""}${r.data && r.src !== "web" ? ` · ${esc(t("fl.note", { date: shortDate(r.data) }))}` : ""}</p>
    ${r.nota ? `<p class="hint">${esc(r.nota)}</p>` : ""}
    <div class="foot">${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${ic("external")}${esc(t("best.open"))}${nt}</a>` : "<span></span>"}
      <button class="btn ghost" type="button" data-bestadd="${i}" aria-label="${esc(t("deals.addToList", { name: r.nome }))}">${ic("list-add")} ${esc(t("deals.addList"))}</button></div></li>`;
}
export function renderBest(res) {
  const out = $("#best-out");
  if (!res) { out.innerHTML = ""; return; }
  renderBest.cur = res;
  const st = res.stato || {};
  const chip = (k, label) => `<span class="src-chip ${st[k] || ""}">${st[k] === "run" ? ic("spinner") : st[k] === "ok" ? ic("ok") : st[k] === "err" ? ic("warn") : ic("minus")} ${esc(label)}${res.n?.[k] != null && st[k] === "ok" ? ` (${res.n[k]})` : ""}${k === "web" && st.web === "run" && res.web ? ` ${res.web.done}/${res.web.tot}` : ""}</span>`;
  const righe = res.righe || [];
  const busy = Object.values(st).includes("run");
  out.innerHTML = `<section class="card best-res" aria-labelledby="best-rt" aria-busy="${busy}">
    <h3 id="best-rt">${esc(t("best.results", { q: res.q }))}</h3>
    <p class="srcs">${chip("mine", t("best.srcMine"))}${chip("op", "Open Prices")}${chip("serp", t("serp.src"))}${chip("web", t("best.srcWeb"))}</p>
    ${st.web === "err" && res.errore ? `<p class="hint">${ic("warn")} ${esc(res.errore)}</p>` : ""}
    ${res.avviso && !busy ? `<p class="hint">${ic("info")} ${esc(t("best.partial", { msg: res.avviso }))}</p>` : ""}
    ${righe.length ? `<ol class="best-list">${righe.map((r, i) => bestRow(r, i, i === 0 && !busy)).join("")}</ol>` : `<p class="hint">${esc(busy ? t("best.searching") : t("best.none"))}</p>`}
    ${amzOn() && !righe.some(r => isAmazon(r.negozio)) ? `<p class="cmp">${amzLink(res.q)}</p>` : ""}
    ${paese() === "it" ? `<p class="cmp"><a href="https://www.promoqui.it/offerte/${encodeURIComponent(best.slug(res.q))}" target="_blank" rel="noopener noreferrer">${ic("external")}${esc(t("best.also", { site: "PromoQui" }))}<span class="sr"> ${esc(t("a11y.newTab"))}</span></a></p>` : ""}
    ${righe.some(r => r.src === "web") ? `<p class="hint">${ic("info")} ${esc(t("best.check"))}</p>` : ""}
    ${righe.some(r => r.src === "op") ? OP_CREDIT() : ""}
    <p class="hint">${esc(t("cmp.when", { when: quando(res.at) }))}</p></section>`;
}
export async function findBest(q, link = "") {
  q = String(q || "").trim(); if (!q) return;
  bestCtl?.abort(); const ctl = bestCtl = new AbortController(); // una nuova ricerca ferma la precedente (quote gratuite)
  const run = ++bestRun, s0 = state.settings;
  const res = { q, at: Date.now(), righe: [], gruppo: null, stato: { mine: "run", op: searchPoint() ? "run" : "", serp: serp.getKey() ? "run" : "", web: ai.ready(true) ? "run" : "" }, n: {} };
  const parts = { mine: [], op: [], serp: [], web: [] };
  const update = () => {
    if (run !== bestRun) return;
    Object.assign(res, best.rank([...parts.serp, ...parts.web.filter(r => best.inRange(r, s0.raggioKm || 5, res.catene, shops.sameShop)), ...parts.mine, ...parts.op], q));
    // conteggi = risultati davvero mostrati (dopo i filtri su formato e raggio)
    for (const k of ["mine", "op", "serp", "web"]) if (res.stato[k] === "ok") res.n[k] = res.righe.filter(r => r.src === k).length;
    renderBest(res);
  };
  const btn = $("#best-go"); btn.classList.add("loading"); btn.setAttribute("aria-busy", "true");
  mochi.mood("wow", 0); mochi.say(frase("cerco"), 90000);
  update();
  // 1. i miei prezzi (volantini letti, catene, inseriti a mano, ricerche passate)
  try {
    await pricedb.all();
    parts.mine = [...best.variants(q).flatMap(v => pricedb.recent(v, 60)).map(x => ({ ...x, src: "mine", offerta: !!(x.validoFino && x.validoFino >= oggiISO()) })),
      ...best.variants(q).flatMap(v => flyer.bestSaved(v, live(state.prezzi))).map(x => ({ negozio: x.negozio, nome: x.riga || q, prezzo: x.prezzo, prezzoUnit: x.prezzoUnit, unita: x.unita, validoFino: x.validoFino, fonte: x.fonte, data: x.data, src: "mine" }))];
    res.stato.mine = "ok"; res.n.mine = parts.mine.length;
  } catch { res.stato.mine = "err"; }
  update();
  const jobs = [];
  // 2. Open Prices (community, gratis)
  const pt = searchPoint(); // casa oppure il posto «fuori casa»
  if (res.stato.op) jobs.push(op.nearby({ lat: pt.lat, lon: pt.lon, raggioKm: s0.raggioKm || 5 })
    .then(list => { parts.op = best.variants(q).flatMap(v => op.bestFor(v, list, 8)).map(x => ({ negozio: x.negozio, nome: [x.marca, x.nome].filter(Boolean).join(" "), prezzo: x.prezzo, quantita: x.quantita, data: x.data, fonte: op.priceUrl(x.id), src: "op" })); res.stato.op = "ok"; res.n.op = parts.op.length; })
    .catch(() => { res.stato.op = "err"; }).then(update));
  // 3. Amazon e negozi online con prezzi veri (SerpApi: Amazon + Google Shopping), se l'utente ha la chiave
  if (res.stato.serp) jobs.push(serp.search(q, { paese: paese(), lang: lang(), proxy: PROXY(), signal: ctl.signal })
    .then(r => { parts.serp = [...r.amazon, ...r.shopping].map(x => ({ ...x, src: "serp" })); res.stato.serp = "ok"; res.n.serp = parts.serp.length; renderSerp(); })
    .catch(e => { res.stato.serp = "err"; res.avviso = "SerpApi: " + e.message; }).then(update));
  // 4. ricerca web con l'IA, divisa per fonte: volantini delle catene vicine (a gruppi), aggregatori, spesa online, Amazon
  if (res.stato.web) jobs.push(webBest(q, link, s0, res, parts, update, !!res.stato.serp, ctl.signal));
  await Promise.all(jobs);
  if (run !== bestRun) return; // nel frattempo è partita un'altra ricerca: lo spinner è suo
  btn.classList.remove("loading"); btn.removeAttribute("aria-busy");
  update(); lsSet(BEST_KEY, { ...res, stato: { mine: res.stato.mine, op: res.stato.op, serp: res.stato.serp, web: res.stato.web } });
  if (res.righe.length) { mochi.mood("happy", 2000); mochi.say(t("best.say", { store: res.righe[0].negozio, price: money(res.righe[0].prezzo) })); }
  else { mochi.mood("sleepy", 2000); mochi.say(frase("niente")); }
}
/** Catene da cercare: prima le preferite, poi le più diffuse nel raggio (da OpenStreetMap). */
export async function chainsNear(s0) {
  const fav = String(s0.negozi || "").split(",").map(x => x.trim()).filter(Boolean);
  let near = [];
  const pt = searchPoint();
  if (pt) try { near = (await shops.nearby({ lat: pt.lat, lon: pt.lon, raggioKm: s0.raggioKm || 5 })).filter(g => g.n >= 1).map(g => g.nome); } catch {}
  const out = [];
  for (const n of [...fav, ...near]) if (!out.some(x => shops.sameShop(x, n))) out.push(n);
  return out.slice(0, 9);
}
/** Esegue le promesse al massimo "n" alla volta (per non superare i limiti dei piani gratuiti). */
export async function pool(tasks, n) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
  return out;
}
export async function webBest(q, link, s0, res, parts, update, haveSerp, signal) {
  const a0 = away();
  const luogo = a0 ? `${a0.nome} (lat ${a0.lat}, lon ${a0.lon})` : s0.lat != null ? `${s0.luogo} (lat ${s0.lat}, lon ${s0.lon})` : s0.luogo || "";
  const catene = res.catene = await chainsNear(s0);
  const fonti = [];
  for (let i = 0; i < catene.length; i += 3) fonti.push({ tipo: "volantini", catene: catene.slice(i, i + 3) });
  fonti.push({ tipo: "aggregatori", catene });
  // con SerpApi Amazon e spesa online hanno già prezzi veri: l'IA si concentra sui volantini
  if (!haveSerp) { fonti.push({ tipo: "online" }); if (amzOn()) fonti.push({ tipo: "amazon" }); }
  res.web = { tot: fonti.length, done: 0, ok: 0 };
  // ogni fonte va preferibilmente a un servizio diverso (a rotazione), così le richieste in parallelo non finiscono tutte sullo stesso
  const servizi = [...new Set(ai.route([ai.TAG.WEB]).map(c => c.provider))];
  update();
  const errs = [];
  await pool(fonti.map((fonte, i) => () => signal?.aborted ? Promise.resolve() : ai.cercaMigliore({ query: q, link: fonte.tipo === "amazon" || fonte.tipo === "aggregatori" ? link : "", luogo, raggioKm: s0.raggioKm || 5, valuta: currency(), lingua: langName(), fonte }, { signal, prefer: servizi[i % servizi.length] })
    .then(list => {
      const rows = list.map(x => ({ negozio: best.chainName(x.negozio), nome: x.prodotto, prezzo: x.prezzo, quantita: x.quantita, unita: x.unita, prezzoUnit: x.prezzoUnit,
        offerta: !!x.offerta, validoFino: x.validoFino, online: !!x.online || fonte.tipo === "amazon", distanzaKm: x.distanzaKm, fonte: x.fonte, nota: x.nota, src: "web" }));
      parts.web.push(...rows); res.web.ok++;
      // restano tra i tuoi prezzi: la prossima volta li trovi anche senza rete
      pricedb.add(rows.map(x => ({ ...best.withUnit(x), validoFino: /^\d{4}-\d{2}-\d{2}$/.test(x.validoFino || "") ? x.validoFino : "", origine: "web" }))).then(renderDb).catch(() => {});
    })
    .catch(e => { if (e.name !== "AbortError") errs.push(e.message); })
    .then(() => { res.web.done++; res.n.web = parts.web.length; update(); })),
    // una richiesta alla volta per ogni servizio con ricerca web: i piani gratuiti hanno limiti al minuto
    Math.max(1, Math.min(3, servizi.length)));
  res.stato.web = res.web.ok ? "ok" : "err";
  if (!res.web.ok) res.errore = errs[0] || "";
  else if (errs.length) res.avviso = errs[0];
}

$("#f-best").addEventListener("submit", e => { e.preventDefault(); $("#best-q").blur(); findBest($("#best-q").value); });
$("#best-key").addEventListener("click", e => {
  if (!e.target.closest("#best-keysave")) return;
  const k = $("#best-keyin").value.trim();
  if (k.length < 20) { toast(t("best.keyBad"), "warn"); $("#best-keyin").focus(); return; }
  ai.addKey({ provider: "groq", key: k }); renderAiKeys(); renderBestHow(); renderOfferte();
  toast(t("common.saved"), "key"); $("#best-q").focus();
});
$("#best-out").addEventListener("click", e => {
  const b = e.target.closest("[data-bestadd]"); if (!b) return;
  const r = renderBest.cur?.righe[+b.dataset.bestadd]; if (!r) return;
  mutate((s, now) => {
    const id = uid();
    s.items[id] = { id, nome: r.nome.slice(0, 80), qta: "", cat: catOf(r.nome), fatto: false, da: me().nome,
      nota: t("deals.offerNote", { store: r.negozio || "", price: money(r.prezzo) }), negozio: r.negozio || "", prezzo: r.prezzo, ts: now, updatedAt: now };
  });
  sparkles(b); toast(t("toast.addedList"), "list-add"); mochi.mood("happy"); mochi.say(frase("aggiunto"));
});

// ---------- VOLANTINI UFFICIALI DELLE CATENE (via ponte) ----------
export const FLY_TXT = "mochi.flyertext", CH_CHECK = "mochi.chainCheck";
// catene attive: quelle con adattatore dedicato scelte dall'utente + le pagine ufficiali dei suoi negozi
export const myChains = () => PROXY() ? [...(state.settings.catene || []).map(id => chains.CHAINS[id]).filter(Boolean),
  ...(state.settings.pagine || []).filter(p => chains.officialChainOf(p.url)).map(chains.pageChain)] : [];
export const chainOf = id => myChains().find(c => c.id === id) || null;
export let chainRun = null;
export async function refreshChains({ manual = false } = {}) {
  const list = myChains(); if (!list.length || chainRun) return chainRun;
  if (!manual && Date.now() - lsGet(CH_CHECK, 0) < 12 * 3600e3) { matchChainTexts(); return; }
  const btn = $("#ch-refresh"), msg = $("#fl-msg"), prog = $("#fl-prog");
  chainRun = (async () => {
    btn.disabled = true; btn.classList.add("loading"); prog.hidden = false; prog.removeAttribute("value");
    const cache = lsGet(FLY_TXT, {}), oggi = oggiISO(); let errori = 0;
    // scaduti; i PDF senza date (pagine ufficiali) valgono al massimo 14 giorni
    for (const k of Object.keys(cache)) if ((cache[k].fine && cache[k].fine < oggi) || (!cache[k].fine && Date.now() - (cache[k].at || 0) > 14 * 864e5)) delete cache[k];
    try {
      for (const ch of list) {
        let fl = [];
        try { fl = await ch.flyers(PROXY()); } catch { errori++; toast(t("ch.err", { chain: ch.nome }), "warn"); continue; }
        for (const f of fl) {
          if (cache[f.id]) continue;
          msg.textContent = t("ch.loading", { chain: ch.nome, name: f.nome });
          try {
            const text = await flyer.readFlyer(await ch.pdf(PROXY(), f), flyer.ocrLang(lang()), ev => { if (ev.step === "page") msg.textContent = `${t("ch.loading", { chain: ch.nome, name: f.nome })} ${t("fl.page", { page: ev.page, pages: ev.pages })}`; });
            cache[f.id] = { fine: f.fine, at: Date.now(), text: text.slice(0, 400000), f };
            try { await ingestFlyer(text, { negozio: ch.nome, validoFino: f.fine, fonte: f.url }); } catch {}
            try { localStorage.setItem(FLY_TXT, JSON.stringify(cache)); } catch { delete cache[f.id]; }
          } catch { errori++; }
          mutate((s, now) => { s.volantini[f.id] = { id: f.id, catena: f.catena, nome: f.nome, fine: f.fine, url: f.url, letto: now, updatedAt: now }; });
        }
      }
      lsSet(CH_CHECK, Date.now());
      const n = matchChainTexts();
      msg.textContent = t("ch.done", { n });
      if (manual || n) toast(t("ch.done", { n }), "store");
    } finally { btn.disabled = false; btn.classList.remove("loading"); prog.hidden = true; chainRun = null; }
  })();
  return chainRun;
}
/** Cerca i prodotti della lista nei volantini già scaricati e aggiorna i prezzi automatici. */
export function matchChainTexts() {
  const cache = lsGet(FLY_TXT, {}), names = flyerNames(), oggi = oggiISO(); let n = 0;
  const nuovi = {};
  for (const { text, f, fine, at } of Object.values(cache)) {
    if (!f || (fine && fine < oggi) || (!fine && Date.now() - (at || 0) > 14 * 864e5)) continue;
    const ch = chainOf(f.catena); if (!ch) continue;
    for (const x of flyer.findProducts(text, names)) {
      const id = "auto-" + hash(`${f.id}|${x.nome}|${x.prezzo}`);
      nuovi[id] = { id, nome: x.nome, riga: x.riga, prezzo: x.prezzo, prezzoUnit: x.prezzoUnit, negozio: ch.nome, validoFino: f.fine, data: oggi, fonte: f.url, auto: f.id };
    }
  }
  const cur = state.prezzi;
  const cambia = Object.keys(nuovi).some(id => !cur[id] || cur[id].deleted && !cur[id].tolto) ||
    Object.values(cur).some(p => p.auto && !p.deleted && !nuovi[p.id]);
  n = Object.keys(nuovi).length;
  if (cambia) mutate((s, now) => {
    for (const [id, p] of Object.entries(nuovi)) if (!s.prezzi[id] || (s.prezzi[id].deleted && !s.prezzi[id].tolto)) s.prezzi[id] = { ...p, ts: now, updatedAt: now };
    for (const p of Object.values(s.prezzi)) if (p.auto && !p.deleted && !nuovi[p.id]) s.prezzi[p.id] = { ...p, deleted: true, updatedAt: now };
  });
  return n;
}
$("#ch-refresh").addEventListener("click", () => refreshChains({ manual: true }));

// tutti i prezzi di un volantino nel database locale (con l'IA se c'è una chiave, altrimenti a regole)
export async function ingestFlyer(text, { negozio, validoFino = "", fonte = "", origine = "volantino" }) {
  let items = [];
  if (ai.ready(false)) {
    for (const part of pricedb.chunks(text).slice(0, 10)) {
      try { items.push(...await ai.estraiPrezzi({ testo: part, lingua: langName() })); }
      catch { items.push(...pricedb.guessAll(part)); }
    }
  } else items = pricedb.guessAll(text);
  const oggi = oggiISO();
  return pricedb.add(items.map(x => ({ ...x, negozio, validoFino, fonte, origine, data: oggi })));
}

// ---------- LEGGI UN VOLANTINO ----------
export const flyerNames = () => [...new Map([...live(state.monitor).map(m => m.nome), ...live(state.items).filter(i => !i.fatto).map(i => i.nome)]
  .map(n => [pantry.norm(n), n])).values()];
export function renderFlyerBest() {
  $("#ch-refresh").hidden = !myChains().length;
  const nomi = flyerNames(), rows = [];
  for (const n of nomi) { const b = flyer.bestSaved(n, live(state.prezzi))[0]; if (b) rows.push([n, b]); }
  $("#fl-best").innerHTML = rows.length ? rows.map(([n, b]) => `<li><span class="fl-n">${esc(n)}</span>
      <span class="fl-p">${money(b.prezzo)}</span><span class="fl-w">${ic("store")} ${esc(b.negozio)} · ${esc(b.validoFino ? t("deals.until", { date: shortDate(b.validoFino) }) : t("fl.note", { date: shortDate(b.data) }))}</span>
      <button class="icon-btn" type="button" data-fldel="${esc(b.id)}" aria-label="${esc(t("fl.remove", { name: n, store: b.negozio }))}">${ic("delete")}</button></li>`).join("")
    : `<li class="hint">${esc(t("fl.bestEmpty"))}</li>`;
}
$("#fl-best").addEventListener("click", e => {
  const b = e.target.closest("[data-fldel]"); if (!b) return;
  const id = b.dataset.fldel, prev = state.prezzi[id];
  mutate((s, now) => { s.prezzi[id] = { ...s.prezzi[id], deleted: true, tolto: true, updatedAt: now }; });
  toast(t("pref.removed"), "delete", { label: t("common.undo"), run: () => mutate((s, now) => { s.prezzi[id] = { ...prev, deleted: false, tolto: false, updatedAt: now }; }) });
});
$("#fl-btn").addEventListener("click", () => {
  if (!flyerNames().length) { toast(t("fl.needProducts"), "info"); $("#mon-nome").focus(); return; }
  $("#fl-file").click();
});
export let sharedStore = "";
$("#fl-file").addEventListener("change", async e => {
  // uno o più file: PDF del volantino o screenshot delle pagine (es. dalla condivisione di più immagini)
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  const negozi = [...new Set([sharedStore, ...live(state.prezzi).map(p => p.negozio), ...String(state.settings.negozi || "").split(",").map(x => x.trim())].filter(Boolean))];
  const q = await sheet({
    title: t("fl.title"), icon: "scan",
    body: `<p class="hint">${ic("flyer")} ${esc(files.length > 1 ? t("fl.files", { n: files.length }) : files[0].name)}</p>
      <label for="fl-store">${esc(t("fl.store"))}</label><input id="fl-store" name="negozio" list="fl-stores" maxlength="40" required autocomplete="off" value="${esc(negozi[0] || "")}">
      <datalist id="fl-stores">${negozi.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <label for="fl-until">${esc(t("fl.until"))}</label><input id="fl-until" name="fino" type="date">`,
    buttons: [{ value: "ok", label: t("fl.read"), icon: "scan", primary: true }, { value: "", label: t("common.cancel"), icon: "close" }],
  });
  sharedStore = "";
  const negozio = String(q.form?.get("negozio") || "").trim();
  if (q.value !== "ok" || !negozio) return;
  const fino = String(q.form.get("fino") || "");
  const btn = $("#fl-btn"), prog = $("#fl-prog"), msg = $("#fl-msg");
  btn.disabled = true; btn.classList.add("loading"); prog.hidden = false; prog.removeAttribute("value");
  mochi.mood("wow", 0); mochi.say(frase("guardo"), 120000);
  let text = "";
  try {
    const parts = [];
    for (const [i, file] of files.entries()) {
      const pre = files.length > 1 ? t("fl.fileN", { i: i + 1, n: files.length }) + " · " : "";
      parts.push(await flyer.readFlyer(file, flyer.ocrLang(lang()), ev => {
        if (ev.step === "load") { msg.textContent = pre + t("fl.loading"); prog.removeAttribute("value"); }
        if (ev.step === "page") { msg.textContent = pre + t("fl.page", { page: ev.page, pages: ev.pages }); prog.value = (i + (ev.page - 1) / ev.pages) / files.length; }
      }));
    }
    text = parts.join("\f"); // una "pagina" per file: l'estrazione con l'IA lavora pagina per pagina
  } catch (err) { msg.textContent = t("fl.err"); toast(t("fl.err"), "warn"); mochi.mood("sleepy", 2000); return; }
  finally { btn.disabled = false; btn.classList.remove("loading"); prog.hidden = true; }
  const found = flyer.findProducts(text, flyerNames());
  msg.textContent = "";
  ingestFlyer(text, { negozio, validoFino: fino }).then(n => { if (n) { renderDb(); toast(t("db.saved", { n }), "store"); } }).catch(() => {});
  if (!found.length) { msg.textContent = t("fl.none"); mochi.mood("sleepy", 2000); mochi.say(frase("niente")); return; }
  mochi.mood("happy", 1500);
  const r = await sheet({
    title: t("fl.foundTitle"), icon: "scan",
    body: `<p class="hint">${esc(t("fl.foundHint"))} ${ic("store")} <strong>${esc(negozio)}</strong></p><ul class="fl-found">${found.map((f, i) => `<li>
      <label class="check"><input type="checkbox" name="ok-${i}" checked> <strong>${esc(f.nome)}</strong></label>
      <span class="hint">${esc(f.riga)}</span>
      <label class="sr" for="flp-${i}">${esc(t("rate.price"))}</label><input id="flp-${i}" name="p-${i}" inputmode="decimal" value="${f.prezzo.toFixed(2).replace(".", (1.5).toLocaleString(locale())[1])}"></li>`).join("")}</ul>`,
    buttons: [{ value: "ok", label: t("fl.save"), icon: "save", primary: true }, { value: "", label: t("common.cancel"), icon: "close" }],
  });
  if (r.value !== "ok") return;
  const oggi = oggiISO(); let n = 0;
  mutate((s, now) => {
    found.forEach((f, i) => {
      if (!r.form.get("ok-" + i)) return;
      const prezzo = num(r.form.get("p-" + i)); if (!(prezzo > 0)) return;
      const id = uid(); n++;
      s.prezzi[id] = { id, nome: f.nome, riga: f.riga, prezzo, prezzoUnit: f.prezzoUnit, negozio, validoFino: fino, data: oggi, ts: now, updatedAt: now };
    });
  });
  toast(t("fl.saved", { n }), "save"); if (n) confetti();
});

// ---------- I MIEI PREZZI (database locale) ----------
export function renderDb() {
  const list = pricedb.cached(), q = $("#db-q").value.trim();
  $("#db-count").textContent = list.length ? "· " + t("db.count", { n: list.length }) : "";
  $("#db-clear").hidden = !list.length;
  $("#db-stores").innerHTML = [...new Set([...(amzOn() ? ["Amazon"] : []), ...list.map(r => r.negozio).filter(Boolean)])].slice(0, 40).map(n => `<option value="${esc(n)}">`).join("");
  if (!q) { $("#db-out").innerHTML = list.length ? "" : `<p class="hint">${esc(t("db.empty"))}</p>`; return; }
  const rows = pricedb.search(q);
  if (!rows.length) { $("#db-out").innerHTML = `<p class="hint">${esc(t("deals.none"))}</p>`; return; }
  const best = pricedb.byStore(rows);
  $("#db-out").innerHTML = `<ul class="db-best">${best.map(b => `<li><strong>${esc(b.negozio)}</strong> <span class="fl-p">${money(b.min.prezzo)}</span>
      <span class="hint">${esc(b.min.nome)} · ${esc(shortDate(b.min.data))}${b.n > 1 ? ` · ${esc(t("db.history"))}: ${b.n}` : ""}</span></li>`).join("")}</ul>
    <details class="adv"><summary>${esc(t("db.history"))} (${rows.length})</summary><ul class="db-list">${rows.slice(0, 60).map(r => `<li><span>${esc(r.nome)}</span>
      <span class="hint">${esc(r.negozio || "?")} · ${esc(shortDate(r.data))}</span><span class="fl-p">${money(r.prezzo)}</span>
      <button class="icon-btn" type="button" data-dbdel="${esc(r.id)}" aria-label="${esc(t("fl.remove", { name: r.nome, store: r.negozio || "?" }))}">${ic("delete")}</button></li>`).join("")}</ul></details>`;
}
export let dbT; $("#db-q").addEventListener("input", () => { clearTimeout(dbT); dbT = setTimeout(renderDb, 200); });
$("#db-out").addEventListener("click", async e => { const b = e.target.closest("[data-dbdel]"); if (!b) return; await pricedb.remove(b.dataset.dbdel); renderDb(); toast(t("pref.removed"), "delete"); });
$("#f-db").addEventListener("submit", async e => {
  e.preventDefault();
  const n = await pricedb.add([{ nome: $("#db-nome").value, prezzo: num($("#db-prezzo").value), negozio: $("#db-negozio").value, origine: "manuale" }]);
  if (!n) { toast(t("err.unreadable"), "warn"); return; }
  $("#db-q").value = $("#db-nome").value; $("#db-nome").value = ""; $("#db-prezzo").value = "";
  renderDb(); renderOfferte(); toast(t("db.saved", { n }), "save"); $("#db-nome").focus();
});
$("#db-clear").addEventListener("click", async () => {
  if (!(await confirmDlg(t("db.clearConfirm"), t("db.clear"), "delete"))) return;
  await pricedb.clear(); renderDb(); toast(t("db.cleared"), "delete");
});
pricedb.all().then(() => pricedb.prune()).then(() => { renderDb(); renderOfferte(); }).catch(() => {});
// arrivo da "Condividi" di un'altra app: link/testo → ricerca; screenshot o PDF → lettura prezzi
export async function takeShare() {
  if (!new URLSearchParams(location.search).has("share") || !("caches" in window)) return;
  history.replaceState(null, "", location.pathname);
  const c = await caches.open("mochi-share");
  const tx = await c.match("./shared-text"), fr = await c.match("./shared-file");
  await c.delete("./shared-text"); await c.delete("./shared-file");
  selectTab($("#t-offerte"));
  // file condivisi: ./shared-file-0, -1, … (anche tante pagine di volantino insieme)
  const dt = new DataTransfer();
  for (let i = 0; i < 30; i++) {
    const r = await c.match("./shared-file-" + i); if (!r) break;
    await c.delete("./shared-file-" + i);
    const blob = await r.blob();
    dt.items.add(new File([blob], decodeURIComponent(r.headers.get("x-name") || "screenshot-" + (i + 1)), { type: blob.type }));
  }
  if (fr) { const blob = await fr.blob(); dt.items.add(new File([blob], decodeURIComponent(fr.headers.get("x-name") || "screenshot"), { type: blob.type })); }
  if (dt.files.length) {
    const d = tx ? await tx.clone().json().catch(() => ({})) : {};
    const txt = [d.title, d.text, d.url].join(" ").toLowerCase();
    // screenshot da Amazon: negozio già proposto; altrimenti l'ultimo usato
    sharedStore = /amazon|amzn/.test(txt) ? "Amazon" : "";
    const inp = $("#fl-file"); inp.files = dt.files; inp.dispatchEvent(new Event("change"));
    return;
  }
  if (tx) {
    const d = await tx.json(), sh = best.fromShare(d.title, d.text, d.url);
    if (!sh.q && !sh.url) return;
    $("#best-q").value = sh.q || sh.url; findBest(sh.q || sh.url, sh.url);
  }
}
takeShare().catch(() => {});
{ const lb = lsGet(BEST_KEY, null); if (lb && lb.q) { $("#best-q").value = lb.q; renderBest(lb); } }

// ---------- DOVE CONVIENE? ----------
export const prefOf = (prodotto, negozio) => live(state.preferenze).find(p => pantry.sameProduct(p.prodotto, prodotto) && pantry.norm(p.negozio) === pantry.norm(negozio));
export function togglePref(prodotto, negozio, tipo) {
  const p = prefOf(prodotto, negozio);
  mutate((s, now) => {
    if (p && p.tipo === tipo) s.preferenze[p.id] = { ...p, deleted: true, updatedAt: now };
    else { const id = p ? p.id : uid(); s.preferenze[id] = { id, prodotto, negozio, tipo, updatedAt: now }; }
  });
}
export function compareBody() {
  const items = live(state.items).filter(i => !i.fatto);
  const res = state.confronto.prodotti || [];
  let tot = 0, h = "";
  for (const it of items) {
    const r = res.find(x => x.id === it.id) || res.find(x => pantry.sameProduct(x.nome || "", it.nome));
    let ops = (r && Array.isArray(r.opzioni) ? r.opzioni : []).filter(o => o && o.negozio && typeof o.prezzo === "number");
    const az = amzOn() && !ops.some(o => isAmazon(o.negozio)) ? amzSaved(it.nome) : null;
    if (az) ops = [...ops, { negozio: "Amazon", prezzo: az.prezzo, prezzoUnit: az.prezzoUnit, fonte: amazonSearch(it.nome, paese()), validoFino: null }];
    const evitati = ops.filter(o => prefOf(it.nome, o.negozio)?.tipo === "evita");
    ops = ops.filter(o => !evitati.includes(o)).sort((a, b) => (prefOf(it.nome, b.negozio)?.tipo === "preferito") - (prefOf(it.nome, a.negozio)?.tipo === "preferito") || a.prezzo - b.prezzo);
    const sel = $("#sheet-body").querySelector(`input[name="${CSS.escape(it.id)}"]:checked`)?.value
      ?? (ops.findIndex(o => it.negozio && pantry.norm(o.negozio) === pantry.norm(it.negozio)) >= 0 ? String(ops.findIndex(o => pantry.norm(o.negozio) === pantry.norm(it.negozio))) : ops.length ? "0" : "");
    const chosen = ops[+sel]; if (chosen) tot += chosen.prezzo;
    h += `<fieldset class="cmp-item"><legend>${esc(it.nome)}${it.qta ? ` <span class="q">· ${esc(it.qta)}</span>` : ""}</legend>`;
    if (!ops.length) h += `<p class="hint">${esc(t("cmp.noData"))}</p>`;
    ops.forEach((o, i) => {
      const pf = prefOf(it.nome, o.negozio)?.tipo === "preferito";
      const src = safeUrl(o.fonte);
      h += `<div class="cmp-opt${pf ? " fav" : ""}"><label><input type="radio" name="${esc(it.id)}" value="${i}" data-price="${o.prezzo}"${String(i) === sel ? " checked" : ""}>
        <span class="txt"><span class="n">${pf ? ic("star") + " " : ""}${esc(o.negozio)}</span>
        <span class="meta">${money(o.prezzo)}${o.prezzoUnit ? " · " + esc(perUnit(o.prezzoUnit, o.unita)) : ""}${o.offerta ? ` · <strong>${esc(t("cmp.deal"))}</strong>` : ""}${o.validoFino ? " · " + esc(t("deals.until", { date: o.validoFino })) : ""}</span></span></label>
        ${src ? `<a class="icon-btn" href="${esc(src)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t("deals.flyer"))} ${esc(o.negozio)} ${esc(t("a11y.newTab"))}">${ic("external")}</a>` : ""}
        <button class="icon-btn" type="button" data-fav="${esc(it.id)}|${esc(o.negozio)}" aria-pressed="${pf}" aria-label="${esc(t("pref.fav", { product: it.nome, store: o.negozio }))}">${ic(pf ? "star" : "star-line")}</button>
        <button class="icon-btn danger" type="button" data-avoid="${esc(it.id)}|${esc(o.negozio)}" aria-label="${esc(t("pref.avoid", { product: it.nome, store: o.negozio }))}">${ic("avoid")}</button></div>`;
    });
    if (amzOn() && !ops.some(o => isAmazon(o.negozio))) h += `<p class="cmp">${amzLink(it.nome)}</p>`;
    if (evitati.length) h += `<p class="hint">${ic("avoid")} ${esc(t("cmp.hidden", { n: evitati.length, stores: evitati.map(o => o.negozio).join(", ") }))}</p>`;
    h += `</fieldset>`;
  }
  h += `<p class="cmp-total" aria-live="polite">${esc(t("cmp.total", { total: money(tot) }))}</p>
    <p class="hint">${esc(t("cmp.when", { when: state.confronto.updatedAt ? quando(state.confronto.updatedAt) : "–" }))}</p>${state.confronto.fonte === "openprices" && (state.confronto.prodotti || []).some(r => (r.opzioni || []).some(o => o.op)) ? OP_CREDIT() + `<p class="hint">${ic("key")} ${esc(t("free.moreWithKey"))}</p>` : ""}`;
  return h;
}
$("#sheet-body").addEventListener("click", e => {
  const b = e.target.closest("[data-fav], [data-avoid]"); if (!b) return;
  const [id, negozio] = (b.dataset.fav || b.dataset.avoid).split("|");
  const it = state.items[id]; if (!it) return;
  togglePref(it.nome, negozio, b.dataset.fav ? "preferito" : "evita");
  $("#sheet-body").innerHTML = compareBody();
  $("#sheet-body").querySelector(`[data-${b.dataset.fav ? "fav" : "avoid"}="${CSS.escape(id + "|" + negozio)}"]`)?.focus();
});
$("#sheet-body").addEventListener("change", e => {
  if (!e.target.matches('.cmp-item input[type="radio"]')) return;
  const tot = [...$("#sheet-body").querySelectorAll('.cmp-item input[type="radio"]:checked')].reduce((n, r) => n + (+r.dataset.price || 0), 0);
  const el = $("#sheet-body").querySelector(".cmp-total"); if (el) el.textContent = t("cmp.total", { total: money(tot) });
});
export async function openCompare() {
  const r = await sheet({
    title: t("cmp.title"), icon: "store", body: compareBody(),
    buttons: [{ value: "ok", label: t("cmp.apply"), icon: "ok", primary: true }, { value: "again", label: t("cmp.again"), icon: "refresh" }, { value: "", label: t("common.close"), icon: "close" }],
  });
  if (r.value === "again") return runCompare();
  if (r.value !== "ok") return;
  const res = state.confronto.prodotti || [];
  mutate((s, now) => {
    for (const it of live(s.items).filter(i => !i.fatto)) {
      const v = r.form.get(it.id); if (v == null) continue;
      const rr = res.find(x => x.id === it.id) || res.find(x => pantry.sameProduct(x.nome || "", it.nome));
      let ops = (rr && rr.opzioni || []).filter(o => o && o.negozio && typeof o.prezzo === "number" && prefOf(it.nome, o.negozio)?.tipo !== "evita")
        .sort((a, b) => (prefOf(it.nome, b.negozio)?.tipo === "preferito") - (prefOf(it.nome, a.negozio)?.tipo === "preferito") || a.prezzo - b.prezzo);
      const o = ops[+v]; if (o) s.items[it.id] = { ...it, negozio: o.negozio, prezzo: o.prezzo, updatedAt: now };
    }
  });
  toast(t("cmp.applied"), "store"); mochi.mood("happy");
}
export async function runCompare() {
  const s0 = state.settings, btn = $("#compare");
  if (!s0.luogo) { toast(t("geo.ask"), "pin"); selectTab($("#t-imp")); $("#z-luogo").focus(); return; }
  const prodotti = live(state.items).filter(i => !i.fatto).slice(0, 25).map(i => ({ id: i.id, nome: i.nome, qta: i.qta || "" }));
  if (myChains().length) { btn.classList.add("loading"); try { await refreshChains(); } catch {} btn.classList.remove("loading"); }
  if (!ai.ready()) {
    const pt = searchPoint(); if (!pt) { toast(t("geo.ask"), "pin"); return; }
    btn.classList.add("loading"); btn.setAttribute("aria-busy", "true");
    try {
      let prices = []; try { prices = await op.nearby({ ...pt, raggioKm: Math.max(s0.raggioKm || 5, 10) }); } catch {}
      const res = prodotti.map(p => ({ id: p.id, nome: p.nome, opzioni: mergeOptions([
        ...savedOptions(p.nome),
        ...op.bestFor(p.nome, prices).map(x => ({ negozio: x.negozio, prezzo: x.prezzo, offerta: x.sconto, fonte: op.priceUrl(x.id), nota: opNote(x), op: true })),
      ]) }));
      mutate((s, now) => { s.confronto = { prodotti: res, fonte: "openprices", updatedAt: now }; });
      openCompare();
    } catch (err) { toast(err.message, "warn"); }
    finally { btn.classList.remove("loading"); btn.removeAttribute("aria-busy"); }
    return;
  }
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true"); mochi.mood("wow", 0); mochi.say(frase("cerco"), 90000);
  toast(t("cmp.searching"), "search");
  try {
    const a0 = away();
    const luogo = a0 ? `${a0.nome} (lat ${a0.lat}, lon ${a0.lon})` : s0.lat != null ? `${s0.luogo} (lat ${s0.lat}, lon ${s0.lon})` : s0.luogo;
    const prefs = live(state.preferenze);
    const res = await ai.confrontaPrezzi({ prodotti, luogo, raggioKm: s0.raggioKm, negozi: s0.negozi, amazon: s0.amazon !== false, valuta: currency(), lingua: langName(),
      preferiti: prefs.filter(p => p.tipo === "preferito").map(p => ({ prodotto: p.prodotto, negozio: p.negozio })),
      evitati: prefs.filter(p => p.tipo === "evita").map(p => ({ prodotto: p.prodotto, negozio: p.negozio })) });
    // i volantini ufficiali letti sul telefono vincono sulle stime dell'IA per lo stesso negozio
    for (const r of res) { const p = prodotti.find(x => x.id === r.id); if (p) r.opzioni = mergeOptions([...savedOptions(p.nome), ...(r.opzioni || [])]); }
    mutate((s, now) => { s.confronto = { prodotti: res, fonte: "ai", updatedAt: now }; });
    mochi.mood("happy", 2000); mochi.say(frase("offerta"));
    openCompare();
  } catch (err) { toast(err.message, "warn"); mochi.mood("sleepy", 2000); mochi.say(frase("errore")); }
  finally { btn.classList.remove("loading"); btn.removeAttribute("aria-busy"); }
}
$("#compare").addEventListener("click", () => state.confronto.updatedAt && Date.now() - state.confronto.updatedAt < 6 * 3600e3 &&
  live(state.items).filter(i => !i.fatto).every(i => (state.confronto.prodotti || []).some(x => x.id === i.id)) ? openCompare() : runCompare());

// Preferenze nelle impostazioni
export function renderPrefs() {
  const ps = live(state.preferenze).sort((a, b) => a.tipo.localeCompare(b.tipo) || a.prodotto.localeCompare(b.prodotto));
  $("#pref-list").innerHTML = ps.length ? ps.map(p => `<li class="chip ${p.tipo === "evita" ? "avoid" : "fav"}">${ic(p.tipo === "evita" ? "avoid" : "star")}
    <span>${esc(t(p.tipo === "evita" ? "pref.lineAvoid" : "pref.lineFav", { product: p.prodotto, store: p.negozio }))}</span>
    <button class="icon-btn" type="button" data-prdel="${esc(p.id)}" aria-label="${esc(t("pref.remove"))}">${ic("close")}</button></li>`).join("")
    : `<li class="hint">${esc(t("pref.empty"))}</li>`;
}
$("#pref-list").addEventListener("click", e => {
  const b = e.target.closest("[data-prdel]"); if (!b) return;
  mutate((s, now) => { s.preferenze[b.dataset.prdel] = { ...s.preferenze[b.dataset.prdel], deleted: true, updatedAt: now }; });
  toast(t("pref.removed"), "close");
});

// ---------- MONITOR / OFFERTE ----------
$("#mon-nome").addEventListener("input", e => {
  const v = e.target.value;
  if (/detersiv.*(lavatric|bucato)|ammorbid|lavastovigl|capsul|pods|laundry|softener|dishwasher/i.test(v)) $("#mon-unita").value = "lavaggi";
  else if (/olio|latte|acqua|vino|candeggin|sgrassat|\boil\b|milk|water|wine|bleach/i.test(v)) $("#mon-unita").value = "litri";
});
$("#f-mon").addEventListener("submit", e => {
  e.preventDefault();
  const nome = $("#mon-nome").value.trim(); if (!nome) return $("#mon-nome").focus();
  mutate((s, now) => { const id = uid(); s.monitor[id] = { id, nome, unita: $("#mon-unita").value, updatedAt: now }; });
  $("#mon-nome").value = ""; toast(t("toast.watching", { name: nome }), "watch"); mochi.mood("wow"); mochi.say(frase("guardo"));
});
$("#monitor").addEventListener("click", e => {
  const b = e.target.closest("[data-mdel]"); if (!b) return;
  const id = b.dataset.mdel, nome = state.monitor[id]?.nome;
  mutate((s, now) => { s.monitor[id] = { ...s.monitor[id], deleted: true, updatedAt: now }; });
  $("#mon-nome").focus(); toast(t("toast.removed", { name: nome }), "unwatch");
});
$("#offerte").addEventListener("click", e => {
  const b = e.target.closest("[data-addoff]"); if (!b) return;
  const x = renderOfferte.sorted[+b.dataset.addoff]; if (!x) return;
  mutate((s, now) => {
    const id = uid();
    s.items[id] = { id, nome: x.prodotto, qta: "", cat: catOf((x.categoria || "") + " " + x.prodotto), fatto: false, da: me().nome,
      nota: t("deals.offerNote", { store: x.negozio || "", price: money(x.prezzo) }) + (x.validoFino ? " · " + t("deals.until", { date: x.validoFino }) : ""), ts: now, updatedAt: now };
  });
  sparkles(b); toast(t("toast.addedList"), "list-add"); mochi.mood("happy"); mochi.say(frase("aggiunto"));
});

export let searching = null;
export function endSearch() { searching = null; $("#cerca").classList.remove("loading"); $("#cerca").removeAttribute("aria-busy"); }
$("#cerca").addEventListener("click", async () => {
  if (searching) return;
  const btn = $("#cerca");
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true");
  $("#off-info").textContent = t("deals.searching");
  mochi.mood("wow", 0); mochi.say(frase("cerco"), 60000);
  searching = new AbortController();
  try {
    await checkAway({ ask: true, modal: true });
    const s0 = state.settings, a0 = away();
    const luogo = a0 ? `${a0.nome} (lat ${a0.lat}, lon ${a0.lon})` : s0.lat != null ? `${s0.luogo} (lat ${s0.lat}, lon ${s0.lon})` : s0.luogo;
    let offerte;
    if (ai.ready()) offerte = await ai.cercaOfferte({ prodotti: live(state.monitor), ...s0, luogo, valuta: currency(), lingua: langName() }, { signal: searching.signal });
    else {
      const pt = searchPoint(); if (!pt) throw new Error(t("geo.ask"));
      let prices = []; try { prices = await op.nearby({ ...pt, raggioKm: Math.max(s0.raggioKm || 5, 10) }, { signal: searching.signal }); } catch (e) { if (e.name === "AbortError") throw e; }
      offerte = live(state.monitor).flatMap(m => flyer.bestSaved(m.nome, live(state.prezzi)).slice(0, 2).map(x => ({
        prodotto: x.riga || x.nome, categoria: m.nome, negozio: x.negozio, prezzo: x.prezzo, quantita: null, unita: m.unita, prezzoUnit: x.prezzoUnit,
        validoFino: x.validoFino ? shortDate(x.validoFino) : null, fonte: x.fonte || "", amazon: null, voto: null, nota: t("fl.note", { date: shortDate(x.data) }) })))
        .concat(live(state.monitor).flatMap(m => op.bestFor(m.nome, prices, 3).map(x => ({
        prodotto: [x.marca, x.nome].filter(Boolean).join(" · "), categoria: m.nome, negozio: x.citta ? `${x.negozio} · ${x.citta}` : x.negozio,
        prezzo: x.prezzo, quantita: null, unita: m.unita, prezzoUnit: op.unitPrice(x, m.unita), validoFino: null,
        fonte: op.priceUrl(x.id), amazon: null, voto: null, nota: opNote(x), gratis: true }))));
    }
    endSearch();
    mutate((st, now) => { st.offerte = { list: offerte, updatedAt: now }; });
    const top = offerte.filter(o => o.voto === "ottima").length;
    mochi.mood("happy", 2500); mochi.say(frase(offerte.length ? "offerta" : "niente"));
    toast(!offerte.length ? t("deals.foundNone") : top ? t("deals.foundTop", { n: offerte.length, top }) : t("deals.found", { n: offerte.length }), top ? "star" : "search");
    if (top) confetti();
  } catch (err) {
    endSearch(); renderOfferte();
    mochi.mood("sleepy", 2500); mochi.say(frase("errore"));
    $("#off-info").innerHTML = `${ic("warn")} ${esc(err.message)}`;
  }
});

// ---------- VALUTA ----------
export const words = s => (s || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3);
export const readVal = () => ({ testo: $("#val-testo").value.trim(), prezzo: num($("#val-prezzo").value), quantita: num($("#val-q").value), unita: $("#val-u").value });
$("#val-calc").addEventListener("click", () => {
  const { testo, prezzo, quantita, unita } = readVal(), out = $("#val-out");
  if (!prezzo || !quantita) { out.innerHTML = `<p class="hint">${ic("info")} ${esc(t("rate.needPQ"))}</p>`; (!prezzo ? $("#val-prezzo") : $("#val-q")).focus(); return; }
  const pu = prezzo / quantita, w = words(testo);
  const simili = state.offerte.list.filter(o => o.unita === unita && o.prezzoUnit > 0 && (!w.length || words(o.prodotto + " " + (o.categoria || "")).some(x => w.includes(x))));
  const best = simili.sort((a, b) => a.prezzoUnit - b.prezzoUnit)[0];
  let h = `<div class="result"><div class="bigv">${money3(pu)}</div><div class="unit">${esc(t("unitPer." + unita))}</div>`;
  if (best) {
    const p = Math.round((pu / best.prezzoUnit - 1) * 100);
    h += p <= 0 ? `<p><span class="badge gold">${ic("star")} ${esc(t("verdict.good"))}</span> ${esc(p < 0 ? t("rate.cheapText", { p: -p, store: best.negozio }) : t("rate.sameText", { store: best.negozio }))}</p>`
                : `<p><span class="badge warn">${ic("warn")} ${esc(t("rate.dear"))}</span> ${esc(t("rate.dearText", { store: best.negozio, price: perUnit(best.prezzoUnit, unita), p }))}</p>`;
  } else h += `<p class="hint">${esc(t("rate.noCompare"))}</p>`;
  out.innerHTML = h + "</div>";
  mochi.mood(best && pu <= best.prezzoUnit ? "happy" : "wow");
});
$("#f-val").addEventListener("submit", async e => {
  e.preventDefault();
  const v = readVal(), btn = $("#val-ask"), out = $("#val-out");
  if (!v.testo) { out.innerHTML = `<p class="hint">${ic("info")} ${esc(t("rate.needWhat"))}</p>`; $("#val-testo").focus(); return; }
  const webOk = ai.ready(true), textOk = ai.ready(false);
  if (!webOk && !textOk) { out.innerHTML = `<p class="hint">${ic("key")} ${esc(t("ai.none"))}</p>`; return; }
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true"); btn.disabled = true;
  out.innerHTML = `<p class="hint">${esc(t("rate.checking"))}</p>`;
  mochi.mood("wow", 0); mochi.say(frase("guardo"), 60000);
  try {
    const storico = pricedb.search(v.testo).slice(0, 30).map(r => ({ p: r.nome, n: r.negozio, prezzo: r.prezzo, u: r.prezzoUnit, d: r.data }));
    let esito;
    try { esito = webOk ? await ai.valuta({ ...v, offerte: state.offerte.list, valuta: currency(), luogo: state.settings.luogo, lingua: langName() }) : null; }
    catch (e) { if (!textOk) throw e; }
    if (!esito) esito = await ai.valutaOffline({ ...v, storico, valuta: currency(), lingua: langName() });
    mutate((s, now) => { const id = uid(); s.valutazioni[id] = { id, ...v, esito, da: me().nome, ts: now, updatedAt: now }; });
    out.innerHTML = `<p class="hint">${ic("ok")} ${esc(t("rate.done"))}</p>`;
    mochi.mood(esito.voto === "conveniente" ? "happy" : "wow", 2500);
    mochi.say(frase(esito.voto === "conveniente" ? "affare" : esito.voto === "caro" ? "caro" : "media"));
    document.querySelector("#valutazioni article")?.scrollIntoView({ behavior: motionOk() ? "smooth" : "auto", block: "nearest" });
  } catch (err) {
    out.innerHTML = `<p class="hint">${ic("warn")} ${esc(err.message)}</p>`; mochi.mood("sleepy", 2500); mochi.say(frase("errore"));
  } finally { btn.classList.remove("loading"); btn.removeAttribute("aria-busy"); btn.disabled = false; }
});
$("#valutazioni").addEventListener("click", e => {
  const b = e.target.closest("[data-vdel]"); if (!b) return;
  mutate((s, now) => { s.valutazioni[b.dataset.vdel] = { ...s.valutazioni[b.dataset.vdel], deleted: true, updatedAt: now }; });
  $("#val-testo").focus(); toast(t("rate.deleted"), "delete");
});

