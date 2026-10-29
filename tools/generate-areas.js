#!/usr/bin/env node
'use strict';
/* GENERATOR OBSZARÓW — uruchamiasz raz na swoim komputerze (Node 18+), wynik wrzucasz do repo.
 *
 *   node tools/generate-areas.js                  → strefy + punkty z OpenStreetMap (potrzebny internet)
 *   node tools/generate-areas.js --offline        → same strefy, bez punktów (szybki test)
 *   node tools/generate-areas.js --rings 3 --spacing 3200 --points 45
 *
 *   --irregular 1            0 = równe plastry, 1 = nieregularne dzielnice (domyślnie), 2 = bardzo poszarpane
 *   --home                   dodatkowo przegeneruj punkty TERENU STARTOWEGO (Leszczyny) z OSM → js/data/home.generated.js
 *   --home-radius 1500       …i przy okazji NOWA granica startu (nieregularne koło o tym promieniu w m, środek = AREA.center)
 *   (w grze: TERENY → teren startowy → przełącznik „zestaw ręczny / wygenerowany”)
 *
 * Wynik: js/data/areas.generated.js (const GEN_AREAS). Gra czyta go sama — nic więcej nie trzeba ruszać.
 * Środek siatki = AREA.center z js/data/area.js (to jest „teren startowy”). Kolejne strefy układają się wokół niego
 * jak plaster miodu (lekko nieregularne, jak dzielnice), a nazwy bierze z OSM (np. „Zatorze”, „Szobiszowice”).
 */
const fs = require('fs'), path = require('path'), vm = require('vm');

/* ---------- argumenty ---------- */
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const RINGS = +arg('rings', 2), SPACING = +arg('spacing', 3200), MAXPTS = +arg('points', 45), OFFLINE = !!arg('offline', false), HOME = !!arg('home', false), HOME_R = +arg('home-radius', 0), SEED = +arg('seed', 2099);
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'js/data/areas.generated.js');

/* ---------- środek siatki z area.js ---------- */
const AREA = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/data/area.js'), 'utf8') + '\n;AREA');
const C = AREA.center, KY = 110574, KX = 111320 * Math.cos(C.lat * Math.PI / 180);
const toXY = p => ({ x: (p.lng - C.lng) * KX, y: (p.lat - C.lat) * KY }), toLL = q => ({ lat: C.lat + q.y / KY, lng: C.lng + q.x / KX });
const r6 = v => Math.round(v * 1e6) / 1e6;
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = rng(SEED);

/* ---------- kształt terenu startowego (zewnętrzne strefy go omijają) ---------- */
const r5 = v => Math.round(v * 1e5) / 1e5;
const HOME_POLY = HOME_R ? (() => { const rr = rng(SEED + 77); return Array.from({ length: 28 }, (_, i) => { const R = HOME_R * (0.92 + 0.16 * rr()), t = i / 28 * 2 * Math.PI; return [r6(C.lat + R * Math.cos(t) / KY), r6(C.lng + R * Math.sin(t) / KX)]; }); })() : AREA.poly;
const HOME_XY = HOME_POLY.map(q => toXY({ lat: q[0], lng: q[1] }));

/* ---------- siatka stref: losowe, nieregularne dzielnice ----------
 * 1) zaburzone ośrodki (plaster miodu + duży jitter) i losowe „wagi” → komórki różnej wielkości (diagram mocy),
 * 2) krawędzie dzielone co ~100 m i przesuwane polem szumu (to samo pole dla sąsiadów → granice się schodzą, bez dziur),
 * 3) zewnętrzny kontur też falowany, a strefy omijają teren startowy. */
