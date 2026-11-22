#!/usr/bin/env python3
"""Copia i font dal pacchetto npm @fontsource nel sito (fonts/) e scrive css/fonts.css.
Così i font non arrivano da Google (niente IP a terzi) e funzionano offline.

Uso: npm pack @fontsource/m-plus-rounded-1c @fontsource/baloo-bhaijaan-2 in una cartella, estrai,
     poi: python3 tools/build-fonts.py <cartella con i pacchetti estratti>
"""
import glob, os, re, shutil, sys

src = sys.argv[1]
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FONTS = [  # (pacchetto, sottoinsiemi, pesi)
    ("m-plus-rounded-1c", ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek", "greek-ext", "vietnamese"], [400, 500, 700, 800]),
    ("baloo-bhaijaan-2", ["arabic", "latin"], [400, 600, 800]),
]
out = ["/* Generato da tools/build-fonts.py (font @fontsource, licenza SIL OFL 1.1) */"]
for pkg, subsets, weights in FONTS:
    base = glob.glob(os.path.join(src, f"fontsource-{pkg}-*", "package"))[0]
    for w in weights:
        css = open(os.path.join(base, f"{w}.css"), encoding="utf-8").read()
        for name, rule in re.findall(r"/\* ([\w\[\]-]+) \*/\s*(@font-face\s*{[^}]*})", css):
            subset = name[len(pkg) + 1:-len(f"-{w}-normal")]  # es. "latin-ext"; i blocchi CJK sono "[0]", "[1]", …
            if subset not in subsets: continue
            f = f"{pkg}-{subset}-{w}-normal.woff2"
            shutil.copy(os.path.join(base, "files", f), os.path.join(root, "fonts", f))
            rule = re.sub(r"src:[^;]*;", f"src: url(../fonts/{f}) format('woff2');", rule)
            out.append(rule)
open(os.path.join(root, "css", "fonts.css"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("ok", len(out) - 1, "font-face")
