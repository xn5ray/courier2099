'use strict';
/* WYDARZENIA i PĘTLA: losowe zdarzenia w trakcie misji (patrol, dead drop, ...) oraz tick() co sekundę. */

/* ================= WYDARZENIA ================= */
function setNextEvent() { M.nextWalk = (M.walkMs || 0) + rand(420000, 720000) * (M.night ? 0.6 : 1); M.evClock = Date.now(); }   // 7-12 min MARSZU
function spawnEvent(force) {
  if (!pos || M.event) return;
  const g = goal(), dg = dist(pos, g), now = Date.now();
  const pool = ['quiet', 'patrol', 'jam', 'drop', 'hold', 'hacker', 'glitch', 'rogue'];
  if (M.night) pool.push('patrol', 'patrol', 'quiet', 'glitch');   // noc = więcej zagrożeń
  let type = force || pool[Math.floor(Math.random() * pool.length)];
  if (!force && (type === 'patrol' || type === 'quiet') && dg < 350) type = 'jam';
  if (type === 'patrol') {
    const p = offset(pos, Math.min(130, dg * 0.4), bearing(pos, g));
    M.event = { type: 'patrol', lat: p.lat, lng: p.lng, r: 70, endsAt: now + 120000, hit: false };
    toast('<b>PATROL DRONÓW:</b> strefa skanowana. Obejdź ją albo odczekaj 2 minuty!', 'bad', 9000);
    sfx('alert'); haptic([200, 80, 200, 80, 200]);
  } else if (type === 'relay') {
    let p = offset(pos, rand(200, 350), Math.random() * 360);
    const sp = snap(p, 200); if (sp) p = sp;
    if (M.preset) { const cs = areaPts().filter(q => { const d = dist(pos, q); return d >= 150 && d <= 450; }); if (cs.length) p = cs[Math.floor(Math.random() * cs.length)]; }
    M.event = { type: 'relay', lat: p.lat, lng: p.lng, endsAt: now + 300000 };
    toast(`<b>SZYBKI PRZEKAZ:</b> masz 5 minut na dotarcie do punktu bonusowego (+${REWARD_RELAY} ₵)!`, 'ev', 9000);
    sfx('alert'); haptic([120, 60, 120]);
  } else spawnNew(type, now, dg);
  if (M.event && ['drop', 'hold', 'relay'].includes(M.event.type) && eff('intel')) M.event.endsAt += 60000;
  if (M.event) notifyEv(M.event.type);
  renderEvent(); saveMission(); updateHUD();
}
function spawnNew(type, now, dg) {
  const g = goal(), ev = { type, endsAt: now + 300000 };
  const spot = (a, b) => { let p = offset(pos, rand(a, b), Math.random() * 360); const sp = snap(p, 200); if (sp) p = sp;
    if (M.preset) { const cs = areaPts().filter(q => { const d = dist(pos, q); return d >= a * 0.8 && d <= b * 1.4; }); if (cs.length) p = cs[Math.floor(Math.random() * cs.length)]; } return p; };
  let msg, kind = 'ev';
  if (type === 'quiet') { const p = offset(pos, Math.min(130, dg * 0.4), bearing(pos, g)); Object.assign(ev, { lat: p.lat, lng: p.lng, r: 60, det: 0, endsAt: now + 180000 }); kind = 'bad'; msg = '<b>CICHY KROK:</b> strefa czujników drgań! W środku idź wolno (&lt;3 km/h) albo ją obejdź.'; }
  else if (type === 'jam') { ev.endsAt = now + 180000; kind = 'bad'; msg = '<b>ZAGŁUSZACZ SYGNAŁU:</b> mapa i trasa wyłączone na 3 min. Kieruj się kompasem i dystansem!'; }
  else if (type === 'drop') { const p = spot(120, 180); Object.assign(ev, { lat: p.lat, lng: p.lng, endsAt: now + 240000 }); msg = '<b>DEAD DROP:</b> porzucona skrzynia ~150 m stąd, znika za 4 min. Zbaczasz z trasy po kredyty?'; }
  else if (type === 'hold') { const p = spot(150, 250); Object.assign(ev, { lat: p.lat, lng: p.lng, held: 0, endsAt: now + 480000 }); msg = '<b>PRZEJĘCIE SYGNAŁU:</b> wejdź w promień 30 m i wytrwaj tam 3 min (wyjście zeruje postęp).'; }
  else if (type === 'rogue') { const p = spot(100, 200); Object.assign(ev, { lat: p.lat, lng: p.lng, endsAt: now + 180000, h: Math.random() * 360 }); msg = '<b>ROGUE DATA GLITCH:</b> czerwony punkt ucieka po okolicy! Dogoń go w 3 minuty (podbiegnij) — to rzadki komponent do bazy.'; }
  else if (type === 'glitch') { ev.cur = 0; kind = 'bad'; msg = `<b>AWARIA CYBERWARE:</b> zakłócenia ekranu i błędny dystans (±50 m) przez 5 min. Napraw za ${FIX_COST} ₵ albo przeczekaj.`; }
  else { ev.endsAt = now + 600000; $('#choice').hidden = false; }   // hacker
  M.event = ev; if (msg) toast(msg, kind, 9000); sfx('alert'); haptic([120, 60, 120]);
}
const EV_END = { patrol: ['Patrol dronów odleciał. Strefa wolna.', 'good'], jam: ['Zagłuszacz wyłączony — mapa wraca.', 'good'], quiet: ['Czujniki drgań wyłączone.', 'good'], glitch: ['Cyberware sam się zrestartował.', 'good'], hold: ['Przejęcie sygnału nieudane — okno zamknięte.', 'warn'], drop: ['Skrzynia zniknęła…', 'warn'], relay: ['Szybki przekaz wygasł…', 'warn'], rogue: ['Glitch uciekł w sieć…', 'warn'] };
function evTick() {
  const ev = M.event; if (!ev) return;
  if (ev.type === 'hacker') { $('#choice').hidden = false; return; }
  if (ev.type === 'glitch') { const k = Math.floor(Date.now() / 5000); if (ev.k !== k) { ev.k = k; ev.cur = (Math.random() < 0.5 ? -1 : 1) * rand(25, 50); } return; }
  if (!pos || ev.lat == null) return;
  const d = dist(pos, ev);
  if (ev.type === 'quiet') {
    if (d <= ev.r) { ev.entered = true;
      if (spd * 3.6 > 3) { ev.det = Math.min(100, ev.det + 14); haptic(Math.min(900, 200 + ev.det * 7)); }   // wibruje, dopóki rośnie wykrycie
      else { if (ev.det > 0) haptic(0); ev.det = Math.max(0, ev.det - 18); }
      if (ev.det >= 100) { penalty(45); sfx('bad'); haptic([400, 100, 400]); endEvent('<b>WYKRYTO RUCH!</b> Czujniki cię namierzyły. −45 s', 'bad'); }
    } else if (ev.entered) { haptic(0); M.extra += 40; endEvent('<b>CICHY KROK ZALICZONY</b> +40 ₵', 'good'); }
  } else if (ev.type === 'rogue') {   // glitch dryfuje; gdy podejdziesz < 80 m — ucieka szybciej niż idziesz (trzeba przyspieszyć)
    const away = d < 80;
    ev.h = away ? bearing(pos, ev) + rand(-35, 35) : (ev.h == null ? Math.random() * 360 : ev.h) + rand(-25, 25);
    const p = offset(ev, away ? 1.5 : 0.8, ev.h); ev.lat = p.lat; ev.lng = p.lng; renderEvent();
  } else if (ev.type === 'hold') {
    ev.held = d <= 30 ? ev.held + 1 : 0;
    if (ev.held >= 180) { M.extra += 150; M.scrap = (M.scrap || 0) + 3; M.cool = (M.cool || 0) + 1; sfx('ok'); haptic([60, 40, 60, 40, 120]); endEvent('<b>SYGNAŁ PRZEJĘTY!</b> Bonusowe dane +150 ₵, +3 ZŁOM, +1 CHŁODZIWA', 'good'); }
  }
}
function resolveChoice(c) {
  $('#choice').hidden = true; if (!M) return;
  if (c === 'help') { M.endsAt -= 120000; M.extra += 120; endEvent('<b>POMOGŁEŚ HAKEROWI:</b> −2 min z zegara, +120 ₵.', 'good'); }
  else if (c === 'sell') { M.extra += 200; M.hard = true; endEvent('<b>SPRZEDANO KORPORACJI:</b> +200 ₵. Minigry będą trudniejsze.', 'warn'); }
  else endEvent('Zignorowano prośbę.', '');
  tick();
}
function hackDrone(ev) {
  if (dist(pos, ev) > ev.r + 40 || spd > 0.8) return;
  const to = setTimeout(() => { if (mgActive && M && M.event === ev) { closeMinigame(); ev.hit = true; penalty(PATROL_PENALTY); endEvent('<b>HAKOWANIE NIEUDANE</b> — dron cię namierzył! −' + PATROL_PENALTY + ' s', 'bad'); } }, 20000);
  runMinigame('HAKOWANIE DRONA · 20 s', () => { clearTimeout(to); if (M) endEvent('<b>DRON WYŁĄCZONY.</b> Strefa wolna.', 'good'); });
}
function endEvent(msg, kind) {
  M.event = null; setNextEvent(); renderEvent();
  if (msg) toast(msg, kind || '', 5000);
  saveMission(); updateHUD();
}
function checkPatrol() {
  const ev = M && M.event;
  if (!ev || ev.type !== 'patrol' || ev.hit || !pos) return;
  if (dist(pos, ev) <= ev.r) {
    if (save.imp.optic && !M.camoUsed) { M.camoUsed = true; ev.hit = true; ev.camo = true; toast('<b>KAMUFLAŻ OPTYCZNY:</b> dron cię nie zauważył — bez kary! (raz na misję)', 'good', 6000); sfx('ok'); haptic([60, 40, 60]); saveMission(); return; }
    ev.hit = true; penalty(PATROL_PENALTY);
    toast(`<b>WYKRYTO PRZEZ DRONY!</b> −${PATROL_PENALTY} s`, 'bad', 6000);
    sfx('bad'); haptic([400, 100, 400]); saveMission();
  }
}
function penalty(sec) {
  if (!M) return;
  M.endsAt -= sec * 1000; M.penalties += sec;
  const t = $('#hTime'); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
  tick();
}

