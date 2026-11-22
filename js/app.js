import { getTheme, applyTheme } from "./theme.js";
import { frase } from "./mascot.js";
import { catId, iconOf, ORDER, parseAdd } from "./categories.js";
import { live } from "./store.js";
import { t, setLang, detect, lang, locale, LANGS } from "./i18n.js";
import { APP_VERSION, novitaDopo } from "./version.js";
import * as dbx from "./dropbox.js";
import * as ai from "./ai/index.js";
import * as voice from "./voice.js";
import { amazonSearch } from "./amazon.js";
import { $, DBX_CFG_KEY, amzLink, amzOn, amzSaved, applyAnim, confetti, confirmDlg, connectDropbox, curSymbol, esc, hadState, ic, lsGet, lsSet, me, mochi, money, mutate, paese, perUnit, quando, safeUrl, seen, selectTab, setMe, sparkles, state, tabs, toast } from "./ui/core.js";
import { WIZ, openNews, openWizard, policyOk, startTour } from "./ui/onboarding.js";
import { OP_CREDIT, addToList, checkHome, checkKapibo, editQty, placeName, renderPantry, shortDate, takenFromStore } from "./ui/pantry.js";
import { renderBestHow, renderDb, renderFlyerBest, renderPrefs } from "./ui/prices.js";
import * as pricedb from "./pricedb.js";
import * as flyer from "./flyer.js";
import { fillSettings, normPath, settingsDirty } from "./ui/settings.js";
import { away, AWAY_KEY, fillCountry, usaPosizione } from "./ui/location.js";
import { sync, syncSet } from "./ui/sync.js";
export { away } from "./ui/location.js";
export { scheduleSync } from "./ui/sync.js";


// ---------- RENDER ----------
export function keepFocus(fn) {
  const a = document.activeElement, key = a && a.dataset && a.dataset.fk;
  fn();
  if (key) { const el = document.querySelector(`[data-fk="${CSS.escape(key)}"]`); if (el) el.focus({ preventScroll: true }); }
}

export function renderLista() {
  const items = live(state.items), done = items.filter(i => i.fatto).length;
  $("#progress").hidden = !items.length;
  if (items.length) {
    $("#pfill").style.width = (done / items.length * 100) + "%";
    $("#pbar").setAttribute("aria-valuemax", items.length); $("#pbar").setAttribute("aria-valuenow", done);
    $("#ptxt").textContent = done === items.length ? t("list.allDone", { total: items.length }) : t("list.progress", { done, total: items.length });
  }
  $("#clear-done").hidden = !done;
  $("#putaway").hidden = !items.some(i => i.fatto && !i.prendi);
  $("#compare").hidden = !items.some(i => !i.fatto);
  $("#swipe-hint").hidden = !items.length;
  if (!items.length) {
    $("#lista").innerHTML = `<div class="card empty">${ic("basket", "big-emoji")}<p><strong>${esc(t("list.emptyTitle"))}</strong><br>${esc(t("list.emptyText"))}</p></div>`;
    return;
  }
  const groups = {};
  for (const it of items) (groups[catId(it.cat)] ||= []).push(it);
  let h = "";
  for (const c of ORDER) {
    const g = groups[c]; if (!g) continue;
    g.sort((a, b) => (a.fatto - b.fatto) || (a.ts || 0) - (b.ts || 0));
    h += `<section class="group" aria-labelledby="g-${c}"><h2 id="g-${c}">${ic(iconOf(c), "em")}${esc(t("cat." + c))}</h2><div class="card"><ul class="items">`;
    for (const it of g) {
      const chi = it.da && it.da !== me().nome ? it.da : "";
      const isNew = !seen.has(it.id); seen.add(it.id);
      const id = esc(it.id);
      const prendi = it.prendi ? `<span class="badge store-badge">${ic("store-room")} ${esc(t("pantry.takeFrom", { place: it.prendi.label || placeName(it.prendi.luogo) }))}</span>` : "";
      const neg = it.negozio ? `<span class="badge shop-badge">${ic("store")} ${esc(it.negozio)}${it.prezzo ? " · " + money(it.prezzo) : ""}</span>` : "";
      h += `<li class="item${it.fatto ? " done" : ""}${isNew ? " new" : ""}${it.prendi ? " from-store" : ""}" data-id="${id}">
        <div class="swipe-bg" aria-hidden="true">${ic("delete")}</div>
        <div class="item-row">
        <label class="tick"><input type="checkbox" data-chk="${id}" data-fk="c${id}"${it.fatto ? " checked" : ""}>
          <span class="txt"><span class="n">${esc(it.nome)}</span>
          ${prendi || neg ? `<span class="badges">${prendi}${neg}</span>` : ""}
          ${chi ? `<span class="meta">${esc(t("list.addedBy", { name: chi }))}</span>` : ""}${it.nota ? `<span class="meta">${esc(it.nota)}</span>` : ""}</span></label>
        <button class="qty-btn" type="button" data-qty="${id}" data-fk="q${id}" aria-label="${esc(t("list.qtyFor", { name: it.nome, qty: it.qta || "–" }))}">${it.qta ? esc(it.qta) : ic("edit")}</button>
        <button class="icon-btn danger" type="button" data-del="${id}" data-fk="d${id}" aria-label="${esc(t("list.delete", { name: it.nome }))}">${ic("delete")}</button>
        </div></li>`;
    }
    h += "</ul></div></section>";
  }
  $("#lista").innerHTML = h;
}

