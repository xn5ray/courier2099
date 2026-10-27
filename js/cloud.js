'use strict';
/* CHMURA PUNKTÓW: kopia punktów z edytora w Firebase Realtime Database (przez REST, bez SDK).
   Bez logowania: dostęp daje długi, losowy KOD SYNCHRONIZACJI (zapisz go — po reinstalacji wpisujesz go ponownie).
   Konfiguracja i reguły bazy: CLOUD_URL w js/data/config.js oraz DEVELOPING.md. Ładowany po editor.js. */

const CLOUD_KEY = 'courier2099.cloud.code.v1', CLOUD_DIRTY = 'courier2099.cloud.dirty.v1', CLOUD_BASE = 'courier2099.cloud.base.v1';
const CLOUD_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bez 0/O/1/I, żeby kod dało się przepisać
let cloudTimer = null, cloudBusy = false, cloudHold = false;   // cloudHold = konflikt czeka na decyzję (nie nadpisuj chmury)

const cloudOn = () => typeof CLOUD_URL === 'string' && /^https:\/\//.test(CLOUD_URL);
const cloudNorm = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cloudFmt = c => (c.match(/.{1,4}/g) || []).join('-');
function cloudCode() { try { return cloudNorm(localStorage.getItem(CLOUD_KEY)); } catch (e) { return ''; } }
function cloudSetCode(c) { try { if (c) localStorage.setItem(CLOUD_KEY, c); else localStorage.removeItem(CLOUD_KEY); localStorage.removeItem(CLOUD_BASE); } catch (e) {} }
/* BASE = znacznik czasu wersji chmury, którą ten telefon widział przy ostatniej synchronizacji (do wykrywania cudzych zmian) */
function cloudBase(v) { try { if (v == null) return Number(localStorage.getItem(CLOUD_BASE)) || 0; localStorage.setItem(CLOUD_BASE, String(v)); } catch (e) {} return 0; }
function cloudDirty(v) { try { if (v == null) return localStorage.getItem(CLOUD_DIRTY) === '1'; if (v) localStorage.setItem(CLOUD_DIRTY, '1'); else localStorage.removeItem(CLOUD_DIRTY); } catch (e) {} return false; }
function cloudNewCode() {
  const b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b);
  return Array.from(b, x => CLOUD_ALPHA[x % CLOUD_ALPHA.length]).join('');
}
const cloudUrl = c => CLOUD_URL.replace(/\/+$/, '') + '/sync/' + c + '.json';

