#!/usr/bin/env node
'use strict';
/* PODGLĄD OBSZARÓW: buduje jeden samodzielny plik tools/areas-preview.html (mapa stref + punkty) — można go wrzucić na dowolną stronę.
 * Dane są wklejone w plik, więc nic więcej nie trzeba kopiować. Odpalany automatycznie na końcu generate-areas.js, można też ręcznie:
 *   node tools/make-preview.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'areas-preview.html');
const ev = (f, name) => vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;' + name);
const AREA = ev('js/data/area.js', 'AREA');
const GEN = fs.existsSync(path.join(ROOT, 'js/data/areas.generated.js')) ? ev('js/data/areas.generated.js', 'GEN_AREAS') : [];
const data = { home: { name: AREA.name, poly: AREA.poly, center: AREA.center, points: AREA.points }, zones: GEN };
const html = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Courier 2099 · Obszary</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;margin:0;background:#05060a}
body{font-family:ui-monospace,Menlo,Consolas,monospace}
.dark-tiles{filter:invert(1) hue-rotate(185deg) saturate(.7) brightness(.85) contrast(.95)}
.tip{background:rgba(5,6,10,.78);border:1px solid #00f0ff;color:#00f0ff;font:700 11px ui-monospace,Menlo,monospace;padding:1px 6px;box-shadow:none}
.tip:before{display:none}
.tip.home{border-color:#39ff88;color:#39ff88}
#box{position:absolute;z-index:1000;top:10px;right:10px;background:rgba(5,6,10,.9);border:1px solid #00f0ff;color:#9fb3d1;padding:8px 12px;font-size:12px;line-height:1.6}
#box b{color:#00f0ff}#box label{cursor:pointer;display:block}
</style></head><body>
<div id="map"></div>
<div id="box"><b>COURIER 2099 · OBSZARY</b><br><span id="cnt"></span><label><input type="checkbox" id="pts"> pokaż punkty misji</label></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const D = ${JSON.stringify(data)};
const map = L.map('map', { zoomControl: true });
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'dark-tiles', attribution: '© OpenStreetMap' }).addTo(map);
const COL = ['#39ff88', '#00f0ff', '#ff2bd6', '#fcee0a'], pts = L.layerGroup();
const all = [];
function add(a, ring, home) {
  const c = COL[Math.min(ring, COL.length - 1)];
  const pg = L.polygon(a.poly, { color: c, weight: 2, fillColor: c, fillOpacity: home ? .22 : .14 }).addTo(map);
  pg.bindTooltip(a.name + ' (' + (a.points ? a.points.length : 0) + ' pkt)', { permanent: true, direction: 'center', className: 'tip' + (home ? ' home' : '') });
  all.push(...a.poly);
  (a.points || []).forEach(p => L.circleMarker([p.lat, p.lng], { radius: 3, color: '#fcee0a', weight: 1, fillOpacity: .9 }).bindTooltip(p.s).addTo(pts));
}
add(D.home, 0, true); D.zones.forEach(z => add(z, z.ring));
map.fitBounds(all, { padding: [20, 20] });
document.getElementById('cnt').textContent = (D.zones.length + 1) + ' obszarów (teren startowy + ' + D.zones.length + ' stref)';
document.getElementById('pts').onchange = e => e.target.checked ? pts.addTo(map) : map.removeLayer(pts);
</script></body></html>
`;
fs.writeFileSync(OUT, html);
console.log('Podgląd: ' + path.relative(ROOT, OUT) + ' (' + (html.length / 1024).toFixed(0) + ' KB) — otwórz w przeglądarce lub wrzuć na stronę');
