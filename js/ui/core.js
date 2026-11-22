// Base condivisa dell'interfaccia: utilità, configurazione, stato, mascotte, avvisi, schede e finestre.
import { mountMochi } from "../mascot.js";
import { legacyCat } from "../categories.js";
import { emptyState, normalize, live, uid, stamp } from "../store.js";
import { t, locale } from "../i18n.js";
import * as dbx from "../dropbox.js";
import * as pricedb from "../pricedb.js";
import { amazonSearch, isAmazon } from "../amazon.js";
import { away, render, scheduleSync } from "../app.js";

// ---------- utilità ----------
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const ic = (n, cls = "") => `<i class="mi mi-${n}${cls ? " " + cls : ""}" aria-hidden="true"></i>`;
export const num = v => { const n = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
export const safeUrl = u => /^https:\/\//i.test(u || "") ? u : null;
export const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const quando = ts => new Date(ts).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Paese e valuta vengono dalla posizione (GPS o città scritta nelle impostazioni), mai dalla lingua.
export const CUR_BY_COUNTRY = { se: "SEK", dk: "DKK", no: "NOK", is: "ISK", pl: "PLN", cz: "CZK", hu: "HUF", ro: "RON", bg: "BGN", ch: "CHF", li: "CHF",
  gb: "GBP", us: "USD", ca: "CAD", au: "AUD", jp: "JPY", cn: "CNY", kr: "KRW", ae: "AED", sa: "SAR", eg: "EGP", tr: "TRY", ru: "RUB",
  ua: "UAH", by: "BYN", rs: "RSD", ba: "BAM", mk: "MKD", al: "ALL", in: "INR", mx: "MXN", br: "BRL", sg: "SGD" };
// Valute del menu: tutte quelle che il paese può dare, più qualche altra comune
export const CURRENCIES = [...new Set(["EUR", ...Object.values(CUR_BY_COUNTRY), "MAD"])];
/** Paese (ISO 2) dove si fa la spesa: quello «fuori casa» se attivo, altrimenti quello di casa. "" se non ancora impostato. */
export const paese = () => (away()?.paese || state.settings.paese || "").toLowerCase();
export const currency = () => state.settings.valuta || CUR_BY_COUNTRY[paese()] || "EUR";
export const amzOn = () => state.settings.amazon !== false;
export const amzLink = (nome, cls = "") => `<a class="${cls}" href="${esc(amazonSearch(nome, paese()))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t("amz.searchName", { name: nome }))} ${esc(t("a11y.newTab"))}">${ic("external")}${cls.includes("icon-btn") ? "" : esc(t("amz.search"))}</a>`;
// ultimo prezzo Amazon che l'utente ha salvato in «I miei prezzi»
export const amzSaved = nome => pricedb.recent(nome, 365).filter(r => isAmazon(r.negozio)).sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0] || null;
export const fmt = (n, d) => new Intl.NumberFormat(locale(), { style: "currency", currency: currency(), ...(d ? { minimumFractionDigits: 2, maximumFractionDigits: 3 } : {}) }).format(n);
export const money = n => (typeof n === "number" && isFinite(n)) ? fmt(n) : "–";
export const money3 = n => (typeof n === "number" && isFinite(n)) ? fmt(n, true) : "–";
export const curSymbol = () => new Intl.NumberFormat(locale(), { style: "currency", currency: currency() }).formatToParts(0).find(p => p.type === "currency")?.value || currency();
export const perUnit = (n, u) => `${money3(n)} ${t("unitPer." + (u || "pezzi"))}`;

// ---------- configurazione locale (mai nel repo) ----------
// config.js è generato dal deploy (App key Dropbox da variabile del repo); config.local.js solo in sviluppo.
export let LOCAL_CFG = {};
export const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
try { LOCAL_CFG = (await import(isLocal ? "../../config.local.js" : "../../config.js")).default || {}; } catch {}
export const BUILT_KEY = String(LOCAL_CFG.dropboxAppKey || "");
// ponte Cloudflare: dalla configurazione del deploy oppure scritto dall'utente nelle impostazioni (condiviso in famiglia)
export const okProxy = u => /^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(String(u || "")) ? String(u).replace(/\/+$/, "") : "";
export const PROXY = () => okProxy(LOCAL_CFG.flyerProxy) || okProxy(state.settings?.ponte);
export const DBX_CFG_KEY = "mochi.dbxcfg";
export const dbxCfg = () => {
  const c = { appKey: "", path: LOCAL_CFG.dropboxPath || "/Spesa/mochi-spesa.json", ...lsGet(DBX_CFG_KEY, {}) };
  if (BUILT_KEY) c.appKey = BUILT_KEY; // la chiave del sito vince: gli utenti non devono inserirla
  return c;
};
export async function connectDropbox() {
  const { appKey } = dbxCfg();
  if (!appKey) { selectTab($("#t-imp")); $("#dbx-adv").open = true; $("#dbx-key").focus(); $("#dbx-msg").textContent = t("dbx.needKey"); return; }
  lsSet(DBX_CFG_KEY, { ...lsGet(DBX_CFG_KEY, {}), appKey, path: dbxCfg().path });
  toast(t("dbx.redirecting"), "cloud");
  await dbx.startAuth(appKey);
}
export const me = () => ({ nome: "", anim: "auto", lang: "", ...lsGet("mochi.me", {}) });
export const setMe = patch => lsSet("mochi.me", { ...me(), ...patch });

