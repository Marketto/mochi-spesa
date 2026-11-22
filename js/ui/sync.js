// Sincronizzazione con Dropbox (formato in docs/sync-format.md).
import { frase } from "../mascot.js";
import { legacyCat } from "../categories.js";
import { merge, normalize, same, live, canWrite } from "../store.js";
import { t, locale } from "../i18n.js";
import * as dbx from "../dropbox.js";
import { $, connectDropbox, dbxCfg, lsGet, lsSet, me, mochi, save, seen, setState, state, toast } from "./core.js";
import { fillSettings } from "./settings.js";
import { render } from "../app.js";

// ---------- SINCRONIZZAZIONE ----------
export let rev = lsGet("mochi.rev", null), syncing = false, syncAgain = false, syncT;
export let syncKind = "local", syncKey = "sync.local", syncVars = null;
export function syncSet(kind, key, vars) {
  syncKind = kind; syncKey = key; syncVars = vars || null;
  const b = $("#sync");
  b.className = "sync " + ({ ok: "ok", busy: "busy", err: "err" }[kind] || "");
  $("#sync-ic").className = "mi mi-" + ({ ok: "cloud-ok", busy: "cloud-up", err: "cloud-off" }[kind] || "phone");
  $("#sync-txt").textContent = t(key, vars);
  b.setAttribute("aria-label", t(key, vars) + ". " + t(dbx.isConnected() ? "sync.tapSync" : "sync.tapConnect"));
}
export let conflictRuns = 0; // conflitti di fila: la nuova prova aspetta 30 s, 60 s, … fino a 5 minuti
export let readOnlyFile = false; // file scritto da una versione più nuova: si legge e basta
export let localChanged = true; // modifiche locali non ancora inviate: senza, basta confrontare la revisione del file
export function scheduleSync() { localChanged = true; clearTimeout(syncT); syncT = setTimeout(sync, 700); }
export async function sync() {
  if (!dbx.isConnected()) { syncSet("local", "sync.local"); return; }
  if (!navigator.onLine) { syncSet("err", "sync.offline"); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; syncSet("busy", "sync.busy");
  const path = dbxCfg().path;
  try {
    let done = false;
    // nessuna modifica qui e file uguale all'ultima volta: niente da scaricare
    if (!localChanged && rev && await dbx.currentRev(path) === rev) {
      if (readOnlyFile) { syncSet("err", "sync.newer"); return; }
      syncSet("ok", "sync.ok", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) });
      return;
    }
    localChanged = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const remote = await dbx.download(path);
      const remoteState = remote && remote.data ? normalize(remote.data) : null;
      if (remoteState) for (const it of Object.values(remoteState.items)) it.cat = legacyCat(it.cat);
      const merged = merge(state, remoteState);
      // file scritto da una versione più nuova del formato: si legge e basta
      const readOnly = !canWrite(merged);
      try {
        if (!readOnly && (!remoteState || !same(merged, remoteState))) rev = await dbx.upload(path, merged, remote && remote.rev);
        else rev = remote ? remote.rev : rev;
      } catch (e) { if (e.code === "conflict") continue; throw e; }
      const before = state;
      setState(merge(state, merged));
      lsSet("mochi.rev", rev); save();
      if (!same(before, state)) {
        const nuovi = live(state.items).filter(i => !seen.has(i.id) && i.da && i.da !== me().nome);
        render();
        if (nuovi.length) {
          toast(nuovi.length === 1 ? t("toast.fromOther", { who: nuovi[0].da, what: nuovi[0].nome }) : t("toast.fromOtherN", { who: nuovi[0].da, n: nuovi.length }), "send-love");
          mochi.mood("wow"); mochi.say(frase("novita"));
        }
      }
      readOnlyFile = readOnly;
      if (readOnly) syncSet("err", "sync.newer");
      else syncSet("ok", "sync.ok", { time: new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) });
      done = true;
    }
    // 4 conflitti di fila (altri stanno scrivendo): riprova più tardi invece di restare su «sincronizzo…»
    if (!done) { localChanged = true; syncSet("err", "sync.retry"); clearTimeout(syncT); syncT = setTimeout(sync, Math.min(300e3, 30e3 * 2 ** conflictRuns++)); }
    else conflictRuns = 0;
  } catch (e) {
    localChanged = true;
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

