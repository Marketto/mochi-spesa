// Ricerca offerte e valutazioni prezzi con l'API di Claude + ricerca web.
// Chiamata diretta dal browser: la chiave API resta solo su questo dispositivo.

const LS = "mochi.claude";
export const getCfg = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
export const setCfg = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
export const DEFAULT_MODEL = "claude-sonnet-5-5";

async function ask(system, prompt, { signal } = {}) {
  const { key, model } = getCfg();
  if (!key) throw Object.assign(new Error("Manca la chiave API di Claude (Impostazioni)."), { code: "nokey" });
  const messages = [{ role: "user", content: prompt }];
  for (let turn = 0; turn < 4; turn++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal,
      headers: {
        "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL, max_tokens: 6000, system, messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10,
          user_location: { type: "approximate", country: "IT", timezone: "Europe/Rome" } }],
      }),
    });
    if (r.status === 401) throw new Error("Chiave API non valida.");
    if (r.status === 429) throw new Error("Troppe richieste: riprova tra un minuto.");
    if (!r.ok) throw new Error("Claude non ha risposto (" + r.status + ").");
    const j = await r.json();
    if (j.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: j.content }); continue; }
    const text = j.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    return extractJson(text);
  }
  throw new Error("La ricerca è durata troppo, riprova.");
}

export function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try { return JSON.parse(raw); } catch { throw new Error("Risposta non leggibile, riprova."); }
}

const SYS = `Sei un assistente per la spesa in Italia. Usi la ricerca web per trovare prezzi REALI e attuali.
Regole: usa solo dati verificati in una fonte che hai aperto; niente prezzi inventati o stimati.
Se non trovi nulla di affidabile restituisci una lista vuota. Rispondi SOLO con JSON valido in un blocco \`\`\`json.`;

/** Cerca offerte vicino a casa per i prodotti monitorati. */
export async function cercaOfferte({ prodotti, luogo, raggioKm, negozi, amazon }, opts) {
  const oggi = new Date().toLocaleDateString("it-IT");
  const prompt = `Oggi è ${oggi}. Zona: ${luogo}. Raggio: ${raggioKm} km. Negozi preferiti: ${negozi || "nessuno"}.
Prodotti da cercare (con unità di confronto): ${prodotti.map(p => `"${p.nome}" (${p.unita})`).join(", ")}.

Per ogni prodotto trova le offerte valide OGGI in supermercati, discount e drogherie presenti entro il raggio
(volantini sui siti delle catene, PromoQui, DoveConviene, Volantinofacile…). Tieni al massimo 3 offerte per prodotto, le più convenienti per unità.
${amazon ? "Per ognuna cerca anche il prezzo attuale su Amazon.it di un prodotto equivalente (stessa marca e formato se possibile)." : ""}
voto: "ottima" se almeno 20% sotto il prezzo unitario tipico o Amazon, "buona" se 5-20% sotto, altrimenti "normale".

Formato:
{"offerte":[{"prodotto":"nome commerciale e formato","categoria":"nome del prodotto monitorato","negozio":"…","distanzaKm":numero o null,
"prezzo":numero,"quantita":numero,"unita":"lavaggi|litri|kg|pezzi","prezzoUnit":numero,"validoFino":"gg/mm" o null,"fonte":"url",
"amazon":{"prezzo":numero,"prezzoUnit":numero,"url":"url"} o null,"voto":"ottima|buona|normale","nota":"max una frase o stringa vuota"}]}`;
  const j = await ask(SYS, prompt, opts);
  return Array.isArray(j.offerte) ? j.offerte.filter(o => o && o.prodotto && typeof o.prezzo === "number") : [];
}

/** Valuta qualità/prezzo di un prodotto (nome o link Amazon). */
export async function valuta({ testo, prezzo, quantita, unita, offerte }, opts) {
  const prompt = `Prodotto (nome o link Amazon): ${testo}
Prezzo visto: ${prezzo ? prezzo + " €" : "non indicato (trovalo tu)"}${quantita ? `, quantità ${quantita} ${unita}` : ""}.
Offerte già note vicino a casa: ${JSON.stringify((offerte || []).slice(0, 12).map(o => ({ p: o.prodotto, n: o.negozio, u: o.prezzoUnit, un: o.unita })))}

Identifica il prodotto (se è un link apri la pagina o deducilo dall'URL), valuta la qualità con fonti affidabili
(test Altroconsumo, recensioni verificate), confronta il prezzo per unità con Amazon.it e con le offerte note.
Formato:
{"prodotto":"nome","voto":"conveniente|nella media|caro","prezzo":numero o null,"prezzoUnit":numero o null,"unita":"…",
"qualita":"breve, es. buona – 4,5★ su 3.000 recensioni","sintesi":"max 2 frasi","alternativa":"una frase o stringa vuota","fonti":["url"]}`;
  return ask(SYS, prompt, opts);
}