export function renderMonitor() {
  const m = live(state.monitor).sort((a, b) => a.nome.localeCompare(b.nome));
  $("#monitor").innerHTML = m.length ? m.map(x =>
    `<li class="chip">${esc(x.nome)}<small>${esc(t("unitPer." + x.unita))}</small>
      ${amzOn() ? amzLink(x.nome, "icon-btn") : ""}<button class="icon-btn" type="button" data-mdel="${esc(x.id)}" aria-label="${esc(t("deals.unwatch", { name: x.nome }))}">${ic("unwatch")}</button></li>`).join("")
    : `<li class="hint">${esc(t("deals.noneWatched"))}</li>`;
}

export const VOTO = { ottima: ["vote.great", "gold", "star"], buona: ["vote.good", "", "down"], normale: ["vote.avg", "warn", "info"] };
export function renderOfferte() {
  const s = state.settings, o = state.offerte, key = ai.ready();
  $("#off-info").innerHTML = !s.luogo ? `${ic("pin")} ${esc(t("geo.ask"))} <button class="btn ghost" type="button" id="offerte-geo2">${ic("pin")} ${esc(t("geo.use"))}</button>`
    : o.updatedAt ? `${ic("pin")} ${esc(t("deals.last", { when: quando(o.updatedAt), km: s.raggioKm, place: s.luogo }))}`
    : `${ic("info")} ${esc(t("deals.first"))}`;
  $("#offerte-geo2")?.addEventListener("click", () => { selectTab($("#t-imp")); usaPosizione($("#geo-btn")); });
  const a0 = away();
  $("#away").innerHTML = a0 ? `<div class="card notice-card"><p>${ic("pin")} ${esc(t("geo.using", { place: a0.nome }))}</p>
    <button class="btn ghost" type="button" id="away-home">${ic("tab-list")} ${esc(t("geo.backHome"))}</button></div>` : "";
  $("#away-home")?.addEventListener("click", () => { lsSet(AWAY_KEY, null); renderOfferte(); toast(t("geo.backHome"), "pin"); $("#cerca").focus(); });
  $("#cerca").disabled = !s.luogo || !live(state.monitor).length;
  $("#free-box").innerHTML = key ? "" : `<div class="card notice-card"><p>${ic("heart")} ${esc(t("free.info"))}</p>
    </div>`;
  if (!o.list.length) { $("#offerte").innerHTML = `<div class="card empty">${ic("percent", "big-emoji")}<p>${esc(t("deals.none"))}</p></div>`; renderOfferte.sorted = []; return; }
  const list = [...o.list].sort((a, b) => (a.categoria || a.prodotto).localeCompare(b.categoria || b.prodotto) || (a.prezzoUnit ?? 1e9) - (b.prezzoUnit ?? 1e9));
  const nt = `<span class="sr"> ${esc(t("a11y.newTab"))}</span>`;
  $("#offerte").innerHTML = list.map((x, i) => {
    const v = VOTO[x.voto], sv = !x.amazon && amzOn() ? amzSaved(x.prodotto) : null;
    const az = x.amazon || (sv && { prezzo: sv.prezzo, prezzoUnit: sv.prezzoUnit, url: amazonSearch(x.prodotto, paese()), mio: sv.data }) || null;
    let diff = "";
    if (az && az.prezzoUnit > 0 && x.prezzoUnit > 0) {
      const p = Math.round((x.prezzoUnit / az.prezzoUnit - 1) * 100);
      diff = p < 0 ? `<strong>${ic("down")} ${esc(t("deals.cheaper", { p: -p }))}</strong>` : p > 0 ? esc(t("deals.pricier", { p })) : esc(t("deals.same"));
    }
    const src = safeUrl(x.fonte), azu = az && safeUrl(az.url);
    return `<article class="card offer${x.voto === "ottima" ? " top-deal" : ""}" aria-labelledby="of${i}">
      <div class="head"><div><h3 id="of${i}">${esc(x.prodotto)}</h3>
        <div class="where">${ic("store")} ${esc(x.negozio || "")}${x.distanzaKm != null ? ` · ${esc(x.distanzaKm)} km` : ""}${x.validoFino ? ` · ${esc(t("deals.until", { date: x.validoFino }))}` : ""}</div></div>
        <div class="price">${money(x.prezzo)}<small>${x.quantita ? esc(x.quantita) + " " + esc(t("units." + (x.unita || "pezzi"))) : ""}</small></div></div>
      <div class="badges">${v ? `<span class="badge ${v[1]}">${ic(v[2])} ${esc(t(v[0]))}</span>` : ""}${x.prezzoUnit ? `<span class="unit">${esc(perUnit(x.prezzoUnit, x.unita))}</span>` : ""}</div>
      ${!az && amzOn() ? `<p class="cmp">${amzLink(x.prodotto)}</p>` : ""}
      ${az ? `<p class="cmp">Amazon${az.mio ? ` (${esc(t("amz.mine", { date: shortDate(az.mio) }))})` : ""}: ${money(az.prezzo)}${az.prezzoUnit ? ` (${esc(perUnit(az.prezzoUnit, x.unita))})` : ""}${diff ? " · " + diff : ""}${azu ? ` · <a href="${esc(azu)}" target="_blank" rel="noopener noreferrer">${ic("external")}${esc(t("deals.seeAmazon"))}${nt}</a>` : ""}</p>` : ""}
      ${x.nota ? `<p class="hint">${esc(x.nota)}</p>` : ""}
      <div class="foot">${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${ic(x.gratis ? "external" : "flyer")}${esc(t(x.gratis ? "free.source" : "deals.flyer"))}${nt}</a>` : "<span></span>"}
        <button class="btn ghost" type="button" data-addoff="${i}" data-fk="o${i}" aria-label="${esc(t("deals.addToList", { name: x.prodotto }))}">${ic("list-add")} ${esc(t("deals.addList"))}</button></div>
    </article>`;
  }).join("");
  if (list.some(x => x.gratis)) $("#offerte").insertAdjacentHTML("beforeend", OP_CREDIT());
  renderOfferte.sorted = list;
}

export function renderValutazioni() {
  const list = live(state.valutazioni).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (!list.length) { $("#valutazioni").innerHTML = `<p class="hint">${esc(t("rate.historyEmpty"))}</p>`; return; }
  $("#valutazioni").innerHTML = list.map(v => {
    const e = v.esito || {}, link = safeUrl(v.testo);
    const b = e.voto === "conveniente" ? `<span class="badge gold">${ic("star")} ${esc(t("verdict.good"))}</span>`
      : e.voto === "caro" ? `<span class="badge warn">${ic("warn")} ${esc(t("verdict.dear"))}</span>`
      : e.voto ? `<span class="badge">${ic("info")} ${esc(t("verdict.avg"))}</span>` : "";
    return `<article class="card"><div class="row" style="align-items:flex-start;justify-content:space-between">
      <div style="min-width:0"><h3 style="margin:0;font-size:17px">${esc(e.prodotto || v.testo)}</h3>
      <p class="hint" style="margin:2px 0">${v.prezzo ? money(v.prezzo) : ""}${v.quantita ? ` · ${esc(v.quantita)} ${esc(t("units." + v.unita))}` : ""} · ${quando(v.ts)}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${ic("external")}${esc(t("rate.link"))}<span class="sr"> ${esc(t("a11y.newTab"))}</span></a>` : ""}</p></div>
      <button class="icon-btn danger" type="button" data-vdel="${esc(v.id)}" aria-label="${esc(t("rate.delete"))}">${ic("delete")}</button></div>
      <div class="badges">${b}${e.prezzoUnit ? `<span class="unit">${esc(perUnit(e.prezzoUnit, e.unita))}</span>` : ""}</div>
      ${e.qualita ? `<p style="margin:8px 0 0"><strong>${esc(t("rate.quality"))}:</strong> ${esc(e.qualita)}</p>` : ""}
      ${e.sintesi ? `<p style="margin:6px 0 0">${esc(e.sintesi)}</p>` : ""}
      ${e.alternativa ? `<p class="cmp">${ic("info")} ${esc(e.alternativa)}</p>` : ""}</article>`;
  }).join("");
}

