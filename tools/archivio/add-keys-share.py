#!/usr/bin/env python3
"""Chiavi 1.2.1: condivisione dell'app e indicazione della versione."""
import json, os
K = ["share.btn", "share.title", "share.text", "share.copied", "new.share", "new.version"]
T = {
"en": ["Share the app", "Mochi Spesa", "A shared, super cute shopping list with Mochi finding deals for you!", "App link copied", "Share the app with friends and family in one tap.", "The version is always visible next to the title: tap it to see what's new."],
"it": ["Condividi l'app", "Mochi Spesa", "La lista della spesa condivisa e carinissima, con Mochi che cerca le offerte!", "Link dell'app copiato", "Condividi l'app con amici e parenti in un tocco.", "La versione è sempre visibile accanto al titolo: toccala per vedere le novità."],
"es": ["Compartir la app", "Mochi Spesa", "¡La lista de la compra compartida y monísima, con Mochi buscando ofertas!", "Enlace de la app copiado", "Comparte la app con amigos y familia en un toque.", "La versión está siempre junto al título: tócala para ver las novedades."],
"fr": ["Partager l'app", "Mochi Spesa", "La liste de courses partagée et trop mignonne, avec Mochi qui cherche les promos !", "Lien de l'app copié", "Partage l'app avec tes proches en une touche.", "La version est toujours visible à côté du titre : touche-la pour voir les nouveautés."],
"de": ["App teilen", "Mochi Spesa", "Die geteilte, superniedliche Einkaufsliste – Mochi sucht die Angebote!", "App-Link kopiert", "Teile die App mit einem Tipp mit Freunden und Familie.", "Die Version steht immer neben dem Titel: Tippe darauf für die Neuigkeiten."],
"pt": ["Partilhar a app", "Mochi Spesa", "A lista de compras partilhada e fofinha, com a Mochi a procurar promoções!", "Link da app copiado", "Partilha a app com amigos e família num toque.", "A versão está sempre ao lado do título: toca nela para ver as novidades."],
"nl": ["App delen", "Mochi Spesa", "De gedeelde, superschattige boodschappenlijst, met Mochi die aanbiedingen zoekt!", "App-link gekopieerd", "Deel de app met één tik met vrienden en familie.", "De versie staat altijd naast de titel: tik erop voor het nieuws."],
"pl": ["Udostępnij aplikację", "Mochi Spesa", "Wspólna, przeurocza lista zakupów, a Mochi szuka promocji!", "Skopiowano link do aplikacji", "Udostępnij aplikację znajomym i rodzinie jednym dotknięciem.", "Wersja jest zawsze widoczna obok tytułu: dotknij jej, aby zobaczyć nowości."],
"ro": ["Distribuie aplicația", "Mochi Spesa", "Lista de cumpărături comună și super drăguță, cu Mochi care caută oferte!", "Linkul aplicației a fost copiat", "Distribuie aplicația prietenilor și familiei dintr-o atingere.", "Versiunea e mereu vizibilă lângă titlu: atinge-o ca să vezi noutățile."],
"cs": ["Sdílet aplikaci", "Mochi Spesa", "Sdílený a roztomilý nákupní seznam, kde Mochi hledá akce!", "Odkaz na aplikaci zkopírován", "Sdílej aplikaci s přáteli a rodinou jedním klepnutím.", "Verze je vždy vidět vedle názvu: klepni na ni a uvidíš novinky."],
"sk": ["Zdieľať aplikáciu", "Mochi Spesa", "Zdieľaný a rozkošný nákupný zoznam, kde Mochi hľadá akcie!", "Odkaz na aplikáciu skopírovaný", "Zdieľaj aplikáciu s priateľmi a rodinou jedným ťuknutím.", "Verzia je vždy viditeľná vedľa názvu: ťukni na ňu a uvidíš novinky."],
"sl": ["Deli aplikacijo", "Mochi Spesa", "Skupni, prisrčni nakupovalni seznam, kjer Mochi išče akcije!", "Povezava do aplikacije kopirana", "Deli aplikacijo s prijatelji in družino z enim tapom.", "Različica je vedno vidna ob naslovu: tapni jo za novosti."],
"hr": ["Podijeli aplikaciju", "Mochi Spesa", "Zajednički i preslatki popis za kupovinu, a Mochi traži akcije!", "Poveznica na aplikaciju kopirana", "Podijeli aplikaciju s prijateljima i obitelji jednim dodirom.", "Verzija je uvijek vidljiva pored naslova: dodirni je za novosti."],
"hu": ["App megosztása", "Mochi Spesa", "Közös, szuper cuki bevásárlólista, Mochi pedig akciókat keres!", "Az app linkje másolva", "Oszd meg az appot barátokkal és családdal egy koppintással.", "A verzió mindig látszik a cím mellett: koppints rá az újdonságokért."],
"bg": ["Сподели приложението", "Mochi Spesa", "Общ и много сладък списък за пазаруване, а Мочи търси промоции!", "Линкът към приложението е копиран", "Сподели приложението с приятели и семейство с едно докосване.", "Версията винаги се вижда до заглавието: докосни я за новостите."],
"el": ["Κοινοποίηση εφαρμογής", "Mochi Spesa", "Η κοινή, πανέμορφη λίστα για ψώνια, με τη Μότσι να ψάχνει προσφορές!", "Ο σύνδεσμος αντιγράφηκε", "Μοιράσου την εφαρμογή με φίλους και οικογένεια με ένα πάτημα.", "Η έκδοση φαίνεται πάντα δίπλα στον τίτλο: πάτησέ την για τα νέα."],
"sv": ["Dela appen", "Mochi Spesa", "Den delade, supersöta inköpslistan där Mochi letar erbjudanden!", "Applänken kopierad", "Dela appen med vänner och familj med ett tryck.", "Versionen syns alltid bredvid titeln: tryck på den för nyheterna."],
"da": ["Del appen", "Mochi Spesa", "Den delte, supersøde indkøbsliste, hvor Mochi finder tilbud!", "Applink kopieret", "Del appen med venner og familie med ét tryk.", "Versionen ses altid ved siden af titlen: tryk på den for nyheder."],
"fi": ["Jaa sovellus", "Mochi Spesa", "Jaettu ja suloinen ostoslista – Mochi etsii tarjoukset!", "Sovelluksen linkki kopioitu", "Jaa sovellus ystäville ja perheelle yhdellä napautuksella.", "Versio näkyy aina otsikon vieressä: napauta sitä nähdäksesi uutuudet."],
"et": ["Jaga rakendust", "Mochi Spesa", "Jagatud ja väga armas ostunimekiri, kus Mochi otsib pakkumisi!", "Rakenduse link kopeeritud", "Jaga rakendust sõprade ja perega ühe puudutusega.", "Versioon on alati pealkirja kõrval: puuduta seda uudiste nägemiseks."],
"lv": ["Kopīgot lietotni", "Mochi Spesa", "Kopīgs un ļoti mīlīgs iepirkumu saraksts – Moči meklē akcijas!", "Lietotnes saite nokopēta", "Kopīgo lietotni ar draugiem un ģimeni ar vienu pieskārienu.", "Versija vienmēr redzama blakus nosaukumam: pieskaries, lai redzētu jaunumus."],
"lt": ["Bendrinti programėlę", "Mochi Spesa", "Bendras ir labai mielas pirkinių sąrašas – Moči ieško akcijų!", "Programėlės nuoroda nukopijuota", "Bendrinkite programėlę su draugais ir šeima vienu palietimu.", "Versija visada matoma šalia pavadinimo: palieskite ir pamatysite naujienas."],
"ga": ["Roinn an aip", "Mochi Spesa", "Liosta siopadóireachta roinnte gleoite, agus Mochi ag lorg tairiscintí!", "Nasc na haipe cóipeáilte", "Roinn an aip le cairde agus teaghlach le tapáil amháin.", "Bíonn an leagan le feiceáil i gcónaí in aice leis an teideal: tapáil é don nuacht."],
"mt": ["Aqsam l-app", "Mochi Spesa", "Il-lista tax-xiri maqsuma u ħelwa ħafna, b'Mochi jfittex l-offerti!", "Il-link tal-app ikkupjat", "Aqsam l-app mal-ħbieb u l-familja b'għafsa waħda.", "Il-verżjoni dejjem tidher ħdejn it-titlu: agħfasha biex tara x'hemm ġdid."],
"ru": ["Поделиться приложением", "Mochi Spesa", "Общий и очень милый список покупок, а Моти ищет акции!", "Ссылка на приложение скопирована", "Делись приложением с друзьями и семьёй одним касанием.", "Версия всегда видна рядом с названием: нажми, чтобы увидеть новинки."],
"zh": ["分享应用", "Mochi Spesa", "超可爱的共享购物清单，麻糬还会帮你找优惠！", "已复制应用链接", "一点即可把应用分享给亲友。", "版本号始终显示在标题旁：点一下即可查看新功能。"],
"ja": ["アプリをシェア", "Mochi Spesa", "みんなで使えるかわいいお買い物リスト。もちっ子がセールをさがすよ！", "アプリのリンクをコピーしました", "ワンタップで友だちや家族にアプリをシェア。", "バージョンはタイトルの横にいつも表示。タップすると新機能が見られます。"],
"ko": ["앱 공유", "Mochi Spesa", "함께 쓰는 귀여운 장보기 목록, 모찌가 할인을 찾아 줘요!", "앱 링크를 복사했어요", "탭 한 번으로 친구와 가족에게 앱 공유.", "버전이 항상 제목 옆에 보여요: 누르면 새 기능을 볼 수 있어요."],
"ar": ["شارك التطبيق", "Mochi Spesa", "قائمة تسوق مشتركة ولطيفة جدًا، وموتشي يبحث عن العروض!", "تم نسخ رابط التطبيق", "شارك التطبيق مع الأصدقاء والعائلة بنقرة واحدة.", "يظهر الإصدار دائمًا بجانب العنوان: انقر عليه لرؤية الجديد."],
}
root = os.path.join(os.path.dirname(__file__), "..", "locales")
for code, vals in T.items():
    assert len(vals) == len(K), code
    p = os.path.join(root, code + ".json")
    d = json.load(open(p, encoding="utf-8")); d.update(dict(zip(K, vals)))
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2); open(p, "a").write("\n")
print("ok", len(T))
