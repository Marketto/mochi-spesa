import { getTheme, setTheme, applyTheme } from "./theme.js";
import { frase } from "./mascot.js";
import { catId, legacyCat, iconOf, ORDER, parseAdd } from "./categories.js";
import { merge, normalize, same, live, canWrite } from "./store.js";
import { t, setLang, detect, lang, locale, LANGS } from "./i18n.js";
import { APP_VERSION, CHANGELOG, novitaDopo } from "./version.js";
import * as dbx from "./dropbox.js";
import * as ai from "./ai/index.js";
import * as geo from "./geo.js";
import * as voice from "./voice.js";
import * as chains from "./chains.js";
import * as shops from "./shops.js";
import { amazonSearch } from "./amazon.js";
import * as serp from "./serp.js";
import { $, BUILT_KEY, CURRENCIES, DBX_CFG_KEY, LOCAL_CFG, PROXY, amzLink, amzOn, amzSaved, applyAnim, confetti, confirmDlg, connectDropbox, curSymbol, currency, dbxCfg, esc, hadState, ic, lsGet, lsSet, me, mochi, money, mutate, okProxy, paese, perUnit, quando, safeUrl, save, seen, selectTab, setMe, setState, sparkles, state, tabs, toast } from "./ui/core.js";
import { WIZ, openLegal, openNews, openWizard, policyOk, startTour } from "./ui/onboarding.js";
import { OP_CREDIT, addToList, checkHome, checkKapibo, editQty, kapMode, placeName, renderPantry, shortDate, takenFromStore } from "./ui/pantry.js";
import { refreshChains, renderBestHow, renderFlyerBest, renderPrefs } from "./ui/prices.js";


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

// ---------- IMPOSTAZIONI ----------
export function fillLangSelect(sel) {
  sel.innerHTML = Object.entries(LANGS).sort((a, b) => a[1].localeCompare(b[1], "en")).map(([c, n]) => `<option value="${c}" lang="${c}">${esc(n)}</option>`).join("");
  sel.value = lang();
}
export function fillSettings() {
  const km = $("#kap-mode"); if (km) km.value = kapMode();
  const m = me();
  fillLangSelect($("#me-lang"));
  $("#about-ver").textContent = t("about.version", { v: APP_VERSION });
  $("#dbx-off").hidden = !dbx.isConnected();
  $("#dbx-go-txt").textContent = t(dbx.isConnected() ? "dbx.reconnect" : "dbx.connect");
  if (settingsDirty) return; // non cancellare quello che stai scrivendo
  $("#me-nome").value = m.nome || "";
  for (const r of document.querySelectorAll('input[name="anim"]')) r.checked = r.value === (m.anim || "auto");
  for (const r of document.querySelectorAll('input[name="theme"]')) r.checked = r.value === getTheme();
  applyTheme(getTheme());
  const c = dbxCfg(); $("#dbx-key").value = BUILT_KEY ? "" : (c.appKey || ""); $("#dbx-path").value = c.path || "";
  $("#dbx-key-wrap").hidden = !!BUILT_KEY;
  if (!BUILT_KEY && !c.appKey) $("#dbx-adv").open = true;
  const s = state.settings;
  $("#z-luogo").value = s.luogo || ""; $("#z-raggio").value = s.raggioKm || 5; $("#z-raggio-v").textContent = s.raggioKm || 5;
  for (const r of document.querySelectorAll('input[name="lvdir"]')) r.checked = r.value === (s.ripiani === "basso" ? "basso" : "alto");
  pickedShops = splitShops(s.negozi); shopsAll = false; loadShops();
  const scelte = new Set(s.catene || []);
  $("#z-chains-list").innerHTML = PROXY() ? chains.chainList().map(c => `<label class="check"><input type="checkbox" name="catena" value="${c.id}"${scelte.has(c.id) ? " checked" : ""}> ${esc(c.nome)}${c.nazionale ? ` <small>· ${esc(t("ch.national"))}</small>` : ""}</label>`).join("") : "";
  $("#z-chains-hint").textContent = t(PROXY() ? "ch.hint" : "ch.none"); $("#z-amz").checked = s.amazon !== false;
  renderPages(s.pagine || []);
  $("#ponte-box").hidden = !!okProxy(LOCAL_CFG.flyerProxy); $("#z-ponte").value = s.ponte || "";
  let names; try { names = new Intl.DisplayNames([locale()], { type: "currency" }); } catch {}
  $("#z-valuta").innerHTML = CURRENCIES.map(c => `<option value="${c}">${esc(names ? names.of(c) : c)} (${c})</option>`).join("");
  $("#z-valuta").value = currency();
  $("#z-valuta").dataset.auto = state.settings.valuta ? "" : currency(); // non scelta a mano: resta automatica (dal paese)
  renderSerp();
  ai.setShared(state.settings.aiShared);
  renderAiKeys(); fillProviders();
  $("#ver-chip").textContent = "v" + APP_VERSION;
  $("#ver-chip").setAttribute("aria-label", `v${APP_VERSION}. ${t("news.open")}`); // il nome contiene il testo visibile (WCAG 2.5.3)
}
$("#z-raggio").addEventListener("input", e => $("#z-raggio-v").textContent = e.target.value);
export async function changeLang(code) {
  setMe({ lang: code });
  await setLang(code);
  fillSettings(); renderOnboard(); render(); syncSet(syncKind, syncKey, syncVars); setMic(!!stopVoice);
}
$("#me-lang").addEventListener("change", async e => {
  e.stopPropagation(); await changeLang(e.target.value); toast(t("lang.changed"), "lang"); $("#me-lang").focus(); });
