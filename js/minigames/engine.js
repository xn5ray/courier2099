'use strict';
/* MINIGRY — SILNIK: startMinigame(), rejestr MG, pomocnicze funkcje. Nową minigrę dodajesz plikiem js/minigames/<id>.js (MG.<id> = {...}) + <script> w index.html. */

/* ================= MINIGRY: API =================
   startMinigame(gameType, onSuccess, onFailure [, opts])
     gameType   : 'frequency' | 'overload' | 'scan' | 'biometric' | 'pattern' | 'icebreaker' | 'simon' | 'wires' | 'balance'
                  | 'timing' | 'code' | 'random'
     onSuccess()             - gracz wygrał
     onFailure(reason, id)   - reason: 'fail' (porażka) | 'timeout' (czas minął) | 'cancel' (gracz kliknął ANULUJ)
     opts.title              - nagłówek overlayu (nazwa minigry pokaże się wtedy pod nim)
   Każda minigra = MG[id] = { title, run(body, ctx) -> cleanup }, ctx: done / fail / timeout / mistake / later / q / lvl / alive */
const MG_ALL = [];   // lista id wszystkich minigier — uzupełnia się sama
const MG = new Proxy({}, { set(o, k, v) { o[k] = v; if (!MG_ALL.includes(k)) MG_ALL.push(k); return true; } });   // MG.mojaGra = {...} rejestruje minigrę automatycznie
let mgToken = 0, mgLast = null, mgFail = null;
const pickGame = () => { const pool = MG_ALL.filter(id => id !== mgLast); return pool[Math.floor(Math.random() * pool.length)]; };

function startMinigame(gameType, onSuccess, onFailure, opts) {
  opts = opts || {};
  if (mgActive) closeMinigame();
  let id = (!gameType || gameType === 'random') ? pickGame() : gameType;
  if (!MG[id]) { console.warn('startMinigame: nieznana minigra "' + gameType + '" - losuję'); id = pickGame(); }
  mgLast = id; mgFail = onFailure || null;
  const g = MG[id], token = ++mgToken, body = $('#mgBody');
  let ended = false, cleanup = null;
  const timers = new Set();
  const alive = () => !ended && token === mgToken;
  const kill = () => { ended = true; timers.forEach(clearTimeout); timers.clear(); if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; } };
  const end = (ok, reason, msg) => {
    if (!alive()) return;
    kill();
    if (ok) { body.innerHTML = '<div class="mg-result ok">✔ DOSTĘP PRZYZNANY</div>'; sfx('ok'); haptic([60, 40, 60, 40, 120]); }
    else { body.innerHTML = `<div class="mg-result bad">✖ ${msg || 'PRZEŁAMANIE NIEUDANE'}<small>zabezpieczenia zresetowane…</small></div>`; mgBad(); haptic([300, 80, 300]); }
    setTimeout(() => {
      if (token !== mgToken) return;                       // anulowane / zastąpione w międzyczasie
      mgActive = false; mgCancel = null; mgFail = null; $('#mg').hidden = true; updateHUD();
      if (ok) { if (onSuccess) onSuccess(); } else if (onFailure) onFailure(reason, id);
    }, ok ? 450 : 1100);
  };
  const ctx = {
    lvl: opts.hard ? 0 : Math.min(3, save.up.decrypt + (opts.boost ? 1 : 0)), alive,
    done: () => end(true),
    fail: msg => end(false, 'fail', msg),
    timeout: () => end(false, 'timeout', 'CZAS MINĄŁ'),
    mistake: () => { if (alive()) mgBad(); },
    later: (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive()) fn(); }, ms); timers.add(t); return t; },
    q: s => body.querySelector(s)
  };
  mgCancel = () => { kill(); mgToken++; };
  mgActive = true; updateHUD();
  $('#mgTitle').textContent = opts.title || g.title;
  $('#mgSub').textContent = opts.title ? g.title : '';
  $('#mg').hidden = false; body.innerHTML = '';
  try { cleanup = g.run(body, ctx) || null; }
  catch (e) { console.error(e); end(false, 'fail', 'BŁĄD MINIGRY'); }
  return id;
}
function closeMinigame() { if (mgCancel) mgCancel(); mgCancel = null; mgFail = null; mgActive = false; $('#mg').hidden = true; updateHUD(); }
function cancelMinigame() { const cb = mgFail; closeMinigame(); if (cb) cb('cancel', mgLast); }
function mgBad() { sfx('bad'); haptic([60, 30, 60]); const p = $('#mg .panel'); p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); }

/* Użycie w misji: losowa minigra; porażka = kara czasu + kolejne podejście (inna minigra). M.hard = 2 minigry z rzędu. */
function runMinigame(title, onSuccess) {
  let left = M && M.hard ? 2 : 1;
  const next = () => {
    const boost = save.comps > 0 && (save.comps--, persist(), toast('<b>KOMPONENT ZUŻYTY</b> — minigra łatwiejsza.', 'good', 2500), true);
    startMinigame('random',
      () => { if (--left > 0) next(); else onSuccess(); },
      reason => {
        if (reason === 'cancel') return;
        penalty(MG_PENALTY);
        if (!M) return;                                   // kara mogła skończyć misję
        toast(`<b>${reason === 'timeout' ? 'CZAS MINĄŁ' : 'WŁAMANIE NIEUDANE'}</b> −${MG_PENALTY} s · nowe podejście`, 'warn', 3500);
        next();
      },
      { title, boost });
  };
  next();
}

/* helpery wspólne dla minigier */
const mgClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mgAng = (a, b) => ((a - b + 540) % 360) - 180;          // różnica kątów -180..180
const mgDpr = () => Math.min(2, window.devicePixelRatio || 1);
function mgLoop(fn) {
  let on = true, id = 0, last = performance.now();
  const f = now => { if (!on) return; const dt = mgClamp((now - last) / 1000, 0, 0.05); last = now; fn(dt, now); if (on) id = requestAnimationFrame(f); };
  id = requestAnimationFrame(f);
  return () => { on = false; cancelAnimationFrame(id); };
}
function mgLimit(sec, bar, onEnd) {                              // pasek czasu; zwraca stop()
  const t0 = performance.now(); let on = true;
  const id = setInterval(() => {
    const left = 1 - (performance.now() - t0) / (sec * 1000);
    bar.style.width = Math.max(0, left * 100) + '%'; bar.parentNode.classList.toggle('low', left < 0.25);
    if (left <= 0) { clearInterval(id); if (on) onEnd(); }
  }, 80);
  return () => { on = false; clearInterval(id); };
}
