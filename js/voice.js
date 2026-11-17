// Dettatura vocale gratuita con il riconoscimento del browser (Web Speech API).
// Chrome usa il servizio vocale di Google; Safari quello di Apple. Firefox non lo supporta.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const supported = () => !!SR;

// Congiunzioni da trasformare in virgole: "latte, pane e uova" → "latte, pane, uova"
const AND = {
  it: ["e", "ed", "poi"], en: ["and", "then"], es: ["y", "e"], fr: ["et", "puis"], de: ["und", "dann"], pt: ["e"],
  nl: ["en"], pl: ["i", "oraz"], ro: ["și", "si"], cs: ["a"], sk: ["a"], sl: ["in"], hr: ["i"], hu: ["és", "meg"],
  bg: ["и"], el: ["και"], sv: ["och"], da: ["og"], fi: ["ja"], et: ["ja"], lv: ["un"], lt: ["ir"], ga: ["agus"],
  mt: ["u"], ru: ["и"], ar: ["و"], zh: ["和", "还有"], ja: ["と"], ko: ["그리고"],
};
export function toList(text, lang) {
  let t = " " + text.trim() + " ";
  for (const w of AND[lang] || []) {
    const cjk = /[぀-ヿ一-鿿]/.test(w);
    t = t.replace(cjk ? new RegExp(w, "g") : new RegExp(`\\s${w}\\s`, "giu"), ", ");
  }
  if (lang === "ar") t = t.replace(/\sو(?=\S)/g, ", "); // "و" attaccata alla parola successiva
  return t.split(/\s*[,;、，]\s*/).map(s => s.trim()).filter(Boolean).join(", ");
}

/** Avvia l'ascolto. onText(testoParziale, finale) a ogni risultato; restituisce stop(). */
export function listen(locale, { onText, onEnd, onError }) {
  const r = new SR();
  r.lang = locale; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let finale = "";
  r.onresult = e => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) finale += (finale ? " " : "") + txt; else interim += txt;
    }
    onText((finale + " " + interim).trim(), false);
  };
  r.onerror = e => onError && onError(e.error);
  r.onend = () => { onText(finale.trim(), true); onEnd && onEnd(); };
  r.start();
  return () => { try { r.stop(); } catch {} };
}
