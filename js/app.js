import { mountMochi, frase } from "./mascot.js";
import { catOf, emojiOf, ORDER, parseAdd } from "./categories.js";
import { emptyState, merge, normalize, same, live, uid } from "./store.js";
import * as dbx from "./dropbox.js";
import * as ai from "./claude.js";

// ---------- utilità ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = n => (typeof n === "number" && isFinite(n)) ? n.toLocaleString("it-IT", { style: "currency", currency: "EUR" }) : "–";
const eur3 = n => (typeof n === "number" && isFinite(n)) ? "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : "–";
const num = v => { const n = parseFloat(String(v || "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; };
const UNIT1 = { lavaggi: "lavaggio", litri: "litro", kg: "kg", pezzi: "pezzo" };
const safeUrl = u => /^https:\/\//i.test(u || "") ? u : null;
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const quando = t => new Date(t).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ---------- configurazione locale (mai nel repo) ----------
// config.local.js è facoltativo e in .gitignore: utile solo in sviluppo per precompilare i campi.
let LOCAL_CFG = {};
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  try { LOCAL_CFG = (await import("../config.local.js")).default || {}; } catch {}
}
const DBX_CFG_KEY = "mochi.dbxcfg";
const dbxCfg = () => ({ appKey: LOCAL_CFG.dropboxAppKey || "", path: LOCAL_CFG.dropboxPath || "/Spesa/mochi-spesa.json", ...lsGet(DBX_CFG_KEY, {}) });
const me = () => lsGet("mochi.me", { nome: "", anim: "auto" });

// ---------- stato ----------
let state = normalize(lsGet("mochi.state", null) || emptyState());
const seen = new Set(live(state.items).map(i => i.id)); // per animare solo le novità
const save = () => lsSet("mochi.state", state);

function mutate(fn) {
  fn(state, Date.now());
  save(); render(); scheduleSync();
}

// ---------- mascotte, toast, effetti ----------
const mochi = mountMochi($("#mascot"), $("#bubble"));
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600);
}
const motionOk = () => {
  const a = me().anim;
  return a === "on" || (a !== "off" && !matchMedia("(prefers-reduced-motion: reduce)").matches);
};
function sparkles(el) {
  if (!motionOk() || !el) return;
  const r = el.getBoundingClientRect(), fx = $("#fx");
  const sym = ["✦", "♡", "✿", "✧", "❀"];
  for (let i = 0; i < 8; i++) {
    const s = document.createElement("span");
    s.className = "spark"; s.textContent = sym[i % sym.length];
    const a = (Math.PI * 2 * i) / 8, d = 34 + Math.random() * 18;
    s.style.cssText = `left:${r.left + r.width / 2 - 8}px;top:${r.top + r.height / 2 - 10}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rot:${Math.random() * 180}deg;color:${["#ff7eb3", "#b08cff", "#6fcf97", "#ffc94d"][i % 4]}`;
    fx.appendChild(s); setTimeout(() => s.remove(), 900);
  }
}
function confetti() {
  if (!motionOk()) return;
  const fx = $("#fx"), sym = ["🌸", "💖", "✨", "🍡", "⭐", "🎀", "🍓"];
  for (let i = 0; i < 36; i++) {
    const c = document.createElement("span");
    c.className = "confetti"; c.textContent = sym[i % sym.length];
    c.style.cssText = `left:${Math.random() * 100}vw;--t:${2 + Math.random() * 1.8}s;--dx:${(Math.random() - .5) * 120}px;--rot:${(Math.random() - .5) * 720}deg;animation-delay:${Math.random() * .5}s`;
    fx.appendChild(c); setTimeout(() => c.remove(), 4500);
  }
}
function confirmDlg(testo, ok = "Sì") {
  const d = $("#dlg"); $("#dlg-t").textContent = testo; $("#dlg-ok").textContent = ok;
  d.returnValue = ""; d.showModal();
  return new Promise(res => d.addEventListener("close", () => res(d.returnValue === "si"), { once: true }));
}
function applyAnim() {
  const a = me().anim;
  document.documentElement.classList.toggle("anim-on", a === "on");
  document.documentElement.classList.toggle("anim-off", a === "off");
}