/* ================= PĘTLA ================= */
function tick() {
  if (!M) return;
  const now = Date.now(), rem = Math.ceil((M.endsAt - now) / 1000);
  const t = $('#hTime');
  t.textContent = fmt(rem);
  t.classList.toggle('warn', rem < 300 && rem >= 60); t.classList.toggle('crit', rem < 60);
  if (rem <= 0) { finish('timeout'); return; }
  if (now - lastWpT > 4000) spd = 0;
  if (M.nextWalk == null) setNextEvent();
  if (M.evClock == null) M.evClock = now;
  if (M.event) {
    evTick();
    if (M.event && now >= M.event.endsAt) { const x = EV_END[M.event.type] || []; endEvent(x[0], x[1]); }
  } else if (!M.quick && ((M.walkMs || 0) >= M.nextWalk || now - M.evClock > 13 * 60000) && !mgActive && pos) spawnEvent();   // awaryjnie: min. co 13 min
  if (M && M.quick) quickTick(now);
  if (M && save.imp.kin && pos) {   // bufory kinetyczne: 10 min szybkiego, równego marszu = +3 złomu
    if (spd >= 1.1) M.kin = (M.kin || 0) + 1; else if (spd < 0.5) M.kin = 0;
    if (M.kin >= 600) { M.kin = 0; M.scrap = (M.scrap || 0) + 3; toast('<b>BUFORY KINETYCZNE:</b> 10 min równego marszu → +3 ZŁOM', 'good', 5000); sfx('ok'); }
  }
  if (!sim && pos && now - lastFix > 25000) $('#gpsInfo').textContent = 'GPS: SYGNAŁ UTRACONY';
  if (now - lastSave > 5000) saveMission();
  updateHUD();
}
