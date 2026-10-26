'use strict';
/* TABLICA ZLECEŃ: 3 szybkie misje do wyboru. Pominięty (lub wykonany) slot ma cooldown, po którym losuje się nowe zlecenie
   i przychodzi powiadomienie. Ustawienia (liczba slotów, czasy cooldownu) w data/quick-missions.js. Stan: save.qboard. */

const BOARD_NOTIF_BASE = 9001;    // stałe ID powiadomień (slot 0..2) — ponowne zaplanowanie nadpisuje stare
const boardTimers = {};           // tylko dla przeglądarki (bez Androida): działa, dopóki karta żyje

function boardPick(avoid) {
  const all = Object.keys(QUICK_MISSIONS);
  let pool = all.filter(k => !avoid.includes(k));
  if (!pool.length) pool = all;
  return pool[Math.floor(Math.random() * pool.length)];
}

function boardInit() {
  let b = save.qboard, dirty = false;
  if (!Array.isArray(b) || b.length !== QUICK_SLOTS) {
    b = []; for (let i = 0; i < QUICK_SLOTS; i++) b.push({ v: boardPick(b.map(s => s.v)), cd: 0, taken: false, mid: 0 });
    save.qboard = b; dirty = true;
  }
  b.forEach((s, i) => { if (!QUICK_MISSIONS[s.v]) { s.v = boardPick(b.filter((_, j) => j !== i).map(x => x.v)); dirty = true; } });
  if (dirty) persist();
  return b;
}

/* powiadomienie „slot odnowiony” o zadanej godzinie */
function boardNotify(i, at) {
  const n = nNotif(), title = '✔ ZLECENIE ODNOWIONE', body = 'Nowe zlecenie czeka na tablicy — otwórz grę.';
  if (n) {
    try { n.schedule({ notifications: [{ id: BOARD_NOTIF_BASE + i, title, body, schedule: { at: new Date(at), allowWhileIdle: true } }] }); } catch (e) {}
    return;
  }
  clearTimeout(boardTimers[i]);
  boardTimers[i] = setTimeout(() => {
    try { if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') new Notification(title, { body }); } catch (e) {}
  }, Math.max(0, at - Date.now()));
}

/* slot → cooldown (pominięcie, koniec misji) */
function boardCooldown(i, min) {
  const b = boardInit(), s = b[i]; if (!s) return;
  s.taken = false; s.mid = 0; s.cd = Date.now() + min * 60000;
  persist(); boardNotify(i, s.cd);
}
const boardUsed = (i, kind) => boardCooldown(i, kind === 'success' ? QUICK_DONE_CD_MIN : QUICK_SKIP_CD_MIN);
function boardTake(i, mid) { const s = boardInit()[i]; if (!s) return; s.taken = true; s.mid = mid; s.cd = 0; persist(); }

/* odnawia zlecenia po cooldownie; zwraca indeksy odnowionych slotów */
function boardRefresh() {
  const b = boardInit(), now = Date.now(), renewed = [];
  b.forEach((s, i) => {
    if (s.taken) {   // misja zniknęła bez wyniku (wygasła / zastąpiona inną) → traktuj jak przerwaną
      const m = loadMissionSaved();
      if (!m || !m.quick || m.quick.slot !== i || m.startedAt !== s.mid) boardCooldown(i, QUICK_SKIP_CD_MIN);
    }
  });
  b.forEach((s, i) => {
    if (!s.taken && s.cd && s.cd <= now) {
      s.v = boardPick(b.filter((_, j) => j !== i).map(x => x.v).concat(s.v)); s.cd = 0; renewed.push(i);
    }
  });
  if (renewed.length) persist();
  return renewed;
}

function boardSkip(i) {
  const s = boardInit()[i]; if (!s || s.taken || s.cd > Date.now()) return;
  boardCooldown(i, QUICK_SKIP_CD_MIN); sfx('bad'); haptic(40); renderBoard();
}

function boardGo(i) {
  const s = boardInit()[i]; if (!s || s.taken || s.cd > Date.now()) return;
  if (loadMissionSaved() && !confirm('Masz niedokończoną misję. Rozpocząć nową (stara przepadnie)?')) return;
  startMission(true, s.v, i);
}

function renderBoard() {
  const renewed = boardRefresh(), b = boardInit(), now = Date.now(), box = $('#bdList'); box.innerHTML = '';
  b.forEach((s, i) => {
    const d = document.createElement('div'), V = QUICK_MISSIONS[s.v];
    if (s.taken) {
      d.className = 'bd-card run';
      d.innerHTML = '<div class="si-name">W TRAKCIE</div><div class="si-desc">Zlecenie wzięte — wróć do misji przyciskiem WZNÓW w menu.</div>';
    } else if (s.cd > now) {
      d.className = 'bd-card cd';
      d.innerHTML = '<div class="si-name">SLOT ' + (i + 1) + ' · CHŁODZENIE</div><div class="si-desc">Nowe zlecenie pojawi się za:</div><div class="bd-cd" data-cd="' + s.cd + '">' + fmt((s.cd - now) / 1000) + '</div>';
    } else {
      const mins = V.fixedMin ? V.fixedMin + ' min' : V.minutes[0] + '–' + V.minutes[1] + ' min';
      d.className = 'bd-card' + (renewed.includes(i) ? ' new' : '');
      d.innerHTML = '<div class="si-name">' + V.title + '</div><div class="si-desc">' + V.intro + '</div>' +
        '<div class="bd-meta">' + V.dist[0] + '–' + V.dist[1] + ' m · ' + mins + ' · ok. ' + (QUICK_BASE_REWARD + V.reward) + ' ₵</div>' +
        '<div class="bd-row"><button class="btn small" data-go="' + i + '">▶ WEŹ</button><button class="btn small pink" data-skip="' + i + '">✖ POMIŃ</button></div>';
    }
    box.appendChild(d);
  });
  $$('#bdList [data-go]').forEach(x => x.onclick = () => boardGo(+x.dataset.go));
  $$('#bdList [data-skip]').forEach(x => x.onclick = () => boardSkip(+x.dataset.skip));
  $('#bdNote').textContent = 'Pominięty lub wykonany slot odnawia się po ' + QUICK_SKIP_CD_MIN + '/' + QUICK_DONE_CD_MIN + ' min — dostaniesz powiadomienie.';
  if (renewed.length) { sfx('alert'); haptic([60, 40, 60]); }
}

function openBoard() {
  initNotif();   // Android: prośba o zgodę na powiadomienia
  if (!nNotif() && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
  renderBoard(); show('board');
}

/* odliczanie na żywo + odświeżenie po powrocie do gry */
setInterval(() => {
  if (!$('#board').classList.contains('active')) return;
  const now = Date.now(); let expired = false;
  $$('#bdList [data-cd]').forEach(el => { const t = +el.dataset.cd - now; if (t <= 0) expired = true; else el.textContent = fmt(t / 1000); });
  if (expired) renderBoard();
}, 1000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('#board').classList.contains('active')) renderBoard(); });