// ---------- tab accessibili (ARIA tabs + frecce) ----------
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = true) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
    $("#" + t.getAttribute("aria-controls")).hidden = !on;
  }
  if (focus) tab.focus();
  history.replaceState(null, "", "#" + tab.id.slice(2));
  window.scrollTo({ top: 0, behavior: motionOk() ? "smooth" : "auto" });
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => selectTab(t, false));
  t.addEventListener("keydown", e => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
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
  const items = live(state.items);
  const done = items.filter(i => i.fatto).length;
  $("#progress").hidden = !items.length;
  if (items.length) {
    $("#pfill").style.width = (done / items.length * 100) + "%";
    $("#pbar").setAttribute("aria-valuemax", items.length); $("#pbar").setAttribute("aria-valuenow", done);
    $("#ptxt").textContent = done === items.length ? `Tutto preso! ${items.length} su ${items.length} ♡` : `${done} su ${items.length} nel carrello`;
  }
  $("#clear-done").hidden = !done;

  if (!items.length) {
    $("#lista").innerHTML = `<div class="card empty"><span class="big-emoji" aria-hidden="true">🍙</span>
      <p><strong>La lista è vuota.</strong><br>Scrivi qui sopra cosa serve, Mochi lo mette nel reparto giusto.</p></div>`;
    return;
  }
  const groups = {};
  for (const it of items) (groups[it.cat] ||= []).push(it);
  let h = "";
  for (const c of [...ORDER, ...Object.keys(groups).filter(k => !ORDER.includes(k))]) {
    const g = groups[c]; if (!g) continue;
    g.sort((a, b) => (a.fatto - b.fatto) || (a.ts || 0) - (b.ts || 0));
    const gid = "g-" + c.replace(/\W+/g, "");
    h += `<section class="group" aria-labelledby="${gid}"><h2 id="${gid}"><span class="em" aria-hidden="true">${emojiOf(c)}</span>${esc(c)}</h2>
      <div class="card"><ul class="items">`;
    for (const it of g) {
      const chi = it.da && it.da !== me().nome ? it.da : "";
      const isNew = !seen.has(it.id); seen.add(it.id);
      h += `<li class="item${it.fatto ? " done" : ""}${isNew ? " new" : ""}">
        <label class="tick"><input type="checkbox" data-chk="${esc(it.id)}" data-fk="c${esc(it.id)}"${it.fatto ? " checked" : ""}>
          <span class="txt"><span class="n">${esc(it.nome)}${it.qta ? ` <span class="q">· ${esc(it.qta)}</span>` : ""}</span>
          ${chi ? `<span class="meta">aggiunto da ${esc(chi)}</span>` : ""}${it.nota ? `<span class="meta">${esc(it.nota)}</span>` : ""}</span></label>
        <button class="icon-btn" type="button" data-del="${esc(it.id)}" data-fk="d${esc(it.id)}" aria-label="Elimina ${esc(it.nome)}"><span aria-hidden="true">✕</span></button></li>`;
    }
    h += "</ul></div></section>";
  }
  $("#lista").innerHTML = h;
}

function renderMonitor() {
  const m = live(state.monitor).sort((a, b) => a.nome.localeCompare(b.nome));
  $("#monitor").innerHTML = m.length ? m.map(x =>
    `<li class="chip">${esc(x.nome)}<small>per ${esc(UNIT1[x.unita] || x.unita)}</small>
      <button class="icon-btn" type="button" data-mdel="${esc(x.id)}" aria-label="Smetti di monitorare ${esc(x.nome)}"><span aria-hidden="true">✕</span></button></li>`).join("")
    : `<li class="hint">Nessun prodotto. Prova con “detersivo lavatrice”.</li>`;
}

