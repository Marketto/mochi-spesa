// Sincronizzazione con Dropbox, direttamente dal browser (OAuth PKCE, nessun server).
// I token restano solo in questo dispositivo (localStorage).
import { t } from "./i18n.js";

const LS = "mochi.dropbox";
const read = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const write = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };

export const redirectUri = () => location.origin + location.pathname;
export const isConnected = () => !!read().refresh_token;
export const disconnect = () => { const d = read(); delete d.refresh_token; delete d.access_token; delete d.exp; write(d); };

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function startAuth(appKey) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem("mochi.pkce", JSON.stringify({ verifier, state, appKey }));
  const u = new URL("https://www.dropbox.com/oauth2/authorize");
  Object.entries({
    client_id: appKey, response_type: "code", code_challenge: challenge, code_challenge_method: "S256",
    token_access_type: "offline", redirect_uri: redirectUri(), state,
    scope: "files.metadata.read files.content.read files.content.write",
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  location.assign(u.toString());
}

/** Se l'URL contiene ?code=…, completa l'accesso. Restituisce true se ha collegato Dropbox. */
export async function handleRedirect() {
  const p = new URLSearchParams(location.search);
  const code = p.get("code"), state = p.get("state");
  if (!code && !p.get("error")) return false;
  history.replaceState(null, "", redirectUri() + location.hash);
  if (!code) throw new Error(t("dbx.cancelled"));
  let saved; try { saved = JSON.parse(sessionStorage.getItem("mochi.pkce")); } catch {}
  sessionStorage.removeItem("mochi.pkce");
  if (!saved || saved.state !== state) throw new Error(t("dbx.invalid"));
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    body: new URLSearchParams({ code, grant_type: "authorization_code", code_verifier: saved.verifier, client_id: saved.appKey, redirect_uri: redirectUri() }),
  });
  if (!r.ok) throw new Error(t("dbx.rejected"));
  const j = await r.json(); // non "t": coprirebbe la funzione di traduzione usata sopra
  write({ ...read(), appKey: saved.appKey, refresh_token: j.refresh_token, access_token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 });
  return true;
}

async function token() {
  const d = read();
  if (!d.refresh_token) throw Object.assign(new Error(t("sync.local")), { code: "auth" });
  if (d.access_token && d.exp > Date.now()) return d.access_token;
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: d.refresh_token, client_id: d.appKey }),
  });
  if (r.status === 400 || r.status === 401) { disconnect(); throw Object.assign(new Error(t("sync.reconnect")), { code: "auth" }); }
  if (!r.ok) throw new Error(t("sync.retry"));
  const j = await r.json();
  write({ ...d, access_token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 });
  return j.access_token;
}

// L'header Dropbox-API-Arg accetta solo ASCII: i caratteri accentati vanno in \uXXXX.
const apiArg = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

/** Scarica il file. Restituisce { data, rev } oppure null se non esiste ancora. */
export async function download(path) {
  const r = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST", headers: { Authorization: "Bearer " + await token(), "Dropbox-API-Arg": apiArg({ path }) },
  });
  if (r.status === 409) return null;
  if (r.status === 401) { disconnect(); throw Object.assign(new Error(t("sync.reconnect")), { code: "auth" }); }
  if (!r.ok) throw new Error(t("sync.retry"));
  const meta = JSON.parse(r.headers.get("Dropbox-API-Result") || "{}");
  let data = null; try { data = JSON.parse(await r.text()); } catch {}
  return { data, rev: meta.rev };
}

/** Carica il file. Con rev fa un aggiornamento "sicuro": se nel frattempo è cambiato, lancia code=conflict. */
export async function upload(path, data, rev) {
  const r = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + await token(), "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": apiArg({ path, mode: rev ? { ".tag": "update", update: rev } : "add", autorename: false, mute: true }),
    },
    body: JSON.stringify(data),
  });
  if (r.status === 409) throw Object.assign(new Error("conflict"), { code: "conflict" });
  if (!r.ok) throw new Error(t("sync.retry"));
  return (await r.json()).rev;
}