const IRR = +arg('irregular', 1);   // 0 = równe plastry, 1 = domyślnie, 2 = bardzo poszarpane
const polyArea = p => Math.abs(p.reduce((t, a, i) => { const b = p[(i + 1) % p.length]; return t + a.x * b.y - b.x * a.y; }, 0)) / 2;
const HOME_W = 2 * SPACING * Math.sqrt(polyArea(HOME_XY) / Math.PI) - SPACING * SPACING;   // komórka terenu startowego ≈ jego rozmiar
const seeds = [];
for (let q = -RINGS; q <= RINGS; q++) for (let r = -RINGS; r <= RINGS; r++) {
  const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)); if (ring > RINGS) continue;
  const jit = ring ? 0.27 * IRR * SPACING : 0;
  seeds.push({ q, r, ring, x: SPACING * (q + r / 2) + (rand() - .5) * 2 * jit, y: SPACING * (r * Math.sqrt(3) / 2) + (rand() - .5) * 2 * jit, w: 0 });
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
const area = p => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a.x * b.y - b.x * a.y; }, 0)) / 2;
function cell(s) {
  const BR = (RINGS + 0.55) * SPACING;   // zewnętrzna granica (potem i tak falowana)
  let poly = Array.from({ length: 40 }, (_, i) => ({ x: BR * Math.cos(i / 40 * 2 * Math.PI), y: BR * Math.sin(i / 40 * 2 * Math.PI) }));
  for (const o of seeds) {
    if (o === s) continue;
    const nx = 2 * (o.x - s.x), ny = 2 * (o.y - s.y);
    poly = clip(poly, nx, ny, o.x * o.x + o.y * o.y - s.x * s.x - s.y * s.y + s.w - o.w);   // |p-s|²-ws <= |p-o|²-wo
  }
  return poly;
}
let cells;
for (let amp = 0.16 * IRR; ; amp *= 0.6) {   // losowe wagi; jeśli któraś komórka wyjdzie mikroskopijna — zmniejsz rozrzut
  const rw = rng(SEED + 5); seeds.forEach(s => { s.w = s.ring ? (rw() - .5) * 2 * amp * SPACING * SPACING : HOME_W; });
  cells = seeds.map(cell);
  if (cells.every((c, i) => !seeds[i].ring || (c.length >= 3 && area(c) > 0.12 * SPACING * SPACING)) || amp < 0.005) break;
}
const onEdge = (v, s, o) => Math.abs((Math.hypot(v.x - s.x, v.y - s.y) ** 2 - s.w) - (Math.hypot(v.x - o.x, v.y - o.y) ** 2 - o.w)) / (2 * Math.hypot(o.x - s.x, o.y - s.y)) < 8;
const nbOf = i => seeds.map((o, j) => j !== i && cells[i].filter(v => onEdge(v, seeds[i], o)).length >= 2 ? j : -1).filter(j => j >= 0);

/* pole szumu (value noise, dwie oktawy) → przesunięcie wierzchołków */
const hash = (i, j, k) => { let h = Math.imul(i * 374761393 + j * 668265263 + k * 2147483647 + SEED * 1274126177, 1103515245); h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296 * 2 - 1; };
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y, k) { const i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
  const a = hash(i, j, k), b = hash(i + 1, j, k), c = hash(i, j + 1, k), d = hash(i + 1, j + 1, k);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy; }
