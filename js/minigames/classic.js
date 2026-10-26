'use strict';
/* MINIGRY: dwie klasyczne (dekoder czasowy, łamanie kodu). */

/* Minigra 1: zatrzymaj kursor w strefie (3 trafienia) */
function timingGame(body, done) {
  const lvl = save.up.decrypt, zw = [0.18, 0.24, 0.30, 0.36][lvl], period = [1.5, 1.7, 1.9, 2.2][lvl];
  let hits = 0, alive = true, raf = 0, x = 0, zl = 0;
  const t0 = performance.now();
  body.innerHTML = `<div class="mg-help">Zatrzymaj kursor w <b class="pink">różowej strefie</b>.<br>Trafienia: <b id="tHits">0</b>/3 · pudło = −${MG_PENALTY} s</div>
    <div class="tbar"><div class="tzone" id="tZone"></div><div class="tcur" id="tCur"></div></div>
    <button class="btn big pink" id="tStop">STOP</button>`;
  const zone = body.querySelector('#tZone'), cur = body.querySelector('#tCur'), hitsEl = body.querySelector('#tHits');
  const place = () => { zl = 0.04 + Math.random() * (0.92 - zw); zone.style.left = zl * 100 + '%'; zone.style.width = zw * 100 + '%'; };
  place();
  const loop = now => {
    if (!alive) return;
    const ph = ((now - t0) / 1000 / period) % 1; x = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    cur.style.left = x * 100 + '%'; raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  body.querySelector('#tStop').addEventListener('pointerdown', e => {
    e.preventDefault(); if (!alive) return;
    if (x >= zl && x <= zl + zw) {
      hits++; hitsEl.textContent = hits; sfx('ok'); haptic(30);
      if (hits >= 3) { alive = false; cancelAnimationFrame(raf); setTimeout(done, 250); return; }
      place();
    } else { penalty(MG_PENALTY); mgBad(); }
  });
  return () => { alive = false; cancelAnimationFrame(raf); };
}

/* Minigra 2: zapamiętaj i wpisz kod */
function seqGame(body, done) {
  const lvl = save.up.decrypt, len = [6, 5, 4, 3][lvl], showMs = [2600, 3200, 3800, 4600][lvl];
  let alive = true, timer = 0, code = '', input = '';
  function round() {
    if (!alive) return;
    code = Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join(''); input = '';
    body.innerHTML = `<div class="mg-help">ZAPAMIĘTAJ KOD</div><div class="code">${code.split('').join(' ')}</div><div class="sbar"><i id="sBar"></i></div>`;
    const bar = body.querySelector('#sBar');
    bar.style.transition = `width ${showMs}ms linear`;
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '0%'; }));
    timer = setTimeout(ask, showMs);
  }
  function ask() {
    if (!alive) return;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
    body.innerHTML = `<div class="mg-help">WPISZ KOD · błąd = −${MG_PENALTY} s i nowy kod</div><div class="code" id="sIn"></div>
      <div class="keypad">${keys.map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>`;
    const disp = body.querySelector('#sIn');
    const draw = () => { disp.textContent = (input + '_'.repeat(len - input.length)).split('').join(' '); };
    draw();
    body.querySelector('.keypad').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !alive) return;
      const k = b.dataset.k; sfx('click'); haptic(15);
      if (k === 'C') input = ''; else if (k === '⌫') input = input.slice(0, -1); else if (input.length < len) input += k;
      draw();
      if (input.length === len) {
        if (input === code) { alive = false; sfx('ok'); setTimeout(done, 250); }
        else { penalty(MG_PENALTY); mgBad(); setTimeout(round, 350); }
      }
    });
  }
  round();
  return () => { alive = false; clearTimeout(timer); };
}

/* stare minigry wpięte do rejestru */
MG.timing = { title: 'DEKODER CZASOWY', run: (body, c) => timingGame(body, c.done) };
MG.code = { title: 'ŁAMANIE KODU', run: (body, c) => seqGame(body, c.done) };
