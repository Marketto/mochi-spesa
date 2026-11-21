// Reparti automatici: riconosce il reparto dal nome del prodotto (parole italiane e inglesi).
// Il nome visibile del reparto è tradotto: chiave "cat.<id>" nei file locales.
// [id, icona, espressione]
export const CATS = [
  ["clean", "cat-clean", /detersiv|ammorbid|candeggin|sgrassat|anticalc|pastigli|lavastov|brillant|spugn|carta (igien|cucina|casa)|scottex|sacchett|pellicol|alluminio|ammoniac|alcol|\bwc\b|pavimenti|piatti|bucato|smacch|detergent|softener|bleach|dishwasher|sponge|toilet paper|kitchen roll|bin bag|laundry/i],
  ["body", "cat-body", /shampoo|bagnoschiuma|sapone|dentifric|spazzolin|deodorant|rasoi|assorbent|cotton|crema|balsamo|collutorio|soap|toothpaste|toothbrush|razor|conditioner|mouthwash|shower gel/i],
  ["veg", "cat-veg", /\bmel[ae]\b|\bpere\b|banan|aranc|limon|kiwi|\buva\b|frag|insalat|lattuga|pomodor|zucchin|patat|cipoll|aglio|carot|peperon|melanzan|spinac|verdur|frutta|finocch|broccol|cavol|zucc|funghi|basilic|prezzemol|apple|pear|orange|lemon|grape|strawberr|lettuce|salad|tomato|potato|onion|garlic|carrot|pepper|spinach|vegetable|fruit|mushroom/i],
  ["dairy", "cat-dairy", /latte|yogurt|yoghurt|burro|panna|\buov|formagg|mozzarell|parmigian|grana|ricott|stracchin|pecorin|mascarpon|milk|butter|cream|egg|cheese/i],
  ["meat", "cat-meat", /carne|pollo|tacchin|manzo|maiale|salsicc|hamburg|macinat|prosciutt|salame|bresaol|mortadell|wurstel|pesce|tonno|salmon|merluzz|gamber|vongol|cozze|meat|chicken|turkey|beef|pork|sausage|\bham\b|fish|tuna|\bcod\b|prawn|shrimp/i],
  ["bread", "cat-bread", /\bpane|panin|grissin|cracker|fette biscott|biscott|brioche|cornett|pizza|piadin|focacc|bread|\brolls?\b|biscuit|cookie|croissant/i],
  ["frozen", "cat-frozen", /surgel|gelat|bastoncin|congel|frozen|ice cream/i],
  ["drinks", "cat-drinks", /acqua|vino|birra|succo|aranciat|\bcoca|\btè\b|\bthe\b|caff[eè]|bibit|spremut|water|wine|beer|juice|coffee|\btea\b|soda/i],
  ["pantry", "cat-pantry", /pasta|spaghett|penne|\briso\b|farin|zucchero|\bsale\b|\bolio\b|aceto|passata|pelati|legum|ceci|fagiol|lenticch|cereali|marmellat|nutella|miele|sugo|brodo|lievito|spezie|\bpepe\b|\brice\b|flour|sugar|\bsalt\b|\boil\b|vinegar|beans|lentil|cereal|\bjam\b|honey|sauce|stock|yeast|spice/i],
];
export const OTHER = ["other", "cat-other"];
export const catOf = n => (CATS.find(c => c[2].test(n)) || OTHER)[0];
export const iconOf = id => (CATS.find(c => c[0] === id) || OTHER)[1];
export const ORDER = [...CATS.map(c => c[0]), OTHER[0]];

// Dati salvati dalla versione 1.0 (nomi italiani) → nuovi id
const LEGACY = {
  "Detersivi e casa": "clean", "Igiene persona": "body", "Frutta e verdura": "veg", "Latte, uova e formaggi": "dairy",
  "Carne e pesce": "meat", "Pane e forno": "bread", "Surgelati": "frozen", "Bevande": "drinks", "Dispensa": "pantry", "Altro": "other",
};
export const catId = c => (ORDER.includes(c) ? c : LEGACY[c] || "other");

/** "2 kg mele" → { nome: "mele", qta: "2 kg" } */
export function parseAdd(txt) {
  txt = txt.trim().replace(/\s+/g, " ");
  const m = txt.match(/^(\d+[.,]?\d*\s*(?:kg|g|gr|l|lt|ml|pz|pcs|x|confezion\w*|pacc\w*|bottigli\w*|pack\w*|bottle\w*)?)\s+(.+)$/i);
  return m ? { nome: m[2].trim(), qta: m[1].trim() } : { nome: txt, qta: "" };
}
// Converte solo i vecchi nomi della 1.0; valori sconosciuti (es. scritti da altri client) restano com'erano.
export const legacyCat = c => LEGACY[c] || c;
