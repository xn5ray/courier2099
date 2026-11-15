'use strict';
/* DIAGNOSTYKA: pokazuje na ekranie błędy JS (czerwone okienko, dotknij aby zamknąć) oraz mały pasek stanu
   (numer buildu, czy misja istnieje, czy działa pętla czasu). Ładowany jako PIERWSZY skrypt.
   Żeby wyłączyć: usuń linijkę <script src="js/debug.js"> z index.html. */
(() => {
  const errs = [];
  let box = null, bar = null;

  function ui() {
    if (!document.body) return false;
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:6px;right:6px;top:6px;z-index:2147483647;max-height:45vh;overflow:auto;' +
        'background:rgba(40,0,0,.94);color:#ff8a8a;border:1px solid #f33;border-radius:6px;padding:8px;' +
        'font:11px/1.35 monospace;white-space:pre-wrap;word-break:break-word;display:none';
      box.onclick = () => { box.style.display = 'none'; };
      document.body.appendChild(box);
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:2147483646;pointer-events:none;' +
        'background:rgba(0,0,0,.65);color:#7fffd4;padding:2px 5px;border-radius:4px;font:10px/1.3 monospace';
      document.body.appendChild(bar);
    }
    return true;
  }

  function report(kind, msg, where, stack) {
    const t = new Date().toTimeString().slice(0, 8);
    errs.push(t + ' [' + kind + '] ' + msg + (where ? '\n  @ ' + where : '') + (stack ? '\n' + String(stack).split('\n').slice(0, 4).join('\n') : ''));
    if (errs.length > 6) errs.shift();
    if (!ui()) return;
    box.textContent = 'BŁĘDY (dotknij, aby zamknąć):\n' + errs.join('\n\n');
    box.style.display = 'block';
  }

  window.addEventListener('error', e => {
    const src = (e.filename || '').split('/').slice(-2).join('/');
    report('error', e.message || 'błąd', src ? src + ':' + e.lineno + ':' + e.colno : '', e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    report('promise', (r && (r.message || r.code != null && ('code ' + r.code))) || String(r), '', r && r.stack);
  });

  /* pasek stanu: odświeżany co 0,5 s niezależnie od gry */
  setInterval(() => {
    if (!ui()) return;
    let s = 'build ' + (window.BUILD_NUM || 0) + (window.OTA_STATUS ? ' | OTA: ' + window.OTA_STATUS : '');
    try {
      s += typeof M === 'undefined' ? ' | M:?' : ' | M:' + (M ? 'tak' : 'nie');
      s += typeof tickT === 'undefined' ? ' | tickT:?' : ' | tickT:' + tickT;
      const h = document.querySelector('#hTime');
      if (h) s += ' | czas:' + h.textContent;
      if (typeof M !== 'undefined' && M) s += ' | zostało:' + Math.round((M.endsAt - Date.now()) / 1000) + 's';
    } catch (e) { s += ' | ' + e.message; }
    bar.textContent = s;
  }, 500);
})();
