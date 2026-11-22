// Catene supportate: ogni "adattatore" sa trovare i volantini ufficiali in corso e scaricarli
// attraverso il ponte Cloudflare (solo siti ufficiali ammessi). Il volantino viene letto sul telefono;
// nulla viene ripubblicato. Per aggiungere una catena: un oggetto con id, nome, paese, flyers(), pdf().
import { hash } from "./util.js";

const today = () => new Date().toISOString().slice(0, 10);
/**
 * Indirizzo per scaricare "url" attraverso il ponte. Il ponte può avere una chiave privata
 * (es. https://ponte.workers.dev/?k=segreta): viene mantenuta, così solo chi la conosce usa la quota.
 */
export function via(proxy, url) {
  const u = new URL(proxy.includes("?") ? proxy : proxy.replace(/\/+$/, "") + "/");
  u.searchParams.set("url", url);
  return u.href;
}

async function get(proxy, url, as = "text", signal) {
  const r = await fetch(via(proxy, url), { signal });
  if (!r.ok) throw new Error(`${new URL(url).hostname}: ${r.status}`);
  return as === "json" ? r.json() : as === "blob" ? r.blob() : r.text();
}

/** Identificativi dei volantini nella pagina pubblica dei volantini Lidl. */
export function lidlSlugs(html) {
  return [...new Set([...String(html).matchAll(/\/l\/it\/volantini\/([a-z0-9-]+)\/ar\/\d+/g)].map(m => m[1]))];
}
/** Dal dato del visualizzatore Lidl al nostro volantino (null se non utile o scaduto). */
export function lidlFlyer(f, oggi = today()) {
  if (!f || !f.pdfUrl || f.enableDownload === false) return null;
  if (/viaggi|magazine|sostenibilit/i.test(`${f.subcategory || ""} ${f.title || ""} ${f.name || ""}`)) return null;
  const fine = f.offerEndDate || f.endDate || "";
  if (fine && fine < oggi) return null;
  return { id: "lidl:" + f.id, catena: "lidl", nome: [f.name, f.title].filter(Boolean).join(" – "), inizio: f.offerStartDate || f.startDate || "",
    fine, pdf: f.pdfUrl, url: f.flyerUrlAbsolute || "https://www.lidl.it/c/volantino-lidl/s10018048" };
}

export const CHAINS = {
  lidl: {
    id: "lidl", nome: "Lidl", paese: "IT", nazionale: true,
    async flyers(proxy, signal) {
      const html = await get(proxy, "https://www.lidl.it/c/volantino-lidl/s10018048", "text", signal);
      const out = [];
      for (const slug of lidlSlugs(html).slice(0, 12)) {
        try {
          const j = await get(proxy, `https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=${encodeURIComponent(slug)}`, "json", signal);
          const f = lidlFlyer(j && j.flyer); if (f) out.push(f);
        } catch (e) { if (e.name === "AbortError") throw e; }
      }
      return out;
    },
    async pdf(proxy, flyer, signal) {
      const b = await get(proxy, flyer.pdf, "blob", signal);
      return new File([b], "lidl.pdf", { type: "application/pdf" });
    },
  },
};
export const chainList = () => Object.values(CHAINS);

// ---------- pagine ufficiali dei volantini, indicate dall'utente ----------
// Molte catene pubblicano per ogni negozio una pagina con il link "Scarica il volantino in PDF".
// L'utente incolla il link di quella pagina; Mochi la rilegge ogni giorno e legge il PDF che la pagina pubblica.

/** Siti ufficiali ammessi (anche dal ponte: OFFICIAL_DOMAINS in worker/src/index.js). */
export const OFFICIAL = {
  "todis.it": "Todis", "eurospin.it": "Eurospin", "mdspa.it": "MD", "conad.it": "Conad", "pewex.it": "Pewex", "penny.it": "Penny",
  "aldi.it": "Aldi", "despar.it": "Despar", "carrefour.it": "Carrefour", "tigota.it": "Tigotà", "acquaesapone.it": "Acqua & Sapone",
};
const domainOf = host => Object.keys(OFFICIAL).find(d => host === d || host.endsWith("." + d)) || null;

/** Catena di un indirizzo ufficiale ({ dominio, nome }), o null se il sito non è tra quelli ammessi. */
export function officialChainOf(url) {
  let u; try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const d = domainOf(u.hostname);
  return d ? { dominio: d, nome: OFFICIAL[d] } : null;
}

/** Link ai PDF presenti in una pagina, solo sullo stesso sito ufficiale, nell'ordine della pagina. */
export function pdfLinks(html, base) {
  const d = officialChainOf(base)?.dominio, out = [];
  for (const m of String(html).matchAll(/(?:href|src|data-[a-z-]+)\s*=\s*["']([^"'\s]+?\.pdf(?:\?[^"'\s]*)?)["']/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
    if (u.protocol === "https:" && domainOf(u.hostname) === d && !out.includes(u.href)) out.push(u.href);
  }
  return out;
}


const fileName = url => decodeURIComponent(new URL(url).pathname.split("/").pop() || "").replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();

/** Adattatore per una pagina ufficiale scelta dall'utente: { id, url, nome }. */
export function pageChain(page) {
  return {
    id: page.id, nome: page.nome || officialChainOf(page.url)?.nome || "?", pagina: true,
    async flyers(proxy, signal) {
      const html = await get(proxy, page.url, "text", signal);
      return pdfLinks(html, page.url).slice(0, 3).map(pdf => ({ id: page.id + ":" + hash(pdf), catena: page.id, nome: fileName(pdf) || this.nome, inizio: "", fine: "", pdf, url: page.url }));
    },
    async pdf(proxy, flyer, signal) {
      const b = await get(proxy, flyer.pdf, "blob", signal);
      return new File([b], "volantino.pdf", { type: "application/pdf" });
    },
  };
}
/** Nuova pagina da un indirizzo (id stabile ricavato dall'indirizzo). */
export const newPage = url => { const c = officialChainOf(url); return c ? { id: "pg-" + hash(url), url: new URL(url).href, nome: c.nome } : null; };