$("#me-lang").addEventListener("input", e => e.stopPropagation());
// ---------- NEGOZI PREFERITI (dalla zona, OpenStreetMap) ----------
export const splitShops = v => String(v || "").split(",").map(x => x.trim()).filter(Boolean);
export let pickedShops = [], nearShops = [], shopsAll = false, shopsCtl = null;
export const checkedShops = () => [...document.querySelectorAll('#z-shops-list input[name="negozio"]:checked')].map(x => x.value);
export const kmFmt = km => km == null ? "" : km.toLocaleString(locale(), { maximumFractionDigits: 1 });
export function renderShops() {
  const box = $("#z-shops-list");
  const sel = box.childElementCount ? checkedShops() : pickedShops; // non perdere le spunte non salvate
  const extra = sel.filter(n => !nearShops.some(g => shops.sameShop(g.nome, n))).map(nome => ({ nome, n: 0, km: null }));
  const all = [...extra, ...nearShops];
  const isSel = n => sel.some(x => shops.sameShop(x, n));
  const ord = [...all.filter(g => isSel(g.nome)), ...all.filter(g => !isSel(g.nome))];
  const MAX = 24, show = shopsAll ? ord : ord.slice(0, Math.max(MAX, all.filter(g => isSel(g.nome)).length));
  box.innerHTML = show.map(g => `<label><input type="checkbox" name="negozio" value="${esc(g.nome)}"${isSel(g.nome) ? " checked" : ""}> ${esc(g.nome)}${g.n ? ` <small>${esc(t("zone.shopsCount", { n: g.n, km: kmFmt(g.km) }))}</small>` : ""}</label>`).join("");
  const more = $("#z-shops-more"); more.hidden = show.length >= ord.length;
  more.textContent = t("zone.shopsMore", { n: ord.length - show.length });
}
export async function loadShops() {
  const s = state.settings, msg = $("#z-shops-msg");
  nearShops = []; renderShops();
  if (s.lat == null || s.lon == null) { msg.textContent = t("zone.shopsNeedZone"); return; }
  const km = +$("#z-raggio").value || s.raggioKm || 5;
  if (shopsCtl) shopsCtl.abort(); const ctl = shopsCtl = new AbortController();
  msg.textContent = t("zone.shopsLoading");
  try {
    nearShops = await shops.nearby({ lat: s.lat, lon: s.lon, raggioKm: km }, { signal: ctl.signal });
    if (ctl !== shopsCtl) return;
    msg.textContent = nearShops.length ? t("zone.shopsHint", { km }) : t("zone.shopsNone", { km });
  } catch (e) { if (e.name === "AbortError") return; msg.textContent = t("zone.shopsFail"); }
  renderShops();
}
$("#z-shops-more").addEventListener("click", () => { shopsAll = true; renderShops(); $("#z-shops-list label:last-child input")?.focus(); });
export let shopsTimer; $("#z-raggio").addEventListener("change", () => { clearTimeout(shopsTimer); shopsTimer = setTimeout(loadShops, 400); });

