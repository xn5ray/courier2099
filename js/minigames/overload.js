'use strict';
/* MINIGRA: overload */

/* 2. Przeciążenie węzła: klikaj, by dobić do 100% na czas */
MG.overload = { title: 'PRZECIĄŻENIE WĘZŁA', run(body, c) {
  const L = c.lvl, gain = [5, 5.5, 6, 6.5][L], decay = [9, 8, 7, 6][L];
  let v = 0;
  body.innerHTML = `<div class="mg-help">Wciskaj <b class="pink">PRZECIĄŻ</b> jak najszybciej — dobij do <b>100%</b>, zanim czas upłynie! Poziom sam opada.</div>
    <div class="mg-tbar"><i></i></div><div class="gauge"><i></i><b>0%</b></div>
    <button class="btn big pink mg-tap">⚡ PRZECIĄŻ ⚡</button>`;
  const bar = c.q('.gauge i'), txt = c.q('.gauge b'), btn = c.q('.mg-tap');
  const stopT = mgLimit(7 + L * 0.5, c.q('.mg-tbar i'), c.timeout);
  btn.addEventListener('pointerdown', e => {
    e.preventDefault(); v = Math.min(100, v + gain); haptic(12); beep(260 + v * 6, .04, 'square');
    if (v >= 100) { bar.style.width = '100%'; txt.textContent = '100%'; c.done(); }   // sprawdź od razu: pętla najpierw odejmuje decay, więc 100% nigdy by do niej nie dotarło
  });
  const stopL = mgLoop(dt => {
    v = Math.max(0, v - decay * dt);
    bar.style.width = v + '%'; txt.textContent = Math.floor(v) + '%';
    if (v >= 100) c.done();
  });
  return () => { stopT(); stopL(); };
} };
