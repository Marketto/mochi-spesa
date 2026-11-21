#!/usr/bin/env python3
"""Chiavi 2.1.1: ricerca prezzo migliore divisa per fonte."""
import json, os
K = ["best.partial", "best.also", "new.bestv2"]
T = {
"it": ["Alcune fonti non hanno risposto: {msg}","Sfoglia anche i volantini su {site}","«Trova il prezzo migliore» più preciso: cerca nei volantini delle catene vicine una per una, negli aggregatori di volantini, nella spesa online e su Amazon, e scarta i formati diversi (es. pastiglie se cerchi pod)."],
"en": ["Some sources didn't answer: {msg}","Also browse flyers on {site}","More precise “Find the best price”: it checks the flyers of nearby chains one by one, flyer aggregators, online grocery shops and Amazon, and drops other formats (e.g. tablets when you search pods)."],
"es": ["Algunas fuentes no respondieron: {msg}","Mira también los folletos en {site}","«Encuentra el mejor precio» más preciso: revisa los folletos de las cadenas cercanas una a una, agregadores de folletos, supermercados online y Amazon, y descarta otros formatos (p. ej. pastillas si buscas cápsulas)."],
"fr": ["Certaines sources n'ont pas répondu : {msg}","Feuillette aussi les prospectus sur {site}","« Trouver le meilleur prix » plus précis : il vérifie un par un les prospectus des enseignes proches, les agrégateurs de prospectus, les courses en ligne et Amazon, et écarte les autres formats (ex. pastilles si tu cherches des capsules)."],
"de": ["Einige Quellen haben nicht geantwortet: {msg}","Prospekte auch auf {site} ansehen","Genaueres „Besten Preis finden“: prüft die Prospekte der Ketten in der Nähe einzeln, Prospekt-Portale, Online-Supermärkte und Amazon und lässt andere Formate weg (z. B. Tabs, wenn du Pods suchst)."],
"pt": ["Algumas fontes não responderam: {msg}","Vê também os folhetos em {site}","«Encontrar o melhor preço» mais preciso: verifica um a um os folhetos das cadeias próximas, agregadores de folhetos, supermercados online e Amazon, e descarta outros formatos (ex. pastilhas se procuras cápsulas)."],
"nl": ["Sommige bronnen gaven geen antwoord: {msg}","Bekijk ook folders op {site}","Preciezer „Beste prijs vinden”: bekijkt de folders van ketens in de buurt één voor één, folderportalen, online supermarkten en Amazon, en laat andere vormen weg (bv. tabletten als je pods zoekt)."],
"pl": ["Niektóre źródła nie odpowiedziały: {msg}","Przejrzyj też gazetki na {site}","Dokładniejsze „Znajdź najlepszą cenę”: sprawdza po kolei gazetki pobliskich sieci, agregatory gazetek, sklepy online i Amazon oraz pomija inne formy (np. tabletki, gdy szukasz kapsułek)."],
"ro": ["Unele surse nu au răspuns: {msg}","Răsfoiește cataloagele și pe {site}","„Găsește cel mai bun preț” mai precis: verifică pe rând cataloagele lanțurilor din apropiere, agregatoarele de cataloage, cumpărăturile online și Amazon, și elimină alte formate (ex. tablete dacă cauți capsule)."],
"cs": ["Některé zdroje neodpověděly: {msg}","Prohlédni si letáky i na {site}","Přesnější „Najdi nejlepší cenu“: prochází letáky blízkých řetězců jeden po druhém, agregátory letáků, online nákupy a Amazon a vynechává jiné formy (např. tablety, když hledáš kapsle)."],
"sk": ["Niektoré zdroje neodpovedali: {msg}","Pozri si letáky aj na {site}","Presnejšie „Nájdi najlepšiu cenu“: prechádza letáky blízkych reťazcov jeden po druhom, agregátory letákov, online nákupy a Amazon a vynecháva iné formy (napr. tablety, keď hľadáš kapsuly)."],
"sl": ["Nekateri viri niso odgovorili: {msg}","Prelistaj letake tudi na {site}","Natančnejše »Najdi najboljšo ceno«: pregleda letake bližnjih verig enega za drugim, zbiralnike letakov, spletne trgovine in Amazon ter izloči druge oblike (npr. tablete, če iščeš kapsule)."],
"hr": ["Neki izvori nisu odgovorili: {msg}","Prelistaj kataloge i na {site}","Preciznije „Pronađi najbolju cijenu”: provjerava kataloge obližnjih lanaca jedan po jedan, agregatore kataloga, online kupnju i Amazon te izostavlja druge oblike (npr. tablete kad tražiš kapsule)."],
"hu": ["Néhány forrás nem válaszolt: {msg}","Lapozd át a szórólapokat itt is: {site}","Pontosabb „Legjobb ár keresése”: egyenként átnézi a közeli láncok szórólapjait, a szórólap-gyűjtőket, az online boltokat és az Amazont, és kihagyja a más kiszereléseket (pl. tablettát, ha kapszulát keresel)."],
"bg": ["Някои източници не отговориха: {msg}","Разгледай брошурите и в {site}","По-точно „Намери най-добрата цена“: проверява една по една брошурите на близките вериги, агрегаторите на брошури, онлайн магазините и Amazon и изключва други формати (напр. таблетки, ако търсиш капсули)."],
"el": ["Κάποιες πηγές δεν απάντησαν: {msg}","Δες φυλλάδια και στο {site}","Πιο ακριβές «Βρες την καλύτερη τιμή»: ελέγχει ένα-ένα τα φυλλάδια των κοντινών αλυσίδων, τους συλλέκτες φυλλαδίων, τα online σούπερ μάρκετ και το Amazon, και αφήνει έξω άλλες μορφές (π.χ. ταμπλέτες όταν ψάχνεις κάψουλες)."],
"sv": ["Vissa källor svarade inte: {msg}","Bläddra även bland reklamblad på {site}","Exaktare ”Hitta bästa priset”: går igenom närliggande kedjors reklamblad en i taget, reklambladsportaler, nätbutiker och Amazon, och tar bort andra format (t.ex. tabletter när du söker pods)."],
"da": ["Nogle kilder svarede ikke: {msg}","Se også tilbudsaviser på {site}","Mere præcis “Find den bedste pris”: gennemgår kæderne i nærheden én ad gangen, tilbudsavis-portaler, netbutikker og Amazon og fjerner andre formater (fx tabs når du søger pods)."],
"fi": ["Osa lähteistä ei vastannut: {msg}","Selaa mainoksia myös palvelussa {site}","Tarkempi ”Etsi paras hinta”: käy läpi lähiketjujen mainokset yksi kerrallaan, mainoskoosteet, verkkokaupat ja Amazonin ja jättää pois muut muodot (esim. tabletit, kun etsit kapseleita)."],
"et": ["Mõned allikad ei vastanud: {msg}","Vaata kampaanialehti ka siit: {site}","Täpsem „Leia parim hind”: vaatab läbi lähedal olevate kettide lehed ükshaaval, kampaanialehtede koondajad, e-poed ja Amazoni ning jätab välja muud vormid (nt tabletid, kui otsid kapsleid)."],
"lv": ["Daži avoti neatbildēja: {msg}","Šķirsti bukletus arī {site}","Precīzāka “Atrodi labāko cenu”: pa vienam pārbauda tuvējo tīklu bukletus, bukletu apkopotājus, interneta veikalus un Amazon un izslēdz citas formas (piem., tabletes, ja meklē kapsulas)."],
"lt": ["Kai kurie šaltiniai neatsakė: {msg}","Leidinius peržiūrėkite ir {site}","Tikslesnė „Rasti geriausią kainą“: po vieną peržiūri netoliese esančių tinklų leidinius, leidinių agregatorius, internetines parduotuves ir Amazon bei atmeta kitas formas (pvz., tabletes, kai ieškote kapsulių)."],
"ga": ["Níor fhreagair roinnt foinsí: {msg}","Brabhsáil bileoga ar {site} freisin","“Aimsigh an praghas is fearr” níos cruinne: seiceálann sé bileoga na slabhraí in aice láimhe ceann ar cheann, comhbhailitheoirí bileog, siopaí ar líne agus Amazon, agus fágann sé formáidí eile ar lár (m.sh. táibléid nuair a lorgaíonn tú pónairí)."],
"mt": ["Xi sorsi ma weġbux: {msg}","Ara l-fuljetti wkoll fuq {site}","“Sib l-aħjar prezz” aktar preċiż: jiċċekkja l-fuljetti tal-ktajjen fil-qrib wieħed wieħed, l-aggregaturi tal-fuljetti, ix-xiri online u Amazon, u jħalli barra formati oħra (eż. pilloli meta tfittex kapsuli)."],
"ru": ["Некоторые источники не ответили: {msg}","Посмотри буклеты и на {site}","Точнее «Найти лучшую цену»: по очереди проверяет буклеты ближайших сетей, агрегаторы буклетов, онлайн-магазины и Amazon и отбрасывает другие форматы (например, таблетки, если ищешь капсулы)."],
"zh": ["部分来源没有响应：{msg}","也可以在 {site} 浏览促销单","「找最低价」更精准：逐个查看附近连锁店的促销单、促销单聚合网站、网上超市和亚马逊，并排除其他形态（例如搜洗碗凝珠时不显示洗碗块）。"],
"ja": ["一部の情報源から応答がありません：{msg}","{site} でもチラシを見る","「最安値を探す」がより正確に：近くのチェーンのチラシを 1 つずつ、チラシまとめサイト、ネットスーパー、Amazon を調べ、別の形状（例：ポッドを探すときのタブレット）は除外します。"],
"ko": ["일부 출처가 응답하지 않았어요: {msg}","{site}에서도 전단지 보기","더 정확해진 '최저가 찾기': 근처 체인의 전단지를 하나씩, 전단지 모음 사이트, 온라인 마트, 아마존을 확인하고 다른 형태(예: 포드를 찾을 때 태블릿)는 빼요."],
"ar": ["بعض المصادر لم تستجب: {msg}","تصفّح النشرات أيضًا على {site}","«اعثر على أفضل سعر» أدق: يفحص نشرات السلاسل القريبة واحدة واحدة، ومجمّعات النشرات، والتسوق عبر الإنترنت وأمازون، ويستبعد الأشكال الأخرى (مثل الأقراص عند البحث عن الكبسولات)."],
}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "locales")
assert len(T) == 29
for code, vals in T.items():
    assert len(vals) == len(K), code
    p = os.path.join(root, code + ".json"); d = json.load(open(p, encoding="utf-8")); d.update(dict(zip(K, vals)))
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2); open(p, "a").write("\n")
print("ok")
