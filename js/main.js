'use strict';
/* START: podpięcie przycisków, przycisk wstecz (Android), pierwsze rysowanie menu. Ładowany jako ostatni. */

/* publiczne API */
window.startMinigame = startMinigame;
window.MINIGAMES = MG_ALL.slice();

/* ================= PODPIĘCIE ZDARZEŃ ================= */
document.addEventListener('click', e => { if (e.target.closest('.btn')) { initAudio(); sfx('click'); } });
$('#btnStart').onclick = () => { if (loadMissionSaved() && !confirm('Masz niedokończoną misję. Rozpocząć nową (stara przepadnie)?')) return; startMission(); };
$('#btnQuick').onclick = openBoard;
$('#btnBoardBack').onclick = () => { renderMenu(); show('menu'); };
$('#btnResume').onclick = resumeMission;
$('#btnResetCred').onclick = () => { if (!confirm('Zresetować kasę do 0 ₵? Ulepszenia zostają.')) return; save.credits = 0; persist(); renderMenu(); sfx('bad'); haptic(60); };
$('#btnShop').onclick = () => { selT = null; renderSafe(); show('shop'); };
$('#btnShopBack').onclick = () => { renderMenu(); show('menu'); };
$('#optSound').onchange = e => { save.sound = e.target.checked; persist(); };
$('#optHaptic').onchange = e => { save.haptic = e.target.checked; persist(); haptic(50); };
$('#optSim').onchange = e => { save.sim = e.target.checked; persist(); };
$('#btnAct').onclick = onAct;
$('#btnRelay').onclick = onRelay;
$$('#choice [data-c]').forEach(b => b.onclick = () => resolveChoice(b.dataset.c));
let dbgI = 0;
$('#dbgNext').onclick = () => { if (M && sim) { M.event = null; spawnEvent(['quiet', 'patrol', 'jam', 'drop', 'hold', 'hacker', 'glitch', 'rogue'][dbgI++ % 8]); } };
$('#dbgPatrol').onclick = () => { if (M && sim) spawnEvent('patrol'); };
$('#dbgRelay').onclick = () => { if (M && sim) spawnEvent('relay'); };
let dbgG = 0;
$('#dbgMg').onclick = () => { if (!(M && sim)) return; const id = MG_ALL[dbgG++ % MG_ALL.length]; startMinigame(id, () => toast('TEST ' + id + ': ZALICZONA', 'good'), r => toast('TEST ' + id + ': ' + r, 'warn')); };
$('#mgExit').onclick = cancelMinigame;
$('#btnAbort').onclick = () => { if (confirm('Przerwać misję? Dostaniesz tylko część nagrody za zaliczone cele.')) finish('abort'); };
$('#btnCenter').onclick = () => { follow = true; if (pos && map) map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 17)); };
$('#btnFit').onclick = () => { follow = false; fitAll(); };
$('#btnEditor').onclick = openEditor;
$('#edBack').onclick = closeEditor;
$('#btnBlocked').onclick = onBlocked;
$('#resOk').onclick = () => { $('#result').hidden = true; renderMenu(); show('menu'); };


/* Android: przycisk wstecz */
(() => {
  const app = plug('App'); if (!app) return;
  app.addListener('backButton', () => {
    if (!$('#mg').hidden) { cancelMinigame(); return; }
    if (!$('#cloud').hidden) { closeCloud(); return; }
    if (!$('#qdlg').hidden) return;
    if ($('#editor').classList.contains('active')) { closeEditor(); return; }
    if (M) { toast('Misja trwa — użyj ✕ aby ją przerwać.', 'warn', 2500); return; }
    if ($('#board').classList.contains('active')) { renderMenu(); show('menu'); return; }
    if ($('#shop').classList.contains('active')) { renderMenu(); show('menu'); return; }
    if (!$('#result').hidden) return;
    app.exitApp();
  });
})();

renderMenu();
if (typeof L === 'undefined') $('#menuHint').textContent = 'Uwaga: brak połączenia z internetem — mapa się nie załaduje.';
else if (!window.isSecureContext) $('#menuHint').textContent = 'Strona nie jest w HTTPS — GPS nie zadziała (użyj trybu symulacji lub hostingu HTTPS).';
