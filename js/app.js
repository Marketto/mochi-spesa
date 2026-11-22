import { getTheme, setTheme, applyTheme } from "./theme.js";
import { mountMochi, frase, MOCHI_SVG } from "./mascot.js";
import { catOf, catId, legacyCat, iconOf, ORDER, parseAdd } from "./categories.js";
import { emptyState, merge, normalize, same, live, uid, stamp, canWrite } from "./store.js";
import { t, setLang, detect, lang, locale, langName, LANGS } from "./i18n.js";
import { APP_VERSION, POLICY_VERSION, CHANGELOG, novitaDopo } from "./version.js";
import * as dbx from "./dropbox.js";
import * as ai from "./ai/index.js";
import * as geo from "./geo.js";
import * as voice from "./voice.js";
import * as pantry from "./pantry.js";
import * as importer from "./importer.js";
import * as op from "./openprices.js";
import * as flyer from "./flyer.js";
import * as chains from "./chains.js";
import * as pricedb from "./pricedb.js";
import * as shops from "./shops.js";
import { amazonSearch, isAmazon } from "./amazon.js";
import * as best from "./best.js";
import * as serp from "./serp.js";
import { hash } from "./util.js";
import * as bridge from "./bridge.js";

// ---------- utilità ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (n, cls = "") => `<i class="mi mi-${n}${cls ? " " + cls : ""}" aria-hidden="true"></i>`;
const num = v => { const n = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
const safeUrl = u => /^https:\/\//i.test(u || "") ? u : null;
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const quando = ts => new Date(ts).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Valuta: impostazione condivisa, con un valore iniziale sensato per la lingua
const CURRENCIES = ["EUR", "GBP", "CHF", "SEK", "DKK", "NOK", "PLN", "CZK", "HUF", "RON", "USD", "RUB", "CNY", "JPY", "KRW", "AED", "SAR", "EGP", "MAD"];
// Paese e valuta vengono dalla posizione (GPS o città scritta nelle impostazioni), mai dalla lingua.
const CUR_BY_COUNTRY = { se: "SEK", dk: "DKK", no: "NOK", is: "ISK", pl: "PLN", cz: "CZK", hu: "HUF", ro: "RON", bg: "BGN", ch: "CHF", li: "CHF",
  gb: "GBP", us: "USD", ca: "CAD", au: "AUD", jp: "JPY", cn: "CNY", kr: "KRW", ae: "AED", sa: "SAR", eg: "EGP", tr: "TRY", ru: "RUB",
  ua: "UAH", by: "BYN", rs: "RSD", ba: "BAM", mk: "MKD", al: "ALL", in: "INR", mx: "MXN", br: "BRL", sg: "SGD" };
/** Paese (ISO 2) dove si fa la spesa: quello «fuori casa» se attivo, altrimenti quello di casa. "" se non ancora impostato. */
const paese = () => (away()?.paese || state.settings.paese || "").toLowerCase();
const currency = () => state.settings.valuta || CUR_BY_COUNTRY[paese()] || "EUR";
const amzOn = () => state.settings.amazon !== false;
const amzLink = (nome, cls = "") => `<a class="${cls}" href="${esc(amazonSearch(nome, paese()))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t("amz.searchName", { name: nome }))} ${esc(t("a11y.newTab"))}">${ic("external")}${cls.includes("icon-btn") ? "" : esc(t("amz.search"))}</a>`;
// ultimo prezzo Amazon che l'utente ha salvato in «I miei prezzi»
const amzSaved = nome => pricedb.recent(nome, 365).filter(r => isAmazon(r.negozio)).sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0] || null;
const fmt = (n, d) => new Intl.NumberFormat(locale(), { style: "currency", currency: currency(), ...(d ? { minimumFractionDigits: 2, maximumFractionDigits: 3 } : {}) }).format(n);
const money = n => (typeof n === "number" && isFinite(n)) ? fmt(n) : "–";
const money3 = n => (typeof n === "number" && isFinite(n)) ? fmt(n, true) : "–";
const curSymbol = () => new Intl.NumberFormat(locale(), { style: "currency", currency: currency() }).formatToParts(0).find(p => p.type === "currency")?.value || currency();
const perUnit = (n, u) => `${money3(n)} ${t("unitPer." + (u || "pezzi"))}`;

// ---------- configurazione locale (mai nel repo) ----------
// config.js è generato dal deploy (App key Dropbox da variabile del repo); config.local.js solo in sviluppo.
let LOCAL_CFG = {};
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
try { LOCAL_CFG = (await import(isLocal ? "../config.local.js" : "../config.js")).default || {}; } catch {}
const BUILT_KEY = String(LOCAL_CFG.dropboxAppKey || "");
// ponte Cloudflare: dalla configurazione del deploy oppure scritto dall'utente nelle impostazioni (condiviso in famiglia)
const okProxy = u => /^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(String(u || "")) ? String(u).replace(/\/+$/, "") : "";
const PROXY = () => okProxy(LOCAL_CFG.flyerProxy) || okProxy(state.settings?.ponte);
const DBX_CFG_KEY = "mochi.dbxcfg";
const dbxCfg = () => {
  const c = { appKey: "", path: LOCAL_CFG.dropboxPath || "/Spesa/mochi-spesa.json", ...lsGet(DBX_CFG_KEY, {}) };
  if (BUILT_KEY) c.appKey = BUILT_KEY; // la chiave del sito vince: gli utenti non devono inserirla
  return c;
};
async function connectDropbox() {
  const { appKey } = dbxCfg();
  if (!appKey) { selectTab($("#t-imp")); $("#dbx-adv").open = true; $("#dbx-key").focus(); $("#dbx-msg").textContent = t("dbx.needKey"); return; }
  lsSet(DBX_CFG_KEY, { ...lsGet(DBX_CFG_KEY, {}), appKey, path: dbxCfg().path });
  toast(t("dbx.redirecting"), "cloud");
  await dbx.startAuth(appKey);
}
const me = () => ({ nome: "", anim: "auto", lang: "", ...lsGet("mochi.me", {}) });
const setMe = patch => lsSet("mochi.me", { ...me(), ...patch });

// ---------- stato ----------
const hadState = localStorage.getItem("mochi.state") !== null;
let state = normalize(lsGet("mochi.state", null) || emptyState());
for (const it of Object.values(state.items)) it.cat = legacyCat(it.cat); // migrazione 1.0 → 1.1
const seen = new Set(live(state.items).map(i => i.id));
const save = () => lsSet("mochi.state", state);
// id stabile del dispositivo: finisce nel campo "by" di ogni elemento modificato (spareggio nell'unione)
const deviceId = lsGet("mochi.device", null) || (() => { const id = uid(); lsSet("mochi.device", id); return id; })();
const BY = "phone:" + deviceId;
function mutate(fn) { const now = Date.now(); fn(state, now); stamp(state, now, BY); save(); render(); scheduleSync(); }

// ---------- mascotte, toast, effetti ----------
const mochi = mountMochi($("#mascot"), $("#bubble"));
let toastT;
function toast(msg, icon = "heart", action) {
  const el = $("#toast");
  $("#toast-txt").textContent = msg; $("#toast-ic").className = "mi mi-" + icon;
  el.querySelector(".toast-act")?.remove();
  el.classList.toggle("has-action", !!action);
  if (action) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "toast-act"; b.innerHTML = `${ic("undo")} ${esc(action.label)}`;
    b.addEventListener("click", () => { action.run(); el.classList.remove("show"); }, { once: true });
    el.appendChild(b);
  }
  el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), action ? 6000 : 2600);
}
const motionOk = () => { const a = me().anim; return a === "on" || (a !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches); };
function sparkles(el) {
  if (!motionOk() || !el) return;
  const r = el.getBoundingClientRect(), fx = $("#fx"), sym = ["magic", "heart", "star", "heart-line", "mochi"];
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("span"), a = (Math.PI * 2 * i) / 8, d = 34 + Math.random() * 18;
    s.className = "spark mi mi-" + sym[i % sym.length];
    s.style.cssText = `left:${r.left + r.width / 2 - 8}px;top:${r.top + r.height / 2 - 10}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rot:${Math.random() * 180}deg;color:${["#ff7eb3", "#b08cff", "#6fcf97", "#ffc94d"][i % 4]}`;
    fx.appendChild(s); setTimeout(() => s.remove(), 900);
  }
}
function confetti() {
  if (!motionOk()) return;
  const fx = $("#fx"), sym = ["heart", "star", "magic", "mochi", "heart-line"], col = ["#ff7eb3", "#b08cff", "#6fcf97", "#ffc94d", "#ff9cc5"];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement("span");
    c.className = "confetti mi mi-" + sym[i % sym.length];
    c.style.cssText = `color:${col[i % col.length]};font-size:${18 + Math.random() * 14}px;left:${Math.random() * 100}vw;--t:${2 + Math.random() * 1.8}s;--dx:${(Math.random() - .5) * 120}px;--rot:${(Math.random() - .5) * 720}deg;animation-delay:${Math.random() * .5}s`;
    fx.appendChild(c); setTimeout(() => c.remove(), 4500);
  }
}
function confirmDlg(testo, ok, icon = "ok") {
  const d = $("#dlg"); $("#dlg-t").textContent = testo; $("#dlg-ok").textContent = ok || t("common.yes"); $("#dlg-ic").className = "mi mi-" + icon;
  d.returnValue = ""; d.showModal();
  return new Promise(res => d.addEventListener("close", () => res(d.returnValue === "si"), { once: true }));
}
function applyAnim() {
  const a = me().anim;
  document.documentElement.classList.toggle("anim-on", a === "on");
  document.documentElement.classList.toggle("anim-off", a === "off");
}

