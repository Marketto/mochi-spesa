#!/usr/bin/env python3
"""Aggiunge o aggiorna testi in tutte le lingue.

Uso:  python3 tools/add-keys.py testi.json
testi.json: { "chiave.nome": { "it": "…", "en": "…", … tutte le lingue di locales/ … }, … }
Si ferma se manca una lingua o un segnaposto {x} non coincide con l'italiano.
"""
import json, os, re, sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "locales")
langs = sorted(f[:-5] for f in os.listdir(root) if f.endswith(".json"))
data = json.load(open(sys.argv[1], encoding="utf-8"))
ph = lambda s: sorted(re.findall(r"\{(\w+)\}", s))
for key, tr in data.items():
    missing = [l for l in langs if l not in tr]
    if missing: sys.exit(f"{key}: mancano {' '.join(missing)}")
    for l in langs:
        if ph(tr[l]) != ph(tr["it"]): sys.exit(f"{key} [{l}]: segnaposto diversi dall'italiano")
for l in langs:
    p = os.path.join(root, l + ".json"); d = json.load(open(p, encoding="utf-8"))
    d.update({k: tr[l] for k, tr in data.items()})
    with open(p, "w", encoding="utf-8") as f: json.dump(d, f, ensure_ascii=False, indent=2); f.write("\n")
print(f"ok: {len(data)} chiavi in {len(langs)} lingue")
