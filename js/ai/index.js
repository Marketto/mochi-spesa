// Punto d'ingresso dell'IA di Mochi.
//
//   providers.js  catalogo dei servizi e dei modelli (capacità, qualità, velocità)
//   keys.js       chiavi dell'utente, uso giornaliero, pause
//   adapters.js   chiamate HTTP nel formato di ogni API
//   router.js     sceglie il modello più adatto ai tag della richiesta, con ripiego automatico
//   tasks.js      i compiti di Mochi (prompt + tag)
import { TAG, ready as readyFor } from "./router.js";

export { PROVIDERS, CAP, canWeb } from "./providers.js";
export { setShared, localKeys, allKeys, addKey, removeKey, usage, cooling } from "./keys.js";
export { TAG, route, ask, extractJson } from "./router.js";
export { chatText, mistralText } from "./adapters.js";
export * from "./tasks.js";

/** C'è una chiave adatta? web=true: serve un servizio che cerca sul web. */
export const ready = (web = true) => readyFor(web ? [TAG.WEB] : []);
