'use strict';
/* MINIGRA: wires */

/* 8. Odcięcie zasilania: wybierz właściwy kabel według krótkiej reguły */
MG.wires = { title: 'ODCIĘCIE ZASILANIA', run(body, c) {
  const WC = { red: ['CZERWONY', '#ff3860'], blue: ['NIEBIESKI', '#3a8bff'], yellow: ['ŻÓŁTY', '#fcee0a'], green: ['ZIELONY', '#39ff88'], white: ['BIAŁY', '#e8f0ff'] };
  const keys = Object.keys(WC), cnt = (w, x) => w.filter(y => y === x).length;
  const RULES = [
    { t: 'Przetnij <b>pierwszy czerwony</b> kabel.', f: w => w.indexOf('red') },
    { t: 'Przetnij kabel <b>tuż za ostatnim niebieskim</b>.', f: w => { const i = w.lastIndexOf('blue'); return i >= 0 && i < w.length - 1 ? i + 1 : -1; } },
    { t: 'Jeśli są <b>co najmniej 2 żółte</b> kable — przetnij <b>ostatni żółty</b>. W przeciwnym razie przetnij <b>pierwszy</b> kabel.', f: w => cnt(w, 'yellow') >= 2 ? w.lastIndexOf('yellow') : 0 },
    { t: 'Przetnij jedyny kabel, którego <b>kolor się nie powtarza</b>.', f: w => { const u = w.map((x, i) => cnt(w, x) === 1 ? i : -1).filter(i => i >= 0); return u.length === 1 ? u[0] : -1; } },
    { t: 'Jeśli <b>ostatni</b> kabel jest zielony — przetnij <b>drugi</b>. W przeciwnym razie przetnij <b>trzeci</b>.', f: w => w[4] === 'green' ? 1 : 2 },
    { t: 'Nie tnij czerwonych ani żółtych. Przetnij <b>ostatni z pozostałych</b>.', f: w => { for (let i = w.length - 1; i >= 0; i--) if (w[i] !== 'red' && w[i] !== 'yellow') return i; return -1; } },
    { t: 'Jeśli <b>nie ma białego</b> kabla — przetnij <b>ostatni</b>. Jeśli jest — przetnij kabel <b>przed pierwszym białym</b>.', f: w => { const i = w.indexOf('white'); return i < 0 ? 4 : (i > 0 ? i - 1 : -1); } }
  ];
  let w = [], rule = RULES[2], ans = -1;
  for (let n = 0; n < 60 && ans < 0; n++) {
    w = Array.from({ length: 5 }, () => keys[Math.floor(Math.random() * keys.length)]);
    if (new Set(w).size < 3) continue;
    rule = RULES[Math.floor(Math.random() * RULES.length)]; ans = rule.f(w);
  }
  if (ans < 0) { rule = RULES[2]; ans = rule.f(w); }
  body.innerHTML = `<div class="mg-help">Panel pod napięciem. Przetnij <b class="pink">właściwy kabel</b> — pomyłka = zwarcie.</div>
    <div class="mg-tbar"><i></i></div><div class="rule">${rule.t}</div>
    ${w.map((x, i) => `<button class="wire" data-i="${i}" style="--c:${WC[x][1]}"><em>${i + 1}</em><i></i><span>${WC[x][0]}</span></button>`).join('')}`;
  const stopT = mgLimit(16 + c.lvl * 2, c.q('.mg-tbar i'), c.timeout);
  let locked = false;
  body.querySelectorAll('.wire').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault(); if (locked) return; locked = true;
    if (+b.dataset.i === ans) { b.classList.add('cut'); haptic(60); beep(900, .08, 'sawtooth'); c.later(c.done, 350); }
    else { b.classList.add('boom'); haptic([80, 30, 80, 30, 200]); c.later(() => c.fail('ZŁY KABEL — ZWARCIE!'), 300); }
  }));
  return stopT;
} };
