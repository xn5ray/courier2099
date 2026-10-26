'use strict';
/* MINIGRA: pattern */

/* 5. Neuralny wzór: połącz węzły w podanej kolejności (tapnięcia lub przeciąganie) */
MG.pattern = { title: 'NEURALNY WZÓR', run(body, c) {
  const L = c.lvl, len = [6, 5, 5, 4][L], peek = [2800, 3200, 3600, 4000][L], MAXS = 3;
  const P = i => [50 + (i % 3) * 100, 50 + Math.floor(i / 3) * 100];
  const seq = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, len);
  let progress = 0, strikes = 0, phase = 'show', dragging = false, lastIn = -1;
  const path = [];
  const nodes = [...Array(9).keys()].map(i => { const [x, y] = P(i); return `<circle class="pn" data-i="${i}" cx="${x}" cy="${y}" r="17"/><text class="pt" x="${x}" y="${y + 6}" text-anchor="middle"></text>`; }).join('');
  body.innerHTML = `<div class="mg-help" id="pH"></div>
    <svg class="mg-grid" viewBox="0 0 300 300">
      <polyline id="pPre" points="${seq.map(i => P(i).join(',')).join(' ')}"/>
      <g id="pUser"></g><line id="pRub" x1="0" y1="0" x2="0" y2="0" opacity="0"/>${nodes}
    </svg>
    <div class="mg-hud"><span>WĘZŁY <b id="pN">0</b>/${len}</span><span>PRÓBY <b id="pL"></b></span></div>`;
  const svg = c.q('svg'), pre = c.q('#pPre'), user = c.q('#pUser'), rub = c.q('#pRub'), pH = c.q('#pH'), pN = c.q('#pN'), pL = c.q('#pL');
  const circles = [...svg.querySelectorAll('.pn')], texts = [...svg.querySelectorAll('.pt')];
  const tl = pre.getTotalLength();
  const lives = () => { pL.textContent = '◆'.repeat(MAXS - strikes) + '◇'.repeat(strikes); }; lives();
  const resetUser = () => { user.innerHTML = ''; circles.forEach(n => n.classList.remove('on')); progress = 0; path.length = 0; pN.textContent = 0; rub.setAttribute('opacity', 0); };
  const showPreview = ms => {
    phase = 'show'; pH.innerHTML = 'PODGLĄD WZORU — <b class="pink">zapamiętaj kolejność</b>…';
    seq.forEach((n, i) => { texts[n].textContent = i + 1; texts[n].classList.add('show'); });
    pre.style.transition = 'none'; pre.style.opacity = 1; pre.style.strokeDasharray = tl; pre.style.strokeDashoffset = tl; void pre.getBoundingClientRect();
    pre.style.transition = `stroke-dashoffset ${ms * 0.7}ms linear`; pre.style.strokeDashoffset = 0;
    c.later(() => {
      pre.style.transition = 'opacity .4s'; pre.style.opacity = 0; texts.forEach(t => t.classList.remove('show'));
      phase = 'input'; pH.innerHTML = 'ODTWÓRZ WZÓR — <b>stukaj lub przeciągaj</b> przez węzły w tej samej kolejności.';
    }, ms);
  };
  const toS = e => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 300, (e.clientY - r.top) / r.height * 300]; };
  const hit = ([x, y]) => { let b = -1, bd = 34; for (let i = 0; i < 9; i++) { const [px, py] = P(i), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; b = i; } } return b; };
  const segD = (a, b, n) => {                               // odległość węzła n od odcinka a-b (przelot po linii nie jest błędem)
    const [ax, ay] = P(a), [bx, by] = P(b), [px, py] = P(n), dx = bx - ax, dy = by - ay, t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    return (t < 0 || t > 1) ? 999 : Math.hypot(ax + t * dx - px, ay + t * dy - py);
  };
  const strike = () => {
    strikes++; c.mistake(); haptic([60, 30, 60]); lives();
    if (strikes >= MAXS) { phase = 'lock'; c.fail('SIEĆ ZABLOKOWANA'); return; }
    resetUser(); showPreview(1500);
  };
  const handle = (n, down) => {
    if (phase !== 'input' || n < 0) return;
    if (n === seq[progress]) {
      if (progress > 0) { const [x1, y1] = P(path[progress - 1]), [x2, y2] = P(n); user.insertAdjacentHTML('beforeend', `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`); }
      path.push(n); progress++; circles[n].classList.add('on'); pN.textContent = progress; haptic(14); beep(380 + progress * 70, .06, 'sine');
      if (progress >= len) { phase = 'lock'; c.later(c.done, 220); }
    } else if (!path.includes(n)) {
      if (!down && progress > 0 && segD(path[progress - 1], seq[progress], n) < 12) return;
      strike();
    }
  };
  svg.addEventListener('pointerdown', e => {
    e.preventDefault(); dragging = true; try { svg.setPointerCapture(e.pointerId); } catch (_) {}
    const n = hit(toS(e)); lastIn = n; if (n >= 0) handle(n, true);
  });
  svg.addEventListener('pointermove', e => {
    if (!dragging || phase !== 'input') return;
    const s = toS(e);
    if (progress > 0) { const [x1, y1] = P(path[progress - 1]); rub.setAttribute('x1', x1); rub.setAttribute('y1', y1); rub.setAttribute('x2', s[0]); rub.setAttribute('y2', s[1]); rub.setAttribute('opacity', .6); }
    const n = hit(s);
    if (n >= 0 && n !== lastIn) { lastIn = n; handle(n, false); } else if (n < 0) lastIn = -1;
  });
  const up = () => { dragging = false; lastIn = -1; rub.setAttribute('opacity', 0); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  c.later(() => showPreview(peek), 300);
  return null;
} };
