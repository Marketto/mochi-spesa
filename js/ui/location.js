// Posizione: casa, paese dalla posizione (mai dalla lingua) e «fuori casa».
import { frase } from "../mascot.js";
import { t, lang } from "../i18n.js";
import * as geo from "../geo.js";
import { $, confirmDlg, esc, ic, lsGet, lsSet, mochi, mutate, state, toast } from "./core.js";
import { refreshChains, renderBestHow } from "./prices.js";
import { fillSettings, renderAiKeys, renderSerp } from "./settings.js";
import { renderOfferte } from "../app.js";

// ---------- POSIZIONE ----------
// Casa = impostazione condivisa (indirizzo + coordinate). "Fuori casa" = solo su questo telefono.
export const AWAY_KEY = "mochi.away";
export const away = () => lsGet(AWAY_KEY, null);          // { lat, lon, nome, paese } se si cercano offerte fuori casa
// chi aveva già la zona prima della 2.5.0: il paese si ricava una volta dalle coordinate di casa
export async function fillCountry() {
  const s = state.settings;
  if ((s.paese && s.zona) || s.lat == null || !navigator.onLine) return;
  const info = await geo.placeInfo({ lat: s.lat, lon: s.lon }, lang());
  if (info?.paese || info?.nome) mutate((st, now) => { st.settings = { ...st.settings, paese: st.settings.paese || info.paese || "", zona: st.settings.zona || info.nome || "", updatedAt: now }; });
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
    mutate((s, now) => { s.settings = { ...s.settings, ...pos, paese: info?.paese || "", zona: info?.nome || "", luogo: nome, updatedAt: now }; });
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

