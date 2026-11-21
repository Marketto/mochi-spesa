// Compiti di Mochi che usano l'IA: ogni funzione prepara il prompt e dichiara con i tag
// che tipo di richiesta è; il router sceglie il modello tra le chiavi configurate.
import { ask, TAG } from "./router.js";

const SYS = lingua => `You are a grocery shopping assistant. Use web search to find REAL, current prices.
Rules: only use data you verified in a source you opened; never invent or estimate prices.
If nothing reliable is found, return an empty list. Write every human-readable text value in ${lingua}.
Reply ONLY with valid JSON inside a \`\`\`json block.`;

/** Cerca offerte vicino a casa per i prodotti monitorati. */
export async function cercaOfferte({ prodotti, luogo, raggioKm, negozi, amazon, valuta, lingua }, opts) {
  const oggi = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${oggi}. Home area: ${luogo}. Radius: ${raggioKm} km. Favourite shops: ${negozi || "none"}. Currency: ${valuta}.
Products to look for (with comparison unit): ${prodotti.map(p => `"${p.nome}" (${p.unita})`).join(", ")}.

For each product, find deals valid TODAY in supermarkets, discount stores and drugstores within the radius of the home area
(chain websites and weekly flyers, flyer aggregators of that country). Keep at most 3 deals per product, the cheapest per unit.
${amazon ? "For each deal also find the current price of an equivalent product (same brand and size if possible) on the Amazon store of that country." : ""}
voto: "ottima" if at least 20% below the typical unit price or Amazon, "buona" if 5-20% below, otherwise "normale".
unita must be one of: lavaggi (washes), litri (litres), kg, pezzi (pieces).

Format:
{"offerte":[{"prodotto":"brand and size","categoria":"name of the watched product","negozio":"…","distanzaKm":number or null,
"prezzo":number,"quantita":number,"unita":"lavaggi|litri|kg|pezzi","prezzoUnit":number,"validoFino":"short local date" or null,"fonte":"url",
"amazon":{"prezzo":number,"prezzoUnit":number,"url":"url"} or null,"voto":"ottima|buona|normale","nota":"max one sentence or empty string"}]}`;
  const j = await ask({ system: SYS(lingua), prompt, tags: [TAG.WEB, TAG.REASON], signal: opts?.signal });
  return Array.isArray(j.offerte) ? j.offerte.filter(o => o && o.prodotto && typeof o.prezzo === "number") : [];
}

/**
 * Fonti della ricerca «Trova il prezzo migliore». Ogni ricerca web è divisa in più richieste piccole,
 * una per fonte, eseguite in parallelo: così il modello approfondisce ogni fonte invece di fermarsi al primo risultato.
 * @typedef {{ tipo: "volantini", catene: string[] } | { tipo: "amazon" } | { tipo: "online" } | { tipo: "aggregatori" }} Fonte
 */
const FONTE = {
  volantini: f => `Look ONLY at the current flyers/promotions of these chains, in their stores within the radius: ${f.catene.join(", ")}.
Open each chain's official flyer page (and the store page for the home area if prices differ by store).
Also check the flyer aggregators of that country for those chains (in Italy: PromoQui, DoveConviene, VolantinoFacile, Tiendeo).
Report the store's in-flyer price for every matching product you find, one result per chain at least when available.`,
  aggregatori: () => `Search the flyer aggregators of that country (in Italy: promoqui.it/offerte/<product>, DoveConviene, VolantinoFacile, Tiendeo)
for current offers on this product valid in the home area. Report every matching offer (chain, product, price, validity).`,
  amazon: () => `Look ONLY at the Amazon store of that country. Report the 2-3 cheapest per unit matching offers sold or shipped by Amazon,
with their product page URL. online: true.`,
  online: () => `Look ONLY at online grocery shops of supermarket chains that deliver to the home area (e.g. in Italy Conad, Carrefour,
Esselunga, Coop, Tigotà online). Report their current price for matching products. online: true.`,
};