const VOTO = { ottima: ["Ottima offerta", "gold"], buona: ["Buona", ""], normale: ["Nella media", "warn"] };
function renderOfferte() {
  const s = state.settings, o = state.offerte;
  const key = !!ai.getCfg().key;
  $("#off-info").textContent = !s.luogo ? "Prima imposta la zona di casa in ⚙️ Impostazioni."
    : !key ? "Per cercare serve la chiave API di Claude (⚙️ Impostazioni)."
    : o.updatedAt ? `Ultima ricerca: ${quando(o.updatedAt)} · entro ${s.raggioKm} km da ${s.luogo}` : "Tocca il bottone per la prima ricerca.";
  $("#cerca").disabled = !s.luogo || !key || !live(state.monitor).length;

  if (!o.list.length) { $("#offerte").innerHTML = `<div class="card empty"><span class="big-emoji" aria-hidden="true">🏷️</span><p>Nessuna offerta per ora.</p></div>`; return; }
  const list = [...o.list].sort((a, b) => (a.categoria || a.prodotto).localeCompare(b.categoria || b.prodotto) || (a.prezzoUnit ?? 1e9) - (b.prezzoUnit ?? 1e9));
  $("#offerte").innerHTML = list.map((x, i) => {
    const v = VOTO[x.voto], u = UNIT1[x.unita] || x.unita || "", az = x.amazon || null;
    let diff = "";
    if (az && az.prezzoUnit > 0 && x.prezzoUnit > 0) {
      const p = Math.round((x.prezzoUnit / az.prezzoUnit - 1) * 100);
      diff = p < 0 ? `<strong>${-p}% in meno di Amazon</strong>` : p > 0 ? `${p}% in più di Amazon` : "come Amazon";
    }
    const src = safeUrl(x.fonte), azu = az && safeUrl(az.url);
    return `<article class="card offer${x.voto === "ottima" ? " top-deal" : ""}" aria-labelledby="of${i}">
      <div class="head"><div><h3 id="of${i}">${esc(x.prodotto)}</h3>
        <div class="where">${esc(x.negozio || "")}${x.distanzaKm != null ? ` · ${esc(x.distanzaKm)} km` : ""}${x.validoFino ? ` · fino al ${esc(x.validoFino)}` : ""}</div></div>
        <div class="price">${eur(x.prezzo)}<small>${x.quantita ? esc(x.quantita) + " " + esc(x.unita || "") : ""}</small></div></div>
      <div class="badges">${v ? `<span class="badge ${v[1]}">${v[0]}</span>` : ""}${x.prezzoUnit ? `<span class="unit">${eur3(x.prezzoUnit)} al ${esc(u)}</span>` : ""}</div>
      ${az ? `<p class="cmp">Amazon: ${eur(az.prezzo)}${az.prezzoUnit ? ` (${eur3(az.prezzoUnit)} al ${esc(u)})` : ""}${diff ? " · " + diff : ""}${azu ? ` · <a href="${esc(azu)}" target="_blank" rel="noopener noreferrer">vedi su Amazon<span class="sr"> (si apre in una nuova scheda)</span></a>` : ""}</p>` : ""}
      ${x.nota ? `<p class="hint">${esc(x.nota)}</p>` : ""}
      <div class="foot">${src ? `<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Volantino<span class="sr"> di ${esc(x.negozio)} (nuova scheda)</span></a>` : "<span></span>"}
        <button class="btn ghost" type="button" data-addoff="${i}" data-fk="o${i}">＋ Lista</button></div>
    </article>`;
  }).join("");
  renderOfferte.sorted = list;
}