export function render() {
  ai.setShared(state.settings.aiShared);
  keepFocus(() => { renderLista(); renderMonitor(); renderOfferte(); renderValutazioni(); renderPantry(); renderPrefs(); renderFlyerBest(); });
  document.querySelectorAll(".cur-sym").forEach(el => el.textContent = curSymbol());
}

// ---------- LISTA: azioni ----------
$("#f-add").addEventListener("submit", async e => {
  e.preventDefault();
  const inp = $("#add-nome"), v = inp.value.trim();
  if (!v) { mochi.say(frase("vuoto")); inp.focus(); return; }
  const nuovi = v.split(/\s*[,;、，]\s*/).filter(Boolean).map(parseAdd);
  inp.value = "";
  addToList(nuovi);
});
$("#lista").addEventListener("change", e => {
  const id = e.target.dataset.chk; if (!id) return;
  const checked = e.target.checked, it = state.items[id];
  if (checked && it.prendi) { e.target.checked = false; takenFromStore(it); return; }
  mutate((s, now) => { s.items[id] = { ...s.items[id], fatto: checked, updatedAt: now }; });
  if (checked) {
    sparkles(document.querySelector(`[data-chk="${CSS.escape(id)}"]`));
    if (!live(state.items).some(i => !i.fatto)) { mochi.mood("happy", 3000); mochi.say(frase("finito"), 3500); confetti(); toast(t("toast.allDone"), "mochi"); }
    else { mochi.mood("happy"); mochi.say(frase("preso")); toast(t("toast.got", { name: it.nome }), "heart"); }
  } else toast(t("toast.back", { name: it.nome }), "tab-list");
});
export function deleteItem(id, focusFrom) {
  const prima = state.items[id]; if (!prima) return;
  const li = focusFrom && focusFrom.closest("li"), next = li && (li.nextElementSibling || li.previousElementSibling)?.querySelector("input");
  mutate((s, now) => { s.items[id] = { ...s.items[id], deleted: true, updatedAt: now }; });
  (next && document.querySelector(`[data-fk="${CSS.escape(next.dataset.fk)}"]`) || $("#add-nome")).focus();
  toast(t("toast.deleted", { name: prima.nome }), "delete", { label: t("common.undo"), run: () => {
    mutate((s, now) => { s.items[id] = { ...prima, deleted: false, updatedAt: now }; });
  } });
}
$("#lista").addEventListener("click", e => {
  const b = e.target.closest("[data-del]");
  if (b) { deleteItem(b.dataset.del, b); return; }
  const q = e.target.closest("[data-qty]");
  if (q) editQty(q.dataset.qty);
});

