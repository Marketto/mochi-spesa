// Mochi: la mascotte. Un coniglietto-mochi tondo con occhioni lucidi.
// SVG puro, nessuna immagine esterna. Le espressioni cambiano con una classe CSS.
import { list } from "./i18n.js";

export const MOCHI_SVG = `
<svg class="mochi" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="mBody" cx="45%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#fff4f7"/>
      <stop offset="100%" stop-color="#ffe1ea"/>
    </radialGradient>
    <radialGradient id="mEye" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#6b4a7a"/>
      <stop offset="65%" stop-color="#3a2546"/>
      <stop offset="100%" stop-color="#24152d"/>
    </radialGradient>
  </defs>
  <ellipse class="m-shadow" cx="100" cy="186" rx="52" ry="8" fill="#000" opacity=".08"/>
  <g class="m-all">
    <g class="m-ear m-ear-l">
      <path d="M62 78 C48 40 52 12 66 10 C80 9 86 40 84 74 Z" fill="url(#mBody)" stroke="#e8b7c8" stroke-width="3"/>
      <path d="M66 70 C58 44 60 24 67 22 C74 22 77 44 77 68 Z" fill="#ffc2d6"/>
    </g>
    <g class="m-ear m-ear-r">
      <path d="M138 78 C152 40 148 12 134 10 C120 9 114 40 116 74 Z" fill="url(#mBody)" stroke="#e8b7c8" stroke-width="3"/>
      <path d="M134 70 C142 44 140 24 133 22 C126 22 123 44 123 68 Z" fill="#ffc2d6"/>
    </g>
    <path class="m-body" d="M100 64 C150 64 178 100 176 138 C174 170 142 182 100 182 C58 182 26 170 24 138 C22 100 50 64 100 64 Z"
      fill="url(#mBody)" stroke="#e8b7c8" stroke-width="3"/>
    <!-- foglia sulla testa -->
    <g class="m-leaf">
      <path d="M100 66 C100 56 104 50 112 48 C112 56 108 62 100 66 Z" fill="#8fd6a8" stroke="#5fb07f" stroke-width="2"/>
      <path d="M100 66 C99 58 95 53 88 52 C89 59 93 63 100 66 Z" fill="#a9e3bd" stroke="#5fb07f" stroke-width="2"/>
    </g>
    <!-- guance -->
    <ellipse class="m-blush" cx="58" cy="134" rx="13" ry="8" fill="#ff9fbf" opacity=".55"/>
    <ellipse class="m-blush" cx="142" cy="134" rx="13" ry="8" fill="#ff9fbf" opacity=".55"/>
    <!-- occhi aperti -->
    <g class="m-eyes-open">
      <g class="m-eye">
        <ellipse cx="74" cy="114" rx="15" ry="19" fill="url(#mEye)"/>
        <ellipse cx="69" cy="105" rx="6" ry="7.5" fill="#fff"/>
        <circle cx="79" cy="122" r="3" fill="#fff" opacity=".9"/>
        <path d="M66 127 Q74 132 82 127" stroke="#c99be0" stroke-width="2.5" fill="none" opacity=".8"/>
      </g>
      <g class="m-eye">
        <ellipse cx="126" cy="114" rx="15" ry="19" fill="url(#mEye)"/>
        <ellipse cx="121" cy="105" rx="6" ry="7.5" fill="#fff"/>
        <circle cx="131" cy="122" r="3" fill="#fff" opacity=".9"/>
        <path d="M118 127 Q126 132 134 127" stroke="#c99be0" stroke-width="2.5" fill="none" opacity=".8"/>
      </g>
    </g>
    <!-- occhi felici ^ ^ -->
    <g class="m-eyes-happy" fill="none" stroke="#3a2546" stroke-width="5" stroke-linecap="round">
      <path d="M62 118 Q74 100 86 118"/>
      <path d="M114 118 Q126 100 138 118"/>
    </g>
    <!-- occhi assonnati -->
    <g class="m-eyes-sleepy" fill="none" stroke="#3a2546" stroke-width="5" stroke-linecap="round">
      <path d="M62 114 Q74 122 86 114"/>
      <path d="M114 114 Q126 122 138 114"/>
    </g>
    <!-- bocca ω -->
    <path class="m-mouth" d="M90 138 Q95 145 100 139 Q105 145 110 138" fill="none" stroke="#3a2546" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse class="m-mouth-wow" cx="100" cy="142" rx="6" ry="7" fill="#3a2546"/>
    <!-- zampette -->
    <ellipse cx="78" cy="176" rx="12" ry="7" fill="#fff" stroke="#e8b7c8" stroke-width="3"/>
    <ellipse cx="122" cy="176" rx="12" ry="7" fill="#fff" stroke="#e8b7c8" stroke-width="3"/>
  </g>
</svg>`;

// Frasi tradotte: chiavi "phr.<tipo>" nei file locales, separate da "|".
export const frase = tipo => { const a = list("phr." + tipo); return a[Math.floor(Math.random() * a.length)] || ""; };

/** Collega una mascotte già nel DOM. Restituisce i comandi per farla reagire. */
export function mountMochi(host, bubble) {
  host.innerHTML = MOCHI_SVG;
  const svg = host.querySelector("svg");
  let moodTimer, bubbleTimer;

  // Battito di ciglia ogni tanto (solo un gioco visivo)
  const blink = () => {
    svg.classList.add("blink");
    setTimeout(() => svg.classList.remove("blink"), 160);
    setTimeout(blink, 2500 + Math.random() * 3500);
  };
  setTimeout(blink, 1800);

  const mood = (m, ms = 1600) => {
    svg.classList.remove("happy", "wow", "sleepy", "jump");
    void svg.getBoundingClientRect(); // riavvia l'animazione
    if (m) svg.classList.add(m);
    if (m === "happy") svg.classList.add("jump");
    clearTimeout(moodTimer);
    if (ms) moodTimer = setTimeout(() => svg.classList.remove("happy", "wow", "jump"), ms);
  };

  const say = (text, ms = 2600) => {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), ms);
  };

  host.addEventListener("click", () => { mood("happy"); say(frase("ciao")); });
  return { mood, say };
}
