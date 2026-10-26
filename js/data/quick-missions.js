'use strict';
/* DANE: SZYBKIE MISJE. Aby dodać nową szybką misję, dopisz wpis do QUICK_MISSIONS — kod nie wymaga zmian.
   Pola wpisu:
     title, act        nazwa misji / napis na przycisku akcji po dotarciu
     dist [min,max]    odległość celu od gracza w metrach
     minutes [min,max] albo fixedMin   czas na misję (losowy z przedziału albo stały)
     reward, scrap [min,max]           premia za zadanie (₵) i złom
     intro             tekst startowy (HTML)
     hint              (opcjonalnie) dopisek w pasku odległości
     steps             minigry po kolei, np. ['overload','wires']; element-tablica = losowy wybór, np. [['balance','icebreaker']]
                       dostępne: frequency overload scan biometric pattern icebreaker simon wires balance timing code
     stepTitle         nagłówek okna minigry
     failPenalty       kara (s) za nieudaną minigrę (domyślnie QUICK_FAIL_PENALTY)
     hard              true = minigry na najtrudniejszym poziomie
     autoStart         true = minigra startuje sama po dotarciu na miejsce
     arriveToast       (opcjonalnie) komunikat przy starcie minigry
     dialog, dialogOk  (opcjonalnie) klucz w QUICK_DIALOGS + napis przycisku — okno rozmowy przed minigrą
     quiet             (opcjonalnie) cichy dojazd: { radius, maxKmh, penalty, cleanBonus } */
const QUICK_BASE_REWARD = 120;     // ₵ za sam dowieziony cel
const QUICK_TIME_BONUS_DIV = 8;    // premia za czas = pozostałe sekundy / tyle
const QUICK_FAIL_PENALTY = 8;      // domyślna kara (s) za nieudaną minigrę

/* TABLICA ZLECEŃ (3 szybkie misje do wyboru) */
const QUICK_SLOTS = 3;             // ile zleceń naraz na tablicy
const QUICK_SKIP_CD_MIN = 10;      // cooldown (min) slotu po POMINIĘCIU zlecenia (albo po porażce / przerwaniu)
const QUICK_DONE_CD_MIN = 5;       // cooldown (min) slotu po UDANYM wykonaniu zlecenia

const QUICK_MISSIONS = {
  ghost: {
    title: 'GHOST DROP', act: 'ZOSTAW PACZKĘ', dist: [300, 600], minutes: [10, 15], reward: 80, scrap: [2, 4],
    intro: 'Podejdź <b>cicho</b> (ostatnie 60 m wolnym krokiem) i zostaw paczkę bez alarmu.',
    steps: ['biometric'], stepTitle: 'GHOST DROP · ZOSTAW PACZKĘ', failPenalty: 15,
    quiet: { radius: 60, maxKmh: 5.5, penalty: 25, cleanBonus: 40 }
  },
  node: {
    title: 'NODE BURN', act: 'PRZEŁADUJ WĘZEŁ', dist: [300, 380], fixedMin: 4, reward: 170, scrap: [3, 5],
    intro: '<b>4 MINUTY!</b> Węzeł zaraz się wypali — biegnij, a na miejscu czekają dwie trudne minigry.',
    hint: 'węzeł się wypala', steps: ['overload', 'wires'], stepTitle: 'NODE BURN', failPenalty: 10, hard: true, autoStart: true,
    arriveToast: '<b>NODE BURN!</b> Natychmiast przeciąż węzeł i odetnij zasilanie!'
  },
  broker: {
    title: 'DATA BROKER', act: 'ROZMAWIAJ Z INFORMATOREM', dist: [300, 600], minutes: [10, 15], reward: 110, scrap: [2, 4],
    intro: 'Informator czeka w punkcie. Wysłuchaj go i przejmij surowe dane.',
    dialog: 'broker', dialogOk: 'POBIERZ DANE', steps: ['frequency'], stepTitle: 'DATA BROKER · POBIERANIE DANYCH'
  },
  surge: {
    title: 'POWER SURGE', act: 'PODŁĄCZ DO SIECI', dist: [300, 600], minutes: [10, 15], reward: 130, scrap: [5, 8],
    intro: 'Skok napięcia w sieci! Dotrzyj do węzła i ujarzmij przepięcie — extra złom i kredyty.',
    steps: [['balance', 'icebreaker']], stepTitle: 'POWER SURGE'
  }
};

/* Rozmowy (losowa kwestia z listy). Nowa lista = nowy klucz, potem wpisz go w polu "dialog" misji. */
const QUICK_DIALOGS = {
  broker: [
    { who: 'INFORMATOR „CIEŃ-9”', text: 'Spóźniłeś się dwie minuty, kurierze. Dane leżą w buforze tego węzła, ale ochrona korpo zmienia częstotliwość co kilka sekund. Złap falę, zanim ktoś zorientuje się, że słucha.' },
    { who: 'INFORMATOR „WDOWA”', text: 'Nie pytaj, skąd to mam. Ktoś z zarządu sprzedaje plany dzielnicy na lewo. Ściągnij paczkę, zanim zniknie z sieci — i nigdy mnie tu nie widziałeś.' },
    { who: 'INFORMATOR „KRÓLIK”', text: 'Mam dla ciebie surowy dump z kamer na Nowym Rynku. Połowa to szum, ale jeśli dostroisz odbiornik, wyciągniesz coś, za co fixerzy dobrze zapłacą.' },
    { who: 'INFORMATOR „SZEPT”', text: 'Drony zmieniają trasę za kilka minut. Dane o ich patrolach są w tym węzle — zsynchronizuj częstotliwość i zgarnij je, zanim się zamkną.' }
  ]
};
