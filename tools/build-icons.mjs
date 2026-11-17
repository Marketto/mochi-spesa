// Costruisce il font di icone "Mochi Icons" (fonts/mochi-icons.woff2 + css/icons.css).
// Base: Phosphor Icons (MIT, https://phosphoricons.com), peso "bold" arrotondato,
// più qualche variante "fill" e un glifo originale di Mochi (tools/custom/).
// Uso: npm install && npm run icons
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { SVGIcons2SVGFontStream } from "svgicons2svgfont";
import svg2ttf from "svg2ttf";
import wawoff2 from "wawoff2";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PH = path.join(root, "node_modules/@phosphor-icons/core/assets");

// nome nell'app → [file sorgente, perché]
const ICONS = {
  // azioni
  "add": ["bold/plus", "aggiungi"],
  "delete": ["bold/trash", "elimina"],
  "clean": ["bold/broom", "togli i presi"],
  "close": ["bold/x", "annulla / chiudi"],
  "ok": ["bold/check", "conferma"],
  "save": ["bold/floppy-disk", "salva"],
  "search": ["bold/magnifying-glass", "cerca offerte"],
  "list-add": ["bold/list-plus", "aggiungi alla lista"],
  "watch": ["bold/binoculars", "tieni d'occhio"],
  "unwatch": ["bold/eye-slash", "smetti di monitorare"],
  "calc": ["bold/calculator", "calcola"],
  "magic": ["bold/sparkle", "chiedi a Mochi"],
  "copy": ["bold/copy", "copia link"],
  "send-love": ["bold/paper-plane-tilt", "invia"],
  "connect": ["bold/plugs-connected", "collega"],
  "disconnect": ["bold/link-break", "scollega"],
  "external": ["bold/arrow-square-out", "apre un sito esterno"],
  "flyer": ["bold/newspaper", "volantino"],
  "refresh": ["bold/arrows-clockwise", "sincronizza ora"],
  "spinner": ["bold/circle-notch", "caricamento"],
  // navigazione (contorno + pieno quando selezionata)
  "tab-list": ["bold/list-checks", "lista"],
  "tab-list-on": ["fill/list-checks-fill", "lista attiva"],
  "tab-deals": ["bold/tag", "offerte"],
  "tab-deals-on": ["fill/tag-fill", "offerte attiva"],
  "tab-rate": ["bold/scales", "valuta"],
  "tab-rate-on": ["fill/scales-fill", "valuta attiva"],
  "tab-settings": ["bold/gear-six", "impostazioni"],
  "tab-settings-on": ["fill/gear-six-fill", "impostazioni attiva"],
  // stato e sezioni
  "cloud": ["bold/cloud", "dropbox"],
  "cloud-ok": ["bold/cloud-check", "sincronizzato"],
  "cloud-up": ["bold/cloud-arrow-up", "sincronizzo"],
  "cloud-off": ["bold/cloud-slash", "offline / errore"],
  "phone": ["bold/device-mobile", "solo su questo telefono"],
  "user": ["bold/user", "tu"],
  "pin": ["bold/map-pin", "zona"],
  "key": ["bold/key", "chiave"],
  "store": ["bold/storefront", "negozio"],
  "star": ["fill/star-fill", "ottima offerta"],
  "down": ["bold/trend-down", "più economico"],
  "warn": ["bold/warning-circle", "attenzione"],
  "info": ["bold/info", "informazione"],
  "heart": ["fill/heart-fill", "spuntato"],
  "heart-line": ["bold/heart", "cuore"],
  "basket": ["bold/basket", "lista vuota"],
  "percent": ["bold/seal-percent", "sconto"],
  // reparti
  "cat-clean": ["bold/drop", "detersivi e casa"],
  "cat-body": ["bold/hand-soap", "igiene persona"],
  "cat-veg": ["bold/carrot", "frutta e verdura"],
  "cat-dairy": ["bold/cheese", "latte, uova e formaggi"],
  "cat-meat": ["bold/fish", "carne e pesce"],
  "cat-bread": ["bold/bread", "pane e forno"],
  "cat-frozen": ["bold/snowflake", "surgelati"],
  "cat-drinks": ["bold/coffee", "bevande"],
  "cat-pantry": ["bold/cooking-pot", "dispensa"],
  "cat-other": ["bold/shopping-bag", "altro"],
  // lingue, privacy, wizard
  "lang": ["bold/translate", "lingua"],
  "privacy": ["bold/shield-check", "privacy"],
  "terms": ["bold/scroll", "condizioni d'uso"],
  "prev": ["bold/arrow-left", "indietro (si specchia in RTL)"],
  "next": ["bold/arrow-right", "avanti (si specchia in RTL)"],
  "gift": ["bold/gift", "novità"],
  "wave": ["bold/hand-waving", "benvenuto"],
  "party": ["bold/confetti", "si parte"],
  "coins": ["bold/coins", "valuta"],
  "install": ["bold/download-simple", "installa l'app"],
  "share-ios": ["bold/export", "condividi (iPhone)"],
  "mic": ["bold/microphone", "detta a voce"],
  "share": ["bold/share-network", "condividi l'app"],
  "mic-on": ["fill/microphone-fill", "sto ascoltando"],
  // glifo originale
  "mochi": ["custom/mochi", "Mochi"],
};

