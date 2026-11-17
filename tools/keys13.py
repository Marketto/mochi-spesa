"""Chiavi della versione 1.3 (dispensa, lista, confronto prezzi) e funzione per scriverle nei locales."""
import json, os

K = ["tab.pantry", "pantry.putAway", "cmp.open", "list.swipeHint", "pantry.addLabel", "pantry.addPh", "pantry.addBtn",
     "pantry.place", "pantry.groupBy", "pantry.byPlace", "pantry.byCat", "pantry.organize", "pref.title", "pref.hint",
     "pantry.takeFrom", "list.qtyFor", "common.undo", "pantry.haveTitle", "pantry.haveText", "pantry.take",
     "pantry.notThere", "pantry.addAnyway", "pantry.removed", "pantry.takenTitle", "pantry.takenText",
     "pantry.takenYes", "pantry.takenBought", "pantry.tookFrom", "list.qtyTitle", "list.qty", "list.less",
     "list.more", "pantry.putAwayTitle", "pantry.putAwayHint", "pantry.putAwayOk", "pantry.putAwayDone",
     "pantry.atHome", "pantry.emptyTitle", "pantry.emptyText", "pantry.edit", "pantry.toList", "pantry.finished",
     "pantry.added", "pantry.gone", "pantry.name", "pantry.category", "pantry.organizeHint", "pantry.placeName",
     "pantry.shelves", "pantry.shelvesPh", "pantry.removePlace", "pantry.shelvesHelp", "pantry.newPlace",
     "pantry.newPlacePh", "cmp.title", "cmp.noData", "cmp.deal", "pref.fav", "pref.avoid", "cmp.hidden",
     "cmp.total", "cmp.when", "cmp.apply", "cmp.again", "cmp.applied", "cmp.searching", "pref.remove",
     "pref.empty", "pref.removed", "pref.lineFav", "pref.lineAvoid", "place.credenza", "place.cantina",
     "new.pantry", "new.swipe", "new.compare"]


def write(T):
    root = os.path.join(os.path.dirname(__file__), "..", "locales")
    for code, vals in T.items():
        assert len(vals) == len(K), (code, len(vals), len(K))
        p = os.path.join(root, code + ".json")
        d = json.load(open(p, encoding="utf-8"))
        d.update(dict(zip(K, vals)))
        json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(p, "a").write("\n")
    print("ok", list(T))
