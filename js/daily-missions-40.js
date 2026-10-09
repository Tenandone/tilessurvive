/* Session-only planning: no account access, network requests or stored progress. */
(function (global) {
  'use strict';
  function plan(missions, selectedIds, target) {
    if (!Number.isSafeInteger(target) || target < 1) throw new Error('Invalid target');
    const selected = new Set(selectedIds), known = new Set();
    let planned = 0;
    for (const mission of missions) {
      if (known.has(mission.id) || !Number.isSafeInteger(mission.points) || mission.points < 1) throw new Error('Invalid mission');
      known.add(mission.id);
      if (selected.has(mission.id)) planned += mission.points;
    }
    if ([...selected].some(id => !known.has(id))) throw new Error('Unknown mission');
    return { selected: selected.size, planned, remaining: Math.max(0, target - planned) };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { plan };
  if (!global.document) return;
  const document = global.document, data = document.getElementById('daily-missions-data');
  if (!data) return;
  const config = JSON.parse(data.textContent), form = document.querySelector('[data-daily-plan]');
  if (!form) return;
  const t = config.copy, output = form.querySelector('[data-daily-result]');
  const fmt = n => new Intl.NumberFormat(document.documentElement.lang).format(n);
  const inputs = [...form.querySelectorAll('input[name="mission"]')];
  const target = form.querySelector('select[name="target"]');
  // Browsers may restore form state on reload; this planner deliberately starts empty.
  inputs.forEach(input => { input.checked = false; input.disabled = false; input.hidden = false; });
  target.value = String(config.milestones[0]);
  form.querySelectorAll('[data-daily-enhancement]').forEach(node => { node.hidden = false; });
  const update = () => {
    try {
      const targetPoints = Number(target.value);
      if (!config.milestones.includes(targetPoints)) throw new Error('Unknown milestone');
      const result = plan(config.missions, inputs.filter(input => input.checked).map(input => input.value), targetPoints);
      output.classList.remove('is-error'); output.textContent = '';
      for (const key of ['selected', 'planned', 'remaining']) {
        const entry = document.createElement('div'), label = document.createElement('span'), value = document.createElement('strong');
        label.textContent = t[key]; value.textContent = fmt(result[key]); entry.append(label, value); output.append(entry);
      }
    } catch {
      output.classList.add('is-error'); output.textContent = t.invalid;
    }
  };
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', update);
  form.querySelector('[data-daily-clear]').addEventListener('click', () => { inputs.forEach(input => { input.checked = false; }); update(); });
  update();
})(typeof window === 'undefined' ? globalThis : window);
