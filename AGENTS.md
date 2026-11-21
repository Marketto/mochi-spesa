# Mochi Spesa — guida per agenti

PWA senza build (moduli ES "vanilla"), pubblicata su GitHub Pages da `main`.
Rispondi all'utente in italiano, con tono semplice.

## Comandi
- Test: `node --test tests/*.test.mjs` (devono passare tutti prima di ogni commit).
- Controllo regole app: `npx -y github:Marketto/app-forge controlla`.
- Icone: `npm run icons` (font da Phosphor, elenco in `tools/build-icons.mjs`).
- Prova nel browser: `python3 -m http.server 8765` e apri http://localhost:8765/.

## A ogni rilascio
- `js/version.js`: `APP_VERSION` e una voce in `CHANGELOG` (chiave `new.*` tradotta). Le versioni di sole correzioni possono non avere la voce.
- `sw.js`: aumenta `CACHE` (`mochi-spesa-vNN`) e aggiungi ogni nuovo modulo a `SHELL` (c'è un test).
- Testi nuovi: chiave in **tutte** le 29 lingue di `locales/` (script in `tools/add-keys-*.py`; il test i18n lo verifica).
- Cambi alla privacy (`legal.p*`): aggiorna `POLICY_VERSION` (inizia con la data `AAAA-MM-GG`) e il numero di paragrafi in `app.js` e `tests/i18n.test.mjs`.
- Dopo il push: verifica che https://marketto.github.io/mochi-spesa/js/version.js mostri la nuova versione.

## Regole
- Nessun dato personale, chiave o token nel repo: le configurazioni personali stanno in `config.local.js` (ignorato) o nelle impostazioni dell'utente (Dropbox).
- Formato del file condiviso: `docs/sync-format.md`; ogni modifica a `js/store.js` deve passare i vettori in `tests/vectors/`.
- IA: catalogo in `js/ai/providers.js`, scelta del modello in `js/ai/router.js`, prompt in `js/ai/tasks.js`.
- Ponte Cloudflare (`worker/`): solo siti ufficiali; l'elenco `OFFICIAL_DOMAINS` deve restare uguale a `OFFICIAL` in `js/chains.js` (test).
- Fonti esterne: solo API pubbliche o siti ufficiali. Mochi non legge in automatico gli aggregatori di volantini (DoveConviene, PromoQui…): può solo citarli all'IA, che li consulta durante la ricerca web come farebbe una persona, e linkarli.
