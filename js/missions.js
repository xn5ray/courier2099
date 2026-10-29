'use strict';
/* MISJE: wybór punktów z presetów / stałych tras, pobieranie ulic z OSM (Overpass), generowanie celów, stan misji (zapis/odczyt). */

let fixedUsed = null;
function genFixedTargets(base) {
  const LK = 'c2099_lastfixed', setLast = v => { try { localStorage.setItem(LK, v); } catch (e) {} };
  let last = null; try { last = localStorage.getItem(LK); } catch (e) {}
  if (curAreaId !== 'home') return null;   // stałe trasy tylko na terenie startowym
  const ok = FIXED_ROUTES.filter(r => routeLen(base, r.pts) <= FIXED_ROUTE_MAX);
  if (last === '1' || !ok.length || Math.random() >= FIXED_ROUTE_CHANCE) { setLast('0'); return null; }
  setLast('1');
  const r = ok[Math.floor(Math.random() * ok.length)];
  fixedUsed = r.name;
  return r.pts.map((q, i) => ({ lat: q.lat, lng: q.lng, name: q.n + ' · ' + q.s, type: i === 0 ? 'pickup' : 'drop', done: false }));
}

function inPoly(p, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lng < (xj - xi) * (p.lat - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function usePreset(base) {
  if (!inPoly(base, areaById(curAreaId).poly) && !areaPts().some(p => dist(base, p) < 600)) return false;
  return areaPts().filter(p => { const d = dist(base, p); return d >= 300 && d <= 2600; }).length >= 4;
}
function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => permutations(arr.filter((_, j) => j !== i)).forEach(q => out.push([x, ...q])));
  return out;
}
function routeLen(base, seq) {
  let l = dist(base, seq[0]);
  for (let i = 1; i < seq.length; i++) l += dist(seq[i - 1], seq[i]);
  return l + dist(seq[seq.length - 1], base);
}
const MAX_LEG = 900;   // maks. odcinek między kolejnymi punktami (m), żeby cel nie wypadał po drugiej stronie wsi
function maxLeg(base, seq) {
  let m = dist(base, seq[0]);
  for (let i = 1; i < seq.length; i++) m = Math.max(m, dist(seq[i - 1], seq[i]));
  return Math.max(m, dist(seq[seq.length - 1], base));
}
function genPresetTargets(base) {
  const n = Math.random() < 0.5 ? 3 : 4, cap0 = n === 4 ? 3500 : 3000;
  const ranges = [[500, 2000], [400, 2200], [300, 2600], [200, 3200]];
  for (let rel = 0; rel < ranges.length; rel++) {
    const [lo, hi] = ranges[rel];
    const pool = areaPts().filter(p => { const d = dist(base, p); return d >= lo && d <= hi; });
    if (pool.length < n) continue;
    for (let a = 0; a < 300; a++) {
      const pick = shuffle(pool.slice()).slice(0, n);
      let ok = true;
      for (let i = 0; i < n && ok; i++) for (let j = i + 1; j < n; j++) if (dist(pick[i], pick[j]) < 200) { ok = false; break; }
      if (!ok) continue;
      let best = null, bl = 1e9;
      for (const perm of permutations(pick)) { if (maxLeg(base, perm) > MAX_LEG + rel * 150) continue; const l = routeLen(base, perm); if (l < bl) { bl = l; best = perm; } }
      if (best && bl <= cap0 + rel * 300) {
        const names = shuffle(NAMES.slice());
        return best.map((q, i) => ({ lat: q.lat, lng: q.lng, name: names[i] + ' · ' + q.s, type: i === 0 ? 'pickup' : 'drop', done: false }));
      }
    }
  }
  return null;
}