/* ---------- walidacja danych z chmury (kod może znać ktoś obcy — nie ufamy zawartości) ---------- */
function cloudClean(o) {
  const num = v => typeof v === 'number' && isFinite(v);
  const pt = q => (q && num(q.lat) && num(q.lng) && Math.abs(q.lat) <= 90 && Math.abs(q.lng) <= 180) ? { lat: q.lat, lng: q.lng } : null;
  const arr = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const map = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : (Array.isArray(v) ? Object.assign({}, v) : {});   // RTDB oddaje „gęste” obiekty jako tablice
  const out = { removed: [], moved: {}, added: [], fmoved: {}, t: 0 };
  if (!o || typeof o !== 'object') return out;
  out.removed = arr(o.removed).filter(Number.isInteger).slice(0, 2000);
  const mv = map(o.moved);   for (const k of Object.keys(mv).slice(0, 2000)) { const p = pt(mv[k]); if (p && /^\d{1,5}$/.test(k)) out.moved[k] = p; }
  const fm = map(o.fmoved);  for (const k of Object.keys(fm).slice(0, 2000)) { const p = pt(fm[k]); if (p && /^\d{1,3}-\d{1,3}$/.test(k)) out.fmoved[k] = p; }
  for (const a of arr(o.added).slice(0, 500)) {
    const p = pt(a); if (!p || typeof a.id !== 'string' || !/^a\d{1,16}$/.test(a.id)) continue;
    out.added.push({ id: a.id, s: String(a.s || 'Punkt własny').replace(/[<>&"'`]/g, '').slice(0, 60), lat: p.lat, lng: p.lng });
  }
  return out;
}
const cloudHasEdits = () => (pe.removed || []).length || Object.keys(pe.moved || {}).length || (pe.added || []).length || Object.keys(pe.fmoved || {}).length;
const cloudDate = t => t ? new Date(t).toLocaleString('pl-PL') : '—';

/* ---------- sieć ---------- */
async function cloudReq(method, body) {
  const code = cloudCode(); if (!code) throw new Error('brak kodu');
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(cloudUrl(code), { method, signal: ctl.signal, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 || r.status === 403) throw new Error('baza odrzuciła zapytanie (reguły Firebase?)');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'przekroczono czas' : (e.message === 'Failed to fetch' ? 'brak internetu' : e.message)); }
  finally { clearTimeout(tm); }
}
function cloudStatus(msg, kind) {
  const el = $('#edCloud'), cl = $('#clStatus'), col = kind === 'bad' ? 'var(--red)' : kind === 'good' ? 'var(--green)' : 'var(--dim)';
  [el, cl].forEach(x => { if (x) { x.textContent = msg; x.style.color = col; } });
}
function cloudIdle() {
  if (!cloudOn()) return cloudStatus('☁ chmura nieskonfigurowana');
  const c = cloudCode();
  cloudStatus(c ? '☁ połączono · ' + cloudFmt(c).slice(0, 4) + '…' + (cloudHold ? ' · KONFLIKT' : cloudDirty() ? ' · czeka na wysłanie' : ' · zsynchronizowano') : '☁ brak kodu — dotknij ☁ CHMURA');
}

/* ---------- operacje ---------- */
/* Zasada: chmura = jeden dokument. Zapis nadpisuje całość, więc zanim wyślemy, sprawdzamy, czy ktoś (inny telefon) jej nie zmienił
   od naszej ostatniej synchronizacji (BASE). Jeśli zmienił, a my mamy niewysłane zmiany — KONFLIKT: pytamy, nic nie nadpisujemy po cichu. */
async function cloudPush(manual) {
  if (!cloudOn() || !cloudCode() || cloudBusy) return false;
  if (cloudHold && !manual) return false;
  cloudBusy = true; cloudDirty(true);
  let conflict = false, okk = false;
  try {
    if (!manual) {
      const r = await cloudReq('GET');
      if (r && r.t && Number(r.t) !== cloudBase()) conflict = true;
    }
    if (!conflict) {
      pe.t = pe.t || Date.now(); savePe();
      await cloudReq('PUT', { t: pe.t, pe: { removed: pe.removed, moved: pe.moved, added: pe.added, fmoved: pe.fmoved } });
      cloudBase(pe.t); cloudDirty(false); cloudHold = false; cloudStatus('☁ wysłano · ' + cloudDate(Date.now()), 'good'); okk = true;
    }
  } catch (e) { cloudStatus('☁ nie wysłano: ' + e.message, 'bad'); }
  finally { cloudBusy = false; }
  if (conflict) { cloudHold = true; await cloudSync(); }
  return okk;
}
function cloudApply(remote) {
  const c = cloudClean(remote.pe);
  pe = { removed: c.removed, moved: c.moved, added: c.added, fmoved: c.fmoved, t: Number(remote.t) || Date.now() };
  savePe(); applyPts(); edRender(); cloudBase(pe.t); cloudDirty(false); cloudHold = false;
}
async function cloudPull(manual) {
  if (!cloudOn() || !cloudCode() || cloudBusy) return false;
  cloudBusy = true;
  try {
    const remote = await cloudReq('GET');
    if (!remote || !remote.t) { cloudStatus('☁ w chmurze jeszcze nic nie ma', 'bad'); return false; }
    if (manual && cloudHasEdits() && !confirm('Wczytać punkty z chmury (' + cloudDate(remote.t) + ')?\nTwoje obecne zmiany w edytorze zostaną zastąpione.')) return false;
    cloudApply(remote);
    cloudStatus('☁ wczytano z chmury · ' + cloudDate(remote.t), 'good'); return true;
  } catch (e) { cloudStatus('☁ nie pobrano: ' + e.message, 'bad'); return false; }
  finally { cloudBusy = false; }
}
/* automatyczna synchronizacja: przy starcie, otwarciu edytora, powrocie sieci i przy wykryciu konfliktu */
async function cloudSync() {
  if (!cloudOn() || !cloudCode() || cloudBusy) return;
  let remote;
  cloudBusy = true;
  try { remote = await cloudReq('GET'); }
  catch (e) { cloudBusy = false; cloudStatus('☁ offline: ' + e.message, 'bad'); return; }
  cloudBusy = false;
  const rt = remote && remote.t ? Number(remote.t) : 0, dirty = cloudDirty() || cloudHold;
  if (!rt) { if (cloudHasEdits()) await cloudPush(true); else cloudIdle(); return; }          // chmura pusta → wyślij swoje (pusty zapis Firebase = tylko znacznik t)
  if (rt === cloudBase()) { if (dirty) await cloudPush(true); else cloudIdle(); return; }      // nikt poza mną nie zmieniał → wyślij moje albo nic
  if (!dirty) { cloudApply(remote); cloudStatus('☁ wczytano nowsze punkty · ' + cloudDate(rt), 'good'); return; }   // zmieniono gdzie indziej, ja nic nie mam niewysłanego
  cloudHold = true;                                                                            // zmieniono w obu miejscach → konflikt
  if (confirm('Chmura ma nowsze punkty (' + cloudDate(rt) + '), a ty masz niewysłane zmiany.\n\nOK = wczytaj z chmury (twoje niewysłane zmiany przepadną)\nAnuluj = nic nie zmieniaj teraz')) { cloudApply(remote); cloudStatus('☁ wczytano z chmury', 'good'); }
  else cloudIdle();
}
function cloudSchedule() {
  if (!cloudOn() || !cloudCode()) return;
  cloudDirty(true); cloudStatus('☁ zmiany czekają na wysłanie…');
  clearTimeout(cloudTimer); cloudTimer = setTimeout(() => cloudPush(false), 1500);
}

/* ---------- okno ☁ CHMURA ---------- */
function renderCloud() {
  const c = cloudCode(), on = cloudOn();
  $('#clInfo').innerHTML = !on ? 'Chmura nie jest skonfigurowana. Wpisz adres bazy Firebase w <b>CLOUD_URL</b> (js/data/config.js) — instrukcja w DEVELOPING.md.'
    : c ? 'Twoje punkty są kopiowane do chmury. <b>Zapisz ten kod</b> — po reinstalacji aplikacji wpisz go tutaj, a punkty wrócą.'
        : 'Utwórz nowy kod (pierwszy telefon) albo wpisz kod z innego telefonu / z poprzedniej instalacji.';
  $('#clCode').textContent = c ? cloudFmt(c) : '— brak —';
  $('#clNew').hidden = !on || !!c; $('#clJoinRow').hidden = !on || !!c;
  $('#clPush').hidden = !on || !c; $('#clPull').hidden = !on || !c; $('#clCopy').hidden = !c; $('#clOff').hidden = !c;
}
function openCloud() { renderCloud(); cloudIdle(); $('#cloud').hidden = false; }
function closeCloud() { $('#cloud').hidden = true; }
$('#clClose').onclick = closeCloud;
$('#clNew').onclick = async () => {
  cloudSetCode(cloudNewCode()); renderCloud();
  await cloudPush(true);                                      // od razu wyślij to, co jest w telefonie
  renderCloud();
};
$('#clJoin').onclick = async () => {
  const c = cloudNorm($('#clInput').value);
  if (c.length !== 16) { cloudStatus('Kod ma 16 znaków (np. ABCD-EFGH-JKLM-NPQR).', 'bad'); return; }
  cloudSetCode(c); $('#clInput').value = ''; renderCloud();
  const ok = await cloudPull(true);
  if (!ok && !cloudHasEdits()) cloudSetCode('');                  // zły kod / pusta chmura i nic lokalnie → nie zapamiętuj
  renderCloud();
};
$('#clPush').onclick = async () => { if (confirm('Nadpisać chmurę punktami z tego telefonu?')) { await cloudPush(true); renderCloud(); } };
$('#clPull').onclick = async () => { await cloudPull(true); renderCloud(); };
$('#clCopy').onclick = async () => {
  const c = cloudFmt(cloudCode());
  try { await navigator.clipboard.writeText(c); cloudStatus('Skopiowano kod: ' + c, 'good'); } catch (e) { cloudStatus('Nie udało się skopiować — przepisz kod ręcznie.', 'bad'); }
};
$('#clOff').onclick = () => { if (!confirm('Odłączyć ten telefon od chmury? Dane w chmurze zostają — możesz wrócić po kodzie.')) return; cloudSetCode(''); cloudDirty(false); cloudHold = false; renderCloud(); cloudIdle(); };
window.addEventListener('online', () => cloudSync());
setTimeout(() => { cloudIdle(); cloudSync(); }, 800);
