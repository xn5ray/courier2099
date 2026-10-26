'use strict';
/* RDZEŃ: narzędzia, most do Androida (Capacitor), zapis gry, stan, dźwięk, GPS, kompas, toasty. Ładowany po plikach data/. */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

/* ================= NATIVE (Capacitor / Android) ================= */
const CAP = window.Capacitor, NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
const plug = n => (NATIVE && CAP.Plugins && CAP.Plugins[n]) || null;
const nGeo = () => plug('Geolocation'), nAwake = () => plug('KeepAwake'), nNotif = () => plug('LocalNotifications');
const EV_TITLE = { patrol: 'PATROL DRONÓW', quiet: 'CICHY KROK', jam: 'ZAGŁUSZACZ SYGNAŁU', drop: 'DEAD DROP', hold: 'PRZEJĘCIE SYGNAŁU', hacker: 'POTRZEBUJĄCY HAKER', glitch: 'AWARIA CYBERWARE', relay: 'SZYBKI PRZEKAZ', rogue: 'ROGUE DATA GLITCH' };
const EV_BODY = { patrol: 'Strefa skanowana — obejdź ją lub odczekaj 2 min.', quiet: 'Strefa czujników drgań — idź wolno.', jam: 'Mapa wyłączona na 3 min. Użyj kompasu.', drop: 'Porzucona skrzynia w pobliżu — zniknie za 4 min.', hold: 'Wejdź w strefę i wytrwaj 3 min.', hacker: 'Ranny haker prosi o pomoc — otwórz grę.', glitch: 'Zakłócenia ekranu i błędny dystans.', relay: 'Masz 5 min na dotarcie do punktu bonusowego.', rogue: 'Uciekający glitch w pobliżu — złap go, zanim zniknie!' };
let notifId = 1;
async function initNotif() {
  const n = nNotif(); if (!n) return;
  try { const p = await n.checkPermissions(); if (p.display !== 'granted') await n.requestPermissions(); } catch (e) {}
}
function notifyEv(type) {
  const n = nNotif();
  if (!n || document.visibilityState === 'visible') return;   // w grze działają zwykłe powiadomienia na ekranie
  try { n.schedule({ notifications: [{ id: (notifId++ % 100000) + 1, title: '⚠ ' + (EV_TITLE[type] || 'ZDARZENIE'), body: EV_BODY[type] || 'Nowe zdarzenie w misji.', schedule: { at: new Date(Date.now() + 150) } }] }); } catch (e) {}
}
let nWatch = null;

/* ================= ZAPIS ================= */
function loadSave() {
  const d = JSON.parse(JSON.stringify(DEF));
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    const o = Object.assign(d, s, { up: Object.assign({}, DEF.up, s.up || {}) });
    if (!Array.isArray(o.safe) || o.safe.length !== 16) o.safe = DEF.safe.slice();
    return o;
  } catch (e) { return d; }
}
let save = loadSave();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
const cnt = k => save.safe.filter(x => x === k).length;
function grid() { let use = 0; for (const k in MODS) use += cnt(k) * MODS[k].w; const cap = CORE_W + cnt('gen') * MODS.gen.pw; return { cap, use, ok: use <= cap }; }
const eff = k => grid().ok ? cnt(k) : 0;   // bonus modułu działa tylko gdy jest prąd
const radius = () => Math.min(60, [20, 30, 40][save.up.boots] + eff('bench') * 7);
const missionMinutes = () => MISSION_MIN + (save.up.battery ? 10 : 0) + Math.min(2, eff('charge')) * 5;
const isNight = () => { const h = new Date().getHours(); return h >= NIGHT.from || h < NIGHT.to; };

/* ================= STAN ================= */
let M = null, pos = null, watchId = null, heading = null, sim = false;
let tickT = null, lastSave = 0, lastFix = 0, mgActive = false, mgCancel = null, follow = true, wl = null, compassBound = false;
let map = null, gMarks = null, evg = null, playerMk = null, accC = null, routeLine = null;

