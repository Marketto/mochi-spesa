// Catene supportate: ogni "adattatore" sa trovare i volantini ufficiali in corso e scaricarli
// attraverso il ponte Cloudflare (solo siti ufficiali ammessi). Il volantino viene letto sul telefono;
// nulla viene ripubblicato. Per aggiungere una catena: un oggetto con id, nome, paese, flyers(), pdf().

const today = () => new Date().toISOString().slice(0, 10);
export const via = (proxy, url) => `${proxy.replace(/\/+$/, "")}/?url=${encodeURIComponent(url)}`;

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