// ---------- tab accessibili ----------
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = true) {
  for (const x of tabs) {
    const on = x === tab;
    x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1;
    $("#" + x.getAttribute("aria-controls")).hidden = !on;
  }
  if (focus) tab.focus();
  history.replaceState(null, "", "#" + tab.id.slice(2));
  window.scrollTo({ top: 0, behavior: motionOk() ? "smooth" : "auto" });
}
tabs.forEach((x, i) => {
  x.addEventListener("click", () => selectTab(x, false));
  x.addEventListener("keydown", e => {
    const rtl = document.documentElement.dir === "rtl";
    const k = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    if (k) { e.preventDefault(); selectTab(tabs[(i + k + tabs.length) % tabs.length]); }
    if (e.key === "Home") { e.preventDefault(); selectTab(tabs[0]); }
    if (e.key === "End") { e.preventDefault(); selectTab(tabs[tabs.length - 1]); }
  });
});

// ---------- RENDER ----------
function keepFocus(fn) {
  const a = document.activeElement, key = a && a.dataset && a.dataset.fk;
  fn();
  if (key) { const el = document.querySelector(`[data-fk="${CSS.escape(key)}"]`); if (el) el.focus({ preventScroll: true }); }
}

function renderLista() {
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

function renderMonitor() {
  const m = live(state.monitor).sort((a, b) => a.nome.localeCompare(b.nome));
  $("#monitor").innerHTML = m.length ? m.map(x =>
    `<li class="chip">${esc(x.nome)}<small>${esc(t("unitPer." + x.unita))}</small>
      ${amzOn() ? amzLink(x.nome, "icon-btn") : ""}<button class="icon-btn" type="button" data-mdel="${esc(x.id)}" aria-label="${esc(t("deals.unwatch", { name: x.nome }))}">${ic("unwatch")}</button></li>`).join("")
    : `<li class="hint">${esc(t("deals.noneWatched"))}</li>`;
}

const VOTO = { ottima: ["vote.great", "gold", "star"], buona: ["vote.good", "", "down"], normale: ["vote.avg", "warn", "info"] };
function renderOfferte() {
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

function renderValutazioni() {
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

function render() {
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
function deleteItem(id, focusFrom) {
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
let stopVoice = null;
function setMic(on) {
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

// ---------- FINESTRA GENERICA ----------
/** Apre #sheet con titolo, contenuto e bottoni [{value, label, icon, primary}]. Risolve con {value, form}. */
function sheet({ title, icon, body, buttons, onOpen }) {
  const d = $("#sheet");
  $("#sheet-t").innerHTML = `${icon ? ic(icon) : ""} ${esc(title)}`;
  $("#sheet-body").innerHTML = body || "";
  $("#sheet-btns").innerHTML = buttons.map(b =>
    `<button class="btn ${b.primary ? "primary" : "ghost"}" value="${esc(b.value)}">${b.icon ? ic(b.icon) + " " : ""}<span>${esc(b.label)}</span></button>`).join("");
  d.returnValue = "";
  if (onOpen) onOpen(d);
  d.showModal();
  (d.querySelector("#sheet-body input:not([type=hidden]), #sheet-body select, #sheet-body textarea") || d.querySelector("#sheet-btns .btn")).focus();
  return new Promise(res => d.addEventListener("close", () => res({ value: d.returnValue, form: new FormData($("#sheet-form")) }), { once: true }));
}

// ---------- DISPENSA: nomi dei luoghi ----------
const nameOf = l => l ? (l.nome || (["credenza", "cantina"].includes(l.id) ? t("place." + l.id) : l.id)) : "";
const placeName = id => nameOf(state.luoghi[id]);
const placeOpts = sel => pantry.placeOptions(state.luoghi, nameOf).map(o => `<option value="${esc(o.value)}"${o.value === sel ? " selected" : ""}>${esc(o.label)}</option>`).join("");
const findInPantry = nome => live(state.dispensa).find(d => pantry.sameProduct(d.nome, nome));

/** Aggiunge alla lista; se il prodotto c'è già in dispensa avvisa e chiede. */
async function addToList(nuovi) {
  let aggiunti = 0, ultimo = "";
  for (const { nome, qta } of nuovi) {
    const m = findInPantry(nome);
    let prendi = null;
    if (m) {
      const where = pantry.placeLabel(m, state.luoghi, nameOf);
      const r = await sheet({
        title: t("pantry.haveTitle", { name: nome }), icon: "store-room",
        body: `<p class="have">${esc(t("pantry.haveText", { name: m.nome, place: where, qty: m.qta || "–" }))}</p>`,
        buttons: [{ value: "take", label: t("pantry.take"), icon: "store-room", primary: true },
          { value: "none", label: t("pantry.notThere"), icon: "close" }, { value: "add", label: t("pantry.addAnyway"), icon: "add" }],
      });
      if (!r.value) continue;
      if (r.value === "take") prendi = { dispId: m.id, luogo: m.luogo, label: where };
      if (r.value === "none") { mutate((s, now) => { s.dispensa[m.id] = { ...s.dispensa[m.id], deleted: true, updatedAt: now }; }); toast(t("pantry.removed", { name: m.nome, place: where }), "store-room"); }
    }
    mutate((s, now) => { const id = uid(); s.items[id] = { id, nome, qta, cat: catOf(nome), fatto: false, da: me().nome, nota: "", prendi, ts: now, updatedAt: now }; });
    aggiunti++; ultimo = nome;
  }
  if (!aggiunti) return;
  mochi.mood("happy"); mochi.say(frase("aggiunto"));
  toast(aggiunti > 1 ? t("toast.addedN", { n: aggiunti }) : t("toast.added", { name: ultimo }), "add");
  $("#add-nome").focus();
}

/** Spunta di un prodotto segnato "da prendere in cantina". */
async function takenFromStore(it) {
  const place = it.prendi.label || placeName(it.prendi.luogo);
  const r = await sheet({
    title: t("pantry.takenTitle", { name: it.nome }), icon: "store-room",
    body: `<p>${esc(t("pantry.takenText", { place }))}</p>`,
    buttons: [{ value: "yes", label: t("pantry.takenYes", { place }), icon: "store-room", primary: true },
      { value: "bought", label: t("pantry.takenBought"), icon: "basket" }, { value: "", label: t("common.cancel"), icon: "close" }],
  });
  if (r.value === "yes") {
    mutate((s, now) => {
      s.items[it.id] = { ...s.items[it.id], deleted: true, updatedAt: now };
      const d = s.dispensa[it.prendi.dispId]; if (d) s.dispensa[d.id] = { ...d, deleted: true, updatedAt: now };
    });
    sparkles($("#add-nome")); mochi.mood("happy"); toast(t("pantry.tookFrom", { name: it.nome, place }), "store-room");
  } else if (r.value === "bought") {
    mutate((s, now) => { s.items[it.id] = { ...s.items[it.id], fatto: true, prendi: null, updatedAt: now }; });
    mochi.mood("happy"); mochi.say(frase("preso"));
  }
}

/** Tasto quantità sulla voce della lista. */
async function editQty(id) {
  const it = state.items[id]; if (!it) return;
  const r = await sheet({
    title: t("list.qtyTitle", { name: it.nome }), icon: "edit",
    body: `<label for="sq">${esc(t("list.qty"))}</label>
      <div class="stepper"><button class="btn ghost round" type="button" data-step="-1" aria-label="${esc(t("list.less"))}">${ic("minus")}</button>
      <input id="sq" name="qta" value="${esc(it.qta || "")}" placeholder="1" inputmode="text" maxlength="30">
      <button class="btn ghost round" type="button" data-step="1" aria-label="${esc(t("list.more"))}">${ic("add")}</button></div>
      <div class="chips quick">${["1", "2", "3", "6", "500 g", "1 kg", "1 l"].map(q => `<button class="chip-btn" type="button" data-set="${q}">${q}</button>`).join("")}</div>`,
    buttons: [{ value: "ok", label: t("common.save"), icon: "save", primary: true }, { value: "", label: t("common.cancel"), icon: "close" }],
    onOpen: d => {
      d.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { const i = d.querySelector("#sq"); i.value = pantry.stepQty(i.value, +b.dataset.step); });
      d.querySelectorAll("[data-set]").forEach(b => b.onclick = () => { d.querySelector("#sq").value = b.dataset.set; });
    },
  });
  if (r.value !== "ok") return;
  const qta = String(r.form.get("qta") || "").trim();
  mutate((s, now) => { s.items[id] = { ...s.items[id], qta, updatedAt: now }; });
  document.querySelector(`[data-fk="q${CSS.escape(id)}"]`)?.focus();
}

// ---------- METTI VIA LA SPESA ----------
const lastPlace = nome => { const m = findInPantry(nome); return m ? pantry.placeValue(m.luogo, m.scaffale, m.ripiano) : pantry.placeValue("credenza"); };
async function putAway() {
  const da = live(state.items).filter(i => i.fatto && !i.prendi);
  if (!da.length) return;
  const r = await sheet({
    title: t("pantry.putAwayTitle"), icon: "home",
    body: `<p class="hint">${esc(t("pantry.putAwayHint", { base: placeName("credenza") }))}</p>
      <ul class="putaway">${da.map(i => `<li><label for="pw-${esc(i.id)}"><span class="n">${esc(i.nome)}</span>${i.qta ? ` <span class="q">· ${esc(i.qta)}</span>` : ""}</label>
      <select id="pw-${esc(i.id)}" name="${esc(i.id)}">${placeOpts(lastPlace(i.nome))}</select></li>`).join("")}</ul>`,
    buttons: [{ value: "ok", label: t("pantry.putAwayOk"), icon: "home", primary: true }, { value: "", label: t("common.cancel"), icon: "close" }],
  });
  if (r.value !== "ok") return;
  mutate((s, now) => {
    for (const i of da) {
      const p = pantry.parsePlace(r.form.get(i.id));
      const ex = live(s.dispensa).find(d => pantry.sameProduct(d.nome, i.nome) && d.luogo === p.luogo && (d.scaffale || "") === p.scaffale && (d.ripiano || "") === p.ripiano);
      if (ex) s.dispensa[ex.id] = { ...ex, qta: pantry.addQty(ex.qta, i.qta), updatedAt: now };
      else { const id = uid(); s.dispensa[id] = { id, nome: i.nome, qta: i.qta || "", cat: catId(i.cat), ...p, ts: now, updatedAt: now }; }
      s.items[i.id] = { ...s.items[i.id], deleted: true, updatedAt: now };
    }
  });
  homeAsked = true; $("#home-card").innerHTML = "";
  confetti(); mochi.mood("happy", 2500); mochi.say(frase("pulito"));
  toast(t("pantry.putAwayDone", { n: da.length }), "home");
  if (bridge.installed("kapibo")) setTimeout(() => sendToKapibo(da), 1800);
}

// ---------- KAPIBO (stesso dominio, nessun server) ----------
// Preferenza per dispositivo: "ask" (chiedi ogni volta), "always", "never".
const kapMode = () => lsGet("mochi.kapibo", "ask");
const KAP_BTNS = ok => [{ value: "yes", label: ok, icon: "ok", primary: true }, { value: "no", label: t("kapibo.no"), icon: "close" }, { value: "never", label: t("kapibo.never"), icon: "unwatch" }];
function kapNever() { lsSet("mochi.kapibo", "never"); toast(t("kapibo.neverToast"), "unwatch"); }
async function sendToKapibo(da) {
  const mode = kapMode(); if (mode === "never") return;
  if (mode === "ask") {
    const r = await sheet({ title: t("kapibo.sendT"), icon: "coins", body: `<p>${esc(t("kapibo.sendP", { n: da.length }))}</p><p class="hint">${esc(t("kapibo.hint"))}</p>`, buttons: KAP_BTNS(t("kapibo.yes")) });
    if (r.value === "never") return kapNever();
    if (r.value !== "yes") return;
  }
  const items = da.map(i => ({ name: i.nome, qty: parseFloat(String(i.qta || "").replace(",", ".")) || 1 }));
  if (bridge.send("kapibo", { from: "mochi", date: new Date().toISOString().slice(0, 10), items })) toast(t("kapibo.sent", { n: items.length }), "coins");
}
let kapBusy = false;
async function checkKapibo() {
  if (kapBusy || document.querySelector("dialog[open]")) return;
  const [m] = bridge.peek("mochi"); if (!m) return;
  const mode = kapMode();
  if (mode === "never") { bridge.take("mochi"); return; }
  kapBusy = true;
  try {
    const qta = i => (i.qty && i.qty !== 1 ? String(i.qty).replace(".", ",") : "");
    let places = m.items.map(i => lastPlace(i.name));
    if (mode === "ask") {
      const r = await sheet({
        title: t("kapibo.getT"), icon: "store-room",
        body: `<p>${esc(t(m.store ? "kapibo.getPStore" : "kapibo.getP", { n: m.items.length, store: m.store }))}</p>
          <ul class="putaway">${m.items.map((i, k) => `<li><label for="kp-${k}"><span class="n">${esc(i.name)}</span>${qta(i) ? ` <span class="q">· ${esc(qta(i))}</span>` : ""}</label>
          <select id="kp-${k}" name="kp-${k}"><option value="">${esc(t("kapibo.skip"))}</option>${placeOpts(places[k])}</select></li>`).join("")}</ul>
          <p class="hint">${esc(t("kapibo.hint"))}</p>`,
        buttons: KAP_BTNS(t("pantry.putAwayOk")),
      });
      bridge.take("mochi", [m.id]);
      if (r.value === "never") return kapNever();
      if (r.value !== "yes") return;
      places = m.items.map((i, k) => r.form.get("kp-" + k) || "");
    } else bridge.take("mochi", [m.id]);
    let n = 0;
    mutate((s, now) => {
      m.items.forEach((i, k) => {
        if (!places[k]) return;
        const p = pantry.parsePlace(places[k]); n++;
        const ex = live(s.dispensa).find(d => pantry.sameProduct(d.nome, i.name) && d.luogo === p.luogo && (d.scaffale || "") === p.scaffale && (d.ripiano || "") === p.ripiano);
        if (ex) s.dispensa[ex.id] = { ...ex, qta: pantry.addQty(ex.qta, qta(i)), updatedAt: now };
        else { const id = uid(); s.dispensa[id] = { id, nome: i.name, qta: qta(i), cat: catOf(i.name), ...p, ts: now, updatedAt: now }; }
        // comprato: via dalla lista della spesa
        for (const it of live(s.items)) if (pantry.sameProduct(it.nome, i.name)) s.items[it.id] = { ...it, deleted: true, updatedAt: now };
      });
    });
    if (n) { confetti(); mochi.mood("happy", 2500); mochi.say(frase("pulito")); toast(t("pantry.putAwayDone", { n }), "home"); }
  } finally { kapBusy = false; }
}
bridge.listen("mochi", checkKapibo);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(checkKapibo, 700); });
$("#kap-mode")?.addEventListener("change", e => { lsSet("mochi.kapibo", e.target.value); toast(t("common.saved"), "ok"); });
$("#putaway").addEventListener("click", putAway);

// A casa con prodotti spuntati? Propone di metterli via (senza chiedere permessi nuovi).
let homeAsked = false;
async function checkHome() {
  if (homeAsked || !home() || !live(state.items).some(i => i.fatto && !i.prendi)) return;
  if ((await geo.permission()) !== "granted") return;
  let pos; try { pos = await geo.here({ timeout: 8000 }); } catch { return; }
  if (geo.distKm(home(), pos) > 1.5) return;
  $("#home-card").innerHTML = `<div class="card notice-card" role="region" aria-labelledby="home-t">
    <p id="home-t">${ic("home")} ${esc(t("pantry.atHome"))}</p>
    <div class="row gap"><button class="btn primary" type="button" id="home-yes">${ic("home")} ${esc(t("pantry.putAway"))}</button>
    <button class="btn ghost" type="button" id="home-no">${esc(t("install.later"))}</button></div></div>`;
  $("#home-yes").onclick = putAway;
  $("#home-no").onclick = () => { homeAsked = true; $("#home-card").innerHTML = ""; };
  mochi.mood("wow"); mochi.say(frase("novita"));
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkHome(); });

// ---------- SCHEDA DISPENSA ----------
function renderPantry() {
  const sel = $("#pa-posto"), keep = sel.value || pantry.placeValue("credenza");
  sel.innerHTML = placeOpts(keep);
  const items = live(state.dispensa);
  const box = $("#pantry");
  if (!items.length) { box.innerHTML = `<div class="card empty">${ic("tab-pantry", "big-emoji")}<p><strong>${esc(t("pantry.emptyTitle"))}</strong><br>${esc(t("pantry.emptyText"))}</p></div>`; return; }
  const byCat = document.querySelector('input[name="pgroup"]:checked')?.value === "cat";
  const oggi = new Date().toISOString().slice(0, 10), presto = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const scad = d => d.scad ? `<span class="meta exp${d.scad < oggi ? " past" : d.scad <= presto ? " soon" : ""}">${ic("expiry")} ${esc(t("pantry.expires", { date: new Date(d.scad + "T12:00").toLocaleDateString(locale(), { dateStyle: "medium" }) }))}</span>` : "";
  const row = (d, showPlace) => `<li class="item pantry-item">
    <div class="item-row"><span class="txt"><span class="n">${esc(d.nome)}</span>${showPlace ? `<span class="meta">${ic("store-room")} ${esc(pantry.placeLabel(d, state.luoghi, nameOf))}</span>` : ""}${scad(d)}</span>
    <button class="qty-btn" type="button" data-pedit="${esc(d.id)}" data-fk="pe${esc(d.id)}" aria-label="${esc(t("pantry.edit", { name: d.nome }))}">${d.qta ? esc(d.qta) : ic("edit")}</button>
    <button class="icon-btn" type="button" data-p2l="${esc(d.id)}" aria-label="${esc(t("pantry.toList", { name: d.nome }))}">${ic("list-add")}</button>
    <button class="icon-btn danger" type="button" data-pdel="${esc(d.id)}" aria-label="${esc(t("pantry.finished", { name: d.nome }))}">${ic("delete")}</button></div></li>`;
  let h = "";
  if (byCat) {
    const g = {}; for (const d of items) (g[catId(d.cat)] ||= []).push(d);
    for (const c of ORDER) if (g[c]) h += `<section class="group" aria-labelledby="pc-${c}"><h2 id="pc-${c}">${ic(iconOf(c), "em")}${esc(t("cat." + c))}</h2><div class="card"><ul class="items">${g[c].sort((a, b) => a.nome.localeCompare(b.nome)).map(d => row(d, true)).join("")}</ul></div></section>`;
  } else {
    let lvSeq = 0;
    for (const l of pantry.sortedPlaces(state.luoghi)) {
      const inL = items.filter(d => (state.luoghi[d.luogo] && !state.luoghi[d.luogo].deleted ? d.luogo : "credenza") === l.id);
      // scaffali definiti + quelli che compaiono solo nei prodotti
      const basso = state.settings.ripiani === "basso";
      const racks = (l.scaffali || []).map(x => ({ nome: x.nome, ripiani: [...(x.ripiani || [])], basso }));
      for (const d of inL) {
        if (!d.scaffale) continue;
        let r = racks.find(x => pantry.norm(x.nome) === pantry.norm(d.scaffale));
        if (!r) racks.push(r = { nome: d.scaffale, ripiani: [], basso });
        if (d.ripiano && !r.ripiani.some(x => pantry.norm(x) === pantry.norm(d.ripiano))) r.ripiani.push(d.ripiano);
      }
      if (!inL.length && !racks.length) continue;
      const inLevel = (r, lv) => inL.filter(d => pantry.norm(d.scaffale) === pantry.norm(r.nome) && pantry.norm(d.ripiano || "") === pantry.norm(lv));
      const ids = new Map(); const idOf = (r, lv) => { const k = r.nome + "|" + lv; if (!ids.has(k)) ids.set(k, "lv" + lvSeq++); return ids.get(k); };
      h += `<section class="group" aria-labelledby="pl-${esc(l.id)}"><h2 id="pl-${esc(l.id)}">${ic(l.base ? "cat-pantry" : "store-room", "em")}${esc(nameOf(l))} <small>· ${inL.length}</small></h2>`;
      if (racks.length) {
        h += `<div class="racks">${racks.map(r => {
          const sciolti = inLevel(r, "");
          const lvls = [...pantry.levelsTopDown(r), ...(sciolti.length ? [""] : [])];
          return `<div class="rack"><div class="rack-name">${ic("shelf")} ${esc(r.nome)}</div><ul class="rack-body">${lvls.map(lv => {
            const ds = inLevel(r, lv), cats = [...new Set(ds.map(d => catId(d.cat)))].slice(0, 4);
            const lab = t("pantry.rackLevel", { shelf: r.nome, level: lv || "–", n: ds.length });
            const inner = `<span class="lv-n">${esc(lv || "–")}</span><span class="lv-ic">${cats.map(c => ic(iconOf(c))).join("")}</span><span class="lv-c">${ds.length || ""}</span>`;
            return `<li>${ds.length ? `<button type="button" class="rack-lvl" data-goto="${idOf(r, lv)}" aria-label="${esc(lab)}">${inner}</button>` : `<div class="rack-lvl empty" role="img" aria-label="${esc(lab)}">${inner}</div>`}</li>`;
          }).join("")}</ul></div>`;
        }).join("")}</div>`;
      }
      if (inL.length) {
        h += `<div class="card">`;
        const sort = arr => arr.sort((a, b) => a.nome.localeCompare(b.nome)).map(d => row(d, false)).join("");
        for (const r of racks) for (const lv of [...r.ripiani, ""]) {
          const ds = inLevel(r, lv); if (!ds.length) continue;
          h += `<h3 class="shelf" id="${idOf(r, lv)}" tabindex="-1">${ic("shelf")} ${esc([r.nome, lv].filter(Boolean).join(" › "))}</h3><ul class="items">${sort(ds)}</ul>`;
        }
        const liberi = inL.filter(d => !d.scaffale);
        if (liberi.length) h += `${racks.length ? `<h3 class="shelf">${esc(t("pantry.noShelf"))}</h3>` : ""}<ul class="items">${sort(liberi)}</ul>`;
        h += `</div>`;
      }
      h += `</section>`;
    }
  }
  box.innerHTML = h;
}
document.querySelectorAll('input[name="pgroup"]').forEach(r => r.addEventListener("change", renderPantry));
$("#f-pantry").addEventListener("submit", e => {
  e.preventDefault();
  const v = $("#pa-nome").value.trim(); if (!v) return $("#pa-nome").focus();
  const p = pantry.parsePlace($("#pa-posto").value);
  const nuovi = v.split(/\s*[,;、，]\s*/).filter(Boolean).map(parseAdd);
  mutate((s, now) => { for (const { nome, qta } of nuovi) { const id = uid(); s.dispensa[id] = { id, nome, qta, cat: catOf(nome), ...p, ts: now, updatedAt: now }; } });
  $("#pa-nome").value = ""; $("#pa-nome").focus();
  toast(t("pantry.added", { n: nuovi.length, place: pantry.placeLabel(p, state.luoghi, nameOf) }), "store-room"); mochi.mood("happy");
});
$("#pantry").addEventListener("click", async e => {
  const go = e.target.closest("[data-goto]");
  if (go) {
    const h3 = document.getElementById(go.dataset.goto); if (!h3) return;
    h3.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    h3.focus({ preventScroll: true }); h3.classList.remove("flash"); void h3.offsetWidth; h3.classList.add("flash");
    return;
  }
  const del = e.target.closest("[data-pdel]"), tl = e.target.closest("[data-p2l]"), ed = e.target.closest("[data-pedit]");
  if (del) {
    const prima = state.dispensa[del.dataset.pdel];
    mutate((s, now) => { s.dispensa[prima.id] = { ...prima, deleted: true, updatedAt: now }; });
    toast(t("pantry.gone", { name: prima.nome }), "delete", { label: t("common.undo"), run: () => mutate((s, now) => { s.dispensa[prima.id] = { ...prima, deleted: false, updatedAt: now }; }) });
    $("#pa-nome").focus();
  } else if (tl) {
    const d = state.dispensa[tl.dataset.p2l];
    mutate((s, now) => { const id = uid(); s.items[id] = { id, nome: d.nome, qta: "", cat: catId(d.cat), fatto: false, da: me().nome, nota: "", ts: now, updatedAt: now }; });
    sparkles(tl); toast(t("toast.added", { name: d.nome }), "list-add");
  } else if (ed) editPantryItem(ed.dataset.pedit);
});
async function editPantryItem(id) {
  const d = state.dispensa[id]; if (!d) return;
  const r = await sheet({
    title: t("pantry.edit", { name: d.nome }), icon: "edit",
    body: `<label for="pe-n">${esc(t("pantry.name"))}</label><input id="pe-n" name="nome" value="${esc(d.nome)}" maxlength="120">
      <label for="pe-q">${esc(t("list.qty"))}</label>
      <div class="stepper"><button class="btn ghost round" type="button" data-step="-1" aria-label="${esc(t("list.less"))}">${ic("minus")}</button>
      <input id="pe-q" name="qta" value="${esc(d.qta || "")}" maxlength="30"><button class="btn ghost round" type="button" data-step="1" aria-label="${esc(t("list.more"))}">${ic("add")}</button></div>
      <label for="pe-p">${esc(t("pantry.place"))}</label><select id="pe-p" name="posto">${placeOpts(pantry.placeValue(d.luogo, d.scaffale, d.ripiano))}</select>
      <label for="pe-c">${esc(t("pantry.category"))}</label><select id="pe-c" name="cat">${ORDER.map(c => `<option value="${c}"${catId(d.cat) === c ? " selected" : ""}>${esc(t("cat." + c))}</option>`).join("")}</select>`,
    buttons: [{ value: "ok", label: t("common.save"), icon: "save", primary: true }, { value: "", label: t("common.cancel"), icon: "close" }],
    onOpen: dl => dl.querySelectorAll("[data-step]").forEach(b => b.onclick = () => { const i = dl.querySelector("#pe-q"); i.value = pantry.stepQty(i.value, +b.dataset.step); }),
  });
  if (r.value !== "ok") return;
  const p = pantry.parsePlace(r.form.get("posto"));
  mutate((s, now) => { s.dispensa[id] = { ...s.dispensa[id], nome: String(r.form.get("nome") || d.nome).trim() || d.nome, qta: String(r.form.get("qta") || "").trim(), cat: r.form.get("cat"), ...p, updatedAt: now }; });
  toast(t("common.saved"), "save");
}

// Organizza il magazzino: luoghi, scaffali e ripiani
// importazione da Invendo (.xlsx / .csv)
$("#pantry-import").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  let prodotti;
  try { prodotti = await importer.readFile(f); } catch { prodotti = []; }
  const plan = prodotti.length ? importer.planImport(prodotti, state, nameOf, uid) : null;
  if (!plan || !plan.n) { toast(t("pantry.importErr"), "warn"); return; }
  const posti = new Set(prodotti.filter(p => p.qta !== "0").map(p => p.posto.filter(Boolean).join(" › ") || nameOf(state.luoghi.credenza))).size;
  const { value } = await sheet({
    title: t("pantry.importTitle"), icon: "import",
    body: `<p>${esc(t("pantry.importText", { n: plan.n, places: posti }))}</p>${plan.upd.length ? `<p class="hint">${esc(t("pantry.importUpd", { n: plan.upd.length }))}</p>` : ""}`,
    buttons: [{ value: "ok", label: t("pantry.importOk"), icon: "import", primary: true }, { value: "cancel", label: t("common.cancel"), icon: "close" }],
  });
  if (value !== "ok") return;
  mutate((s, now) => {
    for (const [id, l] of Object.entries(plan.luoghi)) s.luoghi[id] = { ...l, updatedAt: now };
    for (const r of plan.add) { const id = uid(); s.dispensa[id] = { id, ...r, ts: now, updatedAt: now }; }
    for (const { id, ...r } of plan.upd) if (s.dispensa[id]) s.dispensa[id] = { ...s.dispensa[id], ...r, updatedAt: now };
    for (const id of plan.del) if (s.dispensa[id]) s.dispensa[id] = { ...s.dispensa[id], deleted: true, updatedAt: now };
  });
  toast(t("pantry.importDone", { n: plan.n }), "import"); mochi.mood("happy");
});