function renderValutazioni() {
  const list = live(state.valutazioni).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (!list.length) { $("#valutazioni").innerHTML = `<p class="hint">Le valutazioni che chiedi a Mochi restano qui, visibili anche a casa.</p>`; return; }
  $("#valutazioni").innerHTML = list.map(v => {
    const e = v.esito || {}, link = safeUrl(v.testo);
    const b = e.voto === "conveniente" ? `<span class="badge gold">Conveniente</span>` : e.voto === "caro" ? `<span class="badge warn">Caro</span>` : e.voto ? `<span class="badge">Nella media</span>` : "";
    return `<article class="card"><div class="row" style="align-items:flex-start;justify-content:space-between">
      <div style="min-width:0"><h3 style="margin:0;font-size:17px">${esc(e.prodotto || v.testo)}</h3>
      <p class="hint" style="margin:2px 0">${v.prezzo ? eur(v.prezzo) : ""}${v.quantita ? ` · ${esc(v.quantita)} ${esc(v.unita)}` : ""} · ${quando(v.ts)}${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener noreferrer">link<span class="sr"> al prodotto (nuova scheda)</span></a>` : ""}</p></div>
      <button class="icon-btn" type="button" data-vdel="${esc(v.id)}" aria-label="Elimina valutazione"><span aria-hidden="true">✕</span></button></div>
      <div class="badges">${b}${e.prezzoUnit ? `<span class="unit">${eur3(e.prezzoUnit)} al ${esc(UNIT1[e.unita] || e.unita || "")}</span>` : ""}</div>
      ${e.qualita ? `<p style="margin:8px 0 0"><strong>Qualità:</strong> ${esc(e.qualita)}</p>` : ""}
      ${e.sintesi ? `<p style="margin:6px 0 0">${esc(e.sintesi)}</p>` : ""}
      ${e.alternativa ? `<p class="cmp">💡 ${esc(e.alternativa)}</p>` : ""}</article>`;
  }).join("");
}

function render() {
  keepFocus(() => { renderLista(); renderMonitor(); renderOfferte(); renderValutazioni(); });
}

// ---------- LISTA: azioni ----------
$("#f-add").addEventListener("submit", e => {
  e.preventDefault();
  const inp = $("#add-nome"), v = inp.value.trim();
  if (!v) { mochi.say(frase("vuoto")); inp.focus(); return; }
  // più prodotti separati da virgola: "latte, pane, uova"
  const nuovi = v.split(/\s*[,;]\s*/).filter(Boolean).map(parseAdd);
  mutate((s, now) => {
    for (const { nome, qta } of nuovi) {
      const id = uid();
      s.items[id] = { id, nome, qta, cat: catOf(nome), fatto: false, da: me().nome, nota: "", ts: now, updatedAt: now };
    }
  });
  inp.value = "";
  mochi.mood("happy"); mochi.say(frase("aggiunto"));
  toast(nuovi.length > 1 ? `${nuovi.length} prodotti aggiunti` : `${nuovi[0].nome} aggiunto`);
});

$("#lista").addEventListener("change", e => {
  const id = e.target.dataset.chk; if (!id) return;
  const checked = e.target.checked, it = state.items[id];
  mutate((s, now) => { s.items[id] = { ...s.items[id], fatto: checked, updatedAt: now }; });
  if (checked) {
    sparkles(document.querySelector(`[data-chk="${CSS.escape(id)}"]`));
    const rest = live(state.items).filter(i => !i.fatto).length;
    if (!rest) { mochi.mood("happy", 3000); mochi.say(frase("finito"), 3500); confetti(); toast("Spesa completata! 🎉"); }
    else { mochi.mood("happy"); mochi.say(frase("preso")); toast(`${it.nome} preso`); }
  } else toast(`${it.nome} rimesso in lista`);
});

$("#lista").addEventListener("click", e => {
  const b = e.target.closest("[data-del]"); if (!b) return;
  const id = b.dataset.del, nome = state.items[id]?.nome;
  // sposta il focus su un elemento vicino prima di eliminare
  const li = b.closest("li"), next = (li.nextElementSibling || li.previousElementSibling)?.querySelector("input");
  mutate((s, now) => { s.items[id] = { ...s.items[id], deleted: true, updatedAt: now }; });
  (next && document.querySelector(`[data-fk="${CSS.escape(next.dataset.fk)}"]`) || $("#add-nome")).focus();
  toast(`${nome} eliminato`);
});

$("#clear-done").addEventListener("click", async () => {
  const n = live(state.items).filter(i => i.fatto).length;
  if (!(await confirmDlg(`Togliere ${n} ${n === 1 ? "prodotto preso" : "prodotti presi"} dalla lista?`, "Sì, togli"))) return;
  mutate((s, now) => { for (const i of live(s.items)) if (i.fatto) s.items[i.id] = { ...i, deleted: true, updatedAt: now }; });
  $("#add-nome").focus();
  mochi.mood("happy"); mochi.say("Tutto in ordine ✿"); toast("Lista pulita");
});

// ---------- MONITOR / OFFERTE ----------
$("#mon-nome").addEventListener("input", e => {
  const v = e.target.value;
  if (/detersiv.*(lavatric|bucato)|ammorbid|lavastovigl|capsul|pods/i.test(v)) $("#mon-unita").value = "lavaggi";
  else if (/olio|latte|acqua|vino|candeggin|sgrassat|detersivo piatti/i.test(v)) $("#mon-unita").value = "litri";
});
$("#f-mon").addEventListener("submit", e => {
  e.preventDefault();
  const nome = $("#mon-nome").value.trim(); if (!nome) return $("#mon-nome").focus();
  mutate((s, now) => { const id = uid(); s.monitor[id] = { id, nome, unita: $("#mon-unita").value, updatedAt: now }; });
  $("#mon-nome").value = ""; toast(`Tengo d'occhio: ${nome}`); mochi.mood("wow"); mochi.say("Ci penso io! 👀");
});
$("#monitor").addEventListener("click", e => {
  const b = e.target.closest("[data-mdel]"); if (!b) return;
  const id = b.dataset.mdel, nome = state.monitor[id]?.nome;
  mutate((s, now) => { s.monitor[id] = { ...s.monitor[id], deleted: true, updatedAt: now }; });
  $("#mon-nome").focus(); toast(`${nome} rimosso`);
});
$("#offerte").addEventListener("click", e => {
  const b = e.target.closest("[data-addoff]"); if (!b) return;
  const x = renderOfferte.sorted[+b.dataset.addoff]; if (!x) return;
  mutate((s, now) => {
    const id = uid();
    s.items[id] = { id, nome: x.prodotto, qta: "", cat: catOf(x.categoria || x.prodotto), fatto: false, da: me().nome,
      nota: `Offerta ${x.negozio || ""} ${eur(x.prezzo)}${x.validoFino ? " fino al " + x.validoFino : ""}`.trim(), ts: now, updatedAt: now };
  });
  sparkles(b); toast("Aggiunto alla lista"); mochi.mood("happy"); mochi.say(frase("aggiunto"));
});

