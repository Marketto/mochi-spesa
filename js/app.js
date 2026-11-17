import { mountMochi, frase, MOCHI_SVG } from "./mascot.js";
import { catOf, catId, iconOf, ORDER, parseAdd } from "./categories.js";
import { emptyState, merge, normalize, same, live, uid } from "./store.js";
import { t, setLang, detect, lang, locale, langName, LANGS } from "./i18n.js";
import { APP_VERSION, POLICY_VERSION, CHANGELOG, novitaDopo } from "./version.js";
import * as dbx from "./dropbox.js";
import * as ai from "./claude.js";
import * as geo from "./geo.js";
import * as voice from "./voice.js";
import * as pantry from "./pantry.js";

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
const CUR_BY_LANG = { sv: "SEK", da: "DKK", pl: "PLN", cs: "CZK", hu: "HUF", ro: "RON", ru: "RUB", zh: "CNY", ja: "JPY", ko: "KRW", ar: "AED", en: "GBP" };
const currency = () => state.settings.valuta || CUR_BY_LANG[lang()] || "EUR";
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
for (const it of Object.values(state.items)) it.cat = catId(it.cat); // migrazione 1.0 → 1.1
const seen = new Set(live(state.items).map(i => i.id));
const save = () => lsSet("mochi.state", state);
function mutate(fn) { fn(state, Date.now()); save(); render(); scheduleSync(); }

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
      <button class="icon-btn" type="button" data-mdel="${esc(x.id)}" aria-label="${esc(t("deals.unwatch", { name: x.nome }))}">${ic("unwatch")}</button></li>`).join("")
    : `<li class="hint">${esc(t("deals.noneWatched"))}</li>`;
}

const VOTO = { ottima: ["vote.great", "gold", "star"], buona: ["vote.good", "", "down"], normale: ["vote.avg", "warn", "info"] };
function renderOfferte() {
  const s = state.settings, o = state.offerte, key = !!ai.getCfg().key;
  $("#off-info").innerHTML = !s.luogo ? `${ic("pin")} ${esc(t("geo.ask"))} <button class="btn ghost" type="button" id="offerte-geo2">${ic("pin")} ${esc(t("geo.use"))}</button>`
    : !key ? `${ic("key")} ${esc(t("deals.needKey"))}`
    : o.updatedAt ? `${ic("pin")} ${esc(t("deals.last", { when: quando(o.updatedAt), km: s.raggioKm, place: s.luogo }))}`
    : `${ic("info")} ${esc(t("deals.first"))}`;
  $("#offerte-geo2")?.addEventListener("click", () => { selectTab($("#t-imp")); usaPosizione($("#geo-btn")); });
  const a0 = away();
  $("#away").innerHTML = a0 ? `<div class="card notice-card"><p>${ic("pin")} ${esc(t("geo.using", { place: a0.nome }))}</p>
    <button class="btn ghost" type="button" id="away-home">${ic("tab-list")} ${esc(t("geo.backHome"))}</button></div>` : "";
  $("#away-home")?.addEventListener("click", () => { lsSet(AWAY_KEY, null); renderOfferte(); toast(t("geo.backHome"), "pin"); $("#cerca").focus(); });
  $("#cerca").disabled = !s.luogo || !key || !live(state.monitor).length;
  if (!o.list.length) { $("#offerte").innerHTML = `<div class="card empty">${ic("percent", "big-emoji")}<p>${esc(t("deals.none"))}</p></div>`; renderOfferte.sorted = []; return; }
  const list = [...o.list].sort((a, b) => (a.categoria || a.prodotto).localeCompare(b.categoria || b.prodotto) || (a.prezzoUnit ?? 1e9) - (b.prezzoUnit ?? 1e9));
  const nt = `<span class="sr"> ${esc(t("a11y.newTab"))}</span>`;
  $("#offerte").innerHTML = list.map((x, i) => {
    const v = VOTO[x.voto], az = x.amazon || null;
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
      ${az ? `<p class="cmp">Amazon: ${money(az.prezzo)}${az.prezzoUnit ? ` (${esc(perUnit(az.prezzoUnit, x.unita))})` : ""}${diff ? " · " + diff : ""}${azu ? ` · <a href="${esc(azu)}" target="_blank" rel="noopener noreferrer">${ic("external")}${esc(t("deals.seeAmazon"))}${nt}</a>` : ""}</p>` : ""}
      ${x.nota ? `<p class="hint">${esc(x.nota)}</p>` : ""}
      <div class="foot">${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">${ic("flyer")}${esc(t("deals.flyer"))}${nt}</a>` : "<span></span>"}
        <button class="btn ghost" type="button" data-addoff="${i}" data-fk="o${i}" aria-label="${esc(t("deals.addToList", { name: x.prodotto }))}">${ic("list-add")} ${esc(t("deals.addList"))}</button></div>
    </article>`;
  }).join("");
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
  keepFocus(() => { renderLista(); renderMonitor(); renderOfferte(); renderValutazioni(); renderPantry(); renderPrefs(); });
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
(function themeBars() {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const set = () => { const c = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(); for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.content = c; };
  set(); mq.addEventListener("change", set);
})();

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
}
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
  const row = (d, showPlace) => `<li class="item pantry-item">
    <div class="item-row"><span class="txt"><span class="n">${esc(d.nome)}</span>${showPlace ? `<span class="meta">${ic("store-room")} ${esc(pantry.placeLabel(d, state.luoghi, nameOf))}</span>` : ""}</span>
    <button class="qty-btn" type="button" data-pedit="${esc(d.id)}" data-fk="pe${esc(d.id)}" aria-label="${esc(t("pantry.edit", { name: d.nome }))}">${d.qta ? esc(d.qta) : ic("edit")}</button>
    <button class="icon-btn" type="button" data-p2l="${esc(d.id)}" aria-label="${esc(t("pantry.toList", { name: d.nome }))}">${ic("list-add")}</button>
    <button class="icon-btn danger" type="button" data-pdel="${esc(d.id)}" aria-label="${esc(t("pantry.finished", { name: d.nome }))}">${ic("delete")}</button></div></li>`;
  let h = "";
  if (byCat) {
    const g = {}; for (const d of items) (g[catId(d.cat)] ||= []).push(d);
    for (const c of ORDER) if (g[c]) h += `<section class="group" aria-labelledby="pc-${c}"><h2 id="pc-${c}">${ic(iconOf(c), "em")}${esc(t("cat." + c))}</h2><div class="card"><ul class="items">${g[c].sort((a, b) => a.nome.localeCompare(b.nome)).map(d => row(d, true)).join("")}</ul></div></section>`;
  } else {
    for (const l of pantry.sortedPlaces(state.luoghi)) {
      const inL = items.filter(d => (state.luoghi[d.luogo] && !state.luoghi[d.luogo].deleted ? d.luogo : "credenza") === l.id);
      if (!inL.length) continue;
      const sub = {}; for (const d of inL) (sub[[d.scaffale || "", d.ripiano || ""].join("|")] ||= []).push(d);
      const keys = Object.keys(sub).sort((a, b) => (a === "|") - (b === "|") || a.localeCompare(b));
      h += `<section class="group" aria-labelledby="pl-${esc(l.id)}"><h2 id="pl-${esc(l.id)}">${ic(l.base ? "cat-pantry" : "store-room", "em")}${esc(nameOf(l))} <small>· ${inL.length}</small></h2><div class="card">`;
      for (const k of keys) {
        const [sc, ri] = k.split("|");
        if (sc) h += `<h3 class="shelf">${esc([sc, ri].filter(Boolean).join(" › "))}</h3>`;
        h += `<ul class="items">${sub[k].sort((a, b) => a.nome.localeCompare(b.nome)).map(d => row(d, false)).join("")}</ul>`;
      }
      h += `</div></section>`;
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
$("#places-edit").addEventListener("click", async () => {
  const ls = pantry.sortedPlaces(state.luoghi);
  const r = await sheet({
    title: t("pantry.organize"), icon: "store-room",
    body: `<p class="hint">${esc(t("pantry.organizeHint"))}</p>${ls.map(l => `<fieldset class="place-edit"><legend>${ic(l.base ? "cat-pantry" : "store-room")} ${esc(nameOf(l))}</legend>
      <label for="pn-${esc(l.id)}">${esc(t("pantry.placeName"))}</label><input id="pn-${esc(l.id)}" name="n-${esc(l.id)}" value="${esc(nameOf(l))}" maxlength="40">
      <label for="ps-${esc(l.id)}">${esc(t("pantry.shelves"))}</label><textarea id="ps-${esc(l.id)}" name="s-${esc(l.id)}" rows="3" placeholder="${esc(t("pantry.shelvesPh"))}" aria-describedby="sh-h">${esc(pantry.shelvesToText(l.scaffali))}</textarea>
      ${l.base ? "" : `<label class="check"><input type="checkbox" name="x-${esc(l.id)}"> ${esc(t("pantry.removePlace"))}</label>`}</fieldset>`).join("")}
      <p class="hint" id="sh-h">${esc(t("pantry.shelvesHelp"))}</p>
      <label for="pn-new">${ic("add")} ${esc(t("pantry.newPlace"))}</label><input id="pn-new" name="new" placeholder="${esc(t("pantry.newPlacePh"))}" maxlength="40">`,
    buttons: [{ value: "ok", label: t("common.save"), icon: "save", primary: true }, { value: "", label: t("common.cancel"), icon: "close" }],
  });
  if (r.value !== "ok") return;
  mutate((s, now) => {
    for (const l of ls) {
      if (r.form.get("x-" + l.id)) {
        s.luoghi[l.id] = { ...l, deleted: true, updatedAt: now };
        for (const d of live(s.dispensa)) if (d.luogo === l.id) s.dispensa[d.id] = { ...d, luogo: "credenza", scaffale: "", ripiano: "", updatedAt: now };
        continue;
      }
      const nome = String(r.form.get("n-" + l.id) || "").trim();
      s.luoghi[l.id] = { ...l, nome: nome === nameOf(l) && !l.nome ? "" : nome, scaffali: pantry.parseShelves(r.form.get("s-" + l.id)), updatedAt: now };
    }
    const nuovo = String(r.form.get("new") || "").trim();
    if (nuovo) { const id = uid(); s.luoghi[id] = { id, nome: nuovo, ordine: ls.length, scaffali: [], updatedAt: now }; }
  });
  toast(t("common.saved"), "store-room");
});

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
    if (evitati.length) h += `<p class="hint">${ic("avoid")} ${esc(t("cmp.hidden", { n: evitati.length, stores: evitati.map(o => o.negozio).join(", ") }))}</p>`;
    h += `</fieldset>`;
  }
  h += `<p class="cmp-total" aria-live="polite">${esc(t("cmp.total", { total: money(tot) }))}</p>
    <p class="hint">${esc(t("cmp.when", { when: state.confronto.updatedAt ? quando(state.confronto.updatedAt) : "–" }))}</p>`;
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
  if (!ai.getCfg().key) { toast(t("deals.needKey"), "key"); return; }
  if (!s0.luogo) { toast(t("geo.ask"), "pin"); selectTab($("#t-imp")); $("#z-luogo").focus(); return; }
  const prodotti = live(state.items).filter(i => !i.fatto).slice(0, 25).map(i => ({ id: i.id, nome: i.nome, qta: i.qta || "" }));
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true"); mochi.mood("wow", 0); mochi.say(frase("cerco"), 90000);
  toast(t("cmp.searching"), "search");
  try {
    const a0 = away();
    const luogo = a0 ? `${a0.nome} (lat ${a0.lat}, lon ${a0.lon})` : s0.lat != null ? `${s0.luogo} (lat ${s0.lat}, lon ${s0.lon})` : s0.luogo;
    const prefs = live(state.preferenze);
    const res = await ai.confrontaPrezzi({ prodotti, luogo, raggioKm: s0.raggioKm, negozi: s0.negozi, valuta: currency(), lingua: langName(),
      preferiti: prefs.filter(p => p.tipo === "preferito").map(p => ({ prodotto: p.prodotto, negozio: p.negozio })),
      evitati: prefs.filter(p => p.tipo === "evita").map(p => ({ prodotto: p.prodotto, negozio: p.negozio })) });
    mutate((s, now) => { s.confronto = { prodotti: res, updatedAt: now }; });
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
    const offerte = await ai.cercaOfferte({ prodotti: live(state.monitor), ...s0, luogo, valuta: currency(), lingua: langName() }, { signal: searching.signal });
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
  if (!ai.getCfg().key) { out.innerHTML = `<p class="hint">${ic("key")} ${esc(t("deals.needKey"))}</p>`; return; }
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true"); btn.disabled = true;
  out.innerHTML = `<p class="hint">${esc(t("rate.checking"))}</p>`;
  mochi.mood("wow", 0); mochi.say(frase("guardo"), 60000);
  try {
    const esito = await ai.valuta({ ...v, offerte: state.offerte.list, valuta: currency(), luogo: state.settings.luogo, lingua: langName() });
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
  const m = me();
  fillLangSelect($("#me-lang"));
  $("#me-nome").value = m.nome || "";
  for (const r of document.querySelectorAll('input[name="anim"]')) r.checked = r.value === (m.anim || "auto");
  const c = dbxCfg(); $("#dbx-key").value = BUILT_KEY ? "" : (c.appKey || ""); $("#dbx-path").value = c.path || "";
  $("#dbx-key-wrap").hidden = !!BUILT_KEY;
  if (!BUILT_KEY && !c.appKey) $("#dbx-adv").open = true;
  const s = state.settings;
  $("#z-luogo").value = s.luogo || ""; $("#z-raggio").value = s.raggioKm || 5; $("#z-raggio-v").textContent = s.raggioKm || 5;
  $("#z-negozi").value = s.negozi || ""; $("#z-amz").checked = s.amazon !== false;
  let names; try { names = new Intl.DisplayNames([locale()], { type: "currency" }); } catch {}
  $("#z-valuta").innerHTML = CURRENCIES.map(c => `<option value="${c}">${esc(names ? names.of(c) : c)} (${c})</option>`).join("");
  $("#z-valuta").value = currency();
  const a = ai.getCfg(); $("#ai-key").value = a.key || ""; $("#ai-model").value = a.model || ai.DEFAULT_MODEL;
  $("#dbx-off").hidden = !dbx.isConnected();
  $("#dbx-go-txt").textContent = t(dbx.isConnected() ? "dbx.reconnect" : "dbx.connect");
  $("#about-ver").textContent = t("about.version", { v: APP_VERSION });
  $("#ver-chip").textContent = "v" + APP_VERSION;
  $("#ver-chip").setAttribute("aria-label", t("about.version", { v: APP_VERSION }) + ". " + t("news.open"));
}
$("#z-raggio").addEventListener("input", e => $("#z-raggio-v").textContent = e.target.value);
async function changeLang(code) {
  setMe({ lang: code });
  await setLang(code);
  fillSettings(); renderOnboard(); render(); syncSet(syncKind, syncKey, syncVars); setMic(!!stopVoice);
}
$("#me-lang").addEventListener("change", async e => { await changeLang(e.target.value); toast(t("lang.changed"), "lang"); $("#me-lang").focus(); });
$("#f-me").addEventListener("submit", e => {
  e.preventDefault();
  const nome = $("#me-nome").value.trim();
  setMe({ nome, anim: document.querySelector('input[name="anim"]:checked')?.value || "auto" });
  applyAnim(); render(); toast(t("common.saved"), "save"); mochi.mood("happy"); mochi.say(nome ? t("phr.nice", { name: nome }) : frase("aggiunto"));
});
$("#f-zona").addEventListener("submit", async e => {
  e.preventDefault();
  const luogo = $("#z-luogo").value.trim(), old = state.settings;
  let coords = luogo === old.luogo && old.lat != null ? { lat: old.lat, lon: old.lon } : {};
  if (luogo && coords.lat == null) {
    const g = await geo.geocode(luogo, lang());
    if (g) coords = { lat: g.lat, lon: g.lon }; else $("#geo-msg").textContent = t("geo.geocodeFail");
  }
  mutate((s, now) => {
    s.settings = { luogo, raggioKm: +$("#z-raggio").value, negozi: $("#z-negozi").value.trim(), amazon: $("#z-amz").checked, valuta: $("#z-valuta").value, ...coords, updatedAt: now };
  });
  toast(t("zone.saved"), "pin");
});
$("#f-ai").addEventListener("submit", e => {
  e.preventDefault();
  ai.setCfg({ key: $("#ai-key").value.trim(), model: $("#ai-model").value.trim() || ai.DEFAULT_MODEL });
  renderOfferte(); toast(t("ai.saved"), "key");
});
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
function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(sync, 700); }
async function sync() {
  if (!dbx.isConnected()) { syncSet("local", "sync.local"); return; }
  if (!navigator.onLine) { syncSet("err", "sync.offline"); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; syncSet("busy", "sync.busy");
  const path = dbxCfg().path;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await dbx.download(path);
      const remoteState = remote && remote.data ? normalize(remote.data) : null;
      if (remoteState) for (const it of Object.values(remoteState.items)) it.cat = catId(it.cat);
      const merged = merge(state, remoteState);
      try {
        if (!remoteState || !same(merged, remoteState)) rev = await dbx.upload(path, merged, remote && remote.rev);
        else rev = remote.rev;
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
      syncSet("ok", "sync.ok", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) });
      break;
    }
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
const away = () => lsGet(AWAY_KEY, null);          // { lat, lon, nome } se si cercano offerte fuori casa
let awayAsked = null;                              // posizione per cui l'utente ha già risposto "no" in questa sessione
const home = () => state.settings.lat != null ? { lat: state.settings.lat, lon: state.settings.lon } : null;

/** "Usa la mia posizione" nelle impostazioni: imposta casa qui. */
async function usaPosizione(btn) {
  const msg = $("#geo-msg");
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true"); msg.textContent = t("geo.locating");
  try {
    const pos = await geo.here();
    const nome = (await geo.placeName(pos, lang())) || t("geo.label", pos);
    mutate((s, now) => { s.settings = { ...s.settings, ...pos, luogo: nome, updatedAt: now }; });
    lsSet(AWAY_KEY, null);
    fillSettings(); msg.textContent = t("geo.ok"); toast(t("geo.ok"), "pin"); mochi.mood("happy"); mochi.say(frase("guardo"));
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
  const nome = (await geo.placeName(pos, lang())) || t("geo.label", pos);
  const accetta = () => { lsSet(AWAY_KEY, { ...pos, nome }); awayAsked = null; renderOfferte(); toast(t("geo.using", { place: nome }), "pin"); mochi.mood("wow"); };
  const rifiuta = () => { awayAsked = pos; renderOfferte(); };
  if (modal) { (await confirmDlg(t("geo.away", { km, place: nome }), t("geo.awayYes"), "pin")) ? accetta() : rifiuta(); return; }
  $("#away").innerHTML = `<div class="card notice-card" role="region" aria-labelledby="away-t">
    <p id="away-t">${ic("pin")} ${esc(t("geo.away", { km, place: nome }))}</p>
    <div class="row gap"><button class="btn primary" type="button" id="away-yes">${ic("ok")} ${esc(t("geo.awayYes"))}</button>
    <button class="btn ghost" type="button" id="away-no">${ic("close")} ${esc(t("geo.awayNo"))}</button></div></div>`;
  $("#away-yes").addEventListener("click", accetta);
  $("#away-no").addEventListener("click", rifiuta);
}
$("#t-offerte").addEventListener("click", () => checkAway());

// ---------- PRIVACY E CONDIZIONI ----------
function legalHtml() {
  const sec = (icon, title, prefix, n) => `<h3>${ic(icon)} ${esc(t(title))}</h3><ul>${
    Array.from({ length: n }, (_, i) => `<li>${esc(t(`${prefix}${i + 1}`))}</li>`).join("")}</ul>`;
  return `<p class="hint">${esc(t("legal.updated", { date: new Date(POLICY_VERSION).toLocaleDateString(locale(), { dateStyle: "long" }) }))}</p>
    ${sec("privacy", "legal.privacyTitle", "legal.p", 10)}${sec("terms", "legal.termsTitle", "legal.t", 7)}`;
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
  $("#wiz-name")?.addEventListener("change", e => setMe({ nome: e.target.value.trim() }));
  if (focusTitle) $("#wiz-title").focus();
}
function openWizard({ required, steps = WIZ }) {
  wiz = { step: 0, steps, required, accepted: policyOk() };
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
  let setupOk = false;
  if (m) {
    try {
      const c = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      lsSet(DBX_CFG_KEY, { appKey: String(c.k || ""), path: normPath(c.p) }); // c.k vuota se la chiave è nel sito
      if (c.l && LANGS[c.l] && !me().lang) setMe({ lang: c.l });
      setupOk = true;
    } catch {}
    history.replaceState(null, "", dbx.redirectUri() + "#imp");
  }
  await setLang(detect(me().lang));
  if (setupOk) toast(t("dbx.configReceived"), "send-love");
  try { if (await dbx.handleRedirect()) { toast(t("dbx.connected"), "cloud-ok"); mochi.mood("happy", 2500); mochi.say(frase("connesso")); } }
  catch (e) { toast(e.message, "warn"); }

  fillSettings(); renderOnboard(); render();
  selectTab(tabs.find(x => "#" + x.id.slice(2) === location.hash) || tabs[0], false);
  syncSet(dbx.isConnected() ? "busy" : "local", dbx.isConnected() ? "sync.busy" : "sync.local");
  sync();
  setTimeout(checkHome, 1500);

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
