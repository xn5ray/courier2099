#!/usr/bin/env node
'use strict';
/* GENERATOR OBSZARÓW — uruchamiasz raz na swoim komputerze (Node 18+), wynik wrzucasz do repo.
 *
 *   node tools/generate-areas.js                  → strefy + punkty z OpenStreetMap (potrzebny internet)
 *   node tools/generate-areas.js --offline        → same strefy, bez punktów (szybki test)
 *   node tools/generate-areas.js --rings 3 --spacing 3200 --points 45
 *
 * Wynik: js/data/areas.generated.js (const GEN_AREAS). Gra czyta go sama — nic więcej nie trzeba ruszać.
 * Środek siatki = AREA.center z js/data/area.js (to jest „teren startowy”). Kolejne strefy układają się wokół niego
 * jak plaster miodu (lekko nieregularne, jak dzielnice), a nazwy bierze z OSM (np. „Zatorze”, „Szobiszowice”).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

/* ---------- argumenty ---------- */
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const RINGS = +arg('rings', 2), SPACING = +arg('spacing', 3200), MAXPTS = +arg('points', 45), OFFLINE = !!arg('offline', false), SEED = +arg('seed', 2099);
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'js/data/areas.generated.js');

/* ---------- środek siatki z area.js ---------- */
const AREA = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/data/area.js'), 'utf8') + '\n;AREA');
const C = AREA.center, KY = 110574, KX = 111320 * Math.cos(C.lat * Math.PI / 180);
const toXY = p => ({ x: (p.lng - C.lng) * KX, y: (p.lat - C.lat) * KY }), toLL = q => ({ lat: C.lat + q.y / KY, lng: C.lng + q.x / KX });
const r6 = v => Math.round(v * 1e6) / 1e6;
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = rng(SEED);

/* ---------- siatka komórek (Voronoi na zaburzonym plastrze miodu) ---------- */
const seeds = [];
for (let q = -RINGS; q <= RINGS; q++) for (let r = -RINGS; r <= RINGS; r++) {
  const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); if (ring > RINGS) continue;
  const jit = ring ? 0.16 * SPACING : 0;
  seeds.push({ q, r, ring, x: SPACING * (q + r / 2) + (rand() - .5) * 2 * jit, y: SPACING * (r * Math.sqrt(3) / 2) + (rand() - .5) * 2 * jit });
}
function clip(poly, nx, ny, c) {   // zostaw punkty, gdzie nx*x+ny*y <= c (Sutherland–Hodgman)
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = nx * a.x + ny * a.y - c, db = nx * b.x + ny * b.y - c;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  }
  return out;
}
function cell(s) {
  const R = SPACING * 0.56;   // zaokrąglenie rogów
  let poly = Array.from({ length: 28 }, (_, i) => ({ x: s.x + R * Math.cos(i / 28 * 2 * Math.PI), y: s.y + R * Math.sin(i / 28 * 2 * Math.PI) }));
  for (const o of seeds) {
    if (o === s || Math.hypot(o.x - s.x, o.y - s.y) > SPACING * 2.2) continue;
    const nx = o.x - s.x, ny = o.y - s.y, mx = (o.x + s.x) / 2, my = (o.y + s.y) / 2;
    poly = clip(poly, nx, ny, nx * mx + ny * my);
  }
  return poly;
}
function inPoly(p, poly) {   // poly: [{x,y}]
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if ((poly[i].y > p.y) !== (poly[j].y > p.y) && p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) ins = !ins;
  return ins;
}
const DIRS = ['PÓŁNOC', 'PÓŁNOCNY WSCHÓD', 'WSCHÓD', 'POŁUDNIOWY WSCHÓD', 'POŁUDNIE', 'POŁUDNIOWY ZACHÓD', 'ZACHÓD', 'PÓŁNOCNY ZACHÓD'];
const compass = s => DIRS[Math.round(((Math.atan2(s.x, s.y) * 180 / Math.PI + 360) % 360) / 45) % 8];

const areas = [];
const homeSeed = seeds.find(s => s.ring === 0);
for (const s of seeds) {
  if (s.ring === 0) continue;
  const poly = cell(s);
  areas.push({ id: 'a' + (areas.length + 1), name: 'SEKTOR ' + compass(s), ring: s.ring, seed: s, xy: poly,
    center: r6lat(toLL(s)), poly: poly.map(p => { const l = toLL(p); return [r6(l.lat), r6(l.lng)]; }), nb: [], points: [] });
}
function r6lat(l) { return { lat: r6(l.lat), lng: r6(l.lng) }; }
for (const a of areas) {   // sąsiedzi (w tym 'home')
  for (const b of areas) if (a !== b && Math.hypot(a.seed.x - b.seed.x, a.seed.y - b.seed.y) < SPACING * 1.35) a.nb.push(b.id);
  if (Math.hypot(a.seed.x - homeSeed.x, a.seed.y - homeSeed.y) < SPACING * 1.35) a.nb.push('home');
}
console.log(`Strefy: ${areas.length} (pierścienie: ${RINGS}, rozstaw ${SPACING} m)`);