// Scorri di lato per eliminare (il tasto cestino resta per tastiera e screen reader)
(function swipe() {
  let sx = 0, sy = 0, row = null, li = null, dx = 0, attivo = false;
  const list = $("#lista");
  list.addEventListener("pointerdown", e => {
    li = e.target.closest("li.item"); if (!li) return;
    row = li.querySelector(".item-row"); sx = e.clientX; sy = e.clientY; dx = 0; attivo = false;
  });
  list.addEventListener("pointermove", e => {
    if (!li) return;
    const x = e.clientX - sx, y = e.clientY - sy;
    if (!attivo) { if (Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.5) { attivo = true; li.classList.add("swiping"); } else if (Math.abs(y) > 12) { li = null; return; } else return; }
    dx = x; row.style.transform = `translateX(${dx}px)`; li.classList.toggle("armed", Math.abs(dx) > 100);
  });
  const fine = () => {
    if (!li) return;
    const id = li.dataset.id, del = attivo && Math.abs(dx) > 100;
    li.classList.remove("swiping", "armed");
    if (del) { row.style.transform = `translateX(${dx > 0 ? "" : "-"}110%)`; setTimeout(() => deleteItem(id), 160); }
    else if (row) row.style.transform = "";
    if (attivo) { const blocca = ev => { ev.preventDefault(); ev.stopPropagation(); }; li.addEventListener("click", blocca, { capture: true, once: true }); setTimeout(() => li && li.removeEventListener("click", blocca, { capture: true }), 50); }
    li = null; row = null; attivo = false;
  };
  list.addEventListener("pointerup", fine); list.addEventListener("pointercancel", fine);
})();
$("#clear-done").addEventListener("click", async () => {
  const n = live(state.items).filter(i => i.fatto).length;
  if (!(await confirmDlg(t("list.clearConfirm", { n }), t("list.clearYes"), "clean"))) return;
  mutate((s, now) => { for (const i of live(s.items)) if (i.fatto) s.items[i.id] = { ...i, deleted: true, updatedAt: now }; });
  $("#add-nome").focus(); mochi.mood("happy"); mochi.say(frase("pulito")); toast(t("toast.cleared"), "clean");
});