// ---------- PAGINE UFFICIALI DEI VOLANTINI (scelte dall'utente) ----------
export const OFFICIAL_LIST = () => Object.values(chains.OFFICIAL).join(", ");
export function renderPages(pagine) {
  $("#pg-hint").textContent = t("ch.pagesHint", { list: OFFICIAL_LIST() });
  $("#pg-list").innerHTML = pagine.map(p => `<label class="check"><input type="checkbox" name="pagina" value="${esc(p.url)}" checked>
    <span><strong>${esc(p.nome)}</strong> <small class="hint">${esc(new URL(p.url).pathname.replace(/\/$/, "").split("/").pop() || p.url)}</small></span></label>`).join("");
}
$("#pg-add").addEventListener("click", () => {
  const url = $("#pg-url").value.trim(), p = chains.newPage(url);
  if (!p) { toast(t("ch.pageBad", { list: OFFICIAL_LIST() }), "warn"); $("#pg-url").focus(); return; }
  const cur = [...document.querySelectorAll('#pg-list input[name="pagina"]')].map(x => ({ url: x.value, nome: chains.officialChainOf(x.value)?.nome, on: x.checked }));
  if (!cur.some(c => c.url === p.url)) renderPages([...cur.filter(c => c.on), p]);
  $("#pg-url").value = "";
  $("#pg-list").dispatchEvent(new Event("change", { bubbles: true })); // segna le impostazioni come modificate
  toast(t("ch.pageAdded", { chain: p.nome }), "store");
});

// ---------- PROVA DEL PONTE ----------
/** Prova il ponte scritto nel campo: chiede la pagina ufficiale dei volantini Lidl. */
export async function testPonte() {
  const p = okProxy($("#z-ponte").value.trim()) || PROXY(), st = $("#ponte-st"), b = $("#ponte-test");
  if (!p) { st.textContent = t("ch.ponteKo", { msg: "https://…workers.dev" }); $("#z-ponte").focus(); return; }
  b.classList.add("loading"); st.textContent = "…";
  try {
    const r = await fetch(chains.via(p, "https://www.lidl.it/c/volantino-lidl/s10018048"), { signal: AbortSignal.timeout(20000) });
    st.textContent = r.ok ? t("ch.ponteOk") : t("ch.ponteKo", { msg: `${r.status} ${(await r.text()).slice(0, 40)}` });
  } catch (e) { st.textContent = t("ch.ponteKo", { msg: e.name === "TimeoutError" ? "timeout" : e.message }); }
  finally { b.classList.remove("loading"); }
}
$("#ponte-test").addEventListener("click", testPonte);

// ---------- SERPAPI: prezzi veri da Amazon e Google Shopping (chiave dell'utente) ----------
export function renderSerp() {
  const k = serp.getKey();
  $("#serp-signup").href = serp.SIGNUP; $("#serp-keypage").href = serp.KEY_PAGE;
  $("#serp-state").textContent = k ? t("serp.on", { n: serp.used() }) : t("serp.off");
  $("#serp-del").hidden = !k;
  if (document.activeElement?.id !== "serp-key") $("#serp-key").value = "";
  $("#serp-key").placeholder = k ? "•••• " + k.slice(-4) : "";
}
$("#serp-save").addEventListener("click", () => {
  const k = $("#serp-key").value.trim();
  if (k.length < 32) { toast(t("best.keyBad"), "warn"); $("#serp-key").focus(); return; }
  serp.setKey(k); $("#serp-key").value = ""; renderSerp(); toast(t("common.saved"), "key");
});
$("#serp-del").addEventListener("click", async () => {
  if (!(await confirmDlg(t("serp.removeConfirm"), t("serp.remove"), "delete"))) return;
  serp.setKey(""); renderSerp(); $("#serp-key").focus();
});

