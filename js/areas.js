'use strict';
/* OBSZARY: strefy (teren startowy + wygenerowane w data/areas.generated.js), odblokowywanie i ekran z mapą stref.
   Odblokowanie: liczba udanych misji + opłata ₵ + odblokowany sąsiad → stan 'paid' → pierwsza udana misja w strefie → 'done'.
   Stan w save.areas { id: 'paid' | 'done' }, licznik udanych misji w save.areaN. Ładowany po core.js. */

const ALL_AREAS = [{ id: 'home', name: AREA.name, ring: 0, center: AREA.center, poly: AREA.poly, nb: [] }]
  .concat(typeof GEN_AREAS !== 'undefined' ? GEN_AREAS : []);
let curAreaId = 'home';   // strefa bieżącej / ostatnio startowanej misji
const areaById = id => ALL_AREAS.find(a => a.id === id) || ALL_AREAS[0];
const areaState = id => id === 'home' ? 'done' : (save.areas && save.areas[id]) || 'locked';
const areaPts = () => { const a = areaById(curAreaId); return a.id === 'home' ? AREA.points : (a.points || []); };
function areaAt(p) {
  if (inPoly(p, AREA.poly)) return ALL_AREAS[0];
  return ALL_AREAS.find(a => a.id !== 'home' && inPoly(p, a.poly)) || null;
}
function areaReq(a) {
  const owned = ALL_AREAS.filter(x => x.id !== 'home' && areaState(x.id) !== 'locked').length, i = Math.min(a.ring, AREA_UNLOCK.missions.length) - 1;
  const need = AREA_UNLOCK.missions[i] + AREA_UNLOCK.stepM * owned, cost = AREA_UNLOCK.cost[i] + AREA_UNLOCK.stepC * owned;
  const nbOk = (a.nb || []).some(id => areaState(id) === 'done');
  return { need, cost, nbOk, mOk: save.missions >= need, cOk: save.credits >= cost };
}
function unlockArea(id) {
  const a = areaById(id), r = areaReq(a);
  if (areaState(id) !== 'locked' || !r.nbOk || !r.mOk || !r.cOk) return false;
  save.credits -= r.cost; save.areas[id] = 'paid'; persist(); return true;
}

/* ---------- ekran TERENY ---------- */
let arMap = null, arLayer = null, arSel = 'home', arMe = null;
const AR_COL = { done: '#00f0ff', paid: '#fcee0a', open: '#ff2bd6', locked: '#6b7a99' };
function arKind(a) { const s = areaState(a.id); if (s !== 'locked') return s; const r = areaReq(a); return r.nbOk ? 'open' : 'locked'; }
function openAreas() {
  show('areas');
  if (typeof L === 'undefined') { show('menu'); $('#menuHint').textContent = 'Mapa niedostępna — brak biblioteki Leaflet.'; return; }
  if (!arMap) {
    arMap = L.map('arMap', { zoomControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'dark-tiles', attribution: '© OpenStreetMap' }).addTo(arMap);
    arLayer = L.layerGroup().addTo(arMap);
  }
  arSel = areaById(save.areaSel).id;
  setTimeout(() => {
    arMap.invalidateSize();
    arMap.fitBounds(L.latLngBounds(ALL_AREAS.flatMap(a => a.poly)), { padding: [10, 10] });
    arRender();
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => {   // pokaż, gdzie jesteś (jeśli GPS dostępny)
      arMe = { lat: p.coords.latitude, lng: p.coords.longitude };
      L.circleMarker([arMe.lat, arMe.lng], { radius: 6, color: '#39ff88', fillOpacity: .9, interactive: false }).addTo(arLayer);
      arInfo();
    }, () => {}, { timeout: 8000, maximumAge: 60000 });
  }, 80);
}
function closeAreas() { renderMenu(); show('menu'); }
function arRender() {
  arLayer.clearLayers();
  ALL_AREAS.forEach(a => {
    const k = arKind(a), sel = a.id === arSel, c = AR_COL[k];
    const pg = L.polygon(a.poly, { color: c, weight: sel ? 4 : 2, dashArray: k === 'locked' || k === 'open' ? '8 6' : null, fillColor: c, fillOpacity: sel ? .38 : k === 'done' ? .2 : .12 }).addTo(arLayer);
    pg.bindTooltip((k === 'done' ? '' : k === 'paid' ? '▶ ' : '🔒 ') + a.name, { permanent: true, direction: 'center', className: 'ar-tip ar-' + k });
    pg.on('click', () => { arSel = a.id; sfx('click'); arRender(); });
  });
  if (arMe) L.circleMarker([arMe.lat, arMe.lng], { radius: 6, color: '#39ff88', fillOpacity: .9, interactive: false }).addTo(arLayer);
  arInfo();
}
function arInfo() {
  const a = areaById(arSel), k = arKind(a), s = areaState(a.id), box = $('#arBtns'), info = $('#arInfo');
  $('#arCount').textContent = ALL_AREAS.filter(x => areaState(x.id) === 'done').length + '/' + ALL_AREAS.length;
  $('#arCred').textContent = save.credits;
  box.innerHTML = '';
  const ok = v => v ? '<b style="color:var(--green)">✔</b>' : '<b class="red">✖</b>';
  const here = arMe && areaAt(arMe), n = save.areaN[a.id] || 0;
  let h = '<b>' + a.name + '</b>' + (a.id === 'home' ? ' · TEREN STARTOWY' : '') + (here && here.id === a.id ? ' · <span style="color:var(--green)">TU JESTEŚ</span>' : '') + '<br>';
  if (s === 'done') h += 'Odblokowany. Udane misje tutaj: <b>' + n + '</b>.' + (a.points && a.points.length ? ' Punktów: ' + a.points.length + '.' : '');
  else if (s === 'paid') h += 'Opłacony — <b>ukończ pierwszą misję w tym terenie</b>, żeby go ostatecznie odblokować.';
  else {
    const r = areaReq(a);
    h += 'Wymagania odblokowania:<br>' + ok(r.mOk) + ' udane misje: ' + save.missions + ' / ' + r.need + '<br>' + ok(r.cOk) + ' opłata: ' + save.credits + ' / ' + r.cost + ' ₵<br>'
      + ok(r.nbOk) + ' odblokowany sąsiedni teren<br>+ pierwsza udana misja w tym terenie.';
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'ODBLOKUJ — ' + r.cost + ' ₵';
    b.disabled = !(r.nbOk && r.mOk && r.cOk);
    b.onclick = () => { if (unlockArea(a.id)) { sfx('buy'); haptic(40); arRender(); } };
    box.appendChild(b);
  }
  if (s !== 'locked' && save.sim) {
    const b = document.createElement('button'); b.className = 'btn small pink'; b.textContent = save.areaSel === a.id ? 'WYBRANY DO SYMULACJI ✔' : 'WYBIERZ DO SYMULACJI';
    b.disabled = save.areaSel === a.id; b.onclick = () => { save.areaSel = a.id; persist(); sfx('ok'); arInfo(); };
    box.appendChild(b);
  }
  info.innerHTML = h + (s !== 'locked' && !save.sim ? '<br><span style="color:var(--dim)">Misja startuje tam, gdzie stoisz — wejdź w ten teren z GPS.</span>' : '');
}