let searching = null;
$("#cerca").addEventListener("click", async () => {
  if (searching) return;
  const btn = $("#cerca"), s = state.settings;
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true");
  $("#off-info").textContent = "Mochi sta sfogliando i volantini… può volerci un minuto.";
  mochi.mood("wow", 0); mochi.say("Cerco, cerco… 🔍", 60000);
  searching = new AbortController();
  try {
    const offerte = await ai.cercaOfferte({ prodotti: live(state.monitor), ...s }, { signal: searching.signal });
    mutate((st, now) => { st.offerte = { list: offerte, updatedAt: now }; });
    const top = offerte.filter(o => o.voto === "ottima").length;
    mochi.mood("happy", 2500); mochi.say(offerte.length ? frase("offerta") : "Niente di speciale oggi (´・ω・`)");
    toast(offerte.length ? `${offerte.length} offerte trovate${top ? `, ${top} ottime ★` : ""}` : "Nessuna offerta trovata");
    if (top) confetti();
  } catch (err) {
    mochi.mood("sleepy", 2500); mochi.say(frase("errore"));
    $("#off-info").textContent = err.message;
  } finally {
    searching = null; btn.classList.remove("loading"); btn.removeAttribute("aria-busy"); renderOfferte();
  }
});

// ---------- VALUTA ----------
const words = s => (s || "").toLowerCase().replace(/https?:\/\/\S+/g, " ").split(/[^a-zà-ù0-9]+/).filter(w => w.length > 3);
function readVal() { return { testo: $("#val-testo").value.trim(), prezzo: num($("#val-prezzo").value), quantita: num($("#val-q").value), unita: $("#val-u").value }; }
$("#val-calc").addEventListener("click", () => {
  const { testo, prezzo, quantita, unita } = readVal(), out = $("#val-out");
  if (!prezzo || !quantita) { out.innerHTML = `<p class="hint">Scrivi prezzo e quantità (es. 12,90 € e 40 lavaggi).</p>`; (!prezzo ? $("#val-prezzo") : $("#val-q")).focus(); return; }
  const pu = prezzo / quantita, w = words(testo);
  const simili = state.offerte.list.filter(o => o.unita === unita && o.prezzoUnit > 0 && (!w.length || words(o.prodotto + " " + (o.categoria || "")).some(x => w.includes(x))));
  const best = simili.sort((a, b) => a.prezzoUnit - b.prezzoUnit)[0];
  let h = `<div class="result"><div class="bigv">${eur3(pu)}</div><div class="unit">al ${UNIT1[unita]}</div>`;
  if (best) {
    const p = Math.round((pu / best.prezzoUnit - 1) * 100);
    h += p <= 0 ? `<p><span class="badge gold">Conveniente</span> Costa ${p < 0 ? -p + "% in meno" : "uguale"} rispetto alla migliore offerta vicino a casa (${esc(best.negozio)}).</p>`
                : `<p><span class="badge warn">Si trova a meno</span> Da ${esc(best.negozio)} costa ${eur3(best.prezzoUnit)} al ${UNIT1[unita]} (${p}% in meno).</p>`;
  } else h += `<p class="hint">Non ho offerte simili salvate per confrontarlo. Prova “Chiedi a Mochi”.</p>`;
  out.innerHTML = h + "</div>";
  mochi.mood(best && pu <= best.prezzoUnit ? "happy" : "wow");
});
$("#f-val").addEventListener("submit", async e => {
  e.preventDefault();
  const v = readVal(), btn = $("#val-ask"), out = $("#val-out");
  if (!v.testo) { out.innerHTML = `<p class="hint">Scrivi il nome del prodotto o incolla il link.</p>`; $("#val-testo").focus(); return; }
  if (!ai.getCfg().key) { out.innerHTML = `<p class="hint">Serve la chiave API di Claude: la trovi in ⚙️ Impostazioni.</p>`; return; }
  btn.classList.add("loading"); btn.setAttribute("aria-busy", "true"); btn.disabled = true;
  out.innerHTML = `<p class="hint">Mochi sta controllando prezzi e recensioni…</p>`;
  mochi.mood("wow", 0); mochi.say("Fammi vedere… 🧐", 60000);
  try {
    const esito = await ai.valuta({ ...v, offerte: state.offerte.list });
    mutate((s, now) => { const id = uid(); s.valutazioni[id] = { id, ...v, esito, da: me().nome, ts: now, updatedAt: now }; });
    out.innerHTML = `<p class="hint">✓ Fatto! Il risultato è qui sotto.</p>`;
    mochi.mood(esito.voto === "conveniente" ? "happy" : "wow", 2500);
    mochi.say(esito.voto === "conveniente" ? "Buon affare! 💕" : esito.voto === "caro" ? "Mmh, si trova a meno…" : "Nella media ✿");
    document.querySelector("#valutazioni article")?.scrollIntoView({ behavior: motionOk() ? "smooth" : "auto", block: "nearest" });
  } catch (err) {
    out.innerHTML = `<p class="hint">${esc(err.message)}</p>`; mochi.mood("sleepy", 2500); mochi.say(frase("errore"));
  } finally { btn.classList.remove("loading"); btn.removeAttribute("aria-busy"); btn.disabled = false; }
});
$("#valutazioni").addEventListener("click", e => {
  const b = e.target.closest("[data-vdel]"); if (!b) return;
  mutate((s, now) => { s.valutazioni[b.dataset.vdel] = { ...s.valutazioni[b.dataset.vdel], deleted: true, updatedAt: now }; });
  $("#val-testo").focus(); toast("Valutazione eliminata");
});

