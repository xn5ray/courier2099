'use strict';
/* EDYTOR PUNKTÓW: dodawanie / usuwanie / przesuwanie punktów gry na mapie (zapis w localStorage, nakładka na AREA). */

/* ================= EDYTOR PUNKTÓW ================= */
const PTS_KEY = 'courier2099.pts.v1';
const DEF_PTS = AREA.points.map((p, i) => ({ s: p.s, lat: p.lat, lng: p.lng, id: i }));
const DEF_FIX = FIXED_ROUTES.map(r => r.pts.map(q => ({ lat: q.lat, lng: q.lng })));
let pe = { removed: [], moved: {}, added: [], fmoved: {} };
try { const o = JSON.parse(localStorage.getItem(PTS_KEY)); if (o && typeof o === 'object') pe = Object.assign(pe, o); } catch (e) {}
const savePe = () => { try { localStorage.setItem(PTS_KEY, JSON.stringify(pe)); } catch (e) {} };
function applyPts() {
  AREA.points = DEF_PTS.filter(p => !pe.removed.includes(p.id)).map(p => Object.assign({}, p, pe.moved[p.id] || {}))
    .concat(pe.added.map(a => ({ s: a.s, lat: a.lat, lng: a.lng, id: a.id })));
  FIXED_ROUTES.forEach((r, ri) => r.pts.forEach((q, qi) => { const m = pe.fmoved[ri + '-' + qi], d = DEF_FIX[ri][qi]; q.lat = m ? m.lat : d.lat; q.lng = m ? m.lng : d.lng; }));
}
applyPts();

