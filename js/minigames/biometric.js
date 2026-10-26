'use strict';
/* MINIGRA: biometric */

/* 4. Biometryczna autoryzacja: przytrzymaj 4 s (wibracja navigator.vibrate) */
MG.biometric = { title: 'BIOMETRYCZNA AUTORYZACJA', run(body, c) {
  const NEED = 4000, MAXS = 3;
  let holding = false, t0 = 0, strikes = 0;
  const vib = ms => { const a = []; let t = 0, i = 0; while (t < ms - 300) { const on = 14 + Math.min(40, i * 3), off = 70; a.push(on, off); t += on + off; i++; } a.push(260); return a; };
  body.innerHTML = `<div class="mg-help">Przyłóż palec do skanera i <b>przytrzymaj 4 sekundy</b>. Puszczenie przerywa autoryzację.</div>
    <div class="bio-wrap"><div class="bio-ring"><button class="bio" oncontextmenu="return false">SKAN</button></div></div>
    <div class="mg-hud"><span>AUTORYZACJA <b id="bP">0%</b></span><span>PRÓBY <b id="bL">◆◆◆</b></span></div>`;
  const btn = c.q('.bio'), ring = c.q('.bio-ring'), bP = c.q('#bP'), bL = c.q('#bL');
  const lives = () => { bL.textContent = '◆'.repeat(MAXS - strikes) + '◇'.repeat(strikes); };
  const setP = p => { ring.style.setProperty('--p', p * 100); bP.textContent = Math.round(p * 100) + '%'; };
  btn.addEventListener('pointerdown', e => {
    e.preventDefault(); if (holding) return;
    holding = true; t0 = performance.now(); btn.classList.add('hold');
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    haptic(vib(NEED));
  });
  const release = () => {
    if (!holding) return;
    holding = false; btn.classList.remove('hold'); haptic(0); setP(0);
    strikes++; lives(); c.mistake();
    if (strikes >= MAXS) c.fail('AUTORYZACJA PRZERWANA');
  };
  btn.addEventListener('pointerup', release); btn.addEventListener('pointercancel', release); btn.addEventListener('lostpointercapture', release);
  const stopL = mgLoop(() => {
    if (!holding) return;
    const p = Math.min(1, (performance.now() - t0) / NEED); setP(p);
    if (p >= 1) { holding = false; btn.classList.remove('hold'); c.done(); }
  });
  return () => { stopL(); if (holding) haptic(0); };
} };
