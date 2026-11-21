// Genera tests/vectors/*.json: input scritti a mano, "atteso" calcolato da merge() e poi controllato a mano.
// Usato anche dai test di altri client (es. SmartBridge): niente dati personali.
import { writeFileSync } from "node:fs";
import { merge, canWrite } from "../js/store.js";
const NOW = 1800000000000, DAY = 86400000;
const V = [
  ["01-chiave-sconosciuta-conservata", "Chiavi in cima sconosciute: una mappa (unita per elemento) e due valori semplici (vince updatedAt più alto; senza updatedAt vince il remoto).",
    { schema: 1, items: {}, sensori: { s1: { id: "s1", t: 21, updatedAt: 1000 } }, profilo: { tema: "chiaro", updatedAt: 2000 }, nota: "locale" },
    { schema: 1, items: {}, sensori: { s1: { id: "s1", t: 19, updatedAt: 900 }, s2: { id: "s2", t: 5, updatedAt: 950 } }, profilo: { tema: "scuro", updatedAt: 1500 }, nota: "remota", extra: [1, 2] }],
  ["02-campo-sconosciuto-conservato", "Campi sconosciuti dentro un elemento restano con l'elemento che vince.",
    { schema: 1, items: { a: { id: "a", nome: "Latte", qta: "2 l", cat: "dairy", ts: 1000, updatedAt: 2000, barcode: "0000000000000" } } },
    { schema: 1, items: { a: { id: "a", nome: "Latte", qta: "1 l", cat: "dairy", ts: 1000, updatedAt: 1500 }, b: { id: "b", nome: "Pane", cat: "bakery", ts: 1200, updatedAt: 1200, fonte: { app: "altro-client", v: 3 } } } }],
  ["03-parita-spareggio-by", "Stesso updatedAt: vince il campo by più alto (confronto tra stringhe).",
    { schema: 1, dispensa: { d: { id: "d", nome: "Riso", qta: "1 kg", luogo: "credenza", updatedAt: 3000, by: "phone:aaa" } } },
    { schema: 1, dispensa: { d: { id: "d", nome: "Riso", qta: "500 g", luogo: "credenza", updatedAt: 3000, by: "smartbridge:hub" } } }],
  ["04-parita-senza-by", "Stesso updatedAt e nessun by: vince il JSON con le chiavi ordinate più alto.",
    { schema: 1, items: { a: { id: "a", nome: "Mele", qta: "1 kg", updatedAt: 4000 } } },
    { schema: 1, items: { a: { id: "a", nome: "Mele", qta: "2 kg", updatedAt: 4000 } } }],
  ["05-tombstone-piu-nuovo", "Un'eliminazione più recente vince su una modifica più vecchia e resta come tombstone.",
    { schema: 1, items: { a: { id: "a", nome: "Uova", deleted: true, updatedAt: NOW - DAY } } },
    { schema: 1, items: { a: { id: "a", nome: "Uova", qta: "6", updatedAt: NOW - 2 * DAY } } }],
  ["06-tombstone-scaduto", "Un tombstone vincente più vecchio di 30 giorni sparisce dal risultato.",
    { schema: 1, items: { a: { id: "a", nome: "Burro", deleted: true, updatedAt: NOW - 31 * DAY }, b: { id: "b", nome: "Sale", updatedAt: NOW - 40 * DAY } } },
    { schema: 1, items: { a: { id: "a", nome: "Burro", updatedAt: NOW - 35 * DAY } } }],
  ["07-schema-piu-nuovo", "Il file remoto ha uno schema più nuovo: l'unione lo conserva (mai abbassare schema) e un client con SCHEMA 1 non scrive.",
    { schema: 1, items: { a: { id: "a", nome: "Caffè", updatedAt: 5000 } } },
    { schema: 2, items: { a: { id: "a", nome: "Caffè", updatedAt: 4000 } }, nuovaMappa: {} }],
];
for (const [nome, descrizione, local, remote] of V) {
  const stato = merge(local, remote, NOW);
  writeFileSync(`tests/vectors/${nome}.json`, JSON.stringify({ nome, descrizione, local, remote, now: NOW, atteso: { scrivi: canWrite(stato), stato } }, null, 2) + "\n");
}
console.log("ok", V.length);
