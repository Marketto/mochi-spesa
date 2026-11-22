// Link di ricerca sul negozio Amazon del paese in cui si fa la spesa. Solo link: nessuna lettura delle pagine Amazon.
// Il paese viene dalla posizione dell'utente (GPS o città), non dalla lingua dell'app.

/** Dominio Amazon per paese (ISO 2 lettere). Paesi senza negozio proprio → il negozio che spedisce lì. */
const BY_COUNTRY = {
  it: "it", sm: "it", va: "it", de: "de", at: "de", ch: "de", lu: "de", li: "de", fr: "fr", mc: "fr", es: "es", ad: "es", pt: "es",
  nl: "nl", be: "com.be", pl: "pl", se: "se", gb: "co.uk", ie: "co.uk", us: "com", ca: "ca", mx: "com.mx", br: "com.br",
  jp: "co.jp", au: "com.au", in: "in", tr: "com.tr", ae: "ae", sa: "sa", eg: "eg", sg: "sg",
};
const EU = new Set("bg cz dk ee fi gr hr hu lt lv mt ro si sk cy is no".split(" "));

/** Dominio Amazon del paese (es. "it" → www.amazon.it). Paese sconosciuto → amazon.com. */
export function amazonHost(paese = "") {
  const p = String(paese).toLowerCase();
  return "www.amazon." + (BY_COUNTRY[p] || (EU.has(p) ? "de" : "com"));
}

/** Ricerca del prodotto su Amazon, senza tag di affiliazione. */
export const amazonSearch = (q, paese) => `https://${amazonHost(paese)}/s?k=${encodeURIComponent(String(q || "").trim())}`;

export const isAmazon = negozio => /^amazon\b/i.test(String(negozio || "").trim());
