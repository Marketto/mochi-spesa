// Privacy e condizioni, novità, presentazione iniziale e guida sugli elementi.
import * as tour from "../tour.js";
import { MOCHI_SVG } from "../mascot.js";
import { t, locale } from "../i18n.js";
import { APP_VERSION, POLICY_VERSION } from "../version.js";
import { render, renderInstall } from "../app.js";
import { $, confetti, esc, ic, lsGet, lsSet, me, mochi, motionOk, selectTab, setMe, tabs } from "./core.js";
import { changeLang, fillLangSelect, fillSettings } from "./settings.js";

// ---------- PRIVACY E CONDIZIONI ----------
export function legalHtml() {
  const sec = (icon, title, prefix, n) => `<h3>${ic(icon)} ${esc(t(title))}</h3><ul>${
    Array.from({ length: n }, (_, i) => `<li>${linkify(esc(t(`${prefix}${i + 1}`)))}</li>`).join("")}</ul>`;
  const linkify = h => h.replace(/github\.com\/Marketto\/mochi-spesa\/issues/, m => `<a href="https://${m}" target="_blank" rel="noopener">${m}</a>`);
  return `<p class="hint">${esc(t("legal.updated", { date: new Date(POLICY_VERSION.slice(0, 10)).toLocaleDateString(locale(), { dateStyle: "long" }) }))}</p>
    ${sec("privacy", "legal.privacyTitle", "legal.p", 19)}${sec("terms", "legal.termsTitle", "legal.t", 7)}`;
}
export function openLegal() { $("#legal-body").innerHTML = legalHtml(); $("#legal").showModal(); }

// ---------- NOVITÀ ----------
export function openNews(releases, soloNuove = true) {
  if (!releases.length) return;
  $("#news-title").textContent = soloNuove ? t("news.title", { v: APP_VERSION }) : t("news.allTitle");
  $("#news-body").innerHTML = releases.map(r => `<h3 class="ver">${esc(t("news.version", { v: r.v }))}</h3><ul class="feat">${
    r.items.map(([icon, key]) => `<li>${ic(icon, "feat-ic")}<span>${esc(t(key))}</span></li>`).join("")}</ul>`).join("");
  $("#news").showModal();
  if (soloNuove) { mochi.mood("happy", 2500); confetti(); }
}

// ---------- WIZARD (primo avvio, riaccettazione policy, o dalle impostazioni) ----------
export const WIZ = [
  { id: "welcome", n: 1, icon: "wave" }, { id: "list", n: 2, icon: "tab-list" }, { id: "share", n: 3, icon: "cloud" },
  { id: "deals", n: 4, icon: "tab-deals" }, { id: "privacy", n: 5, icon: "privacy" },
];
export let wiz = { step: 0, steps: WIZ, required: false, accepted: false };
export const policyOk = () => lsGet("mochi.policy", null) === POLICY_VERSION;
export const bullets = arr => `<ul class="feat">${arr.map(([icon, key]) => `<li>${ic(icon, "feat-ic")}<span>${esc(t(key))}</span></li>`).join("")}</ul>`;

export function wizBody(id) {
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
export function renderWizard(focusTitle = true) {
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
export function openWizard({ required, steps = WIZ }) {
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
  if (wiz.steps.length > 1) setTimeout(() => startTour(), 900);
});

// ---------- GUIDA SUGLI ELEMENTI ----------
export function startTour(all = false) {
  const steps = all ? tour.STEPS : tour.pick(tour.seen(), APP_VERSION);
  if (all) selectTab(tabs[0], false);
  tour.runTour(steps, { mascotSvg: MOCHI_SVG, motion: motionOk, onEnd: () => tour.markSeen(APP_VERSION) });
}
$("#help").addEventListener("click", () => startTour(true));

