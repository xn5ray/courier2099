'use strict';
/* MINIGRA: icebreaker */

/* 6. Przełamanie lodu: klikaj podświetlone kafelki zanim zgasną */
MG.icebreaker = { title: 'PRZEŁAMANIE LODU', run(body, c) {
  const L = c.lvl, need = 8, MAXS = 3, ttl = [1150, 1300, 1450, 1600][L], gap = [620, 700, 780, 860][L];
  let hits = 0, strikes = 0, lastI = -1, nextAt = performance.now() + 600;
  const lit = new Map();
  body.innerHTML = `<div class="mg-help">Klikaj <b class="pink">podświetlone kafelki</b>, zanim zgasną. Pudło lub spóźnienie = utrata próby.</div>
    <div class="ib">${Array.from({ length: 16 }, () => '<button>ICE</button>').join('')}</div>
    <div class="mg-hud"><span>PRZEŁAMANE <b id="iH">0</b>/${need}</span><span>PRÓBY <b id="iL">◆◆◆</b></span></div>`;
  const tiles = [...body.querySelectorAll('.ib button')], iH = c.q('#iH'), iL = c.q('#iL');
  const upd = () => { iH.textContent = hits; iL.textContent = '◆'.repeat(Math.max(0, MAXS - strikes)) + '◇'.repeat(Math.min(MAXS, strikes)); };
  const miss = () => { strikes++; c.mistake(); haptic([40, 30, 40]); upd(); if (strikes >= MAXS) c.fail('LÓD NIEPRZEŁAMANY'); };
  tiles.forEach((b, i) => b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (lit.has(i)) {
      lit.delete(i); b.classList.remove('on'); b.classList.add('hit'); c.later(() => b.classList.remove('hit'), 160);
      hits++; upd(); haptic(14); beep(500 + hits * 60, .05, 'square');
      if (hits >= need) c.done();
    } else miss();
  }));
  const stopL = mgLoop((dt, now) => {
    for (const [i, t] of lit) if (now > t) { lit.delete(i); tiles[i].classList.remove('on'); miss(); }
    if (now >= nextAt && lit.size < 2) {
      let i; do { i = Math.floor(Math.random() * 16); } while (lit.has(i) || i === lastI);
      lastI = i; lit.set(i, now + ttl); tiles[i].classList.add('on'); beep(700, .03, 'sine');
      nextAt = now + gap * (0.8 + Math.random() * 0.5);
    }
  });
  return stopL;
} };
