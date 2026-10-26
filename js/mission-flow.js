'use strict';
/* PRZEBIEG MISJI: start, wznowienie, koniec (ekran wyniku/nagrody) i akcje gracza po dotarciu do celu. */

/* ================= START / KONIEC ================= */
async function startMission(quick) {
  initAudio(); requestCompass(); lockScreen(); initNotif();
  sim = save.sim;
  $('#menuHint').textContent = '';
  $('#loading').hidden = false; $('#loadMsg').textContent = 'SKANOWANIE SATELIT…';
  let start;
  try { const p = await geoOnce(); start = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; }
  catch (e) {
    if (sim) start = { lat: AREA.center.lat, lng: AREA.center.lng, acc: 5 };
    else { $('#loading').hidden = true; releaseLock(); $('#menuHint').textContent = geoErrText(e); return; }
  }
  if (sim && dist(start, FIXED_BASE) > FIXED_BASE_RADIUS) start = { lat: FIXED_BASE.lat, lng: FIXED_BASE.lng, acc: 5 };
  const bs = quick ? { lat: start.lat, lng: start.lng } : (dist(start, FIXED_BASE) <= FIXED_BASE_RADIUS ? { lat: FIXED_BASE.lat, lng: FIXED_BASE.lng } : start);   // baza misji
  let roadNodes = null, giveUp = false;
  const qv = quick ? pickQuickVariant() : null;
  const presetOn = quick ? quickHasPts(bs, qv) : usePreset(bs);
  while (!presetOn && !roadNodes && !giveUp) {
    for (let tries = 0; tries < 2 && !roadNodes; tries++) {
      $('#loadMsg').textContent = 'POBIERANIE MAPY ULIC…' + (tries ? ' (próba ' + (tries + 1) + ')' : '');
      roadNodes = await fetchRoads(bs);
    }
    if (!roadNodes) {
      $('#loading').hidden = true;
      const again = confirm('Nie udało się pobrać ulic (' + lastRoadErr + ').\n\nOK = spróbuj jeszcze raz\nAnuluj = losuj cele bez sprawdzania dróg');
      $('#loading').hidden = false;
      if (!again) giveUp = true;
    }
  }
  roadGrid = roadNodes ? buildGrid(roadNodes, bs.lat) : null;
  $('#loading').hidden = true;
  if (typeof L === 'undefined') { $('#menuHint').textContent = 'Nie załadowano biblioteki mapy (Leaflet) — sprawdź internet.'; releaseLock(); return; }
  M = quick ? createQuick(bs, qv) : createMission(bs);
  pos = null;
  beginUI(false);
  setPos(start.lat, start.lng, start.acc);
  saveMission();
  if (quick) toast('<b>SZYBKA MISJA: ' + QUICK_MISSIONS[qv].title + '</b> — ' + QUICK_MISSIONS[qv].intro + (!presetOn && !roadGrid ? ' <i>(cel bez weryfikacji dróg)</i>' : ''), 'good', 9000);
  else if (presetOn) toast(fixedUsed ? '<b>TRASA: ' + fixedUsed + '</b> — stałe punkty, idź po kolei.' : '<b>PRESET: ' + AREA.name + '</b> — cele wybrane z gotowych punktów na ulicach.', 'good', 6000);
  else if (!roadGrid) toast('<b>Brak danych o ulicach</b> — cele wylosowane bez sprawdzania dróg. Oceń je na mapie przed wyjściem.', 'warn', 9000);
  toast(sim ? '<b>TRYB SYMULACJI:</b> dotknij mapy, aby się przenieść.' : '<b>MISJA ROZPOCZĘTA.</b> Idź do celu nr 1.', 'good', 6000);
  sfx('ok'); haptic(60);
}
function resumeMission() {
  const m = loadMissionSaved(); if (!m) { renderMenu(); return; }
  initAudio(); requestCompass(); lockScreen();
  sim = save.sim; M = m; pos = sim ? { lat: M.base.lat, lng: M.base.lng, acc: 5 } : null;
  beginUI(true);
  const b0 = { lat: M.base.lat, lng: M.base.lng };
  if (!M.preset && !M.quick) fetchRoads(b0).then(n => { roadGrid = n ? buildGrid(n, b0.lat) : null; });
  toast('Misja wznowiona.', 'good', 3000);
}
function beginUI(resume) {
  show('game'); initMap();
  setTimeout(() => { if (map) { map.invalidateSize(); renderMap(); renderEvent(); fitAll(); if (pos) updatePlayerMarker(); } }, 80);
  follow = false;
  setTimeout(() => { if (M && map) { follow = true; if (pos) map.setView([pos.lat, pos.lng], 17); } }, 5000);
  startWatch();
  clearInterval(tickT); tickT = setInterval(tick, 1000);
  tick(); updateHUD();
}
function finish(kind) {
  if (!M) return;
  const m = M; M = null;
  clearInterval(tickT); stopWatch(); releaseLock();
  if (mgCancel) mgCancel(); mgCancel = null; mgActive = false; $('#mg').hidden = true; $('#qdlg').hidden = true;
  try { localStorage.removeItem(MISSION_KEY); } catch (e) {}
  const rem = Math.max(0, Math.ceil((m.endsAt - Date.now()) / 1000));
  const lines = []; let total = 0, title;
  const base = m.done * REWARD_TARGET;
  if (m.quick) {
    const V = QUICK_MISSIONS[m.quick.v];
    if (kind === 'success') {
      title = 'SZYBKA MISJA ZAKOŃCZONA · ' + V.title;
      const tb = Math.floor(rem / 8), bn = m.quick.bonus || V.reward;
      lines.push(['Cel dostarczony', QUICK_BASE_REWARD], [`Premia za czas (zostało ${fmt(rem)})`, tb], [V.title + ' — premia za zadanie', bn]);
      total += QUICK_BASE_REWARD + tb + bn;
      if (m.quick.clean) { lines.push(['Czyste podejście (bez wykrycia)', m.quick.clean]); total += m.quick.clean; }
    } else {
      title = kind === 'timeout' ? 'CZAS MINĄŁ — SZYBKA MISJA NIEUDANA' : 'SZYBKA MISJA PRZERWANA';
      lines.push(['Brak wypłaty za niedokończone zadanie', 0]);
    }
  } else if (kind === 'success') {
    title = 'MISJA ZAKOŃCZONA';
    const tb = Math.floor(rem / 6);
    lines.push([`Dostarczone cele (${m.done})`, base], [`Premia za czas (zostało ${fmt(rem)})`, tb], ['Bonus za ukończenie misji', REWARD_COMPLETE]);
    total += base + tb + REWARD_COMPLETE;
  } else if (kind === 'timeout') {
    title = 'CZAS MINĄŁ — MISJA NIEUDANA';
    const v = Math.floor(base / 2); lines.push([`Cele (${m.done}) — połowa stawki`, v]); total += v;
  } else {
    title = 'MISJA PRZERWANA';
    const v = Math.floor(base / 4); lines.push([`Cele (${m.done}) — ćwierć stawki`, v]); total += v;
  }
  if (m.relays) { lines.push([`Szybkie przekazy (${m.relays})`, m.relays * REWARD_RELAY]); total += m.relays * REWARD_RELAY; }
  if (m.extra) { lines.push(['Premie z wydarzeń', m.extra]); total += m.extra; }
  let sc = m.scrap || 0, co = m.cool || 0;
  if (kind === 'success') {
    co += 1;
    const nn = eff('node'); if (nn) { lines.push([`Serwery danych (${nn})`, nn * 25]); total += nn * 25; }
    let found = 0; for (let i = 0; i < eff('cache'); i++) if (Math.random() < 0.35) found++;
    if (found) { save.comps += found; lines.push(['Magazyn: rzadkie komponenty', '+' + found + ' ◈']); }
  }
  if (sc) { save.scrap += sc; lines.push(['Złom technologiczny', '+' + sc + ' ⚙']); }
  if (co) { save.cool += co; lines.push(['Chłodziwo', '+' + co + ' ❄']); }
  if (m.penalties) lines.push([`Kary czasowe (info)`, '−' + m.penalties + ' s']);
  save.credits += total; if (kind === 'success') save.missions++; save.best = Math.max(save.best, total); persist();
  $('#resTitle').textContent = title;
  $('#resTitle').style.color = kind === 'success' ? 'var(--green)' : 'var(--red)';
  $('#resBody').innerHTML = lines.map(l => `<div class="res-line"><span>${l[0]}</span><b>${typeof l[1] === 'number' ? '+' + l[1] + ' ₵' : l[1]}</b></div>`).join('');
  $('#resTotal').textContent = '+' + total + ' ₵';
  $('#result').hidden = false;
  clearMap();
  sfx(kind === 'success' ? 'end' : 'bad'); haptic(kind === 'success' ? [100, 50, 100, 50, 300] : [500]);
}

