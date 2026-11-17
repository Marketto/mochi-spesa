import { mountMochi, frase, MOCHI_SVG } from "./mascot.js";
import { catOf, catId, iconOf, ORDER, parseAdd } from "./categories.js";
import { emptyState, merge, normalize, same, live, uid } from "./store.js";
import { t, setLang, detect, lang, locale, langName, LANGS } from "./i18n.js";
import { APP_VERSION, POLICY_VERSION, CHANGELOG, novitaDopo } from "./version.js";
import * as dbx from "./dropbox.js";
import * as ai from "./claude.js";
import * as geo from "./geo.js";
import * as voice from "./voice.js";

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
function toast(msg, icon = "heart") {
  $("#toast-txt").textContent = msg; $("#toast-ic").className = "mi mi-" + icon;
  $("#toast").classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => $("#toast").classList.remove("show"), 2600);
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
      h += `<li class="item${it.fatto ? " done" : ""}${isNew ? " new" : ""}">
        <label class="tick"><input type="checkbox" data-chk="${esc(it.id)}" data-fk="c${esc(it.id)}"${it.fatto ? " checked" : ""}>
          <span class="txt"><span class="n">${esc(it.nome)}${it.qta ? ` <span class="q">· ${esc(it.qta)}</span>` : ""}</span>
          ${chi ? `<span class="meta">${esc(t("list.addedBy", { name: chi }))}</span>` : ""}${it.nota ? `<span class="meta">${esc(it.nota)}</span>` : ""}</span></label>
        <button class="icon-btn danger" type="button" data-del="${esc(it.id)}" data-fk="d${esc(it.id)}" aria-label="${esc(t("list.delete", { name: it.nome }))}">${ic("delete")}</button></li>`;
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
  keepFocus(() => { renderLista(); renderMonitor(); renderOfferte(); renderValutazioni(); });
  document.querySelectorAll(".cur-sym").forEach(el => el.textContent = curSymbol());
}

// ---------- LISTA: azioni ----------
$("#f-add").addEventListener("submit", e => {
  e.preventDefault();
  const inp = $("#add-nome"), v = inp.value.trim();
  if (!v) { mochi.say(frase("vuoto")); inp.focus(); return; }
  const nuovi = v.split(/\s*[,;、，]\s*/).filter(Boolean).map(parseAdd);
  mutate((s, now) => {
    for (const { nome, qta } of nuovi) { const id = uid(); s.items[id] = { id, nome, qta, cat: catOf(nome), fatto: false, da: me().nome, nota: "", ts: now, updatedAt: now }; }
  });
  inp.value = "";
  mochi.mood("happy"); mochi.say(frase("aggiunto"));
  toast(nuovi.length > 1 ? t("toast.addedN", { n: nuovi.length }) : t("toast.added", { name: nuovi[0].nome }), "add");
});
$("#lista").addEventListener("change", e => {
  const id = e.target.dataset.chk; if (!id) return;
  const checked = e.target.checked, it = state.items[id];
  mutate((s, now) => { s.items[id] = { ...s.items[id], fatto: checked, updatedAt: now }; });
  if (checked) {
    sparkles(document.querySelector(`[data-chk="${CSS.escape(id)}"]`));
    if (!live(state.items).some(i => !i.fatto)) { mochi.mood("happy", 3000); mochi.say(frase("finito"), 3500); confetti(); toast(t("toast.allDone"), "mochi"); }
    else { mochi.mood("happy"); mochi.say(frase("preso")); toast(t("toast.got", { name: it.nome }), "heart"); }
  } else toast(t("toast.back", { name: it.nome }), "tab-list");
});
$("#lista").addEventListener("click", e => {
  const b = e.target.closest("[data-del]"); if (!b) return;
  const id = b.dataset.del, nome = state.items[id]?.nome;
  const li = b.closest("li"), next = (li.nextElementSibling || li.previousElementSibling)?.querySelector("input");
  mutate((s, now) => { s.items[id] = { ...s.items[id], deleted: true, updatedAt: now }; });
  (next && document.querySelector(`[data-fk="${CSS.escape(next.dataset.fk)}"]`) || $("#add-nome")).focus();
  toast(t("toast.deleted", { name: nome }), "delete");
});
$("#clear-done").addEventListener("click", async () => {
  const n = live(state.items).filter(i => i.fatto).length;
  if (!(await confirmDlg(t("list.clearConfirm", { n }), t("list.clearYes"), "clean"))) return;
  mutate((s, now) => { for (const i of live(s.items)) if (i.fatto) s.items[i.id] = { ...i, deleted: true, updatedAt: now }; });
  $("#add-nome").focus(); mochi.mood("happy"); mochi.say(frase("pulito")); toast(t("toast.cleared"), "clean");
});

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
