(function () {
  'use strict';
  const registry = window.TS_LOCALES;
  if (!registry) return;

  const links = new Map();
  for (const link of document.querySelectorAll('[data-root-locale]')) {
    const code = link.dataset.rootLocale;
    if (registry.normalize(code) !== code || link.getAttribute('href') !== '/' + code + '/') continue;
    links.set(code, link);
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      try { localStorage.setItem('preferred_lang', code); } catch (_) { /* The link still works. */ }
    });
  }

  let saved;
  try { saved = localStorage.getItem('preferred_lang'); } catch (_) { /* Private browsing. */ }
  const browserLanguages = navigator.languages || [];
  const suggested = [saved, ...browserLanguages, navigator.language]
    .map(registry.normalize)
    .find(code => links.has(code));
  if (!suggested) return;

  const link = links.get(suggested);
  link.setAttribute('data-recommended', '');
  const label = document.createElement('small');
  label.className = 'recommended-label';
  label.lang = 'en';
  label.textContent = 'Suggested';
  link.append(label);
})();
