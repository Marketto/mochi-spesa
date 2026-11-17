// Dispensa: nomi, posti (luogo › scaffale › ripiano), quantità. Funzioni pure, testate in tests/pantry.test.mjs.

/** Nome normalizzato per i confronti: minuscolo, senza accenti né spazi doppi. */
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Stesso prodotto? Uguale, oppure uno contiene l'altro come parola intera (es. "latte" ~ "latte intero"). */
export function sameProduct(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [corto, lungo] = x.length <= y.length ? [x, y] : [y, x];
  if (corto.length < 4) return false;
  return new RegExp(`(^|\\s)${corto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(lungo);
}

/** Valore di un posto: "luogoId|scaffale|ripiano" (scaffale e ripiano possono essere vuoti). */
export const placeValue = (luogo, scaffale = "", ripiano = "") => [luogo, scaffale, ripiano].join("|");
export function parsePlace(v) {
  const [luogo = "credenza", scaffale = "", ripiano = ""] = String(v || "").split("|");
  return { luogo, scaffale, ripiano };
}

/** Luoghi ordinati (credenza per prima). */
export const sortedPlaces = luoghi => Object.values(luoghi || {}).filter(l => !l.deleted)
  .sort((a, b) => (b.base ? 1 : 0) - (a.base ? 1 : 0) || (a.ordine ?? 9) - (b.ordine ?? 9) || String(a.nome).localeCompare(String(b.nome)));

/** Opzioni per una select: ogni luogo, ogni scaffale, ogni ripiano. nameOf(luogo) dà il nome visibile. */
export function placeOptions(luoghi, nameOf) {
  const out = [];
  for (const l of sortedPlaces(luoghi)) {
    const n = nameOf(l);
    out.push({ value: placeValue(l.id), label: n });
    for (const sc of l.scaffali || []) {
      out.push({ value: placeValue(l.id, sc.nome), label: `${n} › ${sc.nome}` });
      for (const r of sc.ripiani || []) out.push({ value: placeValue(l.id, sc.nome, r), label: `${n} › ${sc.nome} › ${r}` });
    }
  }
  return out;
}

/** Testo leggibile del posto di un prodotto in dispensa. */
export function placeLabel(it, luoghi, nameOf) {
  const l = (luoghi || {})[it.luogo];
  return [l ? nameOf(l) : "", it.scaffale, it.ripiano].filter(Boolean).join(" › ");
}

/** Scaffali da testo: una riga per scaffale, "Nome scaffale: ripiano, ripiano". */
export function parseShelves(text) {
  return String(text || "").split("\n").map(r => r.trim()).filter(Boolean).map(r => {
    const i = r.indexOf(":");
    const nome = (i < 0 ? r : r.slice(0, i)).trim();
    const ripiani = i < 0 ? [] : r.slice(i + 1).split(/[,;]/).map(x => x.trim()).filter(Boolean);
    return { nome, ripiani };
  }).filter(s => s.nome);
}
export const shelvesToText = scaffali => (scaffali || []).map(s => s.ripiani && s.ripiani.length ? `${s.nome}: ${s.ripiani.join(", ")}` : s.nome).join("\n");

/** Somma quantità compatibili: "2" + "3" = "5", "1 kg" + "0,5 kg" = "1,5 kg"; altrimenti tiene la nuova. */
export function addQty(a, b) {
  const re = /^\s*(\d+(?:[.,]\d+)?)\s*([^\d\s].*)?$/;
  const x = String(a || "").match(re), y = String(b || "").match(re);
  if (!a) return b || ""; if (!b) return a;
  if (x && y && (x[2] || "").trim() === (y[2] || "").trim()) {
    const n = parseFloat(x[1].replace(",", ".")) + parseFloat(y[1].replace(",", "."));
    const sep = /,/.test(x[1] + y[1]) ? "," : ".";
    return `${String(Math.round(n * 100) / 100).replace(".", sep)}${x[2] ? " " + x[2].trim() : ""}`;
  }
  return b;
}

/** Cambia la quantità di delta (+1/-1) mantenendo l'unità: "2 kg" → "3 kg"; vuoto → "1". */
export function stepQty(q, delta) {
  const m = String(q || "").match(/^\s*(\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return delta > 0 ? (q ? `2 ${q}`.trim() : "2") : q;
  const n = Math.max(1, parseFloat(m[1].replace(",", ".")) + delta);
  return `${String(n).replace(".", m[1].includes(",") ? "," : ".")}${m[2]}`;
}
