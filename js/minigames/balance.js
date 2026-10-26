'use strict';
/* MINIGRA: balance */

/* 9. Balansowanie napięcia: utrzymaj drgający wskaźnik w bezpiecznej strefie przez 4 s */
MG.balance = { title: 'BALANSOWANIE NAPIĘCIA', run(body, c) {
  const L = c.lvl, zw = [0.26, 0.30, 0.34, 0.38][L], need = 4, PUSH = 3.4, DAMP = 2.2;
  let p = 0.5 + rand(-0.3, 0.3), v = 0, prog = 0, t = 0, lastBuzz = 0;
  const held = { l: false, r: false };
  body.innerHTML = `<div class="mg-help">Utrzymaj <b>drgający wskaźnik</b> w <b class="pink">bezpiecznej strefie</b> przez <b>4 s</b>. Steruj przyciskami ◄ ► (lub strzałkami).</div>
    <div class="mg-tbar"><i></i></div>
    <div class="bal"><div class="bz" style="left:${(0.5 - zw / 2) * 100}%;width:${zw * 100}%"></div><div class="bc"></div></div>
    <div class="gauge"><i></i><b>0.0 s</b></div>
    <div class="bal-btns"><button class="btn big" data-d="l">◄</button><button class="btn big" data-d="r">►</button></div>`;
  const zone = c.q('.bz'), cur = c.q('.bc'), gi = c.q('.gauge i'), gb = c.q('.gauge b');
  const stopT = mgLimit(26, c.q('.mg-tbar i'), c.timeout);
  body.querySelectorAll('.bal-btns .btn').forEach(b => {
    const d = b.dataset.d;
    b.addEventListener('pointerdown', e => { e.preventDefault(); held[d] = true; try { b.setPointerCapture(e.pointerId); } catch (_) {} });
    const rel = () => { held[d] = false; };
    b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel); b.addEventListener('lostpointercapture', rel);
  });
  const kd = e => { if (e.key === 'ArrowLeft') held.l = true; if (e.key === 'ArrowRight') held.r = true; };
  const ku = e => { if (e.key === 'ArrowLeft') held.l = false; if (e.key === 'ArrowRight') held.r = false; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const stopL = mgLoop((dt, now) => {
    t += dt;
    const n = Math.sin(t * 2.7) * 0.5 + Math.sin(t * 6.1 + 1.3) * 0.3 + (Math.random() - 0.5) * 0.9, dir = (held.r ? 1 : 0) - (held.l ? 1 : 0);
    v += (n * 2.6 + dir * PUSH) * dt; v *= Math.max(0, 1 - DAMP * dt); p += v * dt;
    if (p < 0.02) { p = 0.02; v = Math.abs(v) * 0.4; } if (p > 0.98) { p = 0.98; v = -Math.abs(v) * 0.4; }
    cur.style.left = ((p + (Math.random() - 0.5) * 0.012) * 100) + '%';
    const inZ = Math.abs(p - 0.5) <= zw / 2;
    prog = inZ ? Math.min(need, prog + dt) : Math.max(0, prog - dt * 1.5);
    zone.classList.toggle('ok', inZ);
    gi.style.width = (prog / need * 100) + '%'; gb.textContent = prog.toFixed(1) + ' s';
    if (!inZ && now - lastBuzz > 280) { haptic(18); lastBuzz = now; }
    if (prog >= need) c.done();
  });
  return () => { stopT(); stopL(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
} };