// editor di posti, scaffali e ripiani
let shelfSeq = 0;
function shelfBlock(lid, sh) {
  const k = shelfSeq++, id = `se${k}`, r = sh.ripiani || [];
  return `<div class="shelf-edit" data-k="${k}">
    <input type="hidden" name="so-${esc(lid)}-${k}" value="${esc(sh.nome || "")}"><input type="hidden" name="sl-${esc(lid)}-${k}" value="${esc(JSON.stringify(sh.nome ? r : []))}">
    <div class="shelf-head"><label for="${id}-n">${ic("shelf")} ${esc(t("pantry.shelfName"))}</label>
      <button class="icon-btn danger" type="button" data-rmshelf aria-label="${esc(t("pantry.removeShelf", { name: sh.nome || "" }))}">${ic("delete")}</button></div>
    <input id="${id}-n" name="sn-${esc(lid)}-${k}" value="${esc(sh.nome || "")}" maxlength="40">
    <label for="${id}-r">${esc(t("pantry.levels"))}</label>
    <div class="lv-row"><div class="stepper"><button class="btn ghost round" type="button" data-lv="-1" aria-label="${esc(t("pantry.levelLess"))}">${ic("minus")}</button>
      <output aria-live="polite">${r.length}</output>
      <button class="btn ghost round" type="button" data-lv="1" aria-label="${esc(t("pantry.levelMore"))}">${ic("add")}</button></div>
      <input id="${id}-r" name="sr-${esc(lid)}-${k}" value="${esc(r.join(", "))}" aria-describedby="lv-help" inputmode="text"></div>
  </div>`;
}
$("#places-edit").addEventListener("click", async () => {
  const ls = pantry.sortedPlaces(state.luoghi);
  const r = await sheet({
    title: t("pantry.organize"), icon: "store-room",
    body: `<p class="hint">${esc(t("pantry.organizeHint"))}</p>${ls.map(l => `<fieldset class="place-edit"><legend>${ic(l.base ? "cat-pantry" : "store-room")} ${esc(nameOf(l))}</legend>
      <label for="pn-${esc(l.id)}">${esc(t("pantry.placeName"))}</label><input id="pn-${esc(l.id)}" name="n-${esc(l.id)}" value="${esc(nameOf(l))}" maxlength="40">
      <div class="shelves" data-lid="${esc(l.id)}">${(l.scaffali || []).map(sh => shelfBlock(l.id, sh)).join("")}</div>
      <button class="btn ghost small" type="button" data-addshelf="${esc(l.id)}">${ic("add")} ${esc(t("pantry.addShelf"))}</button>
      ${l.base ? "" : `<label class="check"><input type="checkbox" name="x-${esc(l.id)}"> ${esc(t("pantry.removePlace"))}</label>`}</fieldset>`).join("")}
      <p class="hint" id="lv-help">${esc(t("pantry.levelsHelp"))}</p>
      <label for="pn-new">${ic("add")} ${esc(t("pantry.newPlace"))}</label><input id="pn-new" name="new" placeholder="${esc(t("pantry.newPlacePh"))}" maxlength="40">`,
    buttons: [{ value: "ok", label: t("common.save"), icon: "save", primary: true }, { value: "", label: t("common.cancel"), icon: "close" }],
    onOpen: dl => {
      const body = dl.querySelector("#sheet-body");
      body.onclick = e => {
        const add = e.target.closest("[data-addshelf]"), rm = e.target.closest("[data-rmshelf]"), lv = e.target.closest("[data-lv]");
        if (add) {
          const box = body.querySelector(`.shelves[data-lid="${CSS.escape(add.dataset.addshelf)}"]`);
          box.insertAdjacentHTML("beforeend", shelfBlock(add.dataset.addshelf, { nome: t("pantry.newShelf", { n: box.children.length + 1 }), ripiani: ["1", "2", "3"] }));
          const n = box.lastElementChild.querySelector('input[name^="sn-"]'); n.focus(); n.select();
        } else if (rm) {
          const blk = rm.closest(".shelf-edit"), fs = blk.closest("fieldset"); blk.remove(); fs.querySelector("[data-addshelf]").focus();
        } else if (lv) {
          const blk = lv.closest(".shelf-edit"), inp = blk.querySelector('input[name^="sr-"]');
          const arr = pantry.splitLevels(inp.value);
          if (+lv.dataset.lv > 0) arr.push(pantry.nextLevel(arr)); else arr.pop();
          inp.value = arr.join(", "); blk.querySelector("output").value = arr.length;
        }
      };
      body.oninput = e => { if (e.target.name?.startsWith("sr-")) e.target.closest(".shelf-edit").querySelector("output").value = pantry.splitLevels(e.target.value).length; };
    },
  });
  if (r.value !== "ok") return;
  const f = r.form;
  mutate((s, now) => {
    for (const l of ls) {
      if (f.get("x-" + l.id)) {
        s.luoghi[l.id] = { ...l, deleted: true, updatedAt: now };
        for (const d of live(s.dispensa)) if (d.luogo === l.id) s.dispensa[d.id] = { ...d, luogo: "credenza", scaffale: "", ripiano: "", updatedAt: now };
        continue;
      }
      const scaffali = [], renamers = [];
      for (const [key, val] of f.entries()) {
        const m = key.match(/^sn-(.+)-(\d+)$/); if (!m || m[1] !== l.id) continue;
        const k = m[2], nome = String(val).trim(); if (!nome) continue;
        const sh = { nome, ripiani: pantry.splitLevels(f.get(`sr-${l.id}-${k}`)) };
        scaffali.push(sh);
        const orig = String(f.get(`so-${l.id}-${k}`) || "");
        if (orig) renamers.push(pantry.shelfRenamer({ nome: orig, ripiani: JSON.parse(f.get(`sl-${l.id}-${k}`) || "[]") }, sh));
      }
      for (const d of live(s.dispensa)) {
        if (d.luogo !== l.id || !d.scaffale) continue;
        for (const rn of renamers) { const x = rn(d.scaffale, d.ripiano || ""); if (x) { s.dispensa[d.id] = { ...d, scaffale: x[0], ripiano: x[1], updatedAt: now }; break; } }
      }
      const nome = String(f.get("n-" + l.id) || "").trim();
      s.luoghi[l.id] = { ...l, nome: nome === nameOf(l) && !l.nome ? "" : nome, scaffali, updatedAt: now };
    }
    const nuovo = String(f.get("new") || "").trim();
    if (nuovo) { const id = uid(); s.luoghi[id] = { id, nome: nuovo, ordine: ls.length, scaffali: [], updatedAt: now }; }
  });
  toast(t("common.saved"), "store-room");
});

