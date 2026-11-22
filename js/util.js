// Piccole funzioni comuni a più moduli.

/** Hash djb2 breve e stabile (base 36), per id ricavati da testi o indirizzi. */
export function hash(s) {
  let h = 5381;
  for (const c of String(s)) h = (h * 33 + c.codePointAt(0)) >>> 0;
  return h.toString(36);
}
