# 🐰 Mochi Spesa

Lista della spesa **condivisa**, **kawaii** e **senza server**, con Mochi che cerca le offerte vicino a casa per te.

<p align="center"><img src="icons/icon-512.png" width="160" alt="Mochi, un coniglietto-mochi tondo con grandi occhi lucidi"></p>

- 📝 **Lista condivisa**: scrivi “2 kg mele” o “latte, pane, uova”. Mochi mette ogni prodotto nel reparto giusto.
- ✅ **Spunta, scorri, quantità**: spunti quello che hai comprato, scorri di lato per eliminare (con “Annulla”) e usi un pulsante per la quantità.
- 🥫 **Dispensa**: a casa Mochi ti chiede cosa hai messo in cantina o magazzino. Il resto va in credenza. Puoi organizzare i posti con nome, scaffali, ripiani e categorie. Se aggiungi alla lista qualcosa che hai già, Mochi ti avvisa: lo prendi dalla cantina (badge lilla) o lo togli dalla dispensa.
- 🗄️ **Scaffali disegnati**: ogni posto mostra i suoi scaffali con i ripiani, il numero di prodotti e le categorie. Tocchi un ripiano e vai ai suoi prodotti. L'editor ha un pulsante +/− per i ripiani; nelle impostazioni scegli se contarli dall'alto o dal basso. Se rinomini scaffali o ripiani, i prodotti li seguono.
- 📥 **Importa da Invendo**: carichi l'export Excel (.xlsx) o CSV. “Cantina | Angolo | 3” diventa posto › scaffale › ripiano, con quantità, categorie e scadenze. Se reimporti, i prodotti vengono aggiornati e non duplicati. Quelli a quantità 0 vengono tolti.
- 🏪 **Dove conviene?**: per la lista scegli il negozio più economico di ogni prodotto. I preferiti ★ e i negozi da evitare ⦸ valgono anche per le ricerche successive.
- ☁️ **Sincronizzata con Dropbox**: un file JSON in una cartella condivisa in famiglia. Funziona anche offline e le modifiche si uniscono da sole.
- 🏬 **Volantini ufficiali in automatico**: in Impostazioni scegli le tue catene (per ora Lidl). Mochi scarica i volantini ufficiali attraverso un piccolo ponte su Cloudflare, gratuito, che accetta solo i siti delle catene e non salva nulla. Il volantino viene letto sul telefono e i prezzi dei tuoi prodotti si salvano da soli. Per pubblicare il ponte servono il secret `CLOUDFLARE_API_TOKEN`, la variabile `CLOUDFLARE_ACCOUNT_ID` e, dopo il primo deploy, la variabile `FLYER_PROXY` con l'indirizzo `https://mochi-spesa-ponte.<tuo-sottodominio>.workers.dev`. Per aggiungere una catena basta un adattatore in `js/chains.js` e il suo dominio in `worker/src/index.js`.
- 📰 **Leggi un volantino**: carichi il PDF o una foto, anche di un volantino passato. Il testo viene letto sul telefono con tesseract.js e pdf.js. Mochi trova i prodotti della lista e quelli da tenere d'occhio, tu confermi i prezzi e lui li salva nello storico condiviso. I prezzi salvati entrano in “Dove conviene?” e in Offerte.
- 🤖 **IA gratis con Mistral**: oltre a Claude puoi scegliere Mistral, che ha un piano API gratuito, per cercare nei volantini e nei siti dei negozi.
- 🆓 **Prezzi gratis, senza chiave**: Mochi usa i prezzi segnalati dalla community di [Open Food Facts – Open Prices](https://prices.openfoodfacts.org) (ODbL) vicino a casa, sia in “Dove conviene?” sia in Offerte. Ci sono anche link rapidi per cercare i volantini. La chiave Claude è facoltativa: serve per i volantini aggiornati e per Amazon.
- 🏷️ **Offerte vicino a casa**: scegli i prodotti da tenere d'occhio (detersivo lavatrice, ammorbidente…), la zona e il raggio. Mochi cerca nei volantini e confronta con Amazon il **prezzo per lavaggio, litro o kg**.
- ⚖️ **È un buon affare?**: incolli un link Amazon o un prezzo. Ottieni subito il prezzo per unità e, se vuoi, un'analisi di qualità e prezzo.
- 🌍 **29 lingue**: le 24 lingue ufficiali dell'UE più russo, cinese, giapponese, coreano e arabo (impaginazione da destra a sinistra). Rileva la lingua del telefono e si cambia dalle impostazioni.
- 📍 **Posizione**: scrivi l'indirizzo di casa o usa la posizione del telefono. Se sei a più di 40 km da casa, Mochi ti chiede se cercare le offerte dove sei.
- 🎙️ **Dettatura vocale gratuita**: tocca il microfono e di' “latte, pane e uova”. Usa il riconoscimento vocale del browser (Chrome su Android, Safari su iPhone).
- 💌 **Condividi l'app** con un tocco (menu di condivisione del telefono) e **versione** sempre visibile accanto al titolo.
- 📲 **Proposta di installazione** sulla schermata Home (pulsante su Android, istruzioni su iPhone).
- 👋 **Tour di benvenuto** al primo avvio, con **privacy e condizioni d'uso** da accettare, e la schermata **Novità** dopo ogni aggiornamento.
- 📱 **Installabile** (PWA): “Aggiungi a schermata Home” su iPhone e Android.
- ♿ **Accessibile**: contrasti WCAG AA, tutto usabile da tastiera e con screen reader, target da 44px o più, rispetta “riduci movimento”, tema chiaro e scuro.

## 🔒 Privacy: nessun dato personale nel repo

| Dato | Dove sta |
|---|---|
| Lista, offerte, zona di casa | Nel **tuo** file Dropbox e nel telefono |
| Token Dropbox, chiave API Claude, il tuo nome, la posizione “fuori casa” | Solo nel `localStorage` del telefono |
| App key Dropbox | Variabile del repo GitHub, scritta nel sito al deploy |
| `config.local.js` (facoltativo, per sviluppo) | In `.gitignore`, mai su GitHub |

Il deploy controlla che non finiscano nel sito `config.local.js` o chiavi API.

## 🚀 Messa online (GitHub Pages)

1. Fai il fork o il push di questo repo su GitHub.
2. Vai in **Settings → Pages → Source: GitHub Actions**. Il workflow `.github/workflows/pages.yml` prova ad attivarlo da solo.
3. A ogni push su `main` partono i test e poi la pubblicazione su `https://<utente>.github.io/mochi-spesa/`.

## ☁️ Collegare Dropbox (una volta sola, 3 minuti)

1. Vai su <https://www.dropbox.com/developers/apps> → **Create app**.
   - *Scoped access* → *Full Dropbox* → un nome qualsiasi (es. `mochi-spesa-famiglia`).
2. Nella scheda **Permissions** spunta `files.metadata.read`, `files.content.read` e `files.content.write`, poi tocca **Submit**.
3. Nella scheda **Settings**:
   - in **OAuth 2 → Redirect URIs** aggiungi l'indirizzo esatto dell'app, es. `https://<utente>.github.io/mochi-spesa/`
   - in **Allow public clients (Implicit Grant & PKCE)** scegli **Allow**
   - copia la **App key**. È pubblica per natura, non è una password, ma resta comunque fuori dal repo.
4. In Dropbox crea la cartella **`/Spesa`** e **condividila con tua moglie**.
5. Su GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**, nome `DROPBOX_APP_KEY`, valore = la tua App key. Poi rilancia il deploy (*Actions → Deploy su GitHub Pages → Run workflow*).
   Il deploy scrive la chiave in `config.js` dentro il sito, quindi **nessun utente deve inserirla**: basta toccare *Collega Dropbox*. La App key non è un segreto (serve proprio a identificare l'app nel browser), ma così non sta nel codice del repo.
6. Nell'app tocca **Collega Dropbox** e autorizza. A tua moglie basta aprire l'app e fare lo stesso.

> Senza la variabile l'app funziona comunque: chiede la App key in *Impostazioni → Avanzate*.

> Se tua moglie ha spostato la cartella condivisa in un'altra posizione, deve solo correggere il percorso del file nelle impostazioni.

## ✨ Ricerca offerte (facoltativa)

Senza server, la ricerca web la fa l'**API di Claude** chiamata direttamente dal telefono.

1. Crea una chiave su <https://console.anthropic.com> → *API Keys*. Ti consiglio di impostare un limite di spesa mensile.
2. Incollala in ⚙️ **Impostazioni → Ricerca offerte**. Resta solo su quel telefono.
3. Ogni ricerca costa qualche centesimo. Le offerte trovate vengono salvate nel file condiviso, così le vede tutta la famiglia.

I prezzi arrivano da fonti web (volantini, siti delle catene, Amazon) e possono cambiare: per sicurezza controlla il link “Volantino” prima di andare.

## 🎀 Icone: font “Mochi Icons”

Tutti i pulsanti e le azioni hanno un'icona che dice cosa fanno: il cestino elimina, la scopa toglie i presi, il binocolo tiene d'occhio un prodotto e così via. Le icone sono un **font** fatto apposta per l'app (`fonts/mochi-icons.woff2`, circa 8 KB):

- base **[Phosphor Icons](https://phosphoricons.com)** (licenza MIT, vedi `fonts/LICENSE-phosphor.txt`), peso *bold* dalle forme morbide, con le varianti *fill* per la scheda attiva;
- un glifo **originale di Mochi**, usato per “Chiedi a Mochi”, per i coriandoli e per le scintille;
- anteprima di tutte le icone in `fonts/anteprima.html`.

Uso: `<i class="mi mi-delete" aria-hidden="true"></i>`, sempre insieme a un testo o a un `aria-label` sul pulsante. Per aggiungere o cambiare icone modifica la mappa in `tools/build-icons.mjs` e lancia:

```bash
npm install && npm run icons
```

## 🌍 Lingue

Le traduzioni sono file JSON in `locales/<codice>.json`; l'inglese è la lingua di riserva. Il test `tests/i18n.test.mjs` controlla che ogni lingua abbia tutte le chiavi con gli stessi segnaposto `{...}`.
Le traduzioni sono state scritte con l'aiuto di un'IA: correzioni da madrelingua sono benvenute (basta modificare il JSON).
Per aggiungere una lingua: aggiungi il codice in `LANGS` (`js/i18n.js`), crea `locales/<codice>.json` copiando `en.json` e lancia `npm test`.

Il riconoscimento automatico dei reparti capisce parole italiane e inglesi; nelle altre lingue i prodotti non riconosciuti vanno in “Altro”.

## 🎁 Rilasciare una nuova versione

In `js/version.js`:
- alza `APP_VERSION` e aggiungi in cima a `CHANGELOG` le novità (icona + chiave `new.*`, da tradurre in tutti i `locales`): al prossimo avvio gli utenti vedono la schermata **Novità**;
- se cambiano privacy o condizioni, alza anche `POLICY_VERSION`: verrà chiesta di nuovo l'accettazione;
- alza `CACHE` in `sw.js` per aggiornare la cache offline.

## 🛠️ Sviluppo

```bash
cp config.example.js config.local.js   # facoltativo: precompila l'app key in locale
python3 -m http.server 8000            # poi apri http://localhost:8000
npm test                               # test dell'unione tra telefoni
```

L'app non ha dipendenze né build: HTML, CSS e moduli JavaScript. `npm` serve solo per rigenerare il font delle icone.

```
index.html            struttura e accessibilità (landmark, tab ARIA, dialog)
css/style.css         stile kawaii, temi chiaro/scuro, animazioni, reduced-motion
js/app.js             interfaccia, sincronizzazione, effetti
js/mascot.js          Mochi (SVG) con espressioni e frasi
js/store.js           unione senza conflitti (last-writer-wins per elemento + tombstone)
js/dropbox.js         OAuth PKCE e file Dropbox dal browser
js/claude.js          ricerca offerte e valutazioni con l'API di Claude
js/voice.js           dettatura con il riconoscimento vocale del browser
js/pantry.js          dispensa: posti, scaffali, ripiani, quantità
js/importer.js        importazione da Invendo (.xlsx/.csv) senza librerie
js/openprices.js      prezzi gratuiti della community (Open Food Facts – Open Prices)
js/flyer.js           lettura volantini (OCR con tesseract.js, PDF con pdf.js) e storico prezzi
js/chains.js          catene supportate (adattatori) per i volantini ufficiali
worker/               ponte Cloudflare (solo siti ufficiali, nessun salvataggio)
js/geo.js             posizione, distanza da casa, indirizzi con OpenStreetMap
js/i18n.js            traduzioni, lingua RTL, font per lingua
js/version.js         versione, novità e versione della policy
locales/              29 file di traduzione
css/icons.css         classi delle icone (generato)
fonts/                font Mochi Icons, anteprima e licenza Phosphor
tools/build-icons.mjs costruisce il font da Phosphor + glifo Mochi
sw.js                 funzionamento offline
```

## Licenza

MIT. Mochi è un personaggio originale di questo progetto. Le icone derivano da Phosphor Icons (MIT).
