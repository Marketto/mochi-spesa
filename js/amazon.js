// Link di ricerca sul negozio Amazon del paese giusto. Solo link: nessuna lettura delle pagine Amazon.
const BY_CURRENCY = { GBP: "co.uk", USD: "com", JPY: "co.jp", SEK: "se", PLN: "pl", CAD: "ca", AUD: "com.au", INR: "in", MXN: "com.mx", BRL: "com.br", TRY: "com.tr", AED: "ae", SAR: "sa", EGP: "eg", SGD: "sg" };
const EUR_BY_LANG = { it: "it", de: "de", fr: "fr", es: "es", nl: "nl", pt: "es", ga: "co.uk", mt: "it" };

/** Dominio Amazon per valuta e lingua (es. EUR + it → amazon.it). */
export function amazonHost(valuta = "EUR", lang = "it") {
  const l = String(lang || "").slice(0, 2).toLowerCase();
  const tld = BY_CURRENCY[valuta] || (valuta === "EUR" ? EUR_BY_LANG[l] || "de" : "com");
  return "www.amazon." + tld;
}

/** Ricerca del prodotto su Amazon, senza tag di affiliazione. */
export const amazonSearch = (q, valuta, lang) => `https://${amazonHost(valuta, lang)}/s?k=${encodeURIComponent(String(q || "").trim())}`;

export const isAmazon = negozio => /^amazon\b/i.test(String(negozio || "").trim());
