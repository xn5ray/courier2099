'use strict';
/* KRYJÓWKA: menu główne (statystyki) i ekran Kryjówki — budowanie modułów jest generyczne, czyta budynki z MODS (data/config.js). */

function renderMenu() {
  collectNodes();
  $('#stCredits').textContent = save.credits;
  $('#stScrap').textContent = save.scrap; $('#stCool').textContent = save.cool; $('#stComp').textContent = save.comps;
  $('#stMissions').textContent = save.missions;
  $('#stBest').textContent = save.best;
  $('#optSound').checked = save.sound; $('#optHaptic').checked = save.haptic; $('#optSim').checked = save.sim;
  $('#btnResume').hidden = !loadMissionSaved();
}
function collectNodes() {
  const now = Date.now(), n = eff('node');
  if (!save.nodeT || !n) { save.nodeT = now; return 0; }
  const v = Math.floor(n * 30 * Math.min(12, (now - save.nodeT) / 3600000));
  if (v > 0) { save.credits += v; save.nodeT = now; persist(); }
  return v;
}
let selT = null;
const canPay = c => save.credits >= c[0] && save.scrap >= c[1] && save.cool >= c[2];
const payC = c => { save.credits -= c[0]; save.scrap -= c[1]; save.cool -= c[2]; };
const costTxt = c => c[0] + ' ₵' + (c[1] ? ' · ' + c[1] + ' ZŁOM' : '') + (c[2] ? ' · ' + c[2] + ' CHŁ' : '');
function renderSafe() {
  collectNodes();
  $('#shopCred').textContent = save.credits; $('#shScrap').textContent = save.scrap; $('#shCool').textContent = save.cool; $('#shComp').textContent = save.comps;
  const g = grid();
  $('#shPwr').innerHTML = g.use + ' / ' + g.cap + ' W' + (g.ok ? '' : ' <b class="red">— PRZECIĄŻENIE: BONUSY WYŁĄCZONE (dostaw Generator)</b>');
  $('#pwrBar').classList.toggle('low', !g.ok); $('#pwrBar i').style.width = Math.min(100, g.use / g.cap * 100) + '%';
  const box = $('#sGrid'); box.innerHTML = '';
  save.safe.forEach((t, i) => {
    const d = document.createElement('div'); let cls = 'tile', h;
    if (t === 'lock') { cls += ' lock'; h = '<i>🔒</i>ZABLOK.'; }
    else if (t === 'core') { cls += ' core'; h = '<i>▦</i>TERMINAL'; }
    else if (!t) { cls += ' empty'; h = '<i>+</i>PUSTE'; }
    else { if (!g.ok && t !== 'gen') cls += ' off'; h = '<i>' + MODS[t].ic + '</i>' + MODS[t].name.split(' ')[0]; }
    if (i === selT) cls += ' sel';
    d.className = cls; d.innerHTML = h; d.onclick = () => { selT = i; sfx('click'); renderSafe(); };
    box.appendChild(d);
  });
  const info = $('#shInfo'), t = save.safe[selT]; info.innerHTML = '';
  const add = h => { const p = document.createElement('div'); p.className = 'si-desc'; p.innerHTML = h; info.appendChild(p); };
  const btn = (txt, ok, fn) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = txt; b.disabled = !ok;
    b.onclick = () => { collectNodes(); fn(); persist(); sfx('buy'); haptic(40); renderSafe(); renderMenu(); }; info.appendChild(b); };
  if (selT == null) { add('Dotknij kafelka, aby go zbadać lub rozbudować.'); return; }
  if (t === 'lock') { add('<div class="si-name">ZABLOKOWANY SEKTOR</div>Zawalony tunel — odgruzuj, aby zyskać miejsce pod budowę.'); btn('ODBLOKUJ — ' + costTxt(UNLOCK), canPay(UNLOCK), () => { payC(UNLOCK); save.safe[selT] = null; }); }
  else if (t === 'core') add('<div class="si-name">TERMINAL CENTRALNY</div>Serce kryjówki. Zasila bazę (' + CORE_W + ' W) — reszta mocy musi pochodzić z Generatorów.');
  else if (!t) {
    add('<div class="si-name">PUSTY SEKTOR</div>Wybierz moduł do zbudowania:');
    for (const k in MODS) { const m = MODS[k]; add('<b>' + m.ic + ' ' + m.name + '</b> · ' + (m.pw ? '+' + m.pw : '−' + m.w) + ' W<br>' + m.desc);
      btn('BUDUJ — ' + costTxt(m.cost), canPay(m.cost), () => { payC(m.cost); save.safe[selT] = k; if (k === 'node' && cnt('node') === 1) save.nodeT = Date.now(); }); }
  } else {
    const m = MODS[t]; add('<div class="si-name">' + m.ic + ' ' + m.name + '</div>' + m.desc + '<br>' + (m.pw ? 'Produkcja: +' + m.pw : 'Pobór: ' + m.w) + ' W');
    btn('DEMONTUJ (zwrot ' + Math.floor(m.cost[0] / 2) + ' ₵ · ' + Math.floor(m.cost[1] / 2) + ' ZŁOM)', true, () => { save.credits += Math.floor(m.cost[0] / 2); save.scrap += Math.floor(m.cost[1] / 2); save.safe[selT] = null; });
  }
}
