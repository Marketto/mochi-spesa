// Dispensa: luoghi, «metti via la spesa», Kapibo e scheda dispensa.
import { frase } from "../mascot.js";
import { catOf, catId, iconOf, ORDER, parseAdd } from "../categories.js";
import { live, uid } from "../store.js";
import { t, locale } from "../i18n.js";
import * as geo from "../geo.js";
import * as pantry from "../pantry.js";
import * as importer from "../importer.js";
import * as op from "../openprices.js";
import * as flyer from "../flyer.js";
import * as pricedb from "../pricedb.js";
import * as bridge from "../bridge.js";
import { away, home } from "../app.js";
import { $, confetti, esc, ic, lsGet, lsSet, me, mochi, mutate, sheet, sparkles, state, toast } from "./core.js";

// ---------- DISPENSA: nomi dei luoghi ----------
export const nameOf = l => l ? (l.nome || (["credenza", "cantina"].includes(l.id) ? t("place." + l.id) : l.id)) : "";
export const placeName = id => nameOf(state.luoghi[id]);
export const placeOpts = sel => pantry.placeOptions(state.luoghi, nameOf).map(o => `<option value="${esc(o.value)}"${o.value === sel ? " selected" : ""}>${esc(o.label)}</option>`).join("");
export const findInPantry = nome => live(state.dispensa).find(d => pantry.sameProduct(d.nome, nome));

/** Aggiunge alla lista; se il prodotto c'è già in dispensa avvisa e chiede. */
export async function addToList(nuovi) {
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
export async function takenFromStore(it) {
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
export async function editQty(id) {
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
export const lastPlace = nome => { const m = findInPantry(nome); return m ? pantry.placeValue(m.luogo, m.scaffale, m.ripiano) : pantry.placeValue("credenza"); };
export async function putAway() {
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
export const kapMode = () => lsGet("mochi.kapibo", "ask");
export const KAP_BTNS = ok => [{ value: "yes", label: ok, icon: "ok", primary: true }, { value: "no", label: t("kapibo.no"), icon: "close" }, { value: "never", label: t("kapibo.never"), icon: "unwatch" }];
export function kapNever() { lsSet("mochi.kapibo", "never"); toast(t("kapibo.neverToast"), "unwatch"); }
export async function sendToKapibo(da) {
  const mode = kapMode(); if (mode === "never") return;
  if (mode === "ask") {
    const r = await sheet({ title: t("kapibo.sendT"), icon: "coins", body: `<p>${esc(t("kapibo.sendP", { n: da.length }))}</p><p class="hint">${esc(t("kapibo.hint"))}</p>`, buttons: KAP_BTNS(t("kapibo.yes")) });
    if (r.value === "never") return kapNever();
    if (r.value !== "yes") return;
  }
  const items = da.map(i => ({ name: i.nome, qty: parseFloat(String(i.qta || "").replace(",", ".")) || 1 }));
  if (bridge.send("kapibo", { from: "mochi", date: new Date().toISOString().slice(0, 10), items })) toast(t("kapibo.sent", { n: items.length }), "coins");
}
export let kapBusy = false;
export async function checkKapibo() {
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
export let homeAsked = false;
export async function checkHome() {
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
export function renderPantry() {
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
export async function editPantryItem(id) {
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
export let shelfSeq = 0;
export function shelfBlock(lid, sh) {
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
export const searchPoint = () => { const a0 = away(), s0 = state.settings; return a0 ? { lat: a0.lat, lon: a0.lon } : s0.lat != null ? { lat: s0.lat, lon: s0.lon } : null; };
export const opNote = p => t("free.seen", { product: [p.nome, p.quantita ? `${p.quantita} ${p.unitaQ}` : ""].filter(Boolean).join(" "), date: p.data ? new Date(p.data + "T12:00").toLocaleDateString(locale(), { dateStyle: "medium" }) : "–" });
export const OP_CREDIT = () => `<p class="hint op-credit">${ic("info")} ${esc(t("free.credit"))} <a href="${op.SITE}" target="_blank" rel="noopener noreferrer">Open Food Facts – Open Prices${`<span class="sr"> ${esc(t("a11y.newTab"))}</span>`}</a> (ODbL)</p>`;

// prezzi dai volantini salvati, come opzioni per "Dove conviene?"
export const oggiISO = () => new Date().toISOString().slice(0, 10);
export const shortDate = d => new Date(d + "T12:00").toLocaleDateString(locale(), { day: "numeric", month: "short" });
export function savedOptions(nome) {
  const db = pricedb.recent(nome).map(x => ({ negozio: x.negozio || "?", prezzo: x.prezzo, prezzoUnit: x.prezzoUnit, offerta: !!(x.validoFino && x.validoFino >= oggiISO()),
    validoFino: x.validoFino ? shortDate(x.validoFino) : null, fonte: x.fonte || "", nota: `${t("fl.note", { date: shortDate(x.data) })} – ${x.nome}` }));
  return [...flyer.bestSaved(nome, live(state.prezzi)).map(x => ({ negozio: x.negozio, prezzo: x.prezzo, prezzoUnit: x.prezzoUnit, offerta: !!(x.validoFino && x.validoFino >= oggiISO()),
    validoFino: x.validoFino ? shortDate(x.validoFino) : null, fonte: x.fonte || "", nota: t("fl.note", { date: shortDate(x.data) }) + (x.riga ? ` – ${x.riga}` : "") })), ...db];
}
/** Un'opzione per negozio: vince la prima (volantini salvati prima dei prezzi della community), poi dalla più economica. */
export function mergeOptions(opts) {
  const m = new Map();
  for (const o of opts) { const k = pantry.norm(o.negozio); if (!m.has(k)) m.set(k, o); }
  return [...m.values()].sort((a, b) => a.prezzo - b.prezzo).slice(0, 6);
}