// ---------- CHIAVI IA: più servizi e più chiavi, scelti in automatico ----------
export const mask = k => "•••• " + k.slice(-4);
export const until = ms => new Date(ms).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
export function providerInfo(id) {
  const P = ai.PROVIDERS[id];
  return [t(P.tier === "free" ? "ai.free" : P.tier === "quota" ? "ai.freeQuota" : "ai.paid"), t(ai.canWeb(id) ? "ai.web" : "ai.noweb")].join(" · ");
}
export function renderAiKeys() {
  const keys = ai.allKeys();
  $("#ai-keys").innerHTML = keys.length ? keys.map(k => {
    const P = ai.PROVIDERS[k.provider], c = ai.cooling(k), n = ai.usage(k);
    return `<li class="ai-key${c ? " cool" : ""}"><span class="ai-n"><strong>${esc(P.nome)}</strong> <code>${esc(mask(k.key))}</code>${k.shared ? ` <small>${ic("heart")} ${esc(t("zone.shared"))}</small>` : ""}</span>
      <span class="ai-b"><span class="badge${P.tier === "paid" ? " gold" : ""}">${esc(providerInfo(k.provider))}</span></span>
      <span class="ai-u hint">${esc(t("ai.usage", { n }))}${c ? ` · ${esc(t("ai.cooling", { time: until(c.until) }))}${c.msg ? ` – ${esc(c.msg)}` : ""}` : ""}</span>
      ${k.shared ? "" : `<button class="icon-btn danger" type="button" data-aidel="${esc(k.id)}" aria-label="${esc(t("ai.removeKey", { name: P.nome }))}">${ic("delete")}</button>`}</li>`;
  }).join("") : `<li class="hint">${ic("key")} ${esc(t("ai.none"))}</li>`;
  const sh = state.settings.aiShared, mine = ai.localKeys();
  $("#ai-share").checked = Array.isArray(sh) ? sh.length > 0 && mine.every(k => sh.some(x => x.key === k.key)) : !!(sh && sh.key);
  $("#ai-share").disabled = !mine.length;
  if ($("#best-how")) renderBestHow();
}
export function fillProviders() {
  const sel = $("#ai-provider"), cur = sel.value || "groq";
  sel.innerHTML = Object.entries(ai.PROVIDERS).map(([id, P]) => `<option value="${id}">${esc(P.nome)} – ${esc(providerInfo(id))}</option>`).join("");
  sel.value = cur; fillProvider();
}
export function fillProvider() {
  const id = $("#ai-provider").value, P = ai.PROVIDERS[id];
  $("#ai-link").href = P.link;
  $("#ai-model").placeholder = P.models[0].id;
  $("#ai-pinfo").textContent = t("ai.p." + id);
}
$("#ai-provider").addEventListener("change", fillProvider);
export const shareKeys = on => mutate((s, now) => { s.settings = { ...s.settings, aiShared: on ? ai.localKeys().map(({ provider, key, model }) => ({ provider, key, model })) : null, updatedAt: now }; });
$("#ai-add").addEventListener("click", () => {
  const key = $("#ai-key").value.trim(); if (!key) { $("#ai-key").focus(); return; }
  ai.addKey({ provider: $("#ai-provider").value, key, model: $("#ai-model").value });
  $("#ai-key").value = ""; $("#ai-model").value = "";
  if ($("#ai-share").checked) shareKeys(true);
  renderAiKeys(); renderOfferte(); toast(t("common.saved"), "key"); $("#ai-add-box").open = false;
});
$("#ai-keys").addEventListener("click", e => {
  const b = e.target.closest("[data-aidel]"); if (!b) return;
  ai.removeKey(b.dataset.aidel);
  if ($("#ai-share").checked) shareKeys(true);
  renderAiKeys(); renderOfferte(); toast(t("pref.removed"), "delete");
});
$("#ai-share").addEventListener("change", e => { shareKeys(e.target.checked); toast(t("common.saved"), "heart"); });
// ---------- IMPOSTAZIONI: una sola barra Salva / Annulla ----------
export let settingsDirty = false;
export function setDirty(v) {
  settingsDirty = v;
  $("#save-bar").hidden = !v;
  document.body.classList.toggle("has-save-bar", v);
}
for (const f of document.querySelectorAll("form.track")) {
  f.addEventListener("input", () => setDirty(true));
  f.addEventListener("change", () => setDirty(true));
  f.addEventListener("submit", e => { e.preventDefault(); saveSettings(); });
}
export async function saveSettings() {
  const btn = $("#set-save"); if (btn.getAttribute("aria-busy")) return;
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true");
  try {
    // tu: nome e animazioni (solo su questo telefono)
    const nome = $("#me-nome").value.trim();
    setMe({ nome, anim: document.querySelector('input[name="anim"]:checked')?.value || "auto" });
    setTheme(document.querySelector('input[name="theme"]:checked')?.value || "auto");
    applyAnim();
    // zona e dispensa (condivisi)
    const luogo = $("#z-luogo").value.trim(), old = state.settings;
    let coords = luogo === old.luogo && old.lat != null ? { lat: old.lat, lon: old.lon, paese: old.paese || "" } : { lat: null, lon: null, paese: "" };
    if (luogo && coords.lat == null) {
      const g = await geo.geocode(luogo, lang());
      if (g) coords = { lat: g.lat, lon: g.lon, paese: g.paese }; else $("#geo-msg").textContent = t("geo.geocodeFail");
    }
    const ripiani = document.querySelector('input[name="lvdir"]:checked')?.value === "basso" ? "basso" : "alto";
    mutate((s, now) => {
      s.settings = { ...s.settings, luogo, raggioKm: +$("#z-raggio").value, negozi: checkedShops().join(", "), amazon: $("#z-amz").checked,
        valuta: $("#z-valuta").value === $("#z-valuta").dataset.auto ? "" : $("#z-valuta").value, ripiani, catene: [...document.querySelectorAll('#z-chains-list input[name="catena"]:checked')].map(x => x.value),
        ponte: okProxy($("#z-ponte").value.trim()) || "",
        pagine: [...document.querySelectorAll('#pg-list input[name="pagina"]:checked')].map(x => chains.newPage(x.value)).filter(Boolean), ...coords, updatedAt: now };
    });
    setDirty(false); fillSettings(); render(); renderOfferte();
    toast(t("set.saved"), "save"); mochi.mood("happy"); mochi.say(nome ? t("phr.nice", { name: nome }) : frase("aggiunto"));
  } finally { btn.classList.remove("loading"); btn.removeAttribute("aria-busy"); }
}
$("#set-save").addEventListener("click", saveSettings);
$("#set-cancel").addEventListener("click", () => { setDirty(false); fillSettings(); toast(t("set.reverted"), "undo"); $("#p-imp").querySelector("input, select")?.focus(); });
window.addEventListener("beforeunload", e => { if (settingsDirty) { e.preventDefault(); e.returnValue = ""; } });
export const normPath = p => { p = (p || "").trim() || "/Spesa/mochi-spesa.json"; if (!p.startsWith("/")) p = "/" + p; if (!/\.json$/i.test(p)) p += ".json"; return p; };
$("#f-dbx").addEventListener("submit", async e => {
  e.preventDefault();
  const appKey = BUILT_KEY || $("#dbx-key").value.trim(), path = normPath($("#dbx-path").value);
  if (!appKey) { $("#dbx-adv").open = true; $("#dbx-msg").textContent = t("dbx.needKey"); $("#dbx-key").focus(); return; }
  lsSet(DBX_CFG_KEY, { appKey: BUILT_KEY ? "" : appKey, path });
  $("#dbx-msg").textContent = t("dbx.redirecting");
  await dbx.startAuth(appKey);
});
$("#dbx-off").addEventListener("click", async () => {
  if (!(await confirmDlg(t("dbx.disconnectConfirm"), t("dbx.disconnect"), "disconnect"))) return;
  dbx.disconnect(); fillSettings(); renderOnboard(); syncSet("local", "sync.local"); toast(t("dbx.disconnected"), "disconnect");
});
$("#dbx-share").addEventListener("click", async () => {
  const c = { k: BUILT_KEY ? "" : $("#dbx-key").value.trim(), p: normPath($("#dbx-path").value), l: lang() };
  if (!BUILT_KEY && !c.k) { $("#dbx-adv").open = true; $("#dbx-msg").textContent = t("dbx.needKey"); return; }
  const link = dbx.redirectUri() + "#setup=" + btoa(unescape(encodeURIComponent(JSON.stringify(c)))); // solo app key, percorso e lingua: mai token
  try { await navigator.clipboard.writeText(link); $("#dbx-msg").textContent = t("dbx.copied"); toast(t("dbx.copiedShort"), "copy"); }
  catch { $("#dbx-msg").innerHTML = `${esc(t("dbx.copyThis"))} <input readonly dir="ltr" value="${esc(link)}" aria-label="${esc(t("dbx.share"))}">`; }
});
$("#open-legal").addEventListener("click", () => openLegal());
$("#open-news").addEventListener("click", () => openNews(CHANGELOG, false));
$("#ver-chip").addEventListener("click", () => openNews(CHANGELOG, false));
$("#open-wizard").addEventListener("click", () => openWizard({ required: false }));

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

