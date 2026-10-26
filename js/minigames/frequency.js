'use strict';
/* MINIGRA: frequency */

/* 1. Przejęcie częstotliwości: dopasuj falę suwakiem */
MG.frequency = { title: 'PRZEJĘCIE CZĘSTOTLIWOŚCI', run(body, c) {
  const L = c.lvl, tol = [0.16, 0.2, 0.25, 0.3][L], need = 1.0;
  const target = rand(2.5, 8.5);
  let start; do { start = rand(1, 10); } while (Math.abs(start - target) < 2.5);
  body.innerHTML = `<div class="mg-help">Dostrój <b>cyjanową falę</b> do <b class="pink">różowej</b> suwakiem i utrzymaj zgodność przez <b>1 s</b>.</div>
    <div class="mg-tbar"><i></i></div><canvas class="mg-cv"></canvas>
    <input class="mg-range" type="range" min="1" max="10" step="0.01" value="${start.toFixed(2)}">
    <div class="mg-hud"><span>f = <b id="fV">${start.toFixed(2)}</b></span><span>SYNCHRO <b id="fS">0%</b></span></div>`;
  const cv = c.q('canvas'), g = cv.getContext('2d'), rng = c.q('input'), fS = c.q('#fS'), fV = c.q('#fV'), k = mgDpr();
  cv.width = cv.clientWidth * k; cv.height = cv.clientHeight * k;
  let lock = 0, was = false, t = 0;
  const stopT = mgLimit(24 + L * 2, c.q('.mg-tbar i'), c.timeout);
  const wave = (fr, col, lw, ph) => {
    const W = cv.width, H = cv.height;
    g.beginPath();
    for (let x = 0; x <= W; x += 2) { const y = H / 2 + Math.sin(x / W * Math.PI * 2 * fr + ph) * H * 0.34; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = col; g.lineWidth = lw * k; g.shadowColor = col; g.shadowBlur = 12 * k; g.stroke(); g.shadowBlur = 0;
  };
  const stopL = mgLoop(dt => {
    t += dt;
    const W = cv.width, H = cv.height, f = +rng.value, tg = target + 0.06 * Math.sin(t * 1.3), ok = Math.abs(f - tg) <= tol;
    lock = ok ? Math.min(need, lock + dt) : Math.max(0, lock - dt * 2);
    if (ok && !was) haptic(25); was = ok;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,240,255,.12)'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= W; x += W / 10) { g.moveTo(x, 0); g.lineTo(x, H); }
    g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    wave(tg, '#ff2bd6', 3, t * 3); wave(f, ok ? '#39ff88' : '#00f0ff', 2, t * 3);
    fV.textContent = f.toFixed(2); fS.textContent = Math.round(lock / need * 100) + '%';
    if (lock >= need) c.done();
  });
  return () => { stopT(); stopL(); };
} };
