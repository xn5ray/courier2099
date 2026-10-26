'use strict';
/* MINIGRA: simon */

/* 7. Sekwencja impulsów (Simon): zapamiętaj i odtwórz kolejność 4 przycisków */
MG.simon = { title: 'SEKWENCJA IMPULSÓW', run(body, c) {
  const L = c.lvl, total = [6, 5, 5, 4][L], MAXS = 2;
  const COL = [['#00f0ff', 330], ['#ff2bd6', 415], ['#fcee0a', 523], ['#39ff88', 660]];
  const seq = Array.from({ length: total }, () => Math.floor(Math.random() * 4));
  let k = 3, idx = 0, strikes = 0, phase = 'show';
  body.innerHTML = `<div class="mg-help" id="mH"></div>
    <div class="sm">${COL.map((x, i) => `<button data-i="${i}" style="--c:${x[0]}"></button>`).join('')}</div>
    <div class="mg-hud"><span>RUNDA <b id="mR"></b></span><span>PRÓBY <b id="mL"></b></span></div>`;
  const pads = [...body.querySelectorAll('.sm button')], mH = c.q('#mH'), mR = c.q('#mR'), mL = c.q('#mL');
  const upd = () => { mR.textContent = (k - 2) + '/' + (total - 2); mL.textContent = '◆'.repeat(MAXS - strikes) + '◇'.repeat(strikes); };
  const flash = (i, ms) => { pads[i].classList.add('lit'); beep(COL[i][1], ms / 1000 * 0.9, 'sine'); haptic(18); c.later(() => pads[i].classList.remove('lit'), ms); };
  const play = () => {
    phase = 'show'; idx = 0; mH.innerHTML = 'OBSERWUJ SEKWENCJĘ…'; upd();
    for (let s = 0; s < k; s++) c.later(() => flash(seq[s], 380), 700 + s * 620);
    c.later(() => { phase = 'input'; mH.innerHTML = '<b class="pink">TWOJA KOLEJ</b> — odtwórz sekwencję'; }, 700 + k * 620);
  };
  pads.forEach((p, i) => p.addEventListener('pointerdown', e => {
    e.preventDefault(); if (phase !== 'input') return;
    flash(i, 220);
    if (i === seq[idx]) {
      idx++;
      if (idx === k) { phase = 'wait'; if (k >= total) c.later(c.done, 350); else { k++; c.later(play, 800); } }
    } else {
      phase = 'wait'; strikes++; c.mistake(); upd();
      if (strikes >= MAXS) c.fail('BŁĘDNA SEKWENCJA'); else c.later(play, 900);
    }
  }));
  play();
  return null;
} };