function warp(p) {
  const A1 = 0.17 * IRR * SPACING, A2 = 0.05 * IRR * SPACING, L1 = 0.9 * SPACING, L2 = 0.33 * SPACING;
  return { x: p.x + A1 * vnoise(p.x / L1, p.y / L1, 1) + A2 * vnoise(p.x / L2, p.y / L2, 3), y: p.y + A1 * vnoise(p.x / L1, p.y / L1, 2) + A2 * vnoise(p.x / L2, p.y / L2, 4) };
}
function inPoly(p, poly) {   // poly: [{x,y}]
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if ((poly[i].y > p.y) !== (poly[j].y > p.y) && p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) ins = !ins;
  return ins;
}
function nearestOnPoly(p, poly) {   // najbliższy punkt granicy wielokąta
  let best = null, bd = 1e18;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const q = { x: a.x + dx * t, y: a.y + dy * t }, d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bd) { bd = d; best = q; }
  }
  return { q: best, d: bd };
}
function shape(poly, s) {   // podziel krawędzie, sfalowanie (słabsze przy terenie startowym), dociągnięcie do jego granicy
  const dense = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 100));
    for (let k = 0; k < n; k++) dense.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  return dense.map(v => {
    const near = nearestOnPoly(v, HOME_XY);
    if (onEdge(v, s, homeSeed) && near.d < 0.6 * SPACING) return near.q;   // krawędź od strony startu: przyklej do granicy terenu startowego
    const w = warp(v), f = inPoly(v, HOME_XY) ? 0 : Math.min(1, near.d / (0.5 * SPACING));
    v = { x: v.x + (w.x - v.x) * f, y: v.y + (w.y - v.y) * f };
    for (let n = 0; n < 200 && inPoly(v, HOME_XY); n++) { const d = Math.hypot(v.x, v.y) || 1; v = { x: v.x + v.x / d * 25, y: v.y + v.y / d * 25 }; }
    return v;
  });
}
const DIRS = ['PÓŁNOC', 'PÓŁNOCNY WSCHÓD', 'WSCHÓD', 'POŁUDNIOWY WSCHÓD', 'POŁUDNIE', 'POŁUDNIOWY ZACHÓD', 'ZACHÓD', 'PÓŁNOCNY ZACHÓD'];
const compass = s => DIRS[Math.round(((Math.atan2(s.x, s.y) * 180 / Math.PI + 360) % 360) / 45) % 8];

const areas = [], idx = new Map();
const homeSeed = seeds.find(s => s.ring === 0);
seeds.forEach((s, i) => {
  if (s.ring === 0) return;
  const xy = shape(cells[i], s), cx = xy.reduce((t, p) => t + p.x, 0) / xy.length, cy = xy.reduce((t, p) => t + p.y, 0) / xy.length;
  idx.set(i, areas.length);
  areas.push({ id: 'a' + (areas.length + 1), name: 'SEKTOR ' + compass(s), ring: s.ring, seed: s, xy, center: { lat: r6(toLL({ x: cx, y: cy }).lat), lng: r6(toLL({ x: cx, y: cy }).lng) },
    poly: xy.map(p => { const l = toLL(p); return [r5(l.lat), r5(l.lng)]; }), nb: [], points: [], _i: i });
});
for (const a of areas) {   // sąsiedzi = wspólna krawędź (w tym 'home', gdy strefa dotyka terenu startowego)
  a.nb = nbOf(a._i).filter(j => seeds[j].ring).map(j => areas[idx.get(j)].id);
  if (nbOf(a._i).some(j => seeds[j].ring === 0)) a.nb.push('home');
  delete a._i;
}
console.log(`Strefy: ${areas.length} (pierścienie: ${RINGS}, rozstaw ${SPACING} m)`);

