// Posizione: permesso del browser, distanza da casa, indirizzi ↔ coordinate con OpenStreetMap (Nominatim).
// Nessun server nostro. Le coordinate sono arrotondate a ~1 km.

export const AWAY_KM = 40;
const round = n => Math.round(n * 100) / 100;

/** Distanza in km tra due punti (formula dell'emisenoverso). */
export function distKm(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Stato del permesso senza chiederlo: "granted" | "prompt" | "denied" | "unknown". */
export async function permission() {
  try { return (await navigator.permissions.query({ name: "geolocation" })).state; } catch { return "unknown"; }
}

/** Posizione attuale (chiede il permesso se serve). */
export function here({ timeout = 15000 } = {}) {
  return new Promise((res, rej) => {
    if (!("geolocation" in navigator)) return rej(Object.assign(new Error("nogeo"), { code: 2 }));
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: round(p.coords.latitude), lon: round(p.coords.longitude) }),
      rej, { enableHighAccuracy: false, timeout, maximumAge: 10 * 60 * 1000 });
  });
}

const NOMINATIM = "https://nominatim.openstreetmap.org";
let last = 0;
async function osm(path, lang) {
  const wait = 1100 - (Date.now() - last); // massimo 1 richiesta al secondo (regole di Nominatim)
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  last = Date.now();
  const r = await fetch(`${NOMINATIM}${path}&format=jsonv2&accept-language=${encodeURIComponent(lang || "en")}`);
  if (!r.ok) throw new Error("osm " + r.status);
  return r.json();
}

/** Indirizzo → { lat, lon, nome } oppure null. */
export async function geocode(q, lang) {
  try {
    const j = await osm(`/search?q=${encodeURIComponent(q)}&limit=1`, lang);
    if (!j[0]) return null;
    return { lat: round(+j[0].lat), lon: round(+j[0].lon), nome: j[0].display_name };
  } catch { return null; }
}

/** Coordinate → nome breve del luogo (es. "Borgo San Paolo, Torino") oppure null. */
export async function placeName({ lat, lon }, lang) {
  try {
    const j = await osm(`/reverse?lat=${lat}&lon=${lon}&zoom=14`, lang);
    const a = j.address || {};
    const parts = [a.suburb || a.neighbourhood || a.village || a.town, a.city || a.town || a.village || a.county].filter(Boolean);
    return [...new Set(parts)].join(", ") || j.display_name || null;
  } catch { return null; }
}
