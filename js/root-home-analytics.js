// The multilingual home keeps its real canonical path. All consent, transport,
// dimensions and one-view guards still belong to the existing analytics runtime.
(function () {
  'use strict';
  const schema = window.TS_ANALYTICS_SCHEMA;
  if (!schema || !['/', '/index.html'].includes(location.pathname)) return;
  const page = document.querySelector('link[rel="canonical"]');
  const language = document.documentElement.dataset.lang;
  if (page?.href !== 'https://tilessurvive.net/' ||
      !schema.locales.includes(language) || !document.querySelector('[data-v5-home]')) return;
  window.TS_ANALYTICS_SCHEMA = Object.freeze({
    ...schema,
    classify(path) {
      return path === '/' ? {page: '/', language, page_type: 'home', content_id: ''} : schema.classify(path);
    }
  });
})();
