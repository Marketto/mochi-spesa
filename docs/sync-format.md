# Mochi Sync Format v1

Formato del file JSON condiviso da Mochi Spesa (di default `/Spesa/mochi-spesa.json` su Dropbox).
Serve a far leggere e scrivere lo stesso file anche ad altri client senza perdere dati.

- JSON Schema: [`schema/mochi-spesa.v1.schema.json`](../schema/mochi-spesa.v1.schema.json) (draft 2020-12).
- Implementazione di riferimento: `merge()`, `normalize()`, `canWrite()` in [`js/store.js`](../js/store.js).
- Casi di prova comuni: [`tests/vectors/`](../tests/vectors/) (vedi in fondo).

Compatibilità: i file scritti da Mochi fino alla 2.0.0 sono già validi v1. Non serve nessuna migrazione.

## 1. Struttura

Il file è un oggetto JSON. In cima ci sono:

| Chiave | Tipo | Chi può scriverla |
|---|---|---|
| `schema` | intero ≥ 1 (oggi `1`) | tutti, solo per alzarlo (vedi §3) |
| `items` | mappa di elementi: lista della spesa | Mochi e client esterni |
| `dispensa` | mappa di elementi: dispensa | Mochi e client esterni |
| `luoghi` | mappa: posti della dispensa (credenza, cantina…) | solo Mochi (gli altri la leggono) |
| `monitor`, `valutazioni`, `preferenze`, `prezzi`, `volantini` | mappe | solo Mochi |
| `offerte`, `confronto`, `settings` | oggetti singoli con `updatedAt` | solo Mochi |
| qualsiasi altra chiave | qualsiasi | chi l'ha creata |

Un client esterno **non modifica** le chiavi "solo Mochi", ma le deve **conservare così come sono** quando riscrive il file.
`settings` può contenere chiavi di servizi IA condivise in famiglia (`aiShared`) e l'indirizzo del ponte Cloudflare (`ponte`, con l'eventuale chiave `?k=`): non vanno scritti nei log.

### Mappa ed elemento

Una **mappa** è un oggetto `{ "<id>": elemento, … }`, dove la chiave è uguale a `elemento.id`.
Un **elemento** è un oggetto con almeno:

| Campo | Tipo | Note |
|---|---|---|
| `id` | stringa | unica nella mappa |
| `updatedAt` | numero | ms UTC dell'ultima modifica |
| `by` | stringa, facoltativo | autore dell'ultima modifica, `"<client>:<id stabile>"`. Mochi scrive `"phone:<id del dispositivo>"` |
| `deleted` | booleano, facoltativo | `true` = tombstone (eliminato) |

Qualsiasi altro campo è ammesso e va conservato.

### Campi di `items` (lista della spesa)

| Campo | Tipo | Note |
|---|---|---|
| `nome` | stringa | |
| `qta` | stringa | testo libero con unità: `"2 l"`, `"500 g"`, `"6"`, `""` |
| `cat` | stringa | `clean`, `body`, `veg`, `dairy`, `meat`, `bread`, `frozen`, `drinks`, `pantry`, `other`. Un valore sconosciuto viene conservato e mostrato come `other` |
| `fatto` | booleano | spuntato nel carrello |
| `da` | stringa | nome di chi l'ha aggiunto (per la notifica "X ha aggiunto…") |
| `nota` | stringa | |
| `negozio`, `prezzo` | stringa, numero | facoltativi, scelti da "Dove conviene?" |
| `prendi` | oggetto o `null` | `{ dispId, luogo, label }`: da prendere dalla dispensa invece che comprare |
| `ts` | numero | ms UTC di creazione |
| `updatedAt`, `by`, `deleted` | | vedi sopra |

### Campi di `dispensa`

| Campo | Tipo | Note |
|---|---|---|
| `nome` | stringa | |
| `qta` | stringa | testo libero con unità: `"1 kg"`, `"3"`, `""` |
| `cat` | stringa | come sopra |
| `luogo` | stringa | id di un elemento di `luoghi`; `"credenza"` esiste sempre |
| `scaffale` | stringa | può essere vuoto |
| `ripiano` | stringa | può essere vuoto |
| `scad` | stringa | scadenza `AAAA-MM-GG` o `""` |
| `ts` | numero | ms UTC di creazione |
| `updatedAt`, `by`, `deleted` | | vedi sopra |

## 2. Regole di unione

`merge(local, remote, now)` è pura e deterministica; l'unico input esterno è `now` (ms UTC), usato per i tombstone.