// zona per le ricerche: fuori casa se confermato, altrimenti casa
const searchPoint = () => { const a0 = away(), s0 = state.settings; return a0 ? { lat: a0.lat, lon: a0.lon } : s0.lat != null ? { lat: s0.lat, lon: s0.lon } : null; };
const opNote = p => t("free.seen", { product: [p.nome, p.quantita ? `${p.quantita} ${p.unitaQ}` : ""].filter(Boolean).join(" "), date: p.data ? new Date(p.data + "T12:00").toLocaleDateString(locale(), { dateStyle: "medium" }) : "–" });
const OP_CREDIT = () => `<p class="hint op-credit">${ic("info")} ${esc(t("free.credit"))} <a href="${op.SITE}" target="_blank" rel="noopener noreferrer">Open Food Facts – Open Prices${`<span class="sr"> ${esc(t("a11y.newTab"))}</span>`}</a> (ODbL)</p>`;

// prezzi dai volantini salvati, come opzioni per "Dove conviene?"
const oggiISO = () => new Date().toISOString().slice(0, 10);
const shortDate = d => new Date(d + "T12:00").toLocaleDateString(locale(), { day: "numeric", month: "short" });
function savedOptions(nome) {
  const db = pricedb.recent(nome).map(x => ({ negozio: x.negozio || "?", prezzo: x.prezzo, prezzoUnit: x.prezzoUnit, offerta: !!(x.validoFino && x.validoFino >= oggiISO()),
    validoFino: x.validoFino ? shortDate(x.validoFino) : null, fonte: x.fonte || "", nota: `${t("fl.note", { date: shortDate(x.data) })} – ${x.nome}` }));
  return [...flyer.bestSaved(nome, live(state.prezzi)).map(x => ({ negozio: x.negozio, prezzo: x.prezzo, prezzoUnit: x.prezzoUnit, offerta: !!(x.validoFino && x.validoFino >= oggiISO()),
    validoFino: x.validoFino ? shortDate(x.validoFino) : null, fonte: x.fonte || "", nota: t("fl.note", { date: shortDate(x.data) }) + (x.riga ? ` – ${x.riga}` : "") })), ...db];
}
/** Un'opzione per negozio: vince la prima (volantini salvati prima dei prezzi della community), poi dalla più economica. */
function mergeOptions(opts) {
  const m = new Map();
  for (const o of opts) { const k = pantry.norm(o.negozio); if (!m.has(k)) m.set(k, o); }
  return [...m.values()].sort((a, b) => a.prezzo - b.prezzo).slice(0, 6);
}