/* ---------- OpenStreetMap (Overpass): nazwy dzielnic + punkty na ulicach ---------- */
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'];
if (process.env.OVERPASS_URL) MIRRORS.splice(0, MIRRORS.length, process.env.OVERPASS_URL);   // własny serwer Overpass (opcjonalnie)
const HEAD = { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'courier2099-area-generator/1.0 (https://github.com/xn5ray/courier2099)', 'Accept': 'application/json' };
let lastErr = '';
async function overpass(q) {
  for (let t = 0; t < 6; t++) {
    for (const u of MIRRORS.slice().sort(() => rand() - .5)) {
      try {
        const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: HEAD, signal: AbortSignal.timeout(90000) });
        if (r.ok) return await r.json();
        lastErr = new URL(u).host + ' → HTTP ' + r.status + (r.status === 429 ? ' (za dużo zapytań — czekam)' : '');
      } catch (e) { lastErr = new URL(u).host + ' → ' + (e.cause && (e.cause.code || e.cause.message) || e.message); }
      if (arg('debug', false)) console.log('\n    ' + lastErr);
    }
    await new Promise(r => setTimeout(r, 5000 * (t + 1)));   // przerwa rośnie: 5 s, 10 s, 15 s…
  }
  throw new Error('Overpass nie odpowiada. Ostatni błąd: ' + lastErr);
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
  const pl = a.isHome ? null : places.find(p => !used.includes(p.tags.name.toUpperCase()));
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
const CACHE = path.join(__dirname, '.areas-cache.json'), CKEY = [RINGS, SPACING, MAXPTS, SEED, C.lat, C.lng, HOME_R, IRR, 'v2'].join('|');
let cache = {}; try { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (c.key === CKEY) cache = c.zones; } catch (e) {}
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify({ key: CKEY, zones: cache }));
(async () => {
  if (!OFFLINE) try { await overpass('[out:json][timeout:10];node(1);out;'); console.log('Połączenie z OpenStreetMap działa.'); } catch (e) { console.log('\n' + e.message + '\n(Serwery OSM bywają chwilowo przeciążone — próbuję dalej strefa po strefie; ukończone strefy zapamiętuję, więc możesz przerwać i uruchomić ponownie.)'); }
  let failed = 0;
  if (!OFFLINE) for (const a of areas) {
    process.stdout.write(`  ${a.id}/${areas.length} … `);
    if (cache[a.id]) { a.name = cache[a.id].name; a.named = cache[a.id].named; a.points = cache[a.id].points; console.log(`${a.name} · ${a.points.length} pkt (z pamięci)`); continue; }
    try { await fillArea(a); cache[a.id] = { name: a.name, named: a.named, points: a.points }; saveCache(); console.log(`${a.name} · ${a.points.length} pkt`); } catch (e) { console.log('BŁĄD: ' + e.message); failed++; }
    await new Promise(r => setTimeout(r, 1200));
  }
  if (HOME) {   /* teren startowy: nowe punkty (i opcjonalnie nowa granica) */
    const hp = HOME_POLY;
    if (HOME_R && HOME_R > SPACING * 0.55) console.log(`UWAGA: promień ${HOME_R} m jest duży przy rozstawie ${SPACING} m — strefy sąsiednie będą nachodzić na start.`);
    const h = { isHome: true, name: AREA.name, center: C, poly: hp, xy: HOME_XY, points: [] };
    process.stdout.write('  teren startowy … ');
    if (!OFFLINE) {
      if (cache.home) { h.points = cache.home.points; console.log(h.points.length + ' pkt (z pamięci)'); }
      else try { await fillArea(h); cache.home = { points: h.points }; saveCache(); console.log(h.points.length + ' pkt'); } catch (e) { console.log('BŁĄD: ' + e.message); failed++; }
    } else console.log('pominięto (--offline)');
    if (h.points.length) {
      fs.writeFileSync(path.join(ROOT, 'js/data/home.generated.js'), "'use strict';\n/* WYGENEROWANE przez tools/generate-areas.js --home — zestaw punktów (i granica) terenu startowego do wyboru w grze (TERENY). */\nconst HOME_GEN = "
        + JSON.stringify({ poly: HOME_R ? hp : null, points: h.points }) + ';\n');
      console.log('Zapisano js/data/home.generated.js');
    }
  }
  if (failed) console.log(`\nUWAGA: ${failed} stref bez punktów (serwer OSM nie odpowiedział). Uruchom skrypt jeszcze raz — dociągnie tylko brakujące.`);
  /* unikalne nazwy (gdy OSM nie podał dzielnicy, zostaje „SEKTOR KIERUNEK” — dopisz numer przy powtórkach) */
  const seen = {};
  for (const a of areas) { seen[a.name] = (seen[a.name] || 0) + 1; if (seen[a.name] > 1) a.name += ' ' + seen[a.name]; }
  const out = areas.map(a => ({ id: a.id, name: a.name, ring: a.ring, center: a.center, poly: a.poly, nb: a.nb, points: a.points }));
  const head = `'use strict';\n/* WYGENEROWANE przez tools/generate-areas.js — nie edytuj ręcznie (uruchom skrypt ponownie). Strefy odblokowywane w grze; punkty = cele misji w danej strefie. */\n`;
  fs.writeFileSync(OUT, head + 'const GEN_AREAS = ' + JSON.stringify(out).replace(/\},\{/g, '},\n{') + ';\n');
  console.log('Zapisano ' + path.relative(ROOT, OUT) + ' (' + (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB)');
  require('./make-preview.js');   // odśwież też podgląd tools/areas-preview.html
})();
