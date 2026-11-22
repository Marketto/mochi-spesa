// Blocca commit e pubblicazione se nei file tracciati finiscono dati sensibili.
// Repo pubblico: l'unica identità ammessa è Marketto con indirizzo noreply di GitHub.
import fs from "node:fs";
import { execSync } from "node:child_process";

let files;
try { files = execSync("git ls-files -co --exclude-standard", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n"); }
catch { files = execSync("find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './_site/*'", { encoding: "utf8" }).split("\n").map(f => f.replace(/^\.\//, "")); }
files = files.filter(f => f && !f.startsWith("vendor/") && !f.startsWith("node_modules/") && !/package-lock\.json$/.test(f)
  && !/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|pdf|mp[34]|zip)$/i.test(f) && !f.endsWith("privacy-check.mjs"));

const RULES = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "chiave API Anthropic"],
  [/\b(sk-or-|sk-proj-|gsk_)[A-Za-z0-9_-]{20,}/, "chiave API IA"],
  [/\bsl\.[A-Za-z0-9_-]{40,}/, "token Dropbox"],
  [/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i, "indirizzo di un ponte Cloudflare personale"],
  [/\b(ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/, "token GitHub"],
  [/AIza[0-9A-Za-z_-]{30,}/, "chiave Google"],
  [/\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/, "IBAN"],
  [/\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/, "codice fiscale"],
  [/(?<![:/\w.%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/, "email"], // non «utente:password@sito» negli URL
  [/"(access|refresh)_token"\s*:\s*"[^"]{20,}/, "token"],
];
const ALLOW_EMAIL = /@users\.noreply\.github\.com$|^noreply@anthropic\.com$|@example\.(com|org)$/i;

let bad = 0;
for (const f of files) {
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue;
  const txt = fs.readFileSync(f, "utf8");
  for (const [re, what] of RULES) {
    const hits = (txt.match(new RegExp(re, "g")) || []).filter(x => !(what === "email" && ALLOW_EMAIL.test(x)));
    if (hits.length) { bad++; console.log(`${f}: ${what} → ${hits[0].slice(0, 10)}…`); }
  }
  if (/^\.env/.test(f.split("/").pop())) { bad++; console.log(`${f}: file .env da non pubblicare`); }
}
console.log(bad ? "Dati sensibili trovati!" : "Privacy OK");
process.exit(bad ? 1 : 0);
