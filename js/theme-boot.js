// Prima del disegno: imposta il tema salvato (script classico, senza moduli, per evitare il lampo di colori).
(function () {
  var t = "auto"; try { t = localStorage.getItem("mochi.theme") || "auto"; } catch (e) {}
  if (t === "auto" || ["light", "dark", "contrast", "cb"].indexOf(t) < 0)
    t = matchMedia("(prefers-contrast: more)").matches ? "contrast" : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
})();