// ---------- IMPOSTAZIONI ----------
function fillSettings() {
  const m = me(); $("#me-nome").value = m.nome || "";
  for (const r of document.querySelectorAll('input[name="anim"]')) r.checked = r.value === (m.anim || "auto");
  const c = dbxCfg(); $("#dbx-key").value = c.appKey || ""; $("#dbx-path").value = c.path || "";
  const s = state.settings;
  $("#z-luogo").value = s.luogo || ""; $("#z-raggio").value = s.raggioKm || 5; $("#z-raggio-v").textContent = s.raggioKm || 5;
  $("#z-negozi").value = s.negozi || ""; $("#z-amz").checked = s.amazon !== false;
  const a = ai.getCfg(); $("#ai-key").value = a.key || ""; $("#ai-model").value = a.model || ai.DEFAULT_MODEL;
  $("#dbx-off").hidden = !dbx.isConnected(); $("#dbx-go").textContent = dbx.isConnected() ? "Ricollega Dropbox" : "Collega Dropbox";
}
$("#z-raggio").addEventListener("input", e => $("#z-raggio-v").textContent = e.target.value);
$("#f-me").addEventListener("submit", e => {
  e.preventDefault();
  lsSet("mochi.me", { nome: $("#me-nome").value.trim(), anim: document.querySelector('input[name="anim"]:checked')?.value || "auto" });
  applyAnim(); render(); toast("Salvato ✓"); mochi.mood("happy"); mochi.say($("#me-nome").value.trim() ? `Piacere, ${$("#me-nome").value.trim()}! ♡` : "Salvato ✿");
});
$("#f-zona").addEventListener("submit", e => {
  e.preventDefault();
  mutate((s, now) => { s.settings = { luogo: $("#z-luogo").value.trim(), raggioKm: +$("#z-raggio").value, negozi: $("#z-negozi").value.trim(), amazon: $("#z-amz").checked, updatedAt: now }; });
  toast("Zona salvata ✓");
});
$("#f-ai").addEventListener("submit", e => {
  e.preventDefault();
  ai.setCfg({ key: $("#ai-key").value.trim(), model: $("#ai-model").value.trim() || ai.DEFAULT_MODEL });
  renderOfferte(); toast("Chiave salvata su questo telefono ✓");
});
$("#f-dbx").addEventListener("submit", async e => {
  e.preventDefault();
  const appKey = $("#dbx-key").value.trim(), path = normPath($("#dbx-path").value);
  if (!appKey) { $("#dbx-msg").textContent = "Inserisci l'app key di Dropbox."; $("#dbx-key").focus(); return; }
  lsSet(DBX_CFG_KEY, { appKey, path });
  $("#dbx-msg").textContent = "Ti porto su Dropbox per autorizzare…";
  await dbx.startAuth(appKey);
});
$("#dbx-off").addEventListener("click", async () => {
  if (!(await confirmDlg("Scollegare Dropbox da questo telefono? La lista resta salvata qui.", "Scollega"))) return;
  dbx.disconnect(); fillSettings(); setSync("local"); toast("Dropbox scollegato");
});
$("#dbx-share").addEventListener("click", async () => {
  const c = { k: $("#dbx-key").value.trim(), p: normPath($("#dbx-path").value) };
  if (!c.k) { $("#dbx-msg").textContent = "Prima inserisci l'app key."; return; }
  // Il link contiene solo app key e percorso, mai i token di accesso.
  const link = dbx.redirectUri() + "#setup=" + btoa(unescape(encodeURIComponent(JSON.stringify(c))));
  try { await navigator.clipboard.writeText(link); $("#dbx-msg").textContent = "Link copiato! Mandalo a tua moglie: aprendolo trova tutto pronto, deve solo toccare “Collega Dropbox”."; }
  catch { $("#dbx-msg").innerHTML = `Copia questo link: <input readonly value="${esc(link)}" aria-label="Link di configurazione">`; }
});
const normPath = p => { p = (p || "").trim() || "/Spesa/mochi-spesa.json"; if (!p.startsWith("/")) p = "/" + p; if (!/\.json$/i.test(p)) p += ".json"; return p; };