// colore barre di sistema allineato al tema
applyTheme(getTheme());
for (const r of document.querySelectorAll('input[name="theme"]')) r.addEventListener("change", () => applyTheme(r.value)); // anteprima; si salva con «Salva»

// ---------- DETTATURA ----------
export let stopVoice = null;
export function setMic(on) {
  const b = $("#mic");
  b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", t(on ? "voice.stop" : "voice.start"));
}
$("#mic").hidden = !voice.supported();
$("#mic").addEventListener("click", () => {
  if (stopVoice) { stopVoice(); return; }
  const msg = $("#voice-msg"), inp = $("#add-nome");
  setMic(true); msg.textContent = t("voice.listening"); mochi.mood("wow", 0); mochi.say(frase("guardo"), 8000);
  try {
    stopVoice = voice.listen(locale(), {
      onText: (txt, fine) => {
        if (!fine) { inp.value = txt; return; }
        if (!txt) { msg.textContent = t("voice.none"); return; }
        const lista = voice.toList(txt, lang());
        inp.value = lista; msg.textContent = t("voice.heard", { text: lista });
        mochi.mood("happy"); inp.focus();
      },
      onEnd: () => { stopVoice = null; setMic(false); },
      onError: err => { msg.textContent = t(err === "not-allowed" || err === "service-not-allowed" ? "voice.denied" : "voice.none"); },
    });
  } catch { stopVoice = null; setMic(false); msg.textContent = t("voice.none"); }
});
$("#f-add").addEventListener("submit", () => { $("#voice-msg").textContent = ""; });