let edMap = null, edLayer = null, edSel = null, edMode = null;
const ED_COL = { default: '#fcee0a', moved: '#00f0ff', added: '#ff2bd6', removed: '#6b7a99', fixed: '#39ff88' };
const ED_LAB = { default: 'domyślny', moved: 'przesunięty', added: 'dodany przez ciebie', removed: 'USUNIĘTY (wyłączony z gry)', fixed: 'punkt stałej trasy' };
function edItems() {
  const out = [];
  DEF_PTS.forEach(p => { const rem = pe.removed.includes(p.id), mv = pe.moved[p.id];
    out.push({ k: 'p', id: p.id, s: p.s, lat: mv ? mv.lat : p.lat, lng: mv ? mv.lng : p.lng, st: rem ? 'removed' : mv ? 'moved' : 'default' }); });
  pe.added.forEach(a => out.push({ k: 'p', id: a.id, s: a.s, lat: a.lat, lng: a.lng, st: 'added' }));
  FIXED_ROUTES.forEach((r, ri) => r.pts.forEach((q, qi) => out.push({ k: 'f', id: ri + '-' + qi, s: q.n + ' · ' + q.s, lat: q.lat, lng: q.lng, st: pe.fmoved[ri + '-' + qi] ? 'moved' : 'fixed' })));
  return out;
}
function edCommit() { pe.t = Date.now(); savePe(); applyPts(); edRender(); if (typeof cloudSchedule === 'function') cloudSchedule(); }
function edRender() {
  if (!edMap) return;
  edLayer.clearLayers();
  const items = edItems();
  items.forEach(it => {
    const sel = edSel && edSel.k === it.k && edSel.id === it.id, col = ED_COL[it.st];
    L.circleMarker([it.lat, it.lng], { radius: sel ? 14 : 9, color: sel ? '#ffffff' : col, weight: sel ? 3 : 2, fillColor: col, fillOpacity: it.st === 'removed' ? 0.2 : 0.8 })
      .on('click', ev => { L.DomEvent.stopPropagation(ev); edSel = { k: it.k, id: it.id }; edMode = null; edRender(); }).addTo(edLayer);
  });
  $('#edCount').textContent = AREA.points.length;
  const cur = edSel && items.find(i => i.k === edSel.k && i.id === edSel.id);
  let info = cur ? '<b>' + cur.s + '</b> · ' + ED_LAB[cur.st]
    : 'Dotknij punktu na mapie.<br><span style="color:var(--dim)">żółty = domyślny · cyjan = przesunięty · różowy = własny · zielony = stała trasa · szary = usunięty</span>';
  if (edMode === 'move') info = '<b>PRZENOSZENIE:</b> dotknij mapy w nowym miejscu dla: ' + (cur ? cur.s : '');
  if (edMode === 'add') info = '<b>DODAWANIE:</b> dotknij mapy tam, gdzie ma być nowy punkt.';
  $('#edInfo').innerHTML = info;
  const box = $('#edBtns'); box.innerHTML = '';
  const add = (txt, fn, cls) => { const b = document.createElement('button'); b.className = 'btn small ' + (cls || ''); b.textContent = txt; b.onclick = fn; box.appendChild(b); };
  if (cur && edMode == null) {
    if (cur.st === 'removed') add('PRZYWRÓĆ PUNKT', () => { pe.removed = pe.removed.filter(x => x !== cur.id); edCommit(); });
    else {
      if (cur.k === 'p') add('USUŃ PUNKT', () => {
        if (typeof cur.id === 'string') { pe.added = pe.added.filter(a => a.id !== cur.id); edSel = null; }
        else if (!pe.removed.includes(cur.id)) pe.removed.push(cur.id);
        edCommit();
      }, 'pink');
      add('PRZENIEŚ', () => { edMode = 'move'; edRender(); });
    }
  }
  if (edMode) add('ANULUJ', () => { edMode = null; edRender(); });
  else {
    add('+ DODAJ PUNKT', () => { edMode = 'add'; edSel = null; edRender(); });
    add('☁ CHMURA', () => openCloud());
    add('RESET DOMYŚLNE', () => { if (!confirm('Przywrócić wszystkie punkty do ustawień domyślnych? Twoje zmiany przepadną.')) return;
      pe = { removed: [], moved: {}, added: [], fmoved: {} }; edSel = null; edMode = null; edCommit(); }, 'pink');
  }
}
function edMapClick(ll) {
  const pt = { lat: ll.lat, lng: ll.lng };
  if (edMode === 'move' && edSel) {
    if (edSel.k === 'f') pe.fmoved[edSel.id] = pt;
    else if (typeof edSel.id === 'string') { const a = pe.added.find(x => x.id === edSel.id); if (a) { a.lat = pt.lat; a.lng = pt.lng; } }
    else pe.moved[edSel.id] = pt;
    edMode = null; sfx('ok'); edCommit();
  } else if (edMode === 'add') {
    const id = 'a' + Date.now();
    pe.added.push({ id, s: 'Punkt własny', lat: pt.lat, lng: pt.lng });
    edSel = { k: 'p', id }; edMode = null; sfx('ok'); edCommit();
  } else if (edSel) { edSel = null; edRender(); }
}
function openEditor() {
  show('editor');
  if (!edMap) {
    if (typeof L === 'undefined') { show('menu'); $('#menuHint').textContent = 'Mapa niedostępna — brak biblioteki Leaflet.'; return; }
    edMap = L.map('edMap', { zoomControl: false }).setView([AREA.center.lat, AREA.center.lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'dark-tiles', attribution: '© OpenStreetMap' }).addTo(edMap);
    L.polygon(AREA.poly, { color: '#ff2bd6', weight: 2, dashArray: '10 6', fill: false, interactive: false }).addTo(edMap);
    edLayer = L.layerGroup().addTo(edMap);
    edMap.on('click', e => edMapClick(e.latlng));
  }
  edSel = null; edMode = null;
  if (typeof cloudSync === 'function') cloudSync();
  setTimeout(() => { edMap.invalidateSize(); edMap.fitBounds(L.polygon(AREA.poly).getBounds(), { padding: [20, 20] }); edRender(); }, 80);
}
function closeEditor() { edSel = null; edMode = null; renderMenu(); show('menu'); }
