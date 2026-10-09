(function (global) {
  'use strict';
  function compare(hero, from, to) {
    if (!Number.isInteger(from) || !Number.isInteger(to)) throw Error('Invalid skill level');
    return hero.skills.map(skill => {
      const a = skill.values.find(row => row.level === from), b = skill.values.find(row => row.level === to);
      if (!a || !b || !/^\d+\.\d{2}$/.test(a.value) || !/^\d+\.\d{2}$/.test(b.value)) throw Error('Unavailable skill level');
      return { id:skill.id, from:a.value, to:b.value, unit:skill.unit };
    });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { compare };
  if (!global.document) return;
  const d = global.document, node = d.getElementById('hero-skill-levels-data');
  if (!node) return;
  const config = JSON.parse(node.textContent), form = d.querySelector('[data-skill-level-compare]');
  if (!form) return;
  const block = d.getElementById('skill-level-comparison-40'), table = block.querySelector('[data-level-comparison-table]');
  const status = form.querySelector('[data-level-status]');
  const format = (value, unit) => (unit === 'percent-bonus' ? '+' : '') + (d.documentElement.lang === 'ru' ? value.replace('.', ',') : value) + (unit === 'percent-atk' ? '% ATK' : '%');
  const update = () => {
    try {
      const from = Number(form.querySelector('[name="from"]').value), to = Number(form.querySelector('[name="to"]').value);
      const values = compare(config.hero, from, to);
      table.querySelectorAll('thead th')[1].textContent = 'Lv.' + from;
      table.querySelectorAll('thead th')[2].textContent = 'Lv.' + to;
      for (const value of values) {
        const cells = table.querySelector('[data-skill-level-row="' + value.id + '"]').querySelectorAll('td');
        cells[0].textContent = format(value.from, value.unit); cells[1].textContent = format(value.to, value.unit);
      }
      status.textContent = config.copy.updated.replace('{from}', from).replace('{to}', to);
    } catch { status.textContent = config.copy.invalid; }
  };
  form.hidden = false;
  form.addEventListener('change', update); form.addEventListener('submit', event => event.preventDefault());
  // Keep the original server-rendered Lv10/11 comparison until a selection changes.
})(typeof window === 'undefined' ? globalThis : window);
