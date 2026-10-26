'use strict';
/* MAPA i HUD: rysowanie mapy Leaflet, znaczniki, trasa, pasek informacji, aktualizacja pozycji gracza. */

/* ================= MAPA ================= */
function initMap() {
  if (map || typeof L === 'undefined') return;
  map = L.map('map', { zoomControl: false, attributionControl: true }).setView([52.2297, 21.0122], 17);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'dark-tiles', attribution: '© OpenStreetMap' }).addTo(map);
  gMarks = L.layerGroup().addTo(map); evg = L.layerGroup().addTo(map);
  map.on('dragstart', () => { follow = false; });
  map.on('click', e => { if (sim && M) setPos(e.latlng.lat, e.latlng.lng, 5); });
}
const mk = (cls, txt) => L.divIcon({ className: '', html: `<div class="mk ${cls}"><span>${txt}</span></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
function renderMap() {
  if (!map || !M) return;
  gMarks.clearLayers();
  const atBase = M.idx >= M.targets.length;
  L.marker([M.base.lat, M.base.lng], { icon: mk(atBase ? 'base goal' : 'base', 'B'), interactive: false }).addTo(gMarks);
  M.targets.forEach((t, i) => {
    const cls = t.done ? 'done' : (i === M.idx ? 'goal' : '');
    L.marker([t.lat, t.lng], { icon: mk(cls, t.done ? '✓' : i + 1), interactive: false }).addTo(gMarks);
  });
  if (M.preset) {
    L.polygon(AREA.poly, { color: '#ff2bd6', weight: 2, dashArray: '10 6', fill: false, interactive: false }).addTo(gMarks);
    if (sim || eff('intel')) AREA.points.filter(q => sim || dist(q, M.base) < 700).forEach(q => L.circleMarker([q.lat, q.lng], { radius: 4, color: '#fcee0a', weight: 1, fillOpacity: 0.8, interactive: false }).addTo(gMarks));
  }
  const g = goal();
  L.circle([g.lat, g.lng], { radius: radius(), color: '#00f0ff', weight: 1, dashArray: '4 4', fillColor: '#00f0ff', fillOpacity: 0.12, interactive: false }).addTo(gMarks);
  updateRoute();
}
function renderEvent() {
  if (!map) return;
  evg.clearLayers();
  const ev = M && M.event; if (!ev || ev.lat == null) return;
  const col = { patrol: '#ff3860', quiet: '#ff9500', hold: '#00f0ff', rogue: '#ff3860' }[ev.type] || '#ff2bd6';
  L.circle([ev.lat, ev.lng], { radius: ev.r || (ev.type === 'hold' ? 30 : radius()), color: col, weight: ev.r ? 2 : 1, dashArray: '6 6', fillColor: col, fillOpacity: ev.r ? 0.2 : 0.12, interactive: false }).addTo(evg);
  const cls = { patrol: 'drone', quiet: 'drone', hold: 'hold', rogue: 'rogue' }[ev.type] || 'bonus', ic = { patrol: '☢', quiet: '≋', hold: '⇩', drop: '▣', rogue: '✦' }[ev.type] || '₵';
  L.marker([ev.lat, ev.lng], { icon: mk(cls, ic), interactive: false }).addTo(evg);
}
function updateRoute() {
  if (!map || !M || !pos) return;
  const pts = [[pos.lat, pos.lng]];
  for (let i = M.idx; i < M.targets.length; i++) pts.push([M.targets[i].lat, M.targets[i].lng]);
  pts.push([M.base.lat, M.base.lng]);
  if (!routeLine) routeLine = L.polyline(pts, { color: '#ff2bd6', weight: 2, dashArray: '8 8', opacity: 0.85, interactive: false }).addTo(map);
  else routeLine.setLatLngs(pts);
}
function updatePlayerMarker() {
  if (!map || !pos) return;
  const ll = [pos.lat, pos.lng];
  if (!playerMk) {
    playerMk = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="pl"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), zIndexOffset: 1000, interactive: false }).addTo(map);
    accC = L.circle(ll, { radius: pos.acc || 0, color: '#00f0ff', weight: 1, fillOpacity: 0.06, interactive: false }).addTo(map);
  } else { playerMk.setLatLng(ll); accC.setLatLng(ll); accC.setRadius(pos.acc || 0); }
  updateRoute();
  if (follow) map.panTo(ll, { animate: true, duration: 0.5 });
}
function fitAll() {
  if (!map || !M) return;
  const b = L.latLngBounds([[M.base.lat, M.base.lng]]);
  M.targets.forEach(t => b.extend([t.lat, t.lng]));
  if (pos) b.extend([pos.lat, pos.lng]);
  map.fitBounds(b, { padding: [60, 60] });
}
function clearMap() {
  if (!map) return;
  gMarks.clearLayers(); evg.clearLayers();
  if (playerMk) { map.removeLayer(playerMk); playerMk = null; }
  if (accC) { map.removeLayer(accC); accC = null; }
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
}

/* ================= HUD ================= */
const actLabel = t => t === 'quick' && M && M.quick ? QUICK_MISSIONS[M.quick.v].act : t === 'pickup' ? 'POBIERZ DANE' : t === 'drop' ? 'DOSTARCZ PAKIET' : 'ZADOKUJ W BAZIE';
function updateHUD() {
  if (!M) return;
  const g = goal(), r = radius();
  $('#gName').textContent = (M.idx < M.targets.length ? `CEL ${M.idx + 1}: ` : '') + g.name;
  $('#hStep').textContent = M.idx < M.targets.length ? `${M.idx + 1}/${M.targets.length}` : 'BAZA';
  $('#hCred').textContent = Math.round((M.done * REWARD_TARGET + M.relays * REWARD_RELAY + (M.extra || 0)) * (M.night ? 1 + NIGHT.bonus : 1));
  $('#compInfo').textContent = heading == null ? 'KOMPAS: N ↑' : `HDG ${Math.round(heading)}°`;
  $('#dbg').hidden = !sim;
  $('#btnBlocked').hidden = M.idx >= M.targets.length;
  const btn = $('#btnAct');
  if (!pos) {
    $('#gDist').textContent = '---'; $('#gSub').textContent = 'OCZEKIWANIE NA SYGNAŁ GPS…';
    btn.disabled = true; btn.classList.remove('ready'); btn.textContent = 'CZEKAM NA GPS…'; $('#evRow').hidden = true; return;
  }
  const d = dist(pos, g);
  const ds = Math.max(0, d + (M.event && M.event.type === 'glitch' ? M.event.cur || 0 : 0)); $('#gDist').textContent = ds >= 1000 ? (ds / 1000).toFixed(2) + ' km' : Math.round(ds) + ' m';
  $('#gSub').textContent = M.quick ? quickSub(d, r) : `ZASIĘG INTERAKCJI: ${r} m`;
  $('#arrow').style.transform = `rotate(${bearing(pos, g) - (heading == null ? 0 : heading)}deg)`;
  const inR = d <= r;
  btn.disabled = !inR || mgActive;
  btn.classList.toggle('ready', inR && !mgActive);
  btn.textContent = inR ? actLabel(g.type) : `ZBLIŻ SIĘ (≤ ${r} m)`;
  const acc = pos.acc || 0;
  const gi = $('#gpsInfo');
  if (sim) { gi.textContent = 'GPS: SYMULACJA'; gi.style.color = 'var(--yellow)'; }
  else {
    gi.textContent = `GPS: ±${Math.round(acc)} m`;
    gi.style.color = acc <= 15 ? 'var(--green)' : acc <= 40 ? 'var(--yellow)' : 'var(--red)';
  }
  // zdarzenie
  const ev = M.event, row = $('#evRow'), t = ev && ev.type;
  $('#map').classList.toggle('jam', t === 'jam');
  $$('.hud').forEach(h => h.classList.toggle('glitch', t === 'glitch'));
  if (!ev || t === 'hacker') { row.hidden = true; return; }
  row.hidden = false;
  row.className = 'ev' + (['patrol', 'quiet', 'glitch', 'jam', 'rogue'].includes(t) ? ' patrol' : '');
  const left = fmt(Math.max(0, Math.ceil((ev.endsAt - Date.now()) / 1000))), br = $('#btnRelay'), d2 = ev.lat != null ? Math.round(dist(pos, ev)) : 0;
  let txt = '', b = null;
  if (t === 'patrol') { txt = `⚠ PATROL DRONÓW · ${ev.hit ? (ev.camo ? 'KAMUFLAŻ ✔' : 'WYKRYTO!') : 'strefa za ' + Math.max(0, d2 - ev.r) + ' m'} · ${left}`; b = ['HAKUJ DRONA (stój, 20 s)', d2 <= ev.r + 40 && spd < 0.8]; }
  else if (t === 'quiet') txt = `≋ CZUJNIKI DRGAŃ · ${d2 <= ev.r ? 'DETEKCJA ' + Math.round(ev.det) + '% — IDŹ WOLNO!' : 'strefa za ' + (d2 - ev.r) + ' m'} · ${left}`;
  else if (t === 'jam') txt = `📡 ZAGŁUSZACZ · tylko kompas i dystans · ${left}`;
  else if (t === 'drop') { txt = `▣ DEAD DROP · ${d2} m · ${left}`; b = ['OTWÓRZ SKRZYNIĘ', d2 <= r]; }
  else if (t === 'hold') txt = `⇩ PRZEJĘCIE SYGNAŁU · ${d2 <= 30 ? 'trzymaj pozycję ' + fmt(180 - ev.held) : 'wejdź w 30 m (' + d2 + ' m)'} · ${left}`;
  else if (t === 'rogue') { txt = `✦ ROGUE GLITCH ucieka · ${d2} m · ${left}`; b = [d2 <= r ? 'ZŁAP GLITCHA' : 'ZA DALEKO — BIEGNIJ!', d2 <= r]; }
  else if (t === 'glitch') { txt = `⚠ AWARIA CYBERWARE · ${left}`; b = [`NAPRAW (${FIX_COST} ₵)`, save.credits >= FIX_COST]; }
  else { txt = `⚡ SZYBKI PRZEKAZ · ${d2} m · ${left}`; b = [d2 <= r ? 'PRZECHWYĆ' : 'ZA DALEKO', d2 <= r]; }
  $('#evTxt').textContent = txt;
  br.hidden = !b; if (b) { br.textContent = b[0]; br.disabled = !b[1] || mgActive; }
}
let lastWp = null, lastWpT = 0, spd = 0, mvAnchor = null;   // spd = prędkość (m/s)
function onPosChanged() {
  if (!M) return;
  const now = Date.now();
  if (lastWp) { const dt = (now - lastWpT) / 1000;
    if (dt > 0.3) { const d = dist(lastWp, pos); spd = spd * 0.5 + (d / dt) * 0.5; lastWp = pos; lastWpT = now; } }
  else { lastWp = pos; lastWpT = now; }
  // czas marszu: liczony od punktu-kotwicy, niezależnie od częstotliwości odczytów GPS
  if (!mvAnchor) { mvAnchor = { lat: pos.lat, lng: pos.lng, t: now }; }
  else if (dist(mvAnchor, pos) >= 8) { M.walkMs = (M.walkMs || 0) + Math.min(now - mvAnchor.t, 90000); mvAnchor = { lat: pos.lat, lng: pos.lng, t: now }; }
  else if (now - mvAnchor.t > 90000) { mvAnchor = { lat: pos.lat, lng: pos.lng, t: now }; }   // stoisz — nie licz
  updatePlayerMarker(); checkPatrol(); updateHUD();
}
