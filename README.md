# 🐰 Mochi Spesa

Lista della spesa **condivisa**, **kawaii** e **senza server**, con Mochi che cerca le offerte vicino a casa per te.

<p align="center"><img src="icons/icon-512.png" width="160" alt="Mochi, un coniglietto-mochi tondo con grandi occhi lucidi"></p>

- 📝 **Lista condivisa**: scrivi “2 kg mele” o “latte, pane, uova”. Mochi mette ogni prodotto nel reparto giusto.
- ☁️ **Sincronizzata con Dropbox**: un file JSON in una cartella condivisa in famiglia. Funziona anche offline e le modifiche si uniscono da sole.
- 🏷️ **Offerte vicino a casa**: scegli i prodotti da tenere d'occhio (detersivo lavatrice, ammorbidente…), la zona e il raggio. Mochi cerca nei volantini e confronta con Amazon il **prezzo per lavaggio, litro o kg**.
- ⚖️ **È un buon affare?**: incolli un link Amazon o un prezzo. Ottieni subito il prezzo per unità e, se vuoi, un'analisi di qualità e prezzo.
- 📱 **Installabile** (PWA): “Aggiungi a schermata Home” su iPhone e Android.
- ♿ **Accessibile**: contrasti WCAG AA, tutto usabile da tastiera e con screen reader, target da 44px o più, rispetta “riduci movimento”, tema chiaro e scuro.

## 🔒 Privacy: nessun dato personale nel repo

| Dato | Dove sta |
|---|---|
| Lista, offerte, zona di casa | Nel **tuo** file Dropbox e nel telefono |
| Token Dropbox, chiave API Claude, il tuo nome | Solo nel `localStorage` del telefono |
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
5. Nell'app apri ⚙️ **Impostazioni** → incolla l'App key → **Collega Dropbox**.
6. Tocca **💌 Copia link per tua moglie** e mandaglielo. Aprendolo trova tutto pronto e deve solo toccare *Collega Dropbox*. Il link contiene solo l'app key e il percorso, mai i token.

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
css/icons.css         classi delle icone (generato)
fonts/                font Mochi Icons, anteprima e licenza Phosphor
tools/build-icons.mjs costruisce il font da Phosphor + glifo Mochi
sw.js                 funzionamento offline
```

## Licenza

MIT. Mochi è un personaggio originale di questo progetto. Le icone derivano da Phosphor Icons (MIT).