// ---------- TROVA IL PREZZO MIGLIORE (un prodotto, tutte le fonti) ----------
const BEST_KEY = "mochi.best";
let bestRun = 0, bestCtl = null;
function renderBestHow() {
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
const srcLabel = r => r.src === "web" ? t("best.srcWeb") : r.src === "op" ? "Open Prices" : r.src === "serp" ? t("serp.src") : t("best.srcMine");
function bestRow(r, i, top) {
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
function renderBest(res) {
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
async function findBest(q, link = "") {
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
async function chainsNear(s0) {
  const fav = String(s0.negozi || "").split(",").map(x => x.trim()).filter(Boolean);
  let near = [];
  const pt = searchPoint();
  if (pt) try { near = (await shops.nearby({ lat: pt.lat, lon: pt.lon, raggioKm: s0.raggioKm || 5 })).filter(g => g.n >= 1).map(g => g.nome); } catch {}
  const out = [];
  for (const n of [...fav, ...near]) if (!out.some(x => shops.sameShop(x, n))) out.push(n);
  return out.slice(0, 9);
}
/** Esegue le promesse al massimo "n" alla volta (per non superare i limiti dei piani gratuiti). */
async function pool(tasks, n) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
  return out;
}
async function webBest(q, link, s0, res, parts, update, haveSerp, signal) {
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
const FLY_TXT = "mochi.flyertext", CH_CHECK = "mochi.chainCheck";
// catene attive: quelle con adattatore dedicato scelte dall'utente + le pagine ufficiali dei suoi negozi
const myChains = () => PROXY() ? [...(state.settings.catene || []).map(id => chains.CHAINS[id]).filter(Boolean),
  ...(state.settings.pagine || []).filter(p => chains.officialChainOf(p.url)).map(chains.pageChain)] : [];
const chainOf = id => myChains().find(c => c.id === id) || null;
let chainRun = null;
async function refreshChains({ manual = false } = {}) {
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
function matchChainTexts() {
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
async function ingestFlyer(text, { negozio, validoFino = "", fonte = "", origine = "volantino" }) {
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
const flyerNames = () => [...new Map([...live(state.monitor).map(m => m.nome), ...live(state.items).filter(i => !i.fatto).map(i => i.nome)]
  .map(n => [pantry.norm(n), n])).values()];
function renderFlyerBest() {
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
let sharedStore = "";
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
function renderDb() {
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
let dbT; $("#db-q").addEventListener("input", () => { clearTimeout(dbT); dbT = setTimeout(renderDb, 200); });
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
renderBestHow();
fillCountry().catch(() => {});
// arrivo da "Condividi" di un'altra app: link/testo → ricerca; screenshot o PDF → lettura prezzi
async function takeShare() {
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
const prefOf = (prodotto, negozio) => live(state.preferenze).find(p => pantry.sameProduct(p.prodotto, prodotto) && pantry.norm(p.negozio) === pantry.norm(negozio));
function togglePref(prodotto, negozio, tipo) {
  const p = prefOf(prodotto, negozio);
  mutate((s, now) => {
    if (p && p.tipo === tipo) s.preferenze[p.id] = { ...p, deleted: true, updatedAt: now };
    else { const id = p ? p.id : uid(); s.preferenze[id] = { id, prodotto, negozio, tipo, updatedAt: now }; }
  });
}
function compareBody() {
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
async function openCompare() {
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
async function runCompare() {
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
function renderPrefs() {
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

let searching = null;
function endSearch() { searching = null; $("#cerca").classList.remove("loading"); $("#cerca").removeAttribute("aria-busy"); }
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
const words = s => (s || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3);
const readVal = () => ({ testo: $("#val-testo").value.trim(), prezzo: num($("#val-prezzo").value), quantita: num($("#val-q").value), unita: $("#val-u").value });
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

// ---------- IMPOSTAZIONI ----------
function fillLangSelect(sel) {
  sel.innerHTML = Object.entries(LANGS).sort((a, b) => a[1].localeCompare(b[1], "en")).map(([c, n]) => `<option value="${c}" lang="${c}">${esc(n)}</option>`).join("");
  sel.value = lang();
}
function fillSettings() {
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
  ai.setShared(state.settings.aiShared);
  renderAiKeys(); fillProviders();
  $("#ver-chip").textContent = "v" + APP_VERSION;
  $("#ver-chip").setAttribute("aria-label", t("about.version", { v: APP_VERSION }) + ". " + t("news.open"));
}
$("#z-raggio").addEventListener("input", e => $("#z-raggio-v").textContent = e.target.value);
async function changeLang(code) {
  setMe({ lang: code });
  await setLang(code);
  fillSettings(); renderOnboard(); render(); syncSet(syncKind, syncKey, syncVars); setMic(!!stopVoice);
}
$("#me-lang").addEventListener("change", async e => {
  e.stopPropagation(); await changeLang(e.target.value); toast(t("lang.changed"), "lang"); $("#me-lang").focus(); });
$("#me-lang").addEventListener("input", e => e.stopPropagation());
// ---------- NEGOZI PREFERITI (dalla zona, OpenStreetMap) ----------
const splitShops = v => String(v || "").split(",").map(x => x.trim()).filter(Boolean);
let pickedShops = [], nearShops = [], shopsAll = false, shopsCtl = null;
const checkedShops = () => [...document.querySelectorAll('#z-shops-list input[name="negozio"]:checked')].map(x => x.value);
const kmFmt = km => km == null ? "" : km.toLocaleString(locale(), { maximumFractionDigits: 1 });
function renderShops() {
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
async function loadShops() {
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
let shopsTimer; $("#z-raggio").addEventListener("change", () => { clearTimeout(shopsTimer); shopsTimer = setTimeout(loadShops, 400); });

// ---------- PAGINE UFFICIALI DEI VOLANTINI (scelte dall'utente) ----------
const OFFICIAL_LIST = () => Object.values(chains.OFFICIAL).join(", ");
function renderPages(pagine) {
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
async function testPonte() {
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
function renderSerp() {
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
renderSerp();

// ---------- CHIAVI IA: più servizi e più chiavi, scelti in automatico ----------
const mask = k => "•••• " + k.slice(-4);
const until = ms => new Date(ms).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
function providerInfo(id) {
  const P = ai.PROVIDERS[id];
  return [t(P.tier === "free" ? "ai.free" : P.tier === "quota" ? "ai.freeQuota" : "ai.paid"), t(ai.canWeb(id) ? "ai.web" : "ai.noweb")].join(" · ");
}
function renderAiKeys() {
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
function fillProviders() {
  const sel = $("#ai-provider"), cur = sel.value || "groq";
  sel.innerHTML = Object.entries(ai.PROVIDERS).map(([id, P]) => `<option value="${id}">${esc(P.nome)} – ${esc(providerInfo(id))}</option>`).join("");
  sel.value = cur; fillProvider();
}
function fillProvider() {
  const id = $("#ai-provider").value, P = ai.PROVIDERS[id];
  $("#ai-link").href = P.link;
  $("#ai-model").placeholder = P.models[0].id;
  $("#ai-pinfo").textContent = t("ai.p." + id);
}
$("#ai-provider").addEventListener("change", fillProvider);
const shareKeys = on => mutate((s, now) => { s.settings = { ...s.settings, aiShared: on ? ai.localKeys().map(({ provider, key, model }) => ({ provider, key, model })) : null, updatedAt: now }; });
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
let settingsDirty = false;
function setDirty(v) {
  settingsDirty = v;
  $("#save-bar").hidden = !v;
  document.body.classList.toggle("has-save-bar", v);
}
for (const f of document.querySelectorAll("form.track")) {
  f.addEventListener("input", () => setDirty(true));
  f.addEventListener("change", () => setDirty(true));
  f.addEventListener("submit", e => { e.preventDefault(); saveSettings(); });
}
async function saveSettings() {
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
        valuta: $("#z-valuta").value, ripiani, catene: [...document.querySelectorAll('#z-chains-list input[name="catena"]:checked')].map(x => x.value),
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
const normPath = p => { p = (p || "").trim() || "/Spesa/mochi-spesa.json"; if (!p.startsWith("/")) p = "/" + p; if (!/\.json$/i.test(p)) p += ".json"; return p; };
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
async function shareApp(btn) {
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
let rev = lsGet("mochi.rev", null), syncing = false, syncAgain = false, syncT;
let syncKind = "local", syncKey = "sync.local", syncVars = null;
function syncSet(kind, key, vars) {
  syncKind = kind; syncKey = key; syncVars = vars || null;
  const b = $("#sync");
  b.className = "sync " + ({ ok: "ok", busy: "busy", err: "err" }[kind] || "");
  $("#sync-ic").className = "mi mi-" + ({ ok: "cloud-ok", busy: "cloud-up", err: "cloud-off" }[kind] || "phone");
  $("#sync-txt").textContent = t(key, vars);
  b.setAttribute("aria-label", t(key, vars) + ". " + t(dbx.isConnected() ? "sync.tapSync" : "sync.tapConnect"));
}
let conflictRuns = 0; // conflitti di fila: la nuova prova aspetta 30 s, 60 s, … fino a 5 minuti
function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(sync, 700); }
async function sync() {
  if (!dbx.isConnected()) { syncSet("local", "sync.local"); return; }
  if (!navigator.onLine) { syncSet("err", "sync.offline"); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; syncSet("busy", "sync.busy");
  const path = dbxCfg().path;
  try {
    let done = false;
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
      state = merge(state, merged);
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
    if (!done) { syncSet("err", "sync.retry"); clearTimeout(syncT); syncT = setTimeout(sync, Math.min(300e3, 30e3 * 2 ** conflictRuns++)); }
    else conflictRuns = 0;
  } catch (e) {
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
function renderOnboard() {
  $("#onboard").innerHTML = dbx.isConnected() ? "" :
    `<div class="card"><h2 class="in">${ic("mochi")} ${esc(t("onboard.title"))}</h2>
     <p style="margin:0 0 10px">${esc(t("onboard.text"))}</p>
     <button class="btn primary" type="button" id="go-dbx">${ic("connect")} ${esc(t("dbx.connect"))}</button></div>`;
  $("#go-dbx")?.addEventListener("click", connectDropbox);
  renderInstall();
}


// ---------- INSTALLAZIONE (PWA) ----------
let installEvt = null;
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; renderInstall(); });
addEventListener("appinstalled", () => { installEvt = null; renderInstall(); toast(t("install.done"), "install"); mochi.mood("happy", 2500); confetti(); });
function renderInstall() {
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
const AWAY_KEY = "mochi.away";
const away = () => lsGet(AWAY_KEY, null);          // { lat, lon, nome, paese } se si cercano offerte fuori casa
// chi aveva già la zona prima della 2.5.0: il paese si ricava una volta dalle coordinate di casa
async function fillCountry() {
  const s = state.settings;
  if (s.paese || s.lat == null || !navigator.onLine) return;
  const info = await geo.placeInfo({ lat: s.lat, lon: s.lon }, lang());
  if (info?.paese) mutate((st, now) => { st.settings = { ...st.settings, paese: info.paese, updatedAt: now }; });
}
let awayAsked = null;                              // posizione per cui l'utente ha già risposto "no" in questa sessione
const home = () => state.settings.lat != null ? { lat: state.settings.lat, lon: state.settings.lon } : null;

/** "Usa la mia posizione" nelle impostazioni: imposta casa qui. */
async function usaPosizione(btn) {
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
async function checkAway({ ask = false, modal = false } = {}) {
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
$("#t-offerte").addEventListener("click", () => { checkAway(); refreshChains(); });
$("#t-imp").addEventListener("click", () => { renderAiKeys(); renderSerp(); });
$("#t-offerte").addEventListener("click", () => renderBestHow());

// ---------- PRIVACY E CONDIZIONI ----------
function legalHtml() {
  const sec = (icon, title, prefix, n) => `<h3>${ic(icon)} ${esc(t(title))}</h3><ul>${
    Array.from({ length: n }, (_, i) => `<li>${linkify(esc(t(`${prefix}${i + 1}`)))}</li>`).join("")}</ul>`;
  const linkify = h => h.replace(/github\.com\/Marketto\/mochi-spesa\/issues/, m => `<a href="https://${m}" target="_blank" rel="noopener">${m}</a>`);
  return `<p class="hint">${esc(t("legal.updated", { date: new Date(POLICY_VERSION.slice(0, 10)).toLocaleDateString(locale(), { dateStyle: "long" }) }))}</p>
    ${sec("privacy", "legal.privacyTitle", "legal.p", 17)}${sec("terms", "legal.termsTitle", "legal.t", 7)}`;
}
function openLegal() { $("#legal-body").innerHTML = legalHtml(); $("#legal").showModal(); }

// ---------- NOVITÀ ----------
function openNews(releases, soloNuove = true) {
  if (!releases.length) return;
  $("#news-title").textContent = soloNuove ? t("news.title", { v: APP_VERSION }) : t("news.allTitle");
  $("#news-body").innerHTML = releases.map(r => `<h3 class="ver">${esc(t("news.version", { v: r.v }))}</h3><ul class="feat">${
    r.items.map(([icon, key]) => `<li>${ic(icon, "feat-ic")}<span>${esc(t(key))}</span></li>`).join("")}</ul>`).join("");
  $("#news").showModal();
  if (soloNuove) { mochi.mood("happy", 2500); confetti(); }
}

// ---------- WIZARD (primo avvio, riaccettazione policy, o dalle impostazioni) ----------
const WIZ = [
  { id: "welcome", n: 1, icon: "wave" }, { id: "list", n: 2, icon: "tab-list" }, { id: "share", n: 3, icon: "cloud" },
  { id: "deals", n: 4, icon: "tab-deals" }, { id: "privacy", n: 5, icon: "privacy" },
];
let wiz = { step: 0, steps: WIZ, required: false, accepted: false };
const policyOk = () => lsGet("mochi.policy", null) === POLICY_VERSION;
const bullets = arr => `<ul class="feat">${arr.map(([icon, key]) => `<li>${ic(icon, "feat-ic")}<span>${esc(t(key))}</span></li>`).join("")}</ul>`;

function wizBody(id) {
  switch (id) {
    case "welcome": return `<p>${esc(t("wiz.s1.text"))}</p>
      <label for="wiz-lang">${ic("lang")} ${esc(t("lang.label"))}</label><select id="wiz-lang" class="lang-select"></select>`;
    case "list": return bullets([["add", "wiz.s2.b1"], ["cat-veg", "wiz.s2.b2"], ["heart", "wiz.s2.b3"]]);
    case "share": return `<p>${esc(t("wiz.s3.text"))}</p>${bullets([["cloud", "wiz.s3.b1"], ["copy", "wiz.s3.b2"], ["phone", "wiz.s3.b3"]])}
      <label for="wiz-name">${esc(t("me.name"))}</label><input id="wiz-name" maxlength="30" autocomplete="given-name" value="${esc(me().nome)}">`;
    case "deals": return bullets([["watch", "wiz.s4.b1"], ["search", "wiz.s4.b2"], ["mochi", "wiz.s4.b3"], ["key", "wiz.s4.b4"]]);
    case "privacy": return `${wiz.steps.length === 1 ? `<p class="notice">${ic("info")} ${esc(t("legal.reaccept"))}</p>` : ""}
      ${bullets([["phone", "wiz.s5.b1"], ["privacy", "wiz.s5.b2"], ["key", "wiz.s5.b3"], ["warn", "wiz.s5.b4"]])}
      <button class="btn ghost" type="button" id="wiz-read">${ic("terms")} ${esc(t("wiz.s5.read"))}</button>
      <label class="check accept"><input type="checkbox" id="wiz-accept" aria-describedby="wiz-err"${wiz.accepted ? " checked" : ""}> <span>${esc(t("wiz.s5.accept"))}</span></label>
      <label class="check accept"><input type="checkbox" id="wiz-disc" aria-describedby="wiz-err"${wiz.disc ? " checked" : ""}> <span>${esc(t("wiz.s5.disclaimer"))}</span></label>
      <p class="err" id="wiz-err" role="alert"></p>`;
  }
  return "";
}
function renderWizard(focusTitle = true) {
  const s = wiz.steps[wiz.step], last = wiz.step === wiz.steps.length - 1, total = wiz.steps.length;
  $("#wiz-mochi").innerHTML = s.id === "welcome" ? MOCHI_SVG : `<div class="wiz-ic">${ic(s.icon)}</div>`;
  $("#wiz-dots").innerHTML = wiz.steps.map((_, i) => `<li class="${i === wiz.step ? "on" : i < wiz.step ? "done" : ""}"></li>`).join("");
  $("#wiz-dots").hidden = total < 2;
  $("#wiz-step").textContent = total > 1 ? t("wiz.step", { n: wiz.step + 1, total }) : "";
  $("#wiz-title").textContent = t(`wiz.s${s.n}.title`);
  $("#wiz-body").innerHTML = wizBody(s.id);
  $("#wiz-back").hidden = wiz.step === 0;
  $("#wiz-skip").hidden = last;
  $("#wiz-next-txt").textContent = last ? t("wiz.start") : t("wiz.next");
  $("#wiz-next-ic").className = "mi mi-" + (last ? "party" : "next");
  const sel = $("#wiz-lang");
  if (sel) { fillLangSelect(sel); sel.addEventListener("change", async () => { await changeLang(sel.value); renderWizard(false); $("#wiz-lang").focus(); }); }
  $("#wiz-read")?.addEventListener("click", openLegal);
  $("#wiz-accept")?.addEventListener("change", e => { wiz.accepted = e.target.checked; if (e.target.checked) $("#wiz-err").textContent = ""; });
  $("#wiz-disc")?.addEventListener("change", e => { wiz.disc = e.target.checked; if (e.target.checked) $("#wiz-err").textContent = ""; });
  $("#wiz-name")?.addEventListener("change", e => setMe({ nome: e.target.value.trim() }));
  if (focusTitle) $("#wiz-title").focus();
}
function openWizard({ required, steps = WIZ }) {
  wiz = { step: 0, steps, required, accepted: policyOk(), disc: policyOk() };
  renderWizard(false);
  $("#wiz").showModal();
  $("#wiz-title").focus();
}
$("#wiz").addEventListener("cancel", e => { if (wiz.required) e.preventDefault(); }); // Esc non salta l'accettazione obbligatoria
$("#wiz-back").addEventListener("click", () => { if (wiz.step > 0) { wiz.step--; renderWizard(); } });
$("#wiz-skip").addEventListener("click", () => { wiz.step = wiz.steps.length - 1; renderWizard(); });
$("#wiz-next").addEventListener("click", () => {
  const s = wiz.steps[wiz.step];
  if (s.id === "share") { const n = $("#wiz-name"); if (n) setMe({ nome: n.value.trim() }); }
  if (wiz.step < wiz.steps.length - 1) {
    wiz.step++; renderWizard();
    if (motionOk()) $("#wiz-body").animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 250 });
    return;
  }
  if (s.id === "privacy" && !$("#wiz-accept").checked) {
    $("#wiz-err").textContent = t("wiz.s5.must"); $("#wiz-accept").focus(); mochi.mood("wow"); return;
  }
  if (s.id === "privacy" && !$("#wiz-disc").checked) {
    $("#wiz-err").textContent = t("wiz.s5.mustDisc"); $("#wiz-disc").focus(); mochi.mood("wow"); return;
  }
  if (s.id === "privacy") lsSet("mochi.policy", POLICY_VERSION);
  if (wiz.steps.length > 1) lsSet("mochi.seen", APP_VERSION);
  $("#wiz").close();
  fillSettings(); render();
  mochi.mood("happy", 2500); mochi.say(t("phr.nice", { name: me().nome || "♡" }));
  if (wiz.steps.length > 1) confetti();
  renderInstall();
  $("#add-nome").focus();
});

// ---------- avvio ----------
(async function start() {
  applyAnim();
  // Link di configurazione condiviso: #setup=… (app key, percorso, lingua)
  const m = location.hash.match(/^#setup=(.+)$/);
  let setup = null;
  if (m) {
    try { setup = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch {}
    history.replaceState(null, "", dbx.redirectUri() + "#imp");
    if (setup?.l && LANGS[setup.l] && !me().lang) setMe({ lang: setup.l });
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

  fillSettings(); renderOnboard(); render();
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
    const afterPolicy = () => { lsSet("mochi.seen", APP_VERSION); if (nuove.length) openNews(nuove); else setTimeout(() => mochi.say(frase("ciao")), 600); };
    if (!policyOk()) {
      openWizard({ required: true, steps: WIZ.filter(w => w.id === "privacy") });
      $("#wiz").addEventListener("close", afterPolicy, { once: true });
    } else afterPolicy();
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
