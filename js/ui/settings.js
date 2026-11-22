// Impostazioni: tu, zona e negozi, volantini ufficiali, ponte, SerpApi, chiavi IA, barra Salva/Annulla, file di salvataggio.
import { getTheme, setTheme, applyTheme } from "../theme.js";
import { frase } from "../mascot.js";
import { legacyCat } from "../categories.js";
import { merge, normalize, canWrite } from "../store.js";
import { t, setLang, lang, locale, LANGS } from "../i18n.js";
import { APP_VERSION, CHANGELOG } from "../version.js";
import * as dbx from "../dropbox.js";
import * as ai from "../ai/index.js";
import * as geo from "../geo.js";
import * as chains from "../chains.js";
import * as shops from "../shops.js";
import * as serp from "../serp.js";
import { $, BUILT_KEY, CUR_BY_COUNTRY, CURRENCIES, DBX_CFG_KEY, LOCAL_CFG, PROXY, applyAnim, confirmDlg, dbxCfg, esc, ic, lsSet, me, mochi, mutate, okProxy, save, setMe, setState, state, toast } from "./core.js";
import { openLegal, openNews, openWizard } from "./onboarding.js";
import { kapMode } from "./pantry.js";
import { renderBestHow, renderDb } from "./prices.js";
import * as flyer from "../flyer.js";
import { render, renderOfferte, renderOnboard, setMic, stopVoice } from "../app.js";
import { scheduleSync, syncKey, syncKind, syncSet, syncVars } from "./sync.js";

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
  // prima voce «automatica»: segue il paese di casa; le altre fissano la valuta
  $("#z-valuta").innerHTML = `<option value="">${esc(t("cur.auto", { cur: CUR_BY_COUNTRY[(state.settings.paese || "").toLowerCase()] || "EUR" }))}</option>`
    + CURRENCIES.map(c => `<option value="${c}">${esc(names ? names.of(c) : c)} (${c})</option>`).join("");
  $("#z-valuta").value = state.settings.valuta || "";
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
  fillSettings(); renderOnboard(); render(); renderDb(); renderOfferte(); syncSet(syncKind, syncKey, syncVars); setMic(!!stopVoice);
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
    st.textContent = r.ok ? t("ch.ponteOk") + (r.headers.get("x-mochi-chiave") === "no" ? " " + t("ch.ponteNoKey") : "") : t("ch.ponteKo", { msg: `${r.status} ${(await r.text()).slice(0, 40)}` });
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
    let coords = luogo === old.luogo && old.lat != null ? { lat: old.lat, lon: old.lon, paese: old.paese || "", zona: old.zona || "" } : { lat: null, lon: null, paese: "", zona: "" };
    if (luogo && coords.lat == null) {
      const g = await geo.geocode(luogo, lang());
      // all'IA va solo quartiere e città (zona), mai l'indirizzo scritto
      if (g) coords = { lat: g.lat, lon: g.lon, paese: g.paese, zona: (await geo.placeInfo(g, lang()).catch(() => null))?.nome || "" };
      else $("#geo-msg").textContent = t("geo.geocodeFail");
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
window.addEventListener("beforeunload", e => { if (settingsDirty || flyer.busy()) { e.preventDefault(); e.returnValue = ""; } });
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

// ---------- ESPORTA / IMPORTA (file JSON nel formato condiviso, docs/sync-format.md) ----------
$("#data-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `mochi-spesa-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$("#data-import-btn").addEventListener("click", () => $("#data-import").click());
$("#data-import").addEventListener("change", async e => {
  const f = e.target.files?.[0]; e.target.value = "";
  if (!f) return;
  try {
    const raw = JSON.parse(await f.text());
    if (!raw || typeof raw !== "object" || !raw.items) throw new Error("format"); // non è un file di Mochi Spesa
    const data = normalize(raw);
    for (const it of Object.values(data.items)) it.cat = legacyCat(it.cat);
    if (!canWrite(merge(state, data))) throw new Error("format");
    // si unisce come con Dropbox: niente va perso, vince la modifica più recente
    setState(merge(state, data)); save(); render(); fillSettings(); scheduleSync();
    toast(t("data.imported"), "import"); mochi.mood("happy", 1500);
  } catch { toast(t("data.importFail"), "warn"); }
});

