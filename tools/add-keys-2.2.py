#!/usr/bin/env python3
"""Chiavi 2.2: file scritto da una versione più nuova del formato."""
import json, os
K = ["sync.newer", "new.syncformat"]
T = {
"it": ["Lista creata con una versione più nuova: aggiorna l'app per salvare","Sincronizzazione più robusta: i dati di altre app e versioni non si perdono più"],
"en": ["List made with a newer version: update the app to save","Sturdier sync: data from other apps and versions is no longer lost"],
"es": ["Lista creada con una versión más nueva: actualiza la app para guardar","Sincronización más robusta: ya no se pierden datos de otras apps y versiones"],
"fr": ["Liste créée avec une version plus récente : mets l'app à jour pour enregistrer","Synchro plus solide : les données d'autres apps et versions ne se perdent plus"],
"de": ["Liste mit neuerer Version erstellt: aktualisiere die App zum Speichern","Robustere Synchronisierung: Daten anderer Apps und Versionen gehen nicht mehr verloren"],
"pt": ["Lista criada com uma versão mais recente: atualiza a app para guardar","Sincronização mais robusta: os dados de outras apps e versões já não se perdem"],
"nl": ["Lijst gemaakt met een nieuwere versie: werk de app bij om op te slaan","Stevigere synchronisatie: gegevens van andere apps en versies gaan niet meer verloren"],
"pl": ["Lista z nowszej wersji: zaktualizuj aplikację, aby zapisać","Solidniejsza synchronizacja: dane z innych aplikacji i wersji już nie giną"],
"ro": ["Listă creată cu o versiune mai nouă: actualizează aplicația ca să salvezi","Sincronizare mai solidă: datele din alte aplicații și versiuni nu se mai pierd"],
"cs": ["Seznam z novější verze: aktualizuj aplikaci, aby šlo ukládat","Spolehlivější synchronizace: data z jiných aplikací a verzí se už neztrácejí"],
"sk": ["Zoznam z novšej verzie: aktualizuj aplikáciu, aby sa dalo ukladať","Spoľahlivejšia synchronizácia: dáta z iných aplikácií a verzií sa už nestrácajú"],
"sl": ["Seznam iz novejše različice: posodobi aplikacijo za shranjevanje","Zanesljivejša sinhronizacija: podatki drugih aplikacij in različic se ne izgubijo več"],
"hr": ["Popis iz novije verzije: ažuriraj aplikaciju za spremanje","Pouzdanija sinkronizacija: podaci drugih aplikacija i verzija više se ne gube"],
"hu": ["Újabb verzióval készült lista: frissítsd az appot a mentéshez","Megbízhatóbb szinkron: más appok és verziók adatai már nem vesznek el"],
"bg": ["Списък от по-нова версия: обнови приложението, за да записваш","По-надеждна синхронизация: данните от други приложения и версии вече не се губят"],
"el": ["Λίστα από νεότερη έκδοση: ενημέρωσε την εφαρμογή για αποθήκευση","Πιο σταθερός συγχρονισμός: τα δεδομένα άλλων εφαρμογών και εκδόσεων δεν χάνονται πια"],
"sv": ["Lista från en nyare version: uppdatera appen för att spara","Stabilare synk: data från andra appar och versioner försvinner inte längre"],
"da": ["Liste fra en nyere version: opdater appen for at gemme","Mere robust synkronisering: data fra andre apps og versioner går ikke længere tabt"],
"fi": ["Lista on uudemmasta versiosta: päivitä sovellus tallentaaksesi","Vankempi synkronointi: muiden sovellusten ja versioiden tiedot eivät enää katoa"],
"et": ["Nimekiri uuemast versioonist: salvestamiseks uuenda rakendust","Töökindlam sünkroonimine: teiste rakenduste ja versioonide andmed enam ei kao"],
"lv": ["Saraksts no jaunākas versijas: atjaunini lietotni, lai saglabātu","Drošāka sinhronizācija: citu lietotņu un versiju dati vairs nepazūd"],
"lt": ["Sąrašas iš naujesnės versijos: atnaujinkite programėlę, kad išsaugotumėte","Patikimesnis sinchronizavimas: kitų programėlių ir versijų duomenys nebedingsta"],
"ga": ["Liosta ó leagan níos nuaí: nuashonraigh an aip chun sábháil","Sioncronú níos láidre: ní chailltear sonraí ó aipeanna ná leaganacha eile a thuilleadh"],
"mt": ["Lista minn verżjoni aktar ġdida: aġġorna l-app biex issalva","Sinkronizzazzjoni aktar soda: id-dejta minn apps u verżjonijiet oħra ma tintilifx aktar"],
"ru": ["Список из более новой версии: обнови приложение, чтобы сохранять","Надёжнее синхронизация: данные других приложений и версий больше не теряются"],
"zh": ["清单由更新的版本创建：请更新应用后再保存","同步更可靠：来自其他应用和版本的数据不会再丢失"],
"ja": ["新しいバージョンで作られたリストです：保存するにはアプリを更新してね","同期がより確実に：ほかのアプリやバージョンのデータが消えなくなりました"],
"ko": ["더 새로운 버전으로 만든 목록이에요: 저장하려면 앱을 업데이트하세요","더 튼튼한 동기화: 다른 앱과 버전의 데이터가 더 이상 사라지지 않아요"],
"ar": ["قائمة من إصدار أحدث: حدّث التطبيق لتتمكن من الحفظ","مزامنة أمتن: لم تعد تضيع بيانات التطبيقات والإصدارات الأخرى"],
}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "locales")
assert len(T) == 29
for code, vals in T.items():
    p = os.path.join(root, code + ".json"); d = json.load(open(p, encoding="utf-8")); d.update(dict(zip(K, vals)))
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2); open(p, "a").write("\n")
print("ok")
