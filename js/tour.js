// Guida sugli elementi veri: ogni passo evidenzia un elemento con una nuvoletta di Mochi.
// Al primo avvio dopo la presentazione; pulsante «?» in alto per rivederla.
// Funzione nuova visibile = un passo nuovo qui con v = la versione che la porta: dopo l'aggiornamento si vedono solo quelli.
import { t } from "./i18n.js";

export const STEPS = [
  { id: "mascot", v: "2.5.0", sel: "#mascot" },
  { id: "add", v: "2.5.0", sel: "#add-nome" },
  { id: "mic", v: "2.5.0", sel: "#mic" },
  { id: "sync", v: "2.5.0", sel: "#sync" },
  { id: "pantry", v: "2.5.0", sel: "#t-dispensa" },
  { id: "deals", v: "2.5.0", sel: "#t-offerte" },
  { id: "rate", v: "2.5.0", sel: "#t-valuta" },
  { id: "settings", v: "2.5.0", sel: "#t-imp" },
  { id: "help", v: "2.5.0", sel: "#help" },
];
const KEY = "mochi.tourSeen";
export const cmp = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
/** Passi da mostrare: tutti se non è mai stata vista, altrimenti solo quelli arrivati dopo. */
export const pick = (seen, current, steps = STEPS) => steps.filter(s => cmp(s.v, current) <= 0 && (!seen || cmp(s.v, seen) > 0));
export const seen = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
export const markSeen = v => { try { localStorage.setItem(KEY, v); } catch {} };

let open = false;
export function runTour(steps, { mascotSvg = "", motion = () => true, onEnd } = {}) {
  if (!steps.length || open) return;
  open = true;
  const box = document.createElement("div");
  box.className = "tour"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "tourT"); box.setAttribute("aria-describedby", "tourP");
  box.innerHTML = `<div class="tour-hole" aria-hidden="true"></div><div class="tour-card"><div class="tour-mascot" aria-hidden="true">${mascotSvg}</div>
    <h2 id="tourT"></h2><p id="tourP"></p><div class="tour-dots" aria-hidden="true"></div><p class="sr" id="tourN" aria-live="polite"></p>
    <div class="tour-btns"><button type="button" class="btn ghost" data-t="skip"></button><button type="button" class="btn ghost" data-t="prev"></button><button type="button" class="btn primary" data-t="next"></button></div></div>`;
  document.body.append(box);
  const hole = box.querySelector(".tour-hole"), card = box.querySelector(".tour-card"), $ = s => box.querySelector(s);
  let i = 0, cur = null; const back = document.activeElement;
  function place() { // segue l'elemento anche durante lo scorrimento
    if (!cur) return;
    const r = cur.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { display: "block", left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    const h = card.offsetHeight || 200, below = r.bottom + pad + 14 + h < innerHeight;
    card.style.top = below ? r.bottom + pad + 14 + "px" : Math.max(12, r.top - pad - 14 - h) + "px";
    box.classList.add("spot");
  }

  async function show(dir = 1) {
    const s = steps[i], el = s.sel && document.querySelector(s.sel);
    if (s.sel && (!el || !el.getClientRects().length)) { const d = dir || 1; i += d; if (i < 0) { i = 0; return show(1); } return i >= steps.length ? end() : show(d); }
    $("#tourT").textContent = t(`tour.${s.id}.t`);
    $("#tourP").textContent = t(`tour.${s.id}.p`);
    $("#tourN").textContent = t("tour.step", { i: i + 1, n: steps.length });
    $(".tour-dots").innerHTML = steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    $('[data-t="prev"]').hidden = i === 0;
    $('[data-t="skip"]').hidden = i === steps.length - 1;
    $('[data-t="next"]').textContent = t(i === steps.length - 1 ? "tour.done" : "tour.next");
    $('[data-t="prev"]').textContent = t("tour.prev");
    $('[data-t="skip"]').textContent = t("tour.skip");
    if (el) {
      el.scrollIntoView({ block: "center", behavior: motion() ? "smooth" : "auto" });
      cur = el; place();
      await new Promise(r => setTimeout(r, motion() ? 350 : 0));
      place();
    } else { cur = null; hole.style.display = "none"; card.style.top = ""; box.classList.remove("spot"); }
    if (motion()) { card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop"); }
    $('[data-t="next"]').focus();
  }
  function end() { box.remove(); open = false; removeEventListener("keydown", key, true); removeEventListener("resize", re); removeEventListener("scroll", place, true); back?.focus?.(); onEnd?.(); }
  function key(e) {
    if (e.key === "Escape") { e.preventDefault(); end(); }
    if (e.key === "Tab") { const f = [...card.querySelectorAll("button:not([hidden])")], a = f.indexOf(document.activeElement); e.preventDefault(); f[(a + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
  }
  const re = () => show(0);
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    if (b.dataset.t === "skip") return end();
    if (b.dataset.t === "prev") { i = Math.max(0, i - 1); return show(-1); }
    if (++i >= steps.length) return end();
    show(1);
  });
  addEventListener("keydown", key, true); addEventListener("resize", re); addEventListener("scroll", place, true);
  show(1);
}
