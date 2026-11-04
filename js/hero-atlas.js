(function () {
  'use strict';
  const fields = ['name', 'faction', 'rarity', 'role', 'form'];
  const filters = ['faction', 'rarity', 'role', 'form'];
  const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/gu, ' ').trim();
  const format = (text, values) => text.replace(/\{(forms|heroes|count)\}/g, (_, key) => String(values[key]));

  function initialize(host) {
    if (host.hasAttribute('data-atlas-ready')) return;
    let config;
    try { config = JSON.parse(host.querySelector('script[data-atlas-config]')?.textContent || 'null'); } catch (_) { return; }
    const copy = config?.copy;
    if (!config || typeof config.locale !== 'string' || !copy ||
        ['results', 'empty', 'compareLimit', 'selected', 'remove', 'compare'].some(key => typeof copy[key] !== 'string' || !copy[key].trim()) ||
        fields.some(key => typeof copy.fields?.[key] !== 'string' || !copy.fields[key].trim())) return;
    const controls = host.querySelector('[data-atlas-controls]');
    const query = host.querySelector('[data-atlas-query]');
    const includeHeld = host.querySelector('[data-atlas-include-held]');
    const sort = host.querySelector('[data-atlas-sort]');
    const reset = host.querySelector('[data-atlas-reset]');
    const status = host.querySelector('[data-atlas-status]');
    const empty = host.querySelector('[data-atlas-empty]');
    const comparison = host.querySelector('[data-atlas-comparison]');
    const tableHost = host.querySelector('[data-atlas-comparison-table]');
    const selectedStatus = host.querySelector('[data-atlas-selected]');
    const clear = host.querySelector('[data-atlas-clear-compare]');
    const selects = new Map(filters.map(key => [key, host.querySelector('[data-atlas-filter="' + key + '"]')]));
    if ([controls, query, includeHeld, sort, reset, status, empty, comparison, tableHost, selectedStatus, clear, ...selects.values()].some(node => !node)) return;

    const cards = [...host.querySelectorAll('.hero-atlas-card')].map((node, index) => {
      const values = Object.fromEntries(fields.map(key => [key, node.querySelector('[data-atlas-field="' + key + '"]')?.textContent.trim()]));
      const box = node.querySelector('[data-atlas-compare]');
      return {node, index, id: node.dataset.atlasId, identity: node.dataset.identity, publication: node.dataset.publication, values, box,
        detail: node.querySelector('a[data-atlas-detail]'), search: normalize((node.dataset.search || '') + ' ' + (values.name || ''))};
    });
    if (!cards.length || cards.some(card => !card.id || !card.identity || !card.box || card.box.value !== card.id || !card.detail ||
        !['published', 'held'].includes(card.publication) || fields.some(key => !card.values[key]) || filters.some(key => !card.node.dataset[key])) || new Set(cards.map(card => card.id)).size !== cards.length) return;
    const byId = new Map(cards.map(card => [card.id, card]));
    const selected = new Map();
    const parents = new Map();
    for (const card of cards) {
      if (!parents.has(card.node.parentElement)) parents.set(card.node.parentElement, []);
      parents.get(card.node.parentElement).push(card);
    }
    const groups = [...host.querySelectorAll('[data-atlas-group]')];
    let collator;
    try { collator = new Intl.Collator(config.locale, {sensitivity: 'base', numeric: true}); }
    catch (_) { return; }
    const number = new Intl.NumberFormat(config.locale);
    const selectedText = () => format(copy.selected, {count: number.format(selected.size)});
    const create = (tag, text) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      return node;
    };
    if (!comparison.id) {
      let id = 'hero-atlas-comparison', suffix = 1;
      while (document.getElementById(id)) id = 'hero-atlas-comparison-' + (++suffix);
      comparison.id = id;
    }
    const comparisonJump = create('a');
    comparisonJump.setAttribute('data-atlas-compare-jump', '');
    comparisonJump.setAttribute('href', window.location.pathname + window.location.search + '#' + encodeURIComponent(comparison.id));
    comparisonJump.hidden = true;
    host.appendChild(comparisonJump);
    function announceResults() {
      const visible = cards.filter(card => !card.node.hidden);
      status.textContent = format(copy.results, {forms: number.format(visible.length), heroes: number.format(new Set(visible.map(card => card.identity)).size)});
      empty.hidden = visible.length !== 0;
      empty.textContent = copy.empty;
    }
    function render() {
      const terms = normalize(query.value).split(' ').filter(Boolean);
      for (const card of cards) card.node.hidden = (!includeHeld.checked && card.publication === 'held') || !terms.every(term => card.search.includes(term)) ||
        filters.some(key => selects.get(key).value && card.node.dataset[key] !== selects.get(key).value);
      for (const [parent, list] of parents) {
        const ordered = sort.value === 'name' ? [...list].sort((a, b) => collator.compare(a.values.name, b.values.name) || a.index - b.index) : list;
        for (const card of ordered) parent.appendChild(card.node);
      }
      for (const group of groups) {
        const members = cards.filter(card => group.contains(card.node));
        if (members.length) group.hidden = members.every(card => card.node.hidden);
      }
      announceResults();
    }
    function safeDetail(card) {
      const raw = card.detail.getAttribute('href') || '';
      try {
        const url = new URL(raw, window.location.href);
        if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return null;
        return raw;
      } catch (_) { return null; }
    }
    function renderComparison() {
      selectedStatus.textContent = selectedText();
      comparison.hidden = selected.size === 0;
      comparisonJump.hidden = selected.size === 0;
      comparisonJump.textContent = copy.compare + ' · ' + selectedText();
      for (const card of cards) card.box.checked = selected.has(card.id);
      const table = tableHost.tagName === 'TABLE' ? tableHost : create('table');
      table.replaceChildren();
      if (!selected.size) { if (tableHost !== table) tableHost.replaceChildren(); return; }
      table.classList.add('hero-atlas-comparison-table');
      const caption = create('caption', copy.compare);table.appendChild(caption);
      const head = create('thead'), row = create('tr'), corner = create('th', copy.fields.name);corner.scope = 'col';row.appendChild(corner);
      for (const card of selected.values()) {
        const cell = create('th');cell.scope = 'col';
        const href = safeDetail(card), name = create(href ? 'a' : 'span', card.values.name);
        if (href) name.setAttribute('href', href);
        cell.appendChild(name);
        const remove = create('button', copy.remove);remove.type = 'button';remove.setAttribute('data-atlas-remove', card.id);
        remove.setAttribute('aria-label', copy.remove + ': ' + card.values.name + ' · ' + card.values.form);
        remove.addEventListener('click', () => { selected.delete(card.id);renderComparison();announceResults(); });
        cell.appendChild(remove);row.appendChild(cell);
      }
      head.appendChild(row);table.appendChild(head);
      const body = create('tbody');
      for (const key of fields.slice(1)) {
        const line = create('tr'), label = create('th', copy.fields[key]);label.scope = 'row';line.appendChild(label);
        for (const card of selected.values()) line.appendChild(create('td', card.values[key]));
        body.appendChild(line);
      }
      table.appendChild(body);
      if (tableHost !== table) tableHost.replaceChildren(table);
    }

    query.addEventListener('input', render);
    includeHeld.checked = false;
    includeHeld.addEventListener('change', render);
    for (const select of selects.values()) select.addEventListener('change', render);
    sort.addEventListener('change', render);
    reset.addEventListener('click', () => {
      query.value = '';includeHeld.checked = false;for (const select of selects.values()) select.value = '';sort.value = 'original';render();query.focus();
    });
    clear.addEventListener('click', () => { selected.clear();renderComparison();announceResults(); });
    for (const card of cards) {
      card.box.checked = false;
      card.box.addEventListener('change', () => {
        if (card.box.checked) {
          if (!selected.has(card.id) && selected.size === 3) {
            card.box.checked = false;
            selectedStatus.textContent = selectedText() + ' · ' + copy.compareLimit;
            status.textContent = copy.compareLimit;
            return;
          }
          selected.set(card.id, byId.get(card.id));
        } else selected.delete(card.id);
        renderComparison();announceResults();
      });
    }
    status.setAttribute('aria-live', 'polite');
    selectedStatus.setAttribute('aria-live', 'polite');
    host.setAttribute('data-atlas-ready', '');
    controls.hidden = false;
    renderComparison();render();
  }
  for (const host of document.querySelectorAll('[data-hero-atlas]')) initialize(host);
})();
