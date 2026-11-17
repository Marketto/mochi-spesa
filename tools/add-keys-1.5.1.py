#!/usr/bin/env python3
"""Chiavi 1.5.1: verso di conteggio dei ripiani."""
import json, os
K = ["pantry.countLevels", "pantry.countTop", "pantry.countBottom", "new.lvdir"]
T = {
"it": ["Conta i ripiani", "Dall'alto", "Dal basso", "Nelle impostazioni scegli se contare i ripiani dall'alto o dal basso."],
"en": ["Count levels", "From the top", "From the bottom", "In settings, choose whether levels are counted from the top or the bottom."],
"es": ["Contar las baldas", "Desde arriba", "Desde abajo", "En ajustes eliges si las baldas se cuentan desde arriba o desde abajo."],
"fr": ["Compter les niveaux", "Depuis le haut", "Depuis le bas", "Dans les réglages, choisis de compter les niveaux depuis le haut ou le bas."],
"de": ["Fächer zählen", "Von oben", "Von unten", "In den Einstellungen wählst du, ob Fächer von oben oder unten gezählt werden."],
"pt": ["Contar prateleiras", "De cima", "De baixo", "Nas definições escolhes se as prateleiras se contam de cima ou de baixo."],
"nl": ["Planken tellen", "Van boven", "Van onder", "Kies in de instellingen of planken van boven of van onder worden geteld."],
"pl": ["Licz półki", "Od góry", "Od dołu", "W ustawieniach wybierz, czy półki liczyć od góry, czy od dołu."],
"ro": ["Numără polițele", "De sus", "De jos", "În setări alegi dacă polițele se numără de sus sau de jos."],
"cs": ["Počítat police", "Shora", "Zdola", "V nastavení zvolíš, zda se police počítají shora, nebo zdola."],
"sk": ["Počítať police", "Zhora", "Zdola", "V nastaveniach zvolíš, či sa police počítajú zhora alebo zdola."],
"sl": ["Štej police", "Od zgoraj", "Od spodaj", "V nastavitvah izbereš, ali se police štejejo od zgoraj ali od spodaj."],
"hr": ["Broji police", "Odozgo", "Odozdo", "U postavkama biraš broje li se police odozgo ili odozdo."],
"hu": ["Szintek számozása", "Felülről", "Alulról", "A beállításokban választhatod, hogy a szinteket felülről vagy alulról számozza."],
"bg": ["Броене на рафтовете", "Отгоре", "Отдолу", "В настройките избираш дали рафтовете се броят отгоре или отдолу."],
"el": ["Αρίθμηση ραφιών", "Από πάνω", "Από κάτω", "Στις ρυθμίσεις επιλέγεις αν τα ράφια μετρούν από πάνω ή από κάτω."],
"sv": ["Räkna hyllplan", "Uppifrån", "Nerifrån", "I inställningarna väljer du om hyllplan räknas uppifrån eller nerifrån."],
"da": ["Tæl hylder", "Oppefra", "Nedefra", "I indstillinger vælger du, om hylder tælles oppefra eller nedefra."],
"fi": ["Tasojen numerointi", "Ylhäältä", "Alhaalta", "Asetuksissa valitset, lasketaanko tasot ylhäältä vai alhaalta."],
"et": ["Tasandite loendus", "Ülevalt", "Alt", "Seadetes valid, kas tasandeid loetakse ülevalt või alt."],
"lv": ["Līmeņu skaitīšana", "No augšas", "No apakšas", "Iestatījumos izvēlies, vai līmeņus skaitīt no augšas vai no apakšas."],
"lt": ["Aukštų skaičiavimas", "Iš viršaus", "Iš apačios", "Nustatymuose pasirinkite, ar aukštus skaičiuoti iš viršaus, ar iš apačios."],
"ga": ["Comhair na leibhéil", "Ón mbarr", "Ón mbun", "Sna socruithe roghnaigh an gcomhairtear na leibhéil ón mbarr nó ón mbun."],
"mt": ["Għodd il-livelli", "Minn fuq", "Minn isfel", "Fl-issettjar tagħżel jekk il-livelli jingħaddu minn fuq jew minn isfel."],
"ru": ["Счёт полок", "Сверху", "Снизу", "В настройках выбери, считать полки сверху или снизу."],
"zh": ["层的编号", "从上往下", "从下往上", "可在设置中选择层从上往下还是从下往上编号。"],
"ja": ["段の数え方", "上から", "下から", "設定で段を上から数えるか下から数えるか選べます。"],
"ko": ["칸 번호 세기", "위에서부터", "아래에서부터", "설정에서 칸을 위에서부터 셀지 아래에서부터 셀지 고를 수 있어요."],
"ar": ["ترقيم الطبقات", "من الأعلى", "من الأسفل", "اختر في الإعدادات ترقيم الطبقات من الأعلى أو من الأسفل."],
}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "locales")
assert len(T) == 29
for code, vals in T.items():
    assert len(vals) == len(K), code
    p = os.path.join(root, code + ".json"); d = json.load(open(p, encoding="utf-8")); d.update(dict(zip(K, vals)))
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2); open(p, "a").write("\n")
print("ok", len(T))