/* ================= AKCJE ================= */
function onAct() {
  if (!M || !pos || mgActive) return;
  const g = goal();
  if (dist(pos, g) > radius()) return;
  if (M.quick) { onQuickAct(); return; }
  if (g.type === 'base') { finish('success'); return; }
  runMinigame(g.type === 'pickup' ? 'POBIERANIE DANYCH' : 'DOSTAWA PAKIETU', () => {
    const t = M.targets[M.idx]; t.done = true; M.idx++; M.done++; M.scrap = (M.scrap || 0) + 2;
    sfx('ok'); haptic([80, 40, 80]);
    const last = M.idx >= M.targets.length;
    toast(`<b>${t.type === 'pickup' ? 'DANE POBRANE' : 'PAKIET DOSTARCZONY'}</b> (+${REWARD_TARGET} ₵). ${last ? 'Wracaj do BAZY!' : 'Następny cel: ' + (M.idx + 1)}`, 'good', 6000);
    saveMission(); renderMap(); updateHUD();
  });
}
function onBlocked() {
  if (!M || mgActive || M.idx >= M.targets.length) return;
  if (!confirm('Cel niedostępny? Zostanie zastąpiony innym punktem. Jeśli to punkt z listy, trafi na stałą czarną listę (przywrócisz go w EDYTORZE).')) return;
  const t = M.targets[M.idx];
  const hit = AREA.points.find(q => dist(q, t) < 3);
  if (hit) {
    if (typeof hit.id === 'string') pe.added = pe.added.filter(a => a.id !== hit.id);
    else if (!pe.removed.includes(hit.id)) pe.removed.push(hit.id);
    savePe(); applyPts();
  }
  let rep = null;
  if (M.preset) {
    rep = AREA.points.filter(q => !M.targets.some(o => dist(q, o) < 60) && dist(q, t) > 60 && dist(q, M.base) >= 150)
      .sort((a, b) => dist(a, t) - dist(b, t))[0] || null;
  }
  if (!rep) { const p = offset(t, rand(120, 260), Math.random() * 360); rep = snap(p, 250) || p; }
  M.targets[M.idx] = { lat: rep.lat, lng: rep.lng, name: t.name.split(' · ')[0] + (rep.s ? ' · ' + rep.s : ''), type: t.type, done: false };
  saveMission(); renderMap(); updateHUD();
  toast(hit ? '<b>CEL ZASTĄPIONY</b> — stary punkt usunięty na stałe.' : '<b>CEL ZASTĄPIONY</b> tylko w tej misji (to punkt stałej trasy — przesuń go w EDYTORZE).', 'warn', 7000);
}
function onRelay() {
  const e0 = M && M.event;
  if (e0 && pos && !mgActive) {
    if (e0.type === 'glitch') { if (save.credits >= FIX_COST) { save.credits -= FIX_COST; persist(); endEvent('<b>CYBERWARE NAPRAWIONY</b> −' + FIX_COST + ' ₵', 'good'); } return; }
    if (e0.type === 'patrol') { hackDrone(e0); return; }
    if (e0.type === 'drop' && dist(pos, e0) <= radius()) { const v = Math.round(rand(60, 140)); M.extra += v; const sc = Math.round(rand(2, 5)), co = Math.random() < 0.5 ? Math.round(rand(1, 2)) : 0; M.scrap = (M.scrap || 0) + sc; M.cool = (M.cool || 0) + co; sfx('ok'); haptic([60, 40, 60, 40, 120]); endEvent(`<b>SKRZYNIA OTWARTA!</b> +${v} ₵ · +${sc} ZŁOM` + (co ? ` · +${co} CHŁODZIWA` : ''), 'good'); return; }
  }
  if (!M || !pos || mgActive || !M.event || M.event.type !== 'relay') return;
  if (dist(pos, M.event) > radius()) return;
  runMinigame('PRZECHWYTYWANIE SYGNAŁU', () => {
    if (!M) return;
    M.relays++; M.scrap = (M.scrap || 0) + 3; sfx('ok'); haptic([60, 40, 60, 40, 120]);
    endEvent(`<b>PRZEKAZ ZALICZONY!</b> +${REWARD_RELAY} ₵`, 'good');
  });
}