// ---------- stato ----------
export const hadState = localStorage.getItem("mochi.state") !== null;
export let state = normalize(lsGet("mochi.state", null) || emptyState());
for (const it of Object.values(state.items)) it.cat = legacyCat(it.cat); // migrazione 1.0 → 1.1
export const seen = new Set(live(state.items).map(i => i.id));
/** Sostituisce lo stato (dopo l'unione con la copia su Dropbox). */
export const setState = s => { state = s; };
export const save = () => lsSet("mochi.state", state);
// id stabile del dispositivo: finisce nel campo "by" di ogni elemento modificato (spareggio nell'unione)
export const deviceId = lsGet("mochi.device", null) || (() => { const id = uid(); lsSet("mochi.device", id); return id; })();
export const BY = "phone:" + deviceId;
export function mutate(fn) { const now = Date.now(); fn(state, now); stamp(state, now, BY); save(); render(); scheduleSync(); }

// ---------- mascotte, toast, effetti ----------
export const mochi = mountMochi($("#mascot"), $("#bubble"));
export let toastT;
export function toast(msg, icon = "heart", action) {
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
export const motionOk = () => { const a = me().anim; return a === "on" || (a !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches); };
export function sparkles(el) {
  if (!motionOk() || !el) return;
  const r = el.getBoundingClientRect(), fx = $("#fx"), sym = ["magic", "heart", "star", "heart-line", "mochi"];
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("span"), a = (Math.PI * 2 * i) / 8, d = 34 + Math.random() * 18;
    s.className = "spark mi mi-" + sym[i % sym.length];
    s.style.cssText = `left:${r.left + r.width / 2 - 8}px;top:${r.top + r.height / 2 - 10}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rot:${Math.random() * 180}deg;color:var(${["--pink", "--lav", "--mint", "--gold"][i % 4]})`;
    fx.appendChild(s); setTimeout(() => s.remove(), 900);
  }
}
export function confetti() {
  if (!motionOk()) return;
  const fx = $("#fx"), sym = ["heart", "star", "magic", "mochi", "heart-line"], col = ["var(--pink)", "var(--lav)", "var(--mint)", "var(--gold)", "var(--pink)"];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement("span");
    c.className = "confetti mi mi-" + sym[i % sym.length];
    c.style.cssText = `color:${col[i % col.length]};font-size:${18 + Math.random() * 14}px;left:${Math.random() * 100}vw;--t:${2 + Math.random() * 1.8}s;--dx:${(Math.random() - .5) * 120}px;--rot:${(Math.random() - .5) * 720}deg;animation-delay:${Math.random() * .5}s`;
    fx.appendChild(c); setTimeout(() => c.remove(), 4500);
  }
}
export function confirmDlg(testo, ok, icon = "ok") {
  const d = $("#dlg"); $("#dlg-t").textContent = testo; $("#dlg-ok").textContent = ok || t("common.yes"); $("#dlg-ic").className = "mi mi-" + icon;
  d.returnValue = ""; d.showModal();
  return new Promise(res => d.addEventListener("close", () => res(d.returnValue === "si"), { once: true }));
}
export function applyAnim() {
  const a = me().anim;
  document.documentElement.classList.toggle("anim-on", a === "on");
  document.documentElement.classList.toggle("anim-off", a === "off");
}

// ---------- tab accessibili ----------
export const tabs = [...document.querySelectorAll('[role="tab"]')];
export function selectTab(tab, focus = true) {
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

// ---------- FINESTRA GENERICA ----------
/** Apre #sheet con titolo, contenuto e bottoni [{value, label, icon, primary}]. Risolve con {value, form}. */
export function sheet({ title, icon, body, buttons, onOpen }) {
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