/* ================= DROGI (OpenStreetMap / Overpass) ================= */
let roadGrid = null;
const CELL = 0.0009; // ~100 m
function buildGrid(nodes, lat0) {
  const kx = CELL / Math.cos(lat0 * toR), g = new Map();
  for (const n of nodes) {
    const k = Math.floor(n.lat / CELL) + ':' + Math.floor(n.lng / kx);
    let arr = g.get(k); if (!arr) { arr = []; g.set(k, arr); }
    arr.push(n);
  }
  return { g, kx };
}
function snap(p, maxR) {
  if (!roadGrid) return null;
  const { g, kx } = roadGrid, cy = Math.floor(p.lat / CELL), cx = Math.floor(p.lng / kx), rings = Math.ceil(maxR / 90);
  let best = null, bd = 1e9;
  for (let dy = -rings; dy <= rings; dy++) for (let dx = -rings; dx <= rings; dx++) {
    const arr = g.get((cy + dy) + ':' + (cx + dx)); if (!arr) continue;
    for (const n of arr) { const d = dist(p, n); if (d < bd) { bd = d; best = n; } }
  }
  return best && bd <= maxR ? { lat: best.lat, lng: best.lng } : null;
}
let lastRoadErr = '';
async function fetchRoads(c) {
  const mirrors = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter'];
  for (const rad of [2300, 1500]) {              // 2. próba: mniejszy obszar = mniejsza odpowiedź
    const q = `[out:json][timeout:25];way(around:${rad},${c.lat},${c.lng})["highway"~"^(footway|pedestrian|path|cycleway|residential|living_street|unclassified|tertiary|secondary|primary|service|track)$"];out geom qt;`;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 28000);
    try {
      const j = await Promise.any(mirrors.map(async u => {   // wszystkie serwery naraz, wygrywa pierwszy
        const r = await fetch(u, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        if (!d.elements || !d.elements.length) throw new Error('puste dane');
        return d;
      }));
      clearTimeout(t); ctl.abort();
      const nodes = [];
      for (const w of j.elements) if (w.geometry) w.geometry.forEach((pt, i) => { if (i % 2 === 0 || i === w.geometry.length - 1) nodes.push({ lat: pt.lat, lng: pt.lon }); });
      if (nodes.length > 20) return nodes;
      lastRoadErr = 'za mało dróg w okolicy';
    } catch (e) {
      clearTimeout(t);
      lastRoadErr = (e && e.errors ? [...new Set(e.errors.map(x => x.name === 'AbortError' ? 'przekroczono czas' : (x.message || x.name)))].join(', ') : String(e));
    }
  }
  return null;
}

/* ================= GENEROWANIE MISJI ================= */
function genTargets(base) {
  fixedUsed = null;
  if (usePreset(base)) { const fx = genFixedTargets(base); if (fx) return fx; const pt = genPresetTargets(base); if (pt) return pt; }
  const n = Math.random() < 0.5 ? 3 : 4;
  const cap = n === 4 ? 3500 : 3000;   // maks. długość trasy (m) - tyle da się przejść w ~45 min
  let pts = null;
  const snapOn = !!roadGrid;
  for (let a = 0; a < 500 && !pts; a++) {
    const sector = 360 / n, off = Math.random() * 360, dir = Math.random() < 0.5 ? 1 : -1;
    const maxD = a < 250 ? 2000 : 1000;
    const c = []; let ok = true;
    for (let i = 0; i < n && ok; i++) {
      let p = offset(base, rand(500, maxD), off + dir * (i * sector + (Math.random() - 0.5) * sector * 0.6));
      if (snapOn) {
        p = snap(p, a < 250 ? 250 : 400);        // przyciągnij do najbliższej drogi (też prywatnej)
        if (!p) { ok = false; break; }
        const d = dist(base, p); if (d < 450 || d > 2100) { ok = false; break; }
      }
      c.push(p);
    }
    if (!ok) continue;
    if (snapOn) { for (let i = 0; i < n && ok; i++) for (let j = i + 1; j < n; j++) if (dist(c[i], c[j]) < 250) { ok = false; break; } }
    if (!ok) continue;
    let len = dist(base, c[0]);
    for (let i = 1; i < n; i++) len += dist(c[i - 1], c[i]);
    len += dist(c[n - 1], base);
    if (len <= cap && maxLeg(base, c) <= (a < 250 ? MAX_LEG : MAX_LEG + 300)) pts = c;
  }
  if (!pts) { const off = Math.random() * 360; pts = Array.from({ length: n }, (_, i) => { const p = offset(base, 520, off + i * 360 / n); return (snapOn && snap(p, 400)) || p; }); }
  const names = shuffle(NAMES.slice());
  return pts.map((p, i) => ({ lat: p.lat, lng: p.lng, name: names[i], type: i === 0 ? 'pickup' : 'drop', done: false }));
}
function createMission(base) {
  const now = Date.now(), mins = missionMinutes();
  return { base: { lat: base.lat, lng: base.lng }, preset: usePreset(base), targets: genTargets(base), idx: 0, startedAt: now, endsAt: now + mins * 60000,
    done: 0, relays: 0, penalties: 0, event: null, extra: 0, walkMs: 0, nextWalk: rand(420000, 720000), hard: false, scrap: 0, cool: 0 };
}
function goal() {
  if (!M) return null;
  if (M.idx < M.targets.length) { const t = M.targets[M.idx]; return { lat: t.lat, lng: t.lng, name: t.name, type: t.type }; }
  return { lat: M.base.lat, lng: M.base.lng, name: 'BAZA — POWRÓT', type: 'base' };
}
function saveMission() { if (!M) return; lastSave = Date.now(); try { localStorage.setItem(MISSION_KEY, JSON.stringify(M)); } catch (e) {} }
function loadMissionSaved() {
  try { const m = JSON.parse(localStorage.getItem(MISSION_KEY)); if (m && m.endsAt > Date.now()) return m; } catch (e) {}
  try { localStorage.removeItem(MISSION_KEY); } catch (e) {}
  return null;
}
