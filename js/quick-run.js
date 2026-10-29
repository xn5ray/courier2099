'use strict';
/* SZYBKA MISJA — logika (czyta dane z data/quick-missions.js). */

/* SZYBKA MISJA: logika trybu (1 cel). Wszystkie warianty opisują dane w data/quick-missions.js — tu nie trzeba nic zmieniać, by dodać nowy. */

const pickQuickVariant = () => { const k = Object.keys(QUICK_MISSIONS); return k[Math.floor(Math.random() * k.length)]; };
const quickPts = (base, v) => { const [a, b] = QUICK_MISSIONS[v].dist; return areaPts().filter(q => { const d = dist(base, q); return d >= a && d <= b; }); };
const quickHasPts = (base, v) => quickPts(base, v).length > 0;

function genQuickTarget(base, v) {
  const [a, b] = QUICK_MISSIONS[v].dist, pts = quickPts(base, v);
  if (pts.length) { const q = pts[Math.floor(Math.random() * pts.length)]; return { lat: q.lat, lng: q.lng }; }
  for (let i = 0; i < 120; i++) {
    const p0 = offset(base, rand(a, b), Math.random() * 360), p = roadGrid ? snap(p0, 200) : p0;
    if (!p) continue;
    const d = dist(base, p); if (d >= a * 0.9 && d <= b * 1.1) return { lat: p.lat, lng: p.lng };
  }
  const p0 = offset(base, (a + b) / 2, Math.random() * 360), p = (roadGrid && snap(p0, 300)) || p0;
  return { lat: p.lat, lng: p.lng };
}

function createQuick(base, v) {
  const V = QUICK_MISSIONS[v], now = Date.now(), mins = V.fixedMin || Math.round(rand(V.minutes[0], V.minutes[1]));
  const t = genQuickTarget(base, v), nm = shuffle(NAMES.slice())[0];
  return { base: { lat: base.lat, lng: base.lng }, preset: false, quick: { v, det: 0, pen: 0, started: false, cool: 0, bonus: 0, clean: 0 },
    targets: [{ lat: t.lat, lng: t.lng, name: V.title + ' · ' + nm, type: 'quick', done: false }], idx: 0, startedAt: now, endsAt: now + mins * 60000,
    done: 0, relays: 0, penalties: 0, event: null, extra: 0, walkMs: 0, nextWalk: 1e12, hard: false, scrap: 0, cool: 0 };
}

function quickSub(d, r) {
  const q = M.quick, V = QUICK_MISSIONS[q.v];
  if (V.quiet) return d <= V.quiet.radius ? `🤫 CICHE PODEJŚCIE · DETEKCJA ${Math.round(q.det)}% — IDŹ WOLNO` : `${V.title} · ostatnie ${V.quiet.radius} m idź cicho · zasięg ${r} m`;
  return (V.hint ? `${V.title} · ${V.hint} · ` : '') + `ZASIĘG INTERAKCJI: ${r} m`;
}

function quickTick(now) {
  const q = M.quick, V = QUICK_MISSIONS[q.v]; if (!pos || mgActive || M.idx >= M.targets.length) return;
  const d = dist(pos, M.targets[0]);
  if (V.quiet && !sim && d <= V.quiet.radius) {
    if (spd * 3.6 > V.quiet.maxKmh) { q.det = Math.min(100, q.det + 12); haptic(Math.min(600, 150 + q.det * 5)); }
    else q.det = Math.max(0, q.det - 10);
    if (q.det >= 100) { q.det = 45; q.pen++; penalty(V.quiet.penalty); sfx('bad'); haptic([300, 100, 300]); if (M) toast('<b>WYKRYTO RUCH!</b> Czujniki cię namierzyły. −' + V.quiet.penalty + ' s. Zwolnij do marszu!', 'bad', 5000); }
  }
  if (M && V.autoStart && !q.started && d <= radius() && now >= (q.cool || 0)) onQuickAct();   // minigra startuje od razu po dotarciu
}

function quickDone() {
  const q = M.quick, V = QUICK_MISSIONS[q.v];
  q.bonus = V.reward; if (V.quiet && !q.pen) q.clean = V.quiet.cleanBonus || 0;
  M.scrap = (M.scrap || 0) + Math.round(rand(V.scrap[0], V.scrap[1]));
  M.targets[0].done = true; M.idx = 1; M.done = 1;
  sfx('ok'); haptic([80, 40, 80]); saveMission(); finish('success');
}

/* Kolejne minigry z V.steps; porażka = kara czasu i ponowienie, anulowanie = krótka pauza */
function quickChain(V) {
  const list = V.steps.map(s => Array.isArray(s) ? s[Math.floor(Math.random() * s.length)] : s), pen = V.failPenalty == null ? QUICK_FAIL_PENALTY : V.failPenalty;
  let i = 0; M.quick.started = true;
  const next = () => {
    if (!M) return;
    startMinigame(list[i], () => { if (!M) return; if (++i >= list.length) quickDone(); else next(); },
      reason => {
        if (reason === 'cancel') { if (M && M.quick) { M.quick.started = false; M.quick.cool = Date.now() + 8000; } return; }
        if (M && M.quick && V.quiet) M.quick.pen++;
        penalty(pen); if (!M) return;
        toast(`<b>${reason === 'timeout' ? 'CZAS MINĄŁ' : 'WŁAMANIE NIEUDANE'}</b> −${pen} s · ponów`, 'warn', 3500);
        next();
      }, { title: (V.stepTitle || V.title) + (list.length > 1 ? ` (${i + 1}/${list.length})` : ''), hard: !!V.hard });
  };
  next();
}

function quickDialog(V) {
  const lines = QUICK_DIALOGS[V.dialog] || [], L = lines[Math.floor(Math.random() * lines.length)] || { who: V.title, text: '…' }, q = M.quick; q.started = true;
  $('#qdTitle').textContent = V.title; $('#qdWho').textContent = L.who; $('#qdText').textContent = L.text; $('#qdOk').textContent = V.dialogOk || 'DALEJ';
  $('#qdlg').hidden = false; sfx('alert');
  $('#qdOk').onclick = () => { $('#qdlg').hidden = true; if (M) quickChain(V); };
  $('#qdNo').onclick = () => { $('#qdlg').hidden = true; if (M) { q.started = false; q.cool = Date.now() + 5000; } };
}

function onQuickAct() {
  if (!M || !M.quick || !pos || mgActive || M.idx >= M.targets.length) return;
  if (!$('#qdlg').hidden) return;
  const V = QUICK_MISSIONS[M.quick.v];
  if (V.arriveToast) toast(V.arriveToast, 'bad', 4000);
  if (V.dialog) quickDialog(V); else quickChain(V);
}
