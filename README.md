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

## 🛠️ Sviluppo

```bash
cp config.example.js config.local.js   # facoltativo: precompila l'app key in locale
python3 -m http.server 8000            # poi apri http://localhost:8000
node --test tests/*.test.mjs           # test dell'unione tra telefoni
```

Nessuna dipendenza e nessun build: HTML, CSS e moduli JavaScript.

```
index.html            struttura e accessibilità (landmark, tab ARIA, dialog)
css/style.css         stile kawaii, temi chiaro/scuro, animazioni, reduced-motion
js/app.js             interfaccia, sincronizzazione, effetti
js/mascot.js          Mochi (SVG) con espressioni e frasi
js/store.js           unione senza conflitti (last-writer-wins per elemento + tombstone)
js/dropbox.js         OAuth PKCE e file Dropbox dal browser
js/claude.js          ricerca offerte e valutazioni con l'API di Claude
sw.js                 funzionamento offline
```

## Licenza

MIT. Mochi è un personaggio originale di questo progetto.
