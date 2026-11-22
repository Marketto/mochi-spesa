// Temi: auto (segue il sistema), chiaro, scuro, alto contrasto, daltonici. Scelta salvata su questo dispositivo.
// «auto» diventa il tema del sistema (contrasto alto > scuro > chiaro) e segue i suoi cambi.
const KEY = "mochi.theme";
export const THEMES = ["auto", "light", "dark", "contrast", "cb"];
const mq = { dark: matchMedia("(prefers-color-scheme: dark)"), contrast: matchMedia("(prefers-contrast: more)") };
export const systemTheme = () => (mq.contrast.matches ? "contrast" : mq.dark.matches ? "dark" : "light");
export function getTheme() { try { const v = localStorage.getItem(KEY); return THEMES.includes(v) ? v : "auto"; } catch { return "auto"; } }
/** Applica senza salvare (anteprima). */
export function applyTheme(name) {
  const v = THEMES.includes(name) ? name : "auto";
  document.documentElement.dataset.theme = v === "auto" ? systemTheme() : v;
  const c = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) if (c) m.content = c;
}
export function setTheme(name) { try { localStorage.setItem(KEY, THEMES.includes(name) ? name : "auto"); } catch {} applyTheme(getTheme()); }
for (const m of Object.values(mq)) m.addEventListener("change", () => { if (getTheme() === "auto") applyTheme("auto"); });
