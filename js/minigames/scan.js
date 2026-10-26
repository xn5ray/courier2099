'use strict';
/* MINIGRA: scan */

/* 3. Skanowanie AR: celuj telefonem w kierunek (kompas / żyroskop; fallback = przeciąganie palcem) */
MG.scan = { title: 'SKANOWANIE AR', run(body, c) {
  const L = c.lvl, tol = [14, 16, 18, 20][L], hold = [1.4, 1.2, 1.0, 0.8][L], total = 2, CIRC = 2 * Math.PI * 48;
  let found = 0, tb = rand(0, 360), lock = 0, cur = heading != null ? heading : 0, mh = rand(0, 360), was = false, hinted = false, dragX = null;
  const t0 = performance.now();
  let ticks = '';
  for (let a = 0; a < 360; a += 10) { const major = a % 30 === 0; ticks += `<line x1="0" y1="-108" x2="0" y2="${major ? -94 : -101}" transform="rotate(${a})" stroke="#00f0ff" stroke-opacity="${major ? .9 : .4}"/>`; }
  const lbl = [['N', 0], ['E', 90], ['S', 180], ['W', 270]].map(([t, a]) => `<text transform="rotate(${a}) translate(0,-76)" text-anchor="middle" fill="#00f0ff" font-size="15" font-family="Orbitron">${t}</text>`).join('');
  body.innerHTML = `<div class="mg-help" id="sH">Obracaj się z telefonem, aż <b class="pink">różowy znacznik</b> trafi pod <b>górny wskaźnik</b>. Utrzymaj namiar.</div>
    <div class="mg-tbar"><i></i></div>
    <svg class="mg-rad" viewBox="-130 -130 260 260">
      <circle r="108" fill="#000" stroke="#00f0ff" stroke-opacity=".5"/>
      <g id="sRing">${ticks}${lbl}<g id="sTg"><polygon points="0,-112 -9,-94 9,-94" fill="#ff2bd6"/><line x1="0" y1="-92" x2="0" y2="-60" stroke="#ff2bd6" stroke-width="2" stroke-dasharray="3 4"/></g></g>
      <circle r="48" fill="none" stroke="#ff2bd6" stroke-opacity=".25" stroke-width="6"/>
      <circle id="sPr" r="48" fill="none" stroke="#39ff88" stroke-width="6" stroke-dasharray="0 ${CIRC}" transform="rotate(-90)"/>
      <polygon points="0,-128 -9,-112 9,-112" fill="#00f0ff"/><circle r="4" fill="#00f0ff"/>
    </svg>
    <div class="mg-hud"><span>CEL <b id="sN">1</b>/${total}</span><span>ODCHYLENIE <b id="sD">--</b>°</span></div>`;
  const ring = c.q('#sRing'), tg = c.q('#sTg'), pr = c.q('#sPr'), sD = c.q('#sD'), sN = c.q('#sN'), hintEl = c.q('#sH'), svg = c.q('svg');
  const stopT = mgLimit(40, c.q('.mg-tbar i'), c.timeout);
  svg.addEventListener('pointerdown', e => { dragX = e.clientX; try { svg.setPointerCapture(e.pointerId); } catch (_) {} });
  svg.addEventListener('pointermove', e => { if (dragX == null || heading != null) return; mh = (mh + (e.clientX - dragX) * 0.7 + 360) % 360; dragX = e.clientX; });
  const endDrag = () => { dragX = null; };
  svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  tg.setAttribute('transform', `rotate(${tb})`);
  const stopL = mgLoop(dt => {
    const sensor = heading != null;
    if (sensor) cur = (cur + mgAng(heading, cur) * Math.min(1, dt * 10) + 360) % 360; else cur = mh;
    if (!sensor && !hinted && performance.now() - t0 > 1500) { hinted = true; hintEl.innerHTML = 'Brak czujnika kierunku — <b>przeciągaj palcem</b> po radarze, by się obracać.'; }
    ring.setAttribute('transform', `rotate(${-cur})`);
    const diff = Math.abs(mgAng(tb, cur)), ok = diff <= tol;
    sD.textContent = Math.round(diff);
    lock = ok ? Math.min(hold, lock + dt) : Math.max(0, lock - dt * 1.5);
    if (ok && !was) haptic(15); was = ok;
    pr.setAttribute('stroke-dasharray', `${lock / hold * CIRC} ${CIRC}`);
    if (lock >= hold) {
      found++; lock = 0; sfx('ok'); haptic([40, 40, 40]);
      if (found >= total) { c.done(); return; }
      tb = (cur + rand(70, 290)) % 360; tg.setAttribute('transform', `rotate(${tb})`); sN.textContent = found + 1;
    }
  });
  return () => { stopT(); stopL(); };
} };
