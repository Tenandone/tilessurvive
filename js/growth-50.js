(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.mount(root.document);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const metrics = ['attack', 'defense', 'hp', 'power'];
  function compare(curve, from, to) {
    if (!Array.isArray(curve) || curve.length !== 15 || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 15 || from > to) throw new RangeError('Invalid gear level range');
    curve.forEach((row, i) => {
      if (row.level !== i + 1 || metrics.some(k => !Number.isSafeInteger(row[k]) || row[k] < 0)) throw new TypeError('Invalid explicit gear curve');
    });
    return metrics.map(key => ({key, from: curve[from - 1][key], to: curve[to - 1][key], gain: curve[to - 1][key] - curve[from - 1][key]}));
  }
  function mount(doc) {
    doc.querySelectorAll('[data-growth-50]').forEach(section => {
      if (section.dataset.growthMounted === 'true') return;
      const config = JSON.parse(section.querySelector('script[data-growth-config]').textContent);
      const form = section.querySelector('form');
      const from = form.querySelector('[name=from]'), to = form.querySelector('[name=to]');
      const status = section.querySelector('[data-growth-status]');
      const locale = config.language === 'zh-tw' ? 'zh-TW' : config.language;
      const fmt = n => n.toLocaleString(locale);
      function update() {
        try {
          const values = compare(config.curve, Number(from.value), Number(to.value));
          status.textContent = '';
          section.querySelector('[data-growth-from]').textContent = config.copy.level + ' ' + from.value;
          section.querySelector('[data-growth-to]').textContent = config.copy.level + ' ' + to.value;
          for (const value of values) {
            const row = section.querySelector('[data-growth-metric="' + value.key + '"]');
            ['from', 'to', 'gain'].forEach(key => { row.querySelector('[data-value="' + key + '"]').textContent = fmt(value[key]); });
          }
          section.querySelector('[data-growth-results]').hidden = false;
        } catch (_) {
          status.textContent = config.copy.error;
          section.querySelector('[data-growth-results]').hidden = true;
        }
      }
      form.addEventListener('submit', e => { e.preventDefault(); update(); });
      form.addEventListener('change', update);
      section.dataset.growthMounted = 'true';
      form.hidden = false;
      update();
    });
  }
  return {compare, mount, metrics};
});