/** Un solo prodotto, una fonte: dove costa meno oggi. */
export async function cercaMigliore({ query, link, luogo, raggioKm, valuta, lingua, fonte = { tipo: "aggregatori" } }, opts) {
  const oggi = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${oggi}. Home area: ${luogo}. Radius: ${raggioKm} km. Currency: ${valuta}.
Product the user wants to buy: "${query}"${link ? `\nLink the user shared (open it, it may be an Amazon page): ${link}` : ""}

${FONTE[fonte.tipo](fonte)}

Match the product TYPE exactly: same kind and same format (e.g. "pod/caps" are not "tablets/pastiglie", "gel" is not "powder").
Brands may differ. Skip anything of a different type. Only prices valid today. Always give pack size so the unit price can be compared.
unita: "lavaggi" for washes/pods/tablets, "litri", "kg", or "pezzi". Return up to 6 results, cheapest per unit first.

Format:
{"risultati":[{"negozio":"chain or Amazon","prodotto":"brand, name and pack size","prezzo":number,"quantita":number,"unita":"lavaggi|litri|kg|pezzi",
"prezzoUnit":number,"offerta":true|false,"validoFino":"YYYY-MM-DD" or null,"online":true|false,"distanzaKm":number or null,"fonte":"url","nota":"max one short sentence or empty"}]}`;
  const j = await ask({ system: SYS(lingua), prompt, tags: [TAG.WEB], signal: opts?.signal });
  return Array.isArray(j.risultati) ? j.risultati.filter(o => o && o.negozio && o.prodotto && typeof o.prezzo === "number") : [];
}

/** Valuta qualità/prezzo di un prodotto (nome o link Amazon). */
export async function valuta({ testo, prezzo, quantita, unita, offerte, valuta, luogo, lingua }, opts) {
  const prompt = `Product (name or Amazon link): ${testo}
Price seen: ${prezzo ? prezzo + " " + valuta : "not given (find it)"}${quantita ? `, quantity ${quantita} ${unita}` : ""}. Home area: ${luogo || "unknown"}.
Deals already known near home: ${JSON.stringify((offerte || []).slice(0, 12).map(o => ({ p: o.prodotto, n: o.negozio, u: o.prezzoUnit, un: o.unita })))}

Identify the product (open the link if it is one, or infer it from the URL), assess quality from reliable sources
(consumer tests, verified reviews), compare the unit price with the local Amazon store and with the known deals.
Format:
{"prodotto":"name","voto":"conveniente|nella media|caro","prezzo":number or null,"prezzoUnit":number or null,"unita":"lavaggi|litri|kg|pezzi",
"qualita":"short, e.g. good – 4.5★ from 3,000 reviews","sintesi":"max 2 sentences","alternativa":"one sentence or empty string","fonti":["url"]}`;
  return ask({ system: SYS(lingua), prompt, tags: [TAG.WEB, TAG.REASON], signal: opts?.signal });
}

/** Dove conviene comprare ogni prodotto della lista: 2-4 negozi per prodotto, con prezzi verificati. */
export async function confrontaPrezzi({ prodotti, luogo, raggioKm, negozi, amazon, valuta, lingua, preferiti, evitati }, opts) {
  const oggi = new Date().toISOString().slice(0, 10);
  const prompt = `Today is ${oggi}. Home area: ${luogo}. Radius: ${raggioKm} km. Usual shops: ${negozi || "none"}. Currency: ${valuta}.
Shopping list (id, name, quantity): ${JSON.stringify(prodotti)}
Favourite product/shop combinations (list them first when available): ${JSON.stringify(preferiti || [])}
Combinations to AVOID (never propose them): ${JSON.stringify(evitati || [])}

For each product find where to buy it at the best price within the radius: supermarkets, discount stores, drugstores,
using current flyers, chain websites and online grocery prices of that country. Give 2 to 4 options per product, cheapest first,
for a typical pack (state brand/size in "nota" if relevant). Mark "offerta": true for promotions valid today.${amazon ? `
Also add Amazon (that country's Amazon store, delivered home) as one more option when it sells a comparable product: negozio "Amazon", fonte = the product page.` : ""}
unita must be one of: lavaggi, litri, kg, pezzi.

Format:
{"prodotti":[{"id":"same id as input","nome":"name","opzioni":[{"negozio":"shop name","prezzo":number,"prezzoUnit":number or null,
"unita":"lavaggi|litri|kg|pezzi","offerta":true|false,"validoFino":"short local date" or null,"fonte":"url","nota":"max one short sentence or empty"}]}]}`;
  const j = await ask({ system: SYS(lingua), prompt, tags: [TAG.WEB, TAG.LONG], signal: opts?.signal });
  return Array.isArray(j.prodotti) ? j.prodotti : [];
}

// ---------- compiti senza ricerca web (vanno bene anche i modelli gratuiti più semplici) ----------
const SYS_TEXT = lingua => `You are a careful grocery shopping assistant. You cannot browse the web: use ONLY the data given by the user,
plus general product knowledge where clearly stated as such. Never invent prices.
Write every human-readable text value in ${lingua}. Reply ONLY with valid JSON inside a \`\`\`json block.`;

/** Valuta un prezzo senza web, usando lo storico prezzi dell'utente. */
export async function valutaOffline({ testo, prezzo, quantita, unita, storico, valuta, lingua }, opts) {
  const prompt = `Product: ${testo}
Price seen: ${prezzo ? prezzo + " " + valuta : "not given"}${quantita ? `, quantity ${quantita} ${unita}` : ""}.
Prices the user collected (product, shop, price, unit price, date): ${JSON.stringify((storico || []).slice(0, 30))}

Compare the price seen with the collected prices (per unit when possible). If there is no comparable data, say so.
Format:
{"prodotto":"name","voto":"conveniente|nella media|caro","prezzo":number or null,"prezzoUnit":number or null,"unita":"lavaggi|litri|kg|pezzi",
"qualita":"short general note or empty","sintesi":"max 2 sentences","alternativa":"cheaper option from the collected prices or empty string","fonti":[]}`;
  return ask({ system: SYS_TEXT(lingua), prompt, tags: [TAG.REASON], signal: opts?.signal });
}

/** Estrae prodotti e prezzi dal testo di una pagina di volantino. */
export async function estraiPrezzi({ testo, lingua }, opts) {
  const prompt = `Text of one page of a supermarket flyer (layout may be scrambled, names and prices can be on different lines):
"""
${String(testo).slice(0, 12000)}
"""
List every product with its selling price. Ignore unit prices (€/kg, €/l) except as prezzoUnit, ignore old crossed-out prices and discounts in %.
Format: {"prodotti":[{"nome":"product name with brand and size","prezzo":number,"prezzoUnit":number or null,"unita":"kg|litri|pezzi|lavaggi" or null}]}`;
  const j = await ask({ system: SYS_TEXT(lingua), prompt, tags: [TAG.EXTRACT, TAG.LONG], signal: opts?.signal });
  return (Array.isArray(j.prodotti) ? j.prodotti : []).filter(p => p && p.nome && typeof p.prezzo === "number" && p.prezzo > 0 && p.prezzo < 1000);
}