/* ---------- OpenStreetMap (Overpass): nazwy dzielnic + punkty na ulicach ---------- */
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(q) {
  for (let t = 0; t < 4; t++) for (const u of MIRRORS) {
    try {
      const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(60000) });
      if (r.ok) return await r.json();
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error('Overpass nie odpowiada (spróbuj za chwilę lub użyj --offline)');
}
const hav = (a, b) => { const x = (b.lng - a.lng) * Math.cos(a.lat * Math.PI / 180), y = b.lat - a.lat; return Math.hypot(x, y) * 111195; };
const prefix = n => /^(Plac|Aleja|Park|Rondo|Skwer|Osiedle|Droga|Wiadukt|Most)\b/i.test(n) ? n : 'ul. ' + n;

async function fillArea(a) {
  const lats = a.poly.map(p => p[0]), lngs = a.poly.map(p => p[1]);
  const bb = [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)].join(',');
  const j = await overpass(`[out:json][timeout:50];(way["highway"~"^(residential|living_street|unclassified|tertiary|secondary|pedestrian|footway|cycleway|path)$"]["name"](${bb});node["place"~"^(suburb|neighbourhood|quarter|village|hamlet)$"](around:${SPACING},${a.center.lat},${a.center.lng}););out geom qt;`);
  /* nazwa: najbliższa dzielnica od środka strefy */
  const places = j.elements.filter(e => e.type === 'node' && e.tags && e.tags.name).sort((p, q) => hav(a.center, { lat: p.lat, lng: p.lon }) - hav(a.center, { lat: q.lat, lng: q.lon }));
  const used = areas.filter(x => x.named).map(x => x.name);
  const pl = places.find(p => !used.includes(p.tags.name.toUpperCase()));
  if (pl) { a.name = pl.tags.name.toUpperCase(); a.named = true; }
  /* punkty: co ~140 m wzdłuż nazwanych ulic, tylko wewnątrz strefy, min. 130 m od siebie */
  const cand = [];
  for (const w of j.elements) if (w.type === 'way' && w.geometry && w.tags && w.tags.name) {
    let acc = 70;
    for (let i = 1; i < w.geometry.length; i++) {
      const p0 = { lat: w.geometry[i - 1].lat, lng: w.geometry[i - 1].lon }, p1 = { lat: w.geometry[i].lat, lng: w.geometry[i].lon }, d = hav(p0, p1);
      if (!d) continue;
      for (let t = 140 - acc; t < d; t += 140) { const f = t / d; cand.push({ s: prefix(w.tags.name), lat: r6(p0.lat + (p1.lat - p0.lat) * f), lng: r6(p0.lng + (p1.lng - p0.lng) * f) }); acc = 0; }
      acc = (acc + d) % 140;
    }
  }
  const inside = cand.filter(c => inPoly(toXY(c), a.xy));
  for (let i = inside.length - 1; i > 0; i--) { const k = Math.floor(rand() * (i + 1)); [inside[i], inside[k]] = [inside[k], inside[i]]; }
  const pick = [];
  for (const c of inside) { if (pick.length >= MAXPTS) break; if (pick.every(p => hav(p, c) >= 130)) pick.push(c); }
  a.points = pick;
}
(async () => {
  if (!OFFLINE) for (const a of areas) {
    process.stdout.write(`  ${a.id}/${areas.length} … `);
    try { await fillArea(a); console.log(`${a.name} · ${a.points.length} pkt`); } catch (e) { console.log('BŁĄD: ' + e.message); }
    await new Promise(r => setTimeout(r, 1200));
  }
  /* unikalne nazwy (gdy OSM nie podał dzielnicy, zostaje „SEKTOR KIERUNEK” — dopisz numer przy powtórkach) */
  const seen = {};
  for (const a of areas) { seen[a.name] = (seen[a.name] || 0) + 1; if (seen[a.name] > 1) a.name += ' ' + seen[a.name]; }
  const out = areas.map(a => ({ id: a.id, name: a.name, ring: a.ring, center: a.center, poly: a.poly, nb: a.nb, points: a.points }));
  const head = `'use strict';\n/* WYGENEROWANE przez tools/generate-areas.js — nie edytuj ręcznie (uruchom skrypt ponownie). Strefy odblokowywane w grze; punkty = cele misji w danej strefie. */\n`;
  fs.writeFileSync(OUT, head + 'const GEN_AREAS = ' + JSON.stringify(out).replace(/\},\{/g, '},\n{') + ';\n');
  console.log('Zapisano ' + path.relative(ROOT, OUT) + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
})();
