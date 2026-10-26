'use strict';
/* DANE: teren gracza (AREA), lista punktów, stałe trasy (FIXED_ROUTES) i stała baza. Punkty można też edytować w grze (EDYTOR PUNKTÓW). */

/* ================= PRESETY MAPY (teren gracza) ================= */
const AREA = {
  name: 'LESZCZYNY',
  center: { lat: 50.141955, lng: 18.637321 },
  poly: [[50.155622, 18.655689], [50.15488, 18.659122], [50.15378, 18.661912], [50.152405, 18.663113], [50.150893, 18.662985], [50.149518, 18.661697], [50.148143, 18.661096], [50.146493, 18.661182], [50.144843, 18.662212], [50.143192, 18.663328], [50.141542, 18.6635], [50.140029, 18.662641], [50.138242, 18.660624], [50.136179, 18.658479], [50.134116, 18.656118], [50.132878, 18.652685], [50.13219, 18.647964], [50.13186, 18.642385], [50.13186, 18.637236], [50.13219, 18.632944], [50.13274, 18.628652], [50.133428, 18.624361], [50.134528, 18.621357], [50.135766, 18.61964], [50.137416, 18.618696], [50.139067, 18.618439], [50.140992, 18.618996], [50.142642, 18.620499], [50.14388, 18.622644], [50.144843, 18.625219], [50.145805, 18.627794], [50.146768, 18.629082], [50.148143, 18.629511], [50.149793, 18.631227], [50.15103, 18.633373], [50.152405, 18.635948], [50.153505, 18.639381], [50.154467, 18.643244], [50.155155, 18.647535], [50.155567, 18.651827]],
  points: [
    {"s": "ul. Armii Krajowej", "lat": 50.141377, "lng": 18.645819},
    {"s": "ul. Armii Krajowej", "lat": 50.142642, "lng": 18.653114},
    {"s": "ul. Armii Krajowej", "lat": 50.14399, "lng": 18.659551},
    {"s": "ul. Armii Krajowej", "lat": 50.144348, "lng": 18.660839},
    {"s": "ul. Ks. Adolfa Pojdy", "lat": 50.140029, "lng": 18.639596},
    {"s": "ul. Ks. Adolfa Pojdy", "lat": 50.137416, "lng": 18.641742},
    {"s": "ul. Ks. Adolfa Pojdy", "lat": 50.134666, "lng": 18.643887},
    {"s": "ul. Ks. Adolfa Pojdy", "lat": 50.133428, "lng": 18.644531},
    {"s": "ul. Ks. Adolfa Pojdy", "lat": 50.143192, "lng": 18.625219},
    {"s": "ul. Ks. Adolfa Pojdy", "lat": 50.143027, "lng": 18.631442},
    {"s": "ul. Ks. Adolfa Pojdy", "lat": 50.142587, "lng": 18.633802},
    {"s": "ul. Polna", "lat": 50.145393, "lng": 18.639725},
    {"s": "ul. Polna", "lat": 50.147318, "lng": 18.639682},
    {"s": "ul. Polna", "lat": 50.149518, "lng": 18.638738},
    {"s": "ul. Polna", "lat": 50.150948, "lng": 18.637965},
    {"s": "ul. Polna (ogródki)", "lat": 50.146438, "lng": 18.632515},
    {"s": "ul. Polna (ogródki)", "lat": 50.146135, "lng": 18.637236},
    {"s": "ul. Rybnicka", "lat": 50.144705, "lng": 18.630455},
    {"s": "ul. Ogrodowa", "lat": 50.142202, "lng": 18.629511},
    {"s": "ul. Juliusza Ligonia", "lat": 50.141075, "lng": 18.631227},
    {"s": "ul. Juliusza Ligonia", "lat": 50.140662, "lng": 18.627365},
    {"s": "ul. Marii Konopnickiej", "lat": 50.138324, "lng": 18.630927},
    {"s": "ul. Sportowa", "lat": 50.139204, "lng": 18.62552},
    {"s": "ul. Wincentego Pola", "lat": 50.139699, "lng": 18.632515},
    {"s": "ul. Dąbrowy", "lat": 50.140387, "lng": 18.635776},
    {"s": "ul. Jerzego Pawlasa", "lat": 50.139287, "lng": 18.638008},
    {"s": "ul. Ks. J. Popiełuszki", "lat": 50.137554, "lng": 18.636806},
    {"s": "ul. Wilhelma Pluty", "lat": 50.135821, "lng": 18.638351},
    {"s": "ul. Wilhelma Długosza", "lat": 50.134446, "lng": 18.64024},
    {"s": "ul. Dworcowa", "lat": 50.135821, "lng": 18.624704},
    {"s": "Park leśny (aleja)", "lat": 50.137829, "lng": 18.62479},
    {"s": "ul. Zorska", "lat": 50.139947, "lng": 18.646677},
    {"s": "ul. Zorska", "lat": 50.138682, "lng": 18.649767},
    {"s": "ul. Zorska", "lat": 50.137086, "lng": 18.652342},
    {"s": "ul. Powstańców", "lat": 50.138847, "lng": 18.645647},
    {"s": "ul. Powstańców", "lat": 50.135161, "lng": 18.646033},
    {"s": "ul. Nowy Dwór", "lat": 50.151718, "lng": 18.659337}
  ]
};

/* ---- STAŁE TRASY (kolejność z góry ustalona: punkt 1 -> 2 -> 3 -> baza) ---- */
const FIXED_ROUTE_CHANCE = 0.3;   // szansa na stałą trasę zamiast losowej (1 = zawsze, 0 = nigdy); nigdy dwa razy z rzędu
const FIXED_ROUTE_MAX = 4500;     // maks. długość całej pętli od bazy (m); dalej = losowe cele
const FIXED_ROUTES = [
  { name: 'NOWY DWÓR → OCZYSZCZALNIA → ARMII KRAJOWEJ', pts: [
    { n: 'WĘZEŁ ALFA',      s: 'Nowy Dwór',               lat: 50.154194, lng: 18.656333 },
    { n: 'PORT ZETA-9',     s: 'Oczyszczalnia Ścieków',   lat: 50.152681, lng: 18.658693 },
    { n: 'TERMINAL KAPPA',  s: 'ul. Armii Krajowej',      lat: 50.14399,  lng: 18.659551 }
  ] }
];
/* ---- STAŁA BAZA ---- */
const FIXED_BASE = { lat: 50.143908, lng: 18.639553 };   // skrzyżowanie ulic Polna
const FIXED_BASE_RADIUS = 2500;   // m: jesteś bliżej -> baza stała; dalej -> baza = Twoja pozycja GPS (w symulacji: przenosi Cię do bazy)
