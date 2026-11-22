# Librerie servite dal sito (non da un CDN)

Così il codice eseguito è sempre quello verificato qui, anche se il CDN venisse compromesso.

| Cartella | Pacchetto npm | Versione | Licenza |
|---|---|---|---|
| `pdfjs/` | pdfjs-dist (`build/pdf.min.mjs`, `build/pdf.worker.min.mjs`) | 4.10.38 | Apache-2.0 |
| `tesseract/` | tesseract.js (`dist/tesseract.min.js`, `dist/worker.min.js`) | 7.0.0 | Apache-2.0 |

Restano da jsDelivr, a versione fissa, solo il motore OCR WebAssembly (`tesseract.js-core@7.0.0`) e i dati
delle lingue (`@tesseract.js-data`), troppo grandi per il repo.

Aggiornare: `npm pack <pacchetto>@<versione>`, estrarre e copiare gli stessi file.