const src = name => name.startsWith("custom/")
  ? path.join(root, "tools", name + ".svg")
  : path.join(PH, name + (name.startsWith("bold/") ? "-bold" : "") + ".svg");

const START = 0xe001;
const entries = Object.entries(ICONS).map(([n, [file, desc]], i) => ({ n, file: src(file), desc, cp: START + i }));
for (const e of entries) if (!fs.existsSync(e.file)) throw new Error("Icona mancante: " + e.file);

// 1) SVG font
const svgFont = await new Promise((resolve, reject) => {
  const chunks = [];
  const fontStream = new SVGIcons2SVGFontStream({ fontName: "Mochi Icons", fontHeight: 1000, normalize: true, centerHorizontally: true, log: () => {} });
  fontStream.on("data", c => chunks.push(Buffer.from(c))).on("end", () => resolve(Buffer.concat(chunks).toString())).on("error", reject);
  for (const e of entries) {
    const g = Readable.from([fs.readFileSync(e.file)]);
    g.metadata = { name: e.n, unicode: [String.fromCodePoint(e.cp)] };
    fontStream.write(g);
  }
  fontStream.end();
});

// 2) TTF → WOFF2
const ttf = Buffer.from(svg2ttf(svgFont, { copyright: "Phosphor Icons (MIT) + Mochi Spesa (MIT)", description: "Mochi Icons" }).buffer);
const woff2 = Buffer.from(await wawoff2.compress(ttf));
fs.mkdirSync(path.join(root, "fonts"), { recursive: true });
fs.writeFileSync(path.join(root, "fonts/mochi-icons.woff2"), woff2);
const hash = (await import("node:crypto")).createHash("sha1").update(woff2).digest("hex").slice(0, 8);

// 3) CSS
const hex = cp => "\\" + cp.toString(16);
let css = `/* Mochi Icons — generato da tools/build-icons.mjs, non modificare a mano.
   Icone: Phosphor Icons (MIT) https://phosphoricons.com · glifo "mochi" originale (MIT).
   Uso: <i class="mi mi-add" aria-hidden="true"></i> sempre con un testo o un aria-label sul controllo. */
@font-face {
  font-family: "Mochi Icons";
  src: url("../fonts/mochi-icons.woff2?v=${hash}") format("woff2");
  font-weight: normal; font-style: normal; font-display: block;
}
.mi {
  font-family: "Mochi Icons" !important; font-style: normal; font-weight: normal; font-variant: normal;
  text-transform: none; line-height: 1; display: inline-block; vertical-align: -0.125em;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; speak: never;
}
`;
for (const e of entries) css += `.mi-${e.n}::before { content: "${hex(e.cp)}"; content: "${hex(e.cp)}" / ""; } /* ${e.desc} */\n`;
css += `:root {\n${entries.map(e => `  --mi-${e.n}: "${hex(e.cp)}";`).join("\n")}\n}\n`;
fs.writeFileSync(path.join(root, "css/icons.css"), css);

// 4) Anteprima
const prev = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mochi Icons</title><link rel="stylesheet" href="../css/icons.css"><style>
body{font-family:system-ui,sans-serif;background:#fff6fa;color:#45304f;margin:24px}h1{font-size:22px}
ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;list-style:none;padding:0}
li{background:#fff;border:2px solid #f3d3e2;border-radius:18px;padding:14px 8px;text-align:center;font-size:12px}
.mi{font-size:34px;color:#c2306b;display:block;margin:0 auto 8px}code{font-size:11px;color:#6f5a78}</style></head>
<body><h1>Mochi Icons · ${entries.length} icone</h1><p>Base: Phosphor Icons (MIT). Glifo “mochi” originale.</p><ul>
${entries.map(e => `<li><i class="mi mi-${e.n}" aria-hidden="true"></i>${e.desc}<br><code>mi-${e.n}</code></li>`).join("\n")}
</ul></body></html>`;
fs.writeFileSync(path.join(root, "fonts/anteprima.html"), prev);
console.log(`Mochi Icons: ${entries.length} icone, ${woff2.length} byte (woff2)`);