// ---------- SINCRONIZZAZIONE ----------
let rev = lsGet("mochi.rev", null), syncing = false, syncAgain = false, syncT;
function setSync(kind, txt) {
  const b = $("#sync");
  b.className = "sync " + ({ ok: "ok", busy: "busy", err: "err" }[kind] || "");
  $("#sync-txt").textContent = txt || ({ local: "Solo su questo telefono", busy: "Sincronizzo…", ok: "Sincronizzato" }[kind] || "");
  b.setAttribute("aria-label", ($("#sync-txt").textContent) + (dbx.isConnected() ? ". Tocca per sincronizzare ora" : ". Tocca per collegare Dropbox"));
}
function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(sync, 700); }
async function sync() {
  if (!dbx.isConnected()) { setSync("local"); return; }
  if (!navigator.onLine) { setSync("err", "Offline: salvo qui"); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; setSync("busy");
  const path = dbxCfg().path;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remote = await dbx.download(path);
      const remoteState = remote && remote.data ? normalize(remote.data) : null;
      const merged = merge(state, remoteState);
      try {
        if (!remoteState || !same(merged, remoteState)) rev = await dbx.upload(path, merged, remote && remote.rev);
        else rev = remote.rev;
      } catch (e) { if (e.code === "conflict") continue; throw e; }
      const before = state;
      state = merge(state, merged); // tiene anche modifiche fatte durante la sincronizzazione
      lsSet("mochi.rev", rev); save();
      if (!same(before, state)) {
        const nuovi = live(state.items).filter(i => !seen.has(i.id) && i.da && i.da !== me().nome);
        render();
        if (nuovi.length) { toast(`${nuovi[0].da} ha aggiunto ${nuovi.length === 1 ? nuovi[0].nome : nuovi.length + " prodotti"}`); mochi.mood("wow"); mochi.say("Novità in lista! 💌"); }
      }
      setSync("ok", "Sincronizzato " + new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      break;
    }
  } catch (e) {
    if (e.code === "auth") { setSync("err", "Ricollega Dropbox"); fillSettings(); }
    else setSync("err", "Non sincronizzato, riprovo");
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}
$("#sync").addEventListener("click", () => {
  if (dbx.isConnected()) sync();
  else { selectTab($("#t-imp")); $("#dbx-key").focus(); }
});
setInterval(() => { if (document.visibilityState === "visible") sync(); }, 20000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
addEventListener("online", sync);
addEventListener("offline", () => setSync("err", "Offline: salvo qui"));

// ---------- onboarding ----------
function renderOnboard() {
  $("#onboard").innerHTML = dbx.isConnected() ? "" :
    `<div class="card"><h2 class="in">Ciao! Sono Mochi ♡</h2>
     <p style="margin:0 0 10px">La lista funziona già su questo telefono. Per condividerla con tua moglie collega Dropbox.</p>
     <button class="btn primary" type="button" id="go-dbx">☁️ Collega Dropbox</button></div>`;
  $("#go-dbx")?.addEventListener("click", () => { selectTab($("#t-imp")); $("#dbx-key").focus(); });
}

// ---------- avvio ----------
(async function start() {
  applyAnim();
  // link di configurazione condiviso: #setup=…
  const m = location.hash.match(/^#setup=(.+)$/);
  if (m) {
    try { const c = JSON.parse(decodeURIComponent(escape(atob(m[1])))); lsSet(DBX_CFG_KEY, { appKey: String(c.k || ""), path: normPath(c.p) }); toast("Configurazione ricevuta ♡ Ora collega Dropbox"); } catch {}
    history.replaceState(null, "", dbx.redirectUri() + "#imp");
  }
  try { if (await dbx.handleRedirect()) { toast("Dropbox collegato! ☁️"); mochi.mood("happy", 2500); mochi.say("Ora siamo connessi ♡"); } }
  catch (e) { toast(e.message); }

  fillSettings(); renderOnboard(); render();
  const start = tabs.find(t => "#" + t.id.slice(2) === location.hash) || tabs[0];
  selectTab(start, false);
  setSync(dbx.isConnected() ? "busy" : "local");
  sync();
  setTimeout(() => mochi.say(frase("ciao")), 600);

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
