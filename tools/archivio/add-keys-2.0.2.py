#!/usr/bin/env python3
"""Chiavi 2.0.2: confronto con Amazon (link di ricerca e prezzi Amazon salvati)."""
import json, os
K = ["amz.search", "amz.searchName", "amz.mine", "new.amazon"]
T = {
"it": ["Confronta su Amazon","Cerca {name} su Amazon","tuo prezzo del {date}","Confronto con Amazon: un tocco apre il prodotto su Amazon, e i prezzi Amazon che salvi in «I miei prezzi» entrano nei confronti."],
"en": ["Compare on Amazon","Search {name} on Amazon","your price from {date}","Amazon comparison: one tap opens the product on Amazon, and Amazon prices you save in “My prices” join the comparisons."],
"es": ["Comparar en Amazon","Buscar {name} en Amazon","tu precio del {date}","Comparación con Amazon: un toque abre el producto en Amazon y los precios de Amazon que guardas en «Mis precios» entran en las comparaciones."],
"fr": ["Comparer sur Amazon","Chercher {name} sur Amazon","ton prix du {date}","Comparaison avec Amazon : un appui ouvre le produit sur Amazon, et les prix Amazon enregistrés dans « Mes prix » entrent dans les comparaisons."],
"de": ["Auf Amazon vergleichen","{name} auf Amazon suchen","dein Preis vom {date}","Vergleich mit Amazon: ein Tipp öffnet das Produkt auf Amazon, und Amazon-Preise in „Meine Preise“ fließen in die Vergleiche ein."],
"pt": ["Comparar na Amazon","Procurar {name} na Amazon","o teu preço de {date}","Comparação com a Amazon: um toque abre o produto na Amazon e os preços da Amazon guardados em «Os meus preços» entram nas comparações."],
"nl": ["Vergelijken op Amazon","{name} zoeken op Amazon","jouw prijs van {date}","Vergelijken met Amazon: één tik opent het product op Amazon, en Amazon-prijzen in „Mijn prijzen” tellen mee in vergelijkingen."],
"pl": ["Porównaj na Amazonie","Szukaj {name} na Amazonie","Twoja cena z {date}","Porównanie z Amazonem: jedno dotknięcie otwiera produkt na Amazonie, a ceny z Amazona zapisane w „Moich cenach” trafiają do porównań."],
"ro": ["Compară pe Amazon","Caută {name} pe Amazon","prețul tău din {date}","Comparație cu Amazon: o atingere deschide produsul pe Amazon, iar prețurile Amazon salvate în „Prețurile mele” intră în comparații."],
"cs": ["Porovnat na Amazonu","Hledat {name} na Amazonu","tvoje cena z {date}","Porovnání s Amazonem: jedno klepnutí otevře produkt na Amazonu a ceny z Amazonu uložené v „Moje ceny“ se započítají do porovnání."],
"sk": ["Porovnať na Amazone","Hľadať {name} na Amazone","tvoja cena z {date}","Porovnanie s Amazonom: jedno ťuknutie otvorí produkt na Amazone a ceny z Amazonu uložené v „Moje ceny“ sa započítajú do porovnaní."],
"sl": ["Primerjaj na Amazonu","Išči {name} na Amazonu","tvoja cena z dne {date}","Primerjava z Amazonom: en dotik odpre izdelek na Amazonu, cene z Amazona, shranjene v »Moje cene«, pa so vključene v primerjave."],
"hr": ["Usporedi na Amazonu","Traži {name} na Amazonu","tvoja cijena od {date}","Usporedba s Amazonom: jedan dodir otvara proizvod na Amazonu, a cijene s Amazona spremljene u „Moje cijene” ulaze u usporedbe."],
"hu": ["Összehasonlítás az Amazonon","{name} keresése az Amazonon","saját árad ({date})","Összehasonlítás az Amazonnal: egy koppintás megnyitja a terméket az Amazonon, a „Saját árak”-ba mentett Amazon-árak pedig bekerülnek az összehasonlításba."],
"bg": ["Сравни в Amazon","Търси {name} в Amazon","твоята цена от {date}","Сравнение с Amazon: едно докосване отваря продукта в Amazon, а цените от Amazon, запазени в „Моите цени“, влизат в сравненията."],
"el": ["Σύγκριση στο Amazon","Αναζήτηση {name} στο Amazon","η τιμή σου στις {date}","Σύγκριση με το Amazon: ένα άγγιγμα ανοίγει το προϊόν στο Amazon και οι τιμές Amazon που αποθηκεύεις στις «Τιμές μου» μπαίνουν στις συγκρίσεις."],
"sv": ["Jämför på Amazon","Sök {name} på Amazon","ditt pris från {date}","Jämförelse med Amazon: ett tryck öppnar produkten på Amazon, och Amazonpriser du sparar i ”Mina priser” räknas med i jämförelserna."],
"da": ["Sammenlign på Amazon","Søg {name} på Amazon","din pris fra {date}","Sammenligning med Amazon: ét tryk åbner produktet på Amazon, og Amazon-priser du gemmer i “Mine priser” indgår i sammenligningerne."],
"fi": ["Vertaa Amazonissa","Hae {name} Amazonista","oma hintasi {date}","Vertailu Amazoniin: yksi napautus avaa tuotteen Amazonissa, ja ”Omiin hintoihin” tallentamasi Amazon-hinnat ovat mukana vertailuissa."],
"et": ["Võrdle Amazonis","Otsi {name} Amazonist","sinu hind {date}","Võrdlus Amazoniga: üks puudutus avab toote Amazonis ja „Minu hindadesse” salvestatud Amazoni hinnad lähevad võrdlustesse."],
"lv": ["Salīdzināt Amazon","Meklēt {name} Amazon","tava cena no {date}","Salīdzināšana ar Amazon: viens pieskāriens atver produktu Amazon, un sadaļā “Manas cenas” saglabātās Amazon cenas iekļaujas salīdzinājumos."],
"lt": ["Palyginti Amazon","Ieškoti {name} Amazon","jūsų kaina iš {date}","Palyginimas su Amazon: vienas palietimas atidaro prekę Amazon, o „Mano kainose“ išsaugotos Amazon kainos įtraukiamos į palyginimus."],
"ga": ["Déan comparáid ar Amazon","Cuardaigh {name} ar Amazon","do phraghas ó {date}","Comparáid le Amazon: osclaíonn tapáil amháin an táirge ar Amazon, agus cuirtear praghsanna Amazon a shábhálann tú i “Mo phraghsanna” san áireamh sna comparáidí."],
"mt": ["Qabbel fuq Amazon","Fittex {name} fuq Amazon","il-prezz tiegħek tal-{date}","Tqabbil ma' Amazon: mess wieħed jiftaħ il-prodott fuq Amazon, u l-prezzijiet ta' Amazon li tissalva f'“Il-prezzijiet tiegħi” jidħlu fit-tqabbil."],
"ru": ["Сравнить на Amazon","Искать {name} на Amazon","твоя цена от {date}","Сравнение с Amazon: одно касание открывает товар на Amazon, а цены Amazon из «Моих цен» участвуют в сравнениях."],
"zh": ["在亚马逊比价","在亚马逊搜索 {name}","你在 {date} 记录的价格","与亚马逊比价：点一下即可在亚马逊打开商品，保存在「我的价格」中的亚马逊价格也会参与比较。"],
"ja": ["Amazon で比べる","Amazon で {name} を検索","{date} に保存した価格","Amazon と比較：タップで Amazon の商品を開けます。「マイ価格」に保存した Amazon の価格も比較に入ります。"],
"ko": ["아마존에서 비교","아마존에서 {name} 검색","{date}에 저장한 가격","아마존 비교: 한 번 탭하면 아마존에서 상품이 열리고, '내 가격'에 저장한 아마존 가격도 비교에 들어가요."],
"ar": ["قارن على أمازون","ابحث عن {name} على أمازون","سعرك بتاريخ {date}","مقارنة مع أمازون: لمسة واحدة تفتح المنتج على أمازون، وتدخل أسعار أمازون التي تحفظها في «أسعاري» في المقارنات."],
}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "locales")
assert len(T) == 29
for code, vals in T.items():
    assert len(vals) == len(K), code
    p = os.path.join(root, code + ".json"); d = json.load(open(p, encoding="utf-8")); d.update(dict(zip(K, vals)))
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2); open(p, "a").write("\n")
print("ok")
