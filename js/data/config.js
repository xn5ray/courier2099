'use strict';
/* DANE: ustawienia gry, nagrody, ulepszenia, BUDYNKI KRYJÓWKI (MODS) i nazwy punktów. Tu strojenie balansu i dodawanie budynków. */

/* ================= KONFIGURACJA ================= */
const SAVE_KEY = 'courier2099.save.v1', MISSION_KEY = 'courier2099.mission.v1';
const MISSION_MIN = 45;
const REWARD_TARGET = 100, REWARD_RELAY = 150, REWARD_COMPLETE = 200;
const PATROL_PENALTY = 60, MG_PENALTY = 5, FIX_COST = 50;
const DEF = { credits: 0, missions: 0, best: 0, sound: true, haptic: true, sim: false, up: { boots: 0, decrypt: 0, battery: 0 },
  scrap: 0, cool: 0, comps: 0, nodeT: 0,
  safe: ['lock', null, null, 'lock', null, 'core', null, null, null, null, null, null, 'lock', null, null, 'lock'] };   // siatka 4x4: 'lock' | null (puste) | 'core' | id modułu
/* Moduły Kryjówki. cost = [₵, złom, chłodziwo], w = pobór mocy (W), pw = produkcja mocy (W) */
const MODS = {
  gen:   { name: 'GENERATOR AWARYJNY',   ic: '⚡', w: 0,  pw: 40, cost: [120, 10, 0], desc: 'Dostarcza +40 W dla pozostałych modułów.' },
  bench: { name: 'STÓŁ WARSZTATOWY',     ic: '⚙', w: 15, cost: [150, 15, 0], desc: '+7 m promienia zaliczania punktów GPS na moduł.' },
  node:  { name: 'SERWER DANYCH',        ic: '▤', w: 20, cost: [200, 20, 5], desc: '+30 ₵ na godzinę (do 12 h) i +25 ₵ za udaną misję.' },
  cache: { name: 'MAGAZYN PRZEMYTNICZY', ic: '▣', w: 20, cost: [250, 25, 10], desc: '35% szans na rzadki komponent po misji — ułatwia jedną minigrę hakerską.' },
  intel: { name: 'TERMINAL WYWIADOWCZY', ic: '◉', w: 25, cost: [180, 15, 5], desc: 'Odsłania pobliskie punkty na mapie; Dead Dropy i przekazy trwają +60 s.' }
};
const CORE_W = 20, UNLOCK = [200, 15, 0];
const NAMES = ['WĘZEŁ ALFA', 'SKRZYNKA NEON-7', 'KIOSK 0xF3', 'DROP BRAVO', 'TERMINAL KAPPA', 'PORT ZETA-9', 'MIKRO-SERWEROWNIA', 'AUTOMAT SYNAPSA','KLUB AFTERHOURS','KANASAKA TOWER','PLAC KOMPEKI','DOUBLE TOWERS','WYSPA SILVERSTEINA'];
