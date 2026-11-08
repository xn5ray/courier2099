'use strict';
/* AUTOMATYCZNE AKTUALIZACJE (OTA) — tylko w aplikacji na Androidzie.
   Przy starcie gra pyta GitHuba o najnowszy release. Jeśli ma wyższy numer buildu niż ta wersja,
   pobiera z niego bundle.zip (pliki gry: HTML/CSS/JS) w tle i uruchamia się już z nową wersją — bez ręcznej instalacji APK.
   Zmiany w kodzie natywnym (nowe wtyczki, uprawnienia) nadal wymagają zainstalowania nowego APK.
   Ładowany po core.js, przed main.js. */
(() => {
  const st = t => { window.OTA_STATUS = t; };         // podgląd stanu w pasku diagnostycznym (js/debug.js)
  const up = NATIVE && CAP.Plugins && CAP.Plugins.CapacitorUpdater;
  if (!up) { st(NATIVE ? 'BRAK WTYCZKI w tym APK (zainstaluj nowy APK)' : 'tylko w apce'); return; }   // przeglądarka / brak wtyczki
  const REPO = 'xn5ray/courier2099';
  const TRIED = 'c2099_ota_tried';                     // ostatni build, który już próbowaliśmy zastosować
  const mine = Number(window.BUILD_NUM) || 0;

  // Mówi wtyczce, że ta wersja gry wstała poprawnie. Bez tego po ok. 10 s wraca do poprzedniej wersji.
  try { up.notifyAppReady(); } catch (e) { st('notifyAppReady: ' + (e && e.message || e)); }

  async function check() {
    try {
      if (navigator.onLine === false) { st('offline'); return; }
      st('sprawdzam GitHub…');
      const r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) { st('GitHub API: HTTP ' + r.status + (r.status === 404 ? ' (repo prywatne/brak release?)' : r.status === 403 ? ' (limit zapytań)' : '')); return; }
      const rel = await r.json();
      const m = /^build-(\d+)$/.exec(rel.tag_name || '');
      if (!m) { st('tag "' + rel.tag_name + '" nie pasuje do build-N'); return; }
      const n = Number(m[1]);
      if (n <= mine) { st('aktualne (build ' + mine + ', najnowszy ' + n + ')'); return; }   // mamy już tę wersję albo nowszą
      if (Number(localStorage.getItem(TRIED)) >= n) { st('build ' + n + ' już próbowany (wrócił do ' + mine + ')'); return; }   // ten build już raz wgrany (np. się wysypał i wrócił) — nie próbuj w kółko
      const asset = (rel.assets || []).find(a => a.name === 'bundle.zip');
      if (!asset) { st('release ' + n + ' bez bundle.zip'); return; }                       // release bez paczki gry (np. starszy)
      st('pobieram build ' + n + '…');
      const b = await up.download({ url: asset.browser_download_url, version: 'build-' + n });
      try { localStorage.setItem(TRIED, String(n)); } catch (e) {}
      st('pobrano ' + n + ', wgrywam…');
      if (typeof M !== 'undefined' && M) {             // trwa misja — nie przeładowuj, wejdzie przy następnym uruchomieniu
        await up.next({ id: b.id });
        st('build ' + n + ' czeka na restart');
        toast('Nowa wersja gry pobrana — zadziała po ponownym uruchomieniu.', 'good', 4000);
      } else {
        await up.set({ id: b.id });                    // przeładowuje grę już z nową wersją (zapis gry jest w localStorage)
      }
    } catch (e) { st('BŁĄD: ' + (e && e.message || e)); }
  }
  setTimeout(check, 3000);
})();
