// Categorie automatiche: riconosce il reparto dal nome del prodotto.
export const CATS = [
  ["Detersivi e casa", "🫧", /detersiv|ammorbid|candeggin|sgrassat|anticalc|pastigli|lavastov|brillant|spugn|carta (igien|cucina|casa)|scottex|sacchett|pellicol|alluminio|ammoniac|alcol|wc|pavimenti|piatti|bucato|smacch/i],
  ["Igiene persona", "🧴", /shampoo|bagnoschiuma|sapone|dentifric|spazzolin|deodorant|rasoi|assorbent|cotton|crema|balsamo|collutorio/i],
  ["Frutta e verdura", "🍓", /mel[ae]\b|pere\b|banan|aranc|limon|kiwi|uva\b|frag|insalat|lattuga|pomodor|zucchin|patat|cipoll|aglio|carot|peperon|melanzan|spinac|verdur|frutta|finocch|broccol|cavol|zucc|funghi|basilic|prezzemol/i],
  ["Latte, uova e formaggi", "🥛", /latte|yogurt|burro|panna|uov|formagg|mozzarell|parmigian|grana|ricott|stracchin|pecorin|mascarpon/i],
  ["Carne e pesce", "🐟", /carne|pollo|tacchin|manzo|maiale|salsicc|hamburg|macinat|prosciutt|salame|bresaol|mortadell|wurstel|pesce|tonno|salmon|merluzz|gamber|vongol|cozze/i],
  ["Pane e forno", "🥐", /pane|panin|grissin|cracker|fette biscott|biscott|brioche|cornett|pizza|piadin|focacc/i],
  ["Surgelati", "🧊", /surgel|gelat|bastoncin|congel/i],
  ["Bevande", "🧃", /acqua|vino|birra|succo|aranciat|coca|\btè\b|\bthe\b|caff[eè]|bibit|spremut/i],
  ["Dispensa", "🍙", /pasta|spaghett|penne|riso|farin|zucchero|\bsale\b|olio|aceto|passata|pelati|legum|ceci|fagiol|lenticch|cereali|marmellat|nutella|miele|sugo|brodo|lievito|spezie|pepe/i],
];
export const ALTRO = ["Altro", "🛍️"];
export const catOf = n => (CATS.find(c => c[2].test(n)) || ALTRO)[0];
export const emojiOf = c => (CATS.find(x => x[0] === c) || ALTRO)[1];
export const ORDER = [...CATS.map(c => c[0]), ALTRO[0]];

/** "2 kg mele" → { nome: "mele", qta: "2 kg" } */
export function parseAdd(txt) {
  txt = txt.trim().replace(/\s+/g, " ");
  const m = txt.match(/^(\d+[.,]?\d*\s*(?:kg|g|gr|l|lt|ml|pz|x|confezion\w*|pacc\w*|bottigli\w*)?)\s+(.+)$/i);
  return m ? { nome: m[2].trim(), qta: m[1].trim() } : { nome: txt, qta: "" };
}