// ---------- CONDIVIDI L'APP ----------
export async function shareApp(btn) {
  const url = dbx.redirectUri(); // indirizzo pubblico dell'app, senza configurazioni né dati
  const data = { title: t("share.title"), text: t("share.text"), url };
  try {
    if (navigator.share) { await navigator.share(data); mochi.mood("happy"); mochi.say(frase("aggiunto")); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${data.text} ${url}`); toast(t("share.copied"), "share"); }
  catch { await confirmDlg(`${t("dbx.copyThis")} ${url}`, t("common.close"), "share"); }
  sparkles(btn);
}
$("#share-top").addEventListener("click", e => shareApp(e.currentTarget));
$("#share-app").addEventListener("click", e => shareApp(e.currentTarget));

// ---------- onboarding nella lista ----------
export function renderOnboard() {
  $("#onboard").innerHTML = dbx.isConnected() ? "" :
    `<div class="card"><h2 class="in">${ic("mochi")} ${esc(t("onboard.title"))}</h2>
     <p style="margin:0 0 10px">${esc(t("onboard.text"))}</p>
     <button class="btn primary" type="button" id="go-dbx">${ic("connect")} ${esc(t("dbx.connect"))}</button></div>`;
  $("#go-dbx")?.addEventListener("click", connectDropbox);
  renderInstall();
}


// ---------- INSTALLAZIONE (PWA) ----------
export let installEvt = null;
export const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; renderInstall(); });
addEventListener("appinstalled", () => { installEvt = null; renderInstall(); toast(t("install.done"), "install"); mochi.mood("happy", 2500); confetti(); });
export function renderInstall() {
  const box = $("#install");
  const later = lsGet("mochi.installLater", 0);
  const show = !standalone() && Date.now() - later > 7 * 864e5 && (installEvt || isIOS()) && !$("#wiz").open;
  if (!show) { box.innerHTML = ""; return; }
  box.innerHTML = `<section class="card install-card" aria-labelledby="inst-t">
    <div class="big-ic">${ic("install")}</div>
    <div><h2 id="inst-t">${esc(t("install.title"))}</h2>
    <p>${installEvt ? esc(t("install.text")) : esc(t("install.ios")).replace("{share}", `<span class="ios-share">${ic("share-ios")}</span>`)}</p>
    <div class="row">${installEvt ? `<button class="btn primary" type="button" id="inst-go">${ic("install")} ${esc(t("install.btn"))}</button>` : ""}
      <button class="btn ghost" type="button" id="inst-later">${esc(t("install.later"))}</button></div></div></section>`;
  $("#inst-go")?.addEventListener("click", async () => {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch {}
    installEvt = null; renderInstall();
  });
  $("#inst-later").addEventListener("click", () => { lsSet("mochi.installLater", Date.now()); renderInstall(); $("#add-nome").focus(); });
}

// ---------- avvio ----------
(async function start() {
  applyAnim();
  // Link di configurazione condiviso: #setup=… (app key, percorso, lingua)
  const m = location.hash.match(/^#setup=(.+)$/);
  let setup = null;
  if (m) {
    try { setup = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch {}
    history.replaceState(null, "", dbx.redirectUri() + "#imp");
    if (setup?.l && Object.hasOwn(LANGS, setup.l) && !me().lang) setMe({ lang: setup.l });
  }
  await setLang(detect(me().lang));
  // il link può arrivare da chiunque: si chiede conferma mostrando dove verrebbe salvata la lista
  if (setup) {
    const cfg = { appKey: String(setup.k || ""), path: normPath(setup.p) }; // appKey vuota se la chiave è già nel sito
    const cur = lsGet(DBX_CFG_KEY, null);
    const same = cur && cur.path === cfg.path && (cur.appKey || "") === cfg.appKey;
    if (!same && await confirmDlg(t("dbx.setupConfirm", { path: cfg.path, key: cfg.appKey ? "…" + cfg.appKey.slice(-4) : t("dbx.setupKeyBuilt") }), t("dbx.setupUse"), "cloud-ok")) {
      lsSet(DBX_CFG_KEY, cfg); toast(t("dbx.configReceived"), "send-love");
    }
  }
  try { if (await dbx.handleRedirect()) { toast(t("dbx.connected"), "cloud-ok"); mochi.mood("happy", 2500); mochi.say(frase("connesso")); } }
  catch (e) { toast(e.message, "warn"); }

  fillSettings(); renderOnboard(); render(); renderBestHow(); fillCountry().catch(() => {});
  pricedb.all().then(() => pricedb.prune()).then(() => { renderDb(); renderOfferte(); }).catch(() => {});
  selectTab(tabs.find(x => "#" + x.id.slice(2) === location.hash) || tabs[0], false);
  syncSet(dbx.isConnected() ? "busy" : "local", dbx.isConnected() ? "sync.busy" : "sync.local");
  sync();
  setTimeout(checkHome, 1500);
  setTimeout(checkKapibo, 2500);

  // Primo avvio → wizard. Policy cambiata → riaccettazione. Aggiornamento → novità.
  const seenV = lsGet("mochi.seen", null) || (hadState ? "1.0.0" : null);
  if (!seenV) openWizard({ required: true });
  else {
    const nuove = novitaDopo(seenV);
    const afterPolicy = () => {
      lsSet("mochi.seen", APP_VERSION);
      if (nuove.length) { openNews(nuove); $("#news").addEventListener("close", () => setTimeout(startTour, 400), { once: true }); }
      else { setTimeout(() => mochi.say(frase("ciao")), 600); setTimeout(startTour, 1200); }
    };
    if (!policyOk()) {
      openWizard({ required: true, steps: WIZ.filter(w => w.id === "privacy") });
      $("#wiz").addEventListener("close", afterPolicy, { once: true });
    } else afterPolicy();
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") watchUpdates();
})();

// ---------- AGGIORNAMENTI ----------
// L'app aperta a lungo controlla ogni ora (e quando torna in primo piano) se c'è una versione nuova.
// Il service worker nuovo prende subito il controllo: si avvisa con un pulsante «Ricarica»; se l'app va in
// secondo piano senza lavoro in sospeso, si ricarica da sola al ritorno.
function watchUpdates() {
  const hadController = !!navigator.serviceWorker.controller;
  let pending = false;
  navigator.serviceWorker.register("sw.js").then(reg => {
    setInterval(() => reg.update().catch(() => {}), 3600e3);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || pending) return; // prima installazione: niente da ricaricare
    pending = true;
    toast(t("upd.ready"), "magic", { label: t("upd.reload"), icon: "refresh", run: () => location.reload() });
  });
  document.addEventListener("visibilitychange", () => {
    if (pending && document.visibilityState === "visible" && !settingsDirty && !flyer.busy()) location.reload();
  });
}