1. **`schema`** del risultato = il più alto tra i due (un valore mancante o non valido vale `1`). Mai abbassarlo.
2. Per ogni altra chiave presente in almeno uno dei due stati:
   - **mappa nota** (`items`, `dispensa`, `luoghi`, `monitor`, `valutazioni`, `preferenze`, `prezzi`, `volantini`): unione per elemento (punto 3). Un valore che non è un oggetto conta come mappa vuota;
   - **oggetto singolo noto** (`offerte`, `confronto`, `settings`): vince con lo spareggio del punto 3;
   - **chiave sconosciuta** in cui entrambi i lati (o l'unico presente) sono mappe, cioè oggetti i cui valori sono tutti oggetti con `updatedAt` numerico (un oggetto vuoto conta come mappa): unione per elemento;
   - **altra chiave sconosciuta**: se c'è da un solo lato, si tiene quello; se entrambi hanno `updatedAt` numerico, vince lo spareggio del punto 3; altrimenti vince il **remoto**.
3. **Unione per elemento**: per ogni id presente in almeno un lato, se c'è da un solo lato si tiene quello; altrimenti vince, in ordine:
   1. `updatedAt` più alto (mancante = 0);
   2. a parità, `by` più alto (confronto tra stringhe; mancante = `""`);
   3. a parità, il JSON con le chiavi ordinate più alto (confronto tra stringhe).
   
   L'elemento vincente si tiene **intero**, con tutti i suoi campi, anche quelli sconosciuti. Non si mescolano campi dei due lati.
4. **Tombstone**: se l'elemento vincente ha `deleted: true` e `now - updatedAt > 30 giorni` (2 592 000 000 ms), viene tolto dal risultato. Vale per tutte le mappe, anche sconosciute. Gli elementi non eliminati non scadono.

Per eliminare un elemento non lo si toglie dalla mappa: lo si riscrive con `deleted: true` e un `updatedAt` nuovo.
Altrimenti l'altro dispositivo, con la sua copia, lo farebbe ricomparire.

**JSON con chiavi ordinate**, per lo spareggio 3.3: si ordinano le chiavi di ogni oggetto, a ogni livello; l'ordine degli array resta lo stesso. Si serializza come `JSON.stringify`: niente spazi, caratteri non ASCII scritti così come sono (in Python: `json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False)`), numeri interi senza `.0`. Le stringhe si confrontano per unità UTF-16, come in JavaScript. Coincide con il confronto per code point di Python finché non ci sono caratteri fuori dal piano base (per esempio le emoji); in quel caso un client non JavaScript deve confrontare le codifiche UTF-16.

## 3. Versioni

- `SCHEMA` è la versione più alta del formato che un client sa scrivere (Mochi oggi: `1`).
- Se lo stato unito ha `schema > SCHEMA`, il client **legge ma non scrive** e avvisa l'utente di aggiornare. Mochi mostra "Lista creata con una versione più nuova: aggiorna l'app per salvare".
- Nessun client abbassa mai `schema`.
- Aggiungere campi o chiavi **non** richiede un nuovo `schema`, perché tutti i client li conservano. Il numero sale solo se cambia il significato di qualcosa che esiste già.

## 4. Scrittura (Dropbox)

1. Scarica il file con `files/download` e tieni il `rev` dall'header `Dropbox-API-Result`. Un errore 409 vuol dire che il file non esiste ancora.
2. Unisci: `merged = merge(stato_locale, remoto, now)`.
3. Se `merged` ha `schema > SCHEMA`: non scrivere (§3).
4. Se `merged` è uguale al remoto (confronto del JSON con chiavi ordinate), non scrivere.
5. Altrimenti `files/upload` con `mode: {".tag": "update", "update": rev}` (`mode: "add"` se il file non esisteva), `autorename: false`, `mute: true`. Corpo: JSON compatto in UTF-8.
6. Se risponde **409** (conflitto: qualcuno ha scritto nel frattempo), torna al punto 1. Al massimo **3 nuovi tentativi**, poi riprova più tardi.
7. Dopo la scrittura, lo stato locale diventa `merged`.

## 5. Regole per i client esterni

- Scrive solo in `items` e `dispensa`. Tutto il resto lo conserva com'è.
- **Nuovo elemento**: `id` unico, con un prefisso del client consigliato (es. `"sb-…"`); `ts` e `updatedAt` = adesso, in ms UTC; `by` = `"<client>:<id stabile>"` (es. `"smartbridge:<id dell'installazione>"`), sempre lo stesso per quell'installazione.
- **Modifica**: parti dall'elemento esistente, cambia i campi che servono (gli altri, anche quelli sconosciuti, restano), poi aggiorna `updatedAt` e `by`.
- **Eliminazione**: tombstone (`deleted: true`, `updatedAt` e `by` nuovi).
- `updatedAt` deve venire da un orologio sincronizzato: un orologio avanti farebbe vincere sempre quel client.
- In `dispensa.luogo` usa un id che esiste in `luoghi`.
- Prima di scrivere, scarica e unisci sempre (§4). Non riscrivere mai il file partendo da una copia vecchia senza unire.

## 6. Casi di prova comuni

`tests/vectors/*.json` contiene casi `{ nome, descrizione, local, remote, now, atteso: { scrivi, stato } }`:

- `stato` = risultato atteso di `merge(local, remote, now)`;
- `scrivi` = se un client con `SCHEMA = 1` può scrivere quel risultato.

Ogni client deve superarli tutti; in Mochi li legge `tests/vectors.test.mjs`. Sono generati da `tools/build-vectors.mjs` e controllati a mano; non contengono dati personali.

| Caso | Cosa verifica |
|---|---|
| `01-chiave-sconosciuta-conservata` | mappa sconosciuta unita per elemento; chiave semplice senza `updatedAt` → vince il remoto |
| `02-campo-sconosciuto-conservato` | campi sconosciuti restano con l'elemento vincente |
| `03-parita-spareggio-by` | stesso `updatedAt` → vince `by` più alto |
| `04-parita-senza-by` | stesso `updatedAt`, niente `by` → vince il JSON ordinato più alto |
| `05-tombstone-piu-nuovo` | un'eliminazione più recente vince e resta |
| `06-tombstone-scaduto` | tombstone vincente più vecchio di 30 giorni → tolto |
| `07-schema-piu-nuovo` | `schema` 2 conservato, `scrivi: false` |
