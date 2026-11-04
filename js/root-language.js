(function () {
  'use strict';
  const registry = window.TS_LOCALES;
  const routes = JSON.parse(document.getElementById('ts-root-routes').textContent);
  const choose = value => { const code = registry.normalize(value); return code && routes[code] ? code : null; };
  function goToLang(value) {
    const code = choose(value);
    if (!code) return false;
    try { localStorage.setItem('preferred_lang', code); } catch (_) { /* private mode */ }
    location.replace(routes[code]);
    return true;
  }
  window.TS_ROOT_LANG = { goToLang };
  document.querySelectorAll('[data-root-locale]').forEach(link => link.addEventListener('click', event => {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (goToLang(link.dataset.rootLocale)) event.preventDefault();
  }));
  let saved;
  try { saved = choose(localStorage.getItem('preferred_lang')); } catch (_) { /* private mode */ }
  const detected = (navigator.languages || [navigator.language]).map(choose).find(Boolean);
  goToLang(saved || detected || 'en');
})();
