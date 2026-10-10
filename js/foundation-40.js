(function () {
  'use strict';
  const node = document.getElementById('foundation-data');
  if (!node) return;
  const config = JSON.parse(node.textContent), t = config.copy;
  const fmt = n => new Intl.NumberFormat(document.documentElement.lang).format(n);
  const form = document.querySelector('[data-training-plan]');
  if (form && window.TSFoundationMath) {
    form.hidden = false;
    const output = document.querySelector('[data-plan-result]');
    const update = () => {
      try {
        const values = Object.fromEntries(new FormData(form));
        const plan = TSFoundationMath.trainingPlan(config.event, values);
        output.classList.remove('is-error');
        output.textContent = '';
        for (const key of ['planned', 'total', 'remaining', 'additionalTroops', 'additionalMinutes']) {
          const item = document.createElement('div'), label = document.createElement('span'), value = document.createElement('strong');
          label.textContent = t[key]; value.textContent = fmt(plan[key]); item.append(label, value); output.append(item);
        }
      } catch {
        output.classList.add('is-error'); output.textContent = t.invalid;
      }
    };
    form.addEventListener('input', update); form.addEventListener('change', update); update();
  }
  const packageForm = document.querySelector('[data-package-compare]');
  if (packageForm && window.TSFoundationMath && Array.isArray(config.packages)) {
    packageForm.hidden = false;
    const output = document.querySelector('[data-package-result]');
    const ratio = n => new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 4 }).format(n);
    const update = () => {
      try {
        const first = config.packages.find(p => p.id === packageForm.elements.first.value);
        const second = config.packages.find(p => p.id === packageForm.elements.second.value);
        const compared = TSFoundationMath.comparePackages(first, second);
        output.classList.remove('is-error'); output.textContent = '';
        for (const [key, value] of [['packageFirst', compared.a], ['packageSecond', compared.b]]) {
          const item = document.createElement('div'), label = document.createElement('span'), number = document.createElement('strong'), condition = document.createElement('small');
          label.textContent = t[key] + ' · ' + fmt(value.totalDiamonds) + ' ' + t.diamonds;
          number.textContent = ratio(value.diamondsPerCoin);
          condition.textContent = value.condition === 'one-time-purchase' ? t.packageOneTime : t.packageNoCondition;
          item.append(label, number, condition); output.append(item);
        }
      } catch {
        output.classList.add('is-error'); output.textContent = t.packageInvalid;
      }
    };
    packageForm.addEventListener('input', update); packageForm.addEventListener('change', update); update();
  }
  const filters = document.querySelector('[data-item-filter]');
  if (filters) {
    filters.hidden = false;
    const entries = [...document.querySelectorAll('[data-item-entry]')];
    const update = () => {
      const query = filters.elements.query.value.trim().toLocaleLowerCase();
      const category = filters.elements.category.value;
      let count = 0;
      for (const entry of entries) {
        const matches = (!query || (entry.textContent + ' ' + (entry.dataset.searchAliases || '')).toLocaleLowerCase().includes(query)) && (!category || entry.dataset.category === category);
        entry.hidden = !matches; if (matches) count++;
      }
      document.querySelector('[data-item-count]').textContent = t.results.replace('{n}', fmt(count));
      document.querySelector('[data-item-empty]').hidden = count !== 0;
    };
    filters.addEventListener('input', update); filters.addEventListener('change', update); update();
    const initial = new URLSearchParams(location.search).get('q');
    if (initial) { filters.elements.query.value = initial; update(); }
    const revealItem = (anchor, scroll) => {
      try { anchor = decodeURIComponent(anchor); } catch { return; }
      const target = document.getElementById(anchor);
      if (!target?.matches('[data-item-entry]')) return;
      if (target.hidden) {
        filters.elements.query.value = ''; filters.elements.category.value = ''; update();
      }
      target.open = true;
      if (scroll) target.scrollIntoView({ block: 'start' });
    };
    revealItem(location.hash.slice(1), false);
    window.addEventListener('hashchange', () => revealItem(location.hash.slice(1), true));
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href^="#"]');
      if (link) revealItem(link.getAttribute('href').slice(1), true);
    });
  }
})();
