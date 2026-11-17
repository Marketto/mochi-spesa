// Versione dell'app e novità da mostrare dopo gli aggiornamenti.
// Per una nuova release: alza APP_VERSION, aggiungi in cima a CHANGELOG le novità
// (icona + chiave di traduzione "new.*" in tutti i file locales/*.json).
// Se cambiano privacy o condizioni d'uso, alza anche POLICY_VERSION: verrà chiesta di nuovo l'accettazione.

export const APP_VERSION = "1.5.0";
export const POLICY_VERSION = "2026-11-17c";

export const CHANGELOG = [
  { v: "1.5.0", items: [
    ["shelf", "new.racks"],
  ] },
  { v: "1.4.0", items: [
    ["import", "new.import"],
  ] },
  { v: "1.3.0", items: [
    ["tab-pantry", "new.pantry"],
    ["delete", "new.swipe"],
    ["store", "new.compare"],
  ] },
  { v: "1.2.1", items: [
    ["share", "new.share"],
    ["info", "new.version"],
  ] },
  { v: "1.2.0", items: [
    ["install", "new.install"],
    ["connect", "new.easyDbx"],
    ["pin", "new.geo"],
    ["mic", "new.voice"],
  ] },
  { v: "1.1.0", items: [
    ["lang", "new.lang"],
    ["tab-settings", "new.icons"],
    ["privacy", "new.privacy"],
    ["gift", "new.whatsnew"],
  ] },
  { v: "1.0.0", items: [
    ["tab-list", "new.list"],
    ["cloud", "new.sync"],
    ["tab-deals", "new.deals"],
    ["mochi", "new.rate"],
  ] },
];

const num = v => v.split(".").map(Number);
export function newer(a, b) { // a > b ?
  const x = num(a), y = num(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
/** Novità uscite dopo la versione già vista. */
export const novitaDopo = seen => CHANGELOG.filter(r => newer(r.v, seen || "0.0.0"));
