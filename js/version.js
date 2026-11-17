// Versione dell'app e novità da mostrare dopo gli aggiornamenti.
// Per una nuova release: alza APP_VERSION, aggiungi in cima a CHANGELOG le novità
// (icona + chiave di traduzione "new.*" in tutti i file locales/*.json).
// Se cambiano privacy o condizioni d'uso, alza anche POLICY_VERSION: verrà chiesta di nuovo l'accettazione.

export const APP_VERSION = "1.1.0";
export const POLICY_VERSION = "2026-11-17";

export const CHANGELOG = [
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
