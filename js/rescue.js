// Salvagente dell'avvio: script classico, caricato prima dei moduli. Se l'app non parte entro pochi secondi
// (errore in un modulo, file vecchi in cache, memoria del browser piena), mostra l'errore e due rimedi:
// ricaricare pulito (via cache e service worker) e mettere da parte i dati locali (la lista torna da Dropbox).
// Nessun dato esce dal telefono.
(function () {
  var errs = [];
  function note(m) { if (m && errs.length < 5) errs.push(String(m).slice(0, 300)); }
  addEventListener("error", function (e) { note((e.message || "errore") + (e.filename ? " @ " + e.filename.split("/").pop() + ":" + e.lineno : "")); });
  addEventListener("unhandledrejection", function (e) { var r = e.reason; note(r && (r.stack || r.message) ? (r.message || String(r)) + " " + String(r.stack || "").split("\n")[1] : String(r)); });
  var it = /^it\b/i.test(navigator.language || "");
  var T = it
    ? { t: "Mochi non è partita", p: "Qualcosa si è inceppato all'avvio. Prova questi rimedi, nell'ordine:", a: "Ricarica pulita", ah: "Scarica di nuovo l'app (i tuoi dati restano).", b: "Metti da parte i dati di questo telefono", bh: "Salva una copia dei dati locali e riparte vuota: se usi Dropbox la lista torna da lì.", c: "Copia l'errore", e: "Dettagli", m: "Memoria usata dal sito", ok: "Copiato", bc: "Sicuro? I dati locali vengono salvati in un file e tolti da questo telefono." }
    : { t: "Mochi didn't start", p: "Something got stuck at startup. Try these fixes, in order:", a: "Clean reload", ah: "Download the app again (your data stays).", b: "Set aside this phone's data", bh: "Saves a copy of the local data and starts empty: if you use Dropbox the list comes back from there.", c: "Copy the error", e: "Details", m: "Storage used by the site", ok: "Copied", bc: "Sure? Local data is saved to a file and removed from this phone." };
  function used() {
    var by = {}, tot = 0;
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i), n = (k.length + (localStorage.getItem(k) || "").length) * 2; tot += n; var g = k.split(".")[0]; by[g] = (by[g] || 0) + n; } } catch (e) {}
    return Math.round(tot / 1024) + " KB (" + Object.keys(by).map(function (g) { return g + " " + Math.round(by[g] / 1024) + " KB"; }).join(", ") + ")";
  }
  async function cleanReload() {
    try { var rs = await navigator.serviceWorker.getRegistrations(); for (var r of rs) await r.unregister(); } catch (e) {}
    try { for (var k of await caches.keys()) if (k !== "mochi-share") await caches.delete(k); } catch (e) {}
    location.reload();
  }
  function setAside() {
    if (!confirm(T.bc)) return;
    var dump = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^mochi\./.test(k)) dump[k] = localStorage.getItem(k); }
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(dump)], { type: "application/json" }));
    a.download = "mochi-backup-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".json"; document.body.appendChild(a); a.click();
    // si tengono la configurazione di Dropbox e le scelte personali; via lo stato della lista
    ["mochi.state", "mochi.rev"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    setTimeout(cleanReload, 800);
  }
  function show() {
    if (window.__mochiOk || document.getElementById("rescue")) return;
    var d = document.createElement("div"); d.id = "rescue"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-labelledby", "rescue-t");
    d.style.cssText = "position:fixed;inset:0;z-index:99999;overflow:auto;padding:24px 18px;background:#2a1f2e;color:#fff;font:16px/1.45 system-ui,sans-serif";
    var b = "display:block;width:100%;min-height:48px;margin:14px 0 4px;border:0;border-radius:24px;font:600 16px system-ui;cursor:pointer";
    d.innerHTML = '<h1 id="rescue-t" style="font-size:22px;margin:0 0 8px">🐰 ' + T.t + "</h1><p>" + T.p + "</p>" +
      '<button id="rs-a" style="' + b + ';background:#ff9cc6;color:#2a1f2e">' + T.a + '</button><small>' + T.ah + "</small>" +
      '<button id="rs-b" style="' + b + ';background:#4a3a52;color:#fff">' + T.b + '</button><small>' + T.bh + "</small>" +
      '<details style="margin-top:18px"><summary>' + T.e + '</summary><pre id="rs-e" style="white-space:pre-wrap;font-size:13px;background:#0003;padding:10px;border-radius:10px"></pre>' +
      '<button id="rs-c" style="' + b + ';background:#4a3a52;color:#fff">' + T.c + "</button></details>";
    document.body.appendChild(d);
    var info = (errs.length ? errs.join("\n") : "timeout") + "\n" + T.m + ": " + used() + "\n" + navigator.userAgent;
    d.querySelector("#rs-e").textContent = info;
    d.querySelector("#rs-a").onclick = cleanReload;
    d.querySelector("#rs-b").onclick = setAside;
    d.querySelector("#rs-c").onclick = function (e) { navigator.clipboard.writeText(info).then(function () { e.target.textContent = T.ok; }); };
    d.querySelector("#rs-a").focus();
  }
  addEventListener("load", function () { setTimeout(show, 9000); });
})();