/* ================= DŹWIĘK / WIBRACJE ================= */
let ac = null;
function initAudio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function beep(f, d, type) {
  if (!save.sound || !ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(0.05, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch (e) {}
}
const SFX = {
  ok: [[660, .08], [990, .12]], bad: [[160, .2, 'sawtooth']], alert: [[880, .12], [440, .12], [880, .12], [440, .12]],
  buy: [[520, .08], [780, .08], [1040, .12]], click: [[500, .04]], end: [[440, .1], [660, .1], [880, .1], [1320, .25]]
};
function sfx(n) { let t = 0; (SFX[n] || []).forEach(([f, d, ty]) => { setTimeout(() => beep(f, d, ty), t * 1000); t += d; }); }
const haptic = p => { if (save.haptic && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } };

/* ================= GEO ================= */
const R = 6371000, toR = Math.PI / 180;
function dist(a, b) {
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bearing(a, b) {
  const y = Math.sin((b.lng - a.lng) * toR) * Math.cos(b.lat * toR);
  const x = Math.cos(a.lat * toR) * Math.sin(b.lat * toR) - Math.sin(a.lat * toR) * Math.cos(b.lat * toR) * Math.cos((b.lng - a.lng) * toR);
  return (Math.atan2(y, x) / toR + 360) % 360;
}
function offset(p, d, brg) {
  const br = brg * toR, lat1 = p.lat * toR, lng1 = p.lng * toR, dr = d / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(br));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 / toR, lng: ((lng2 / toR + 540) % 360) - 180 };
}
function geoErrText(e) {
  if (!window.isSecureContext) return 'GPS wymaga HTTPS (lub localhost). Wrzuć plik na hosting (np. Netlify Drop) albo włącz TRYB SYMULACJI.';
  if (!e) return 'Błąd GPS.';
  if (e.code === 1) return 'DOSTĘP DO GPS ODRZUCONY — zezwól na lokalizację dla tej strony i spróbuj ponownie.';
  if (e.code === 2) return 'Brak sygnału GPS — wyjdź na zewnątrz i spróbuj ponownie.';
  if (e.code === 3) return 'Przekroczono czas oczekiwania na GPS. Spróbuj ponownie.';
  return 'GPS niedostępny w tej przeglądarce. Możesz włączyć TRYB SYMULACJI.';
}
async function geoOnce() {
  const g = nGeo();
  if (g) {
    try {
      let perm = await g.checkPermissions();
      if (perm.location !== 'granted') perm = await g.requestPermissions({ permissions: ['location'] });
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') throw { code: 1 };
      const p = await g.getCurrentPosition({ enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
      return p;
    } catch (e) { throw (e && e.code != null) ? e : { code: /denied|permission/i.test((e && e.message) || '') ? 1 : 2 }; }
  }
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej({ code: 0 });
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
  });
}
function startWatch() {
  stopWatch();
  if (sim) return;
  const g = nGeo();
  if (g) {
    g.watchPosition({ enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 }, (p, err) => {
      if (p && p.coords) setPos(p.coords.latitude, p.coords.longitude, p.coords.accuracy);
      else if (err) toast('SYGNAŁ GPS: ' + geoErrText({ code: 2 }), 'warn', 6000);
    }).then(id => { nWatch = id; if (!M) { try { g.clearWatch({ id }); } catch (e) {} nWatch = null; } }).catch(() => {});
    return;
  }
  if (!navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    p => setPos(p.coords.latitude, p.coords.longitude, p.coords.accuracy),
    e => toast('SYGNAŁ GPS: ' + geoErrText(e), 'warn', 6000),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
}
function stopWatch() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (nWatch != null) { const g = nGeo(); if (g) { try { g.clearWatch({ id: nWatch }); } catch (e) {} } nWatch = null; }
}
function setPos(lat, lng, acc) { pos = { lat, lng, acc: acc || 0 }; lastFix = Date.now(); onPosChanged(); }

/* kompas */
function requestCompass() {
  if (compassBound) return; compassBound = true;
  const handler = e => {
    let h = null;
    if (e.webkitCompassHeading != null) h = e.webkitCompassHeading;
    else if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360;
    if (h != null && !isNaN(h)) heading = h;
  };
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') window.addEventListener('deviceorientation', handler, true); }).catch(() => {});
    } else {
      window.addEventListener('deviceorientationabsolute', handler, true);
      window.addEventListener('deviceorientation', handler, true);
    }
  } catch (e) {}
}
async function lockScreen() { const a = nAwake(); if (a) { try { await a.keepAwake(); } catch (e) {} return; } try { if ('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
function releaseLock() { const a = nAwake(); if (a) { try { a.allowSleep(); } catch (e) {} } try { if (wl) wl.release(); } catch (e) {} wl = null; }
document.addEventListener('visibilitychange', () => { if (M && document.visibilityState === 'visible') lockScreen(); });

/* ================= UI POMOCNICZE ================= */
function show(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); }
function toast(msg, kind, ms) {
  const box = $('#toasts'), d = document.createElement('div');
  d.className = 'toast ' + (kind || ''); d.innerHTML = msg; box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, ms || 5000);
}
