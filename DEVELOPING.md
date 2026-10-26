# COURIER 2099 — jak rozwijać grę

## Struktura plików

```
index.html                    sam układ ekranów (HTML) + lista skryptów
css/style.css                 cały wygląd (neony, czcionki, ekrany)
js/data/config.js             USTAWIENIA: nagrody, kary, czas misji, BUDYNKI KRYJÓWKI (MODS), nazwy punktów
js/data/area.js               TEREN: obszar gry, lista punktów, stałe trasy, stała baza
js/data/quick-missions.js     SZYBKIE MISJE: wszystkie warianty + rozmowy z informatorem
js/core.js                    narzędzia, most do Androida, zapis gry, dźwięk, GPS, kompas
js/safehouse.js               menu główne i ekran Kryjówki
js/missions.js                generowanie celów, pobieranie ulic (OSM), stan misji
js/editor.js                  edytor punktów
js/map-hud.js                 mapa Leaflet i pasek informacji (HUD)
js/quick-run.js               logika Szybkiej Misji (czyta dane z quick-missions.js)
js/events.js                  losowe wydarzenia + pętla tick() co sekundę
js/mission-flow.js            start / koniec misji, ekran wyniku, akcje po dotarciu do celu
js/minigames/engine.js        silnik minigier (startMinigame, rejestr MG)
js/minigames/<nazwa>.js       jedna minigra = jeden plik
js/main.js                    podpięcie przycisków, przycisk „wstecz”, start gry (ładowany ostatni)
```

**Kolejność `<script>` w `index.html` ma znaczenie** — pliki `data/` muszą być pierwsze, `main.js` ostatni.
Wszystkie pliki dzielą jeden zakres globalny (zwykłe skrypty, bez modułów) — nie deklaruj dwa razy tej samej nazwy `const`/`let`/`function` w różnych plikach.

## Jak dodać SZYBKĄ MISJĘ (bez ruszania kodu)

W `js/data/quick-missions.js` dopisz wpis do `QUICK_MISSIONS`. Przykład:

```js
  zlom: {
    title: 'SCRAP RUN', act: 'ZBIERZ ZŁOM', dist: [300, 500], minutes: [10, 12], reward: 90, scrap: [4, 7],
    intro: 'Ktoś zostawił skrzynię ze złomem — zgarnij ją.',
    steps: ['icebreaker'], stepTitle: 'SCRAP RUN'
  },
```
Opis wszystkich pól jest w komentarzu na górze pliku. Można łączyć: kilka minigier po kolei (`steps`), losowy wybór (`[['balance','icebreaker']]`),
rozmowę przed minigrą (`dialog` + wpis w `QUICK_DIALOGS`), ciche podejście (`quiet`), automatyczny start (`autoStart`), trudność (`hard`).
Nowy wariant jest losowany razem z pozostałymi.

## Jak dodać BUDYNEK w Kryjówce

W `js/data/config.js` dopisz wpis do `MODS`:

```js
  lab: { name: 'LABORATORIUM', ic: '🧪', w: 25, cost: [300, 30, 10], desc: 'Opis widoczny w grze.' },
```
`w` = pobór mocy, `pw` = produkcja mocy (tylko generatory), `cost` = [₵, złom, chłodziwo].
Budynek od razu pojawia się na liście budowy, liczy się do limitu mocy i da się go zburzyć.
**Efekt** budynku (co robi) to już kod: w dowolnym miejscu sprawdź `eff('lab')` — zwraca liczbę postawionych sztuk (0, jeśli brakuje prądu).
Przykład: w `js/core.js` funkcja `radius()` dodaje `eff('bench') * 7` m do promienia interakcji; premie po misji są w `finish()` w `js/mission-flow.js`.

## Jak dodać MINIGRĘ

1. Nowy plik `js/minigames/mojagra.js`: `MG.mojagra = { title: 'MOJA GRA', run(body, c) { ... return () => { /* sprzątanie */ }; } };`
   (wzoruj się na `overload.js`; `c.done()` = wygrana, `c.fail()` / `c.timeout()` = porażka, `c.lvl` = poziom trudności 0–3).
2. Dopisz `<script src="js/minigames/mojagra.js"></script>` w `index.html` przed `js/main.js`.
3. Gra rejestruje się sama; pojawi się w losowaniu minigier i możesz jej użyć w `steps` szybkiej misji.

## Jak zmienić punkty i trasy

- W grze: menu → **✎ EDYTOR PUNKTÓW** (zapis w telefonie).
- Na stałe: `js/data/area.js` (`AREA.points`, `FIXED_ROUTES`, `FIXED_BASE`).

## Budowanie APK

Wystarczy wrzucić zmiany do repozytorium na GitHubie — workflow `.github/workflows/build.yml` buduje APK (zakładka Actions → Releases).