// ---------- SINCRONIZZAZIONE ----------
export let rev = lsGet("mochi.rev", null), syncing = false, syncAgain = false, syncT;
export let syncKind = "local", syncKey = "sync.local", syncVars = null;
export function syncSet(kind, key, vars) {
  syncKind = kind; syncKey = key; syncVars = vars || null;
  const b = $("#sync");
  b.className = "sync " + ({ ok: "ok", busy: "busy", err: "err" }[kind] || "");
  $("#sync-ic").className = "mi mi-" + ({ ok: "cloud-ok", busy: "cloud-up", err: "cloud-off" }[kind] || "phone");
  $("#sync-txt").textContent = t(key, vars);
  b.setAttribute("aria-label", t(key, vars) + ". " + t(dbx.isConnected() ? "sync.tapSync" : "sync.tapConnect"));
}
export let conflictRuns = 0; // conflitti di fila: la nuova prova aspetta 30 s, 60 s, … fino a 5 minuti
let localChanged = true; // modifiche locali non ancora inviate: senza, basta confrontare la revisione del file
export function scheduleSync() { localChanged = true; clearTimeout(syncT); syncT = setTimeout(sync, 700); }
export async function sync() {
  if (!dbx.isConnected()) { syncSet("local", "sync.local"); return; }
  if (!navigator.onLine) { syncSet("err", "sync.offline"); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; syncSet("busy", "sync.busy");
  const path = dbxCfg().path;
  try {
    let done = false;
    // nessuna modifica qui e file uguale all'ultima volta: niente da scaricare
    if (!localChanged && rev && await dbx.currentRev(path) === rev) {
      syncSet("ok", "sync.ok", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) });
      return;
    }
    localChanged = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const remote = await dbx.download(path);
      const remoteState = remote && remote.data ? normalize(remote.data) : null;
      if (remoteState) for (const it of Object.values(remoteState.items)) it.cat = legacyCat(it.cat);
      const merged = merge(state, remoteState);
      // file scritto da una versione più nuova del formato: si legge e basta
      const readOnly = !canWrite(merged);
      try {
        if (!readOnly && (!remoteState || !same(merged, remoteState))) rev = await dbx.upload(path, merged, remote && remote.rev);
        else rev = remote ? remote.rev : rev;
      } catch (e) { if (e.code === "conflict") continue; throw e; }
      const before = state;
      setState(merge(state, merged));
      lsSet("mochi.rev", rev); save();
      if (!same(before, state)) {
        const nuovi = live(state.items).filter(i => !seen.has(i.id) && i.da && i.da !== me().nome);
        render();
        if (nuovi.length) {
          toast(nuovi.length === 1 ? t("toast.fromOther", { who: nuovi[0].da, what: nuovi[0].nome }) : t("toast.fromOtherN", { who: nuovi[0].da, n: nuovi.length }), "send-love");
          mochi.mood("wow"); mochi.say(frase("novita"));
        }
      }
      if (readOnly) syncSet("err", "sync.newer");
      else syncSet("ok", "sync.ok", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) });
      done = true;
    }
    // 4 conflitti di fila (altri stanno scrivendo): riprova più tardi invece di restare su «sincronizzo…»
    if (!done) { localChanged = true; syncSet("err", "sync.retry"); clearTimeout(syncT); syncT = setTimeout(sync, Math.min(300e3, 30e3 * 2 ** conflictRuns++)); }
    else conflictRuns = 0;
  } catch (e) {
    localChanged = true;
    if (e.code === "auth") { syncSet("err", "sync.reconnect"); fillSettings(); }
    else syncSet("err", "sync.retry");
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}
$("#sync").addEventListener("click", () => {
  if (dbx.isConnected()) sync();
  else connectDropbox();
});
setInterval(() => { if (document.visibilityState === "visible") sync(); }, 20000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
addEventListener("online", sync);
addEventListener("offline", () => syncSet("err", "sync.offline"));

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

// ---------- POSIZIONE ----------
// Casa = impostazione condivisa (indirizzo + coordinate). "Fuori casa" = solo su questo telefono.
export const AWAY_KEY = "mochi.away";
export const away = () => lsGet(AWAY_KEY, null);          // { lat, lon, nome, paese } se si cercano offerte fuori casa
// chi aveva già la zona prima della 2.5.0: il paese si ricava una volta dalle coordinate di casa
export async function fillCountry() {
  const s = state.settings;
  if (s.paese || s.lat == null || !navigator.onLine) return;
  const info = await geo.placeInfo({ lat: s.lat, lon: s.lon }, lang());
  if (info?.paese) mutate((st, now) => { st.settings = { ...st.settings, paese: info.paese, updatedAt: now }; });
}
export let awayAsked = null;                              // posizione per cui l'utente ha già risposto "no" in questa sessione
export const home = () => state.settings.lat != null ? { lat: state.settings.lat, lon: state.settings.lon } : null;

/** "Usa la mia posizione" nelle impostazioni: imposta casa qui. */
export async function usaPosizione(btn) {
  const msg = $("#geo-msg");
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true"); msg.textContent = t("geo.locating");
  try {
    const pos = await geo.here();
    const info = await geo.placeInfo(pos, lang()), nome = info?.nome || t("geo.label", pos);
    mutate((s, now) => { s.settings = { ...s.settings, ...pos, paese: info?.paese || "", luogo: nome, updatedAt: now }; });
    lsSet(AWAY_KEY, null);
    $("#z-luogo").value = nome; fillSettings(); msg.textContent = t("geo.ok"); toast(t("geo.ok"), "pin"); mochi.mood("happy"); mochi.say(frase("guardo"));
  } catch (err) {
    msg.textContent = err && err.code === 1 ? t("geo.denied") : t("geo.fail"); $("#z-luogo").focus();
  } finally { btn.classList.remove("loading"); btn.removeAttribute("aria-busy"); }
}
$("#geo-btn").addEventListener("click", e => usaPosizione(e.currentTarget));

/** Se sei a più di 40 km da casa propone di cercare qui. modal=true usa il dialogo, altrimenti una scheda in Offerte. */
export async function checkAway({ ask = false, modal = false } = {}) {
  const h = home(); if (!h) return;
  if (!ask && (await geo.permission()) !== "granted") return; // senza permesso già dato non chiediamo all'apertura
  let pos; try { pos = await geo.here({ timeout: 8000 }); } catch { return; }
  const a = away();
  if (geo.distKm(h, pos) <= geo.AWAY_KM) { if (a) { lsSet(AWAY_KEY, null); renderOfferte(); } return; }
  if (a && geo.distKm(a, pos) <= geo.AWAY_KM) return;                    // già in uso qui
  if (awayAsked && geo.distKm(awayAsked, pos) <= geo.AWAY_KM) return;    // ha già detto no qui
  const km = Math.round(geo.distKm(h, pos));
  const info = await geo.placeInfo(pos, lang()), nome = info?.nome || t("geo.label", pos);
  const accetta = () => { lsSet(AWAY_KEY, { ...pos, nome, paese: info?.paese || "" }); awayAsked = null; renderOfferte(); toast(t("geo.using", { place: nome }), "pin"); mochi.mood("wow"); };
  const rifiuta = () => { awayAsked = pos; renderOfferte(); };
  if (modal) { (await confirmDlg(t("geo.away", { km, place: nome }), t("geo.awayYes"), "pin")) ? accetta() : rifiuta(); return; }
  $("#away").innerHTML = `<div class="card notice-card" role="region" aria-labelledby="away-t">
    <p id="away-t">${ic("pin")} ${esc(t("geo.away", { km, place: nome }))}</p>
    <div class="row gap"><button class="btn primary" type="button" id="away-yes">${ic("ok")} ${esc(t("geo.awayYes"))}</button>
    <button class="btn ghost" type="button" id="away-no">${ic("close")} ${esc(t("geo.awayNo"))}</button></div></div>`;
  $("#away-yes").addEventListener("click", accetta);
  $("#away-no").addEventListener("click", rifiuta);
}
$("#t-offerte").addEventListener("click", () => { checkAway(); refreshChains(); renderBestHow(); });
$("#t-imp").addEventListener("click", () => { renderAiKeys(); renderSerp(); });

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

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

