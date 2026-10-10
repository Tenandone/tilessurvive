'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const client = fs.readFileSync(path.join(__dirname, '../js/foundation-40.js'), 'utf8');

function fixture({ search = '', hash = '', category = '' } = {}) {
  const dom = parseHTML(`<!doctype html><html lang="en"><body>
    <script id="foundation-data" type="application/json">{"copy":{"results":"{n} items"}}</script>
    <form data-item-filter hidden>
      <input name="query" value="">
      <select name="category"><option value="">All</option><option value="resource">Resource</option><option value="recruit">Recruit</option></select>
    </form>
    <p data-item-count></p><p data-item-empty hidden>No matches</p>
    <details id="item-alpha" data-item-entry data-category="resource"><summary>Alpha</summary>Resource</details>
    <details id="item-beta" data-item-entry data-category="recruit"><summary>Beta</summary>Recruit</details>
    <details id="item-gamma" data-item-entry data-category="resource"><summary>Gamma</summary>Resource</details>
    <h2 id="vip-shop">VIP shop</h2>
    <a id="beta-link" href="#item-beta"><span>Open Beta</span></a>
    <a id="encoded-link" href="#item-%62eta">Encoded Beta</a>
    <a id="heading-link" href="#vip-shop">Section</a>
    <a id="missing-link" href="#item-missing">Missing item</a>
    <a id="malformed-link" href="#item-%E0%A4%A">Malformed UTF-8</a>
    <a id="bare-link" href="#">Empty fragment</a>
  </body></html>`);
  const { document, Event } = dom;
  const form = document.querySelector('[data-item-filter]');
  const query = form.querySelector('[name="query"]');
  const select = form.querySelector('[name="category"]');
  // Linkedom omits form.elements and a writable select.value; keep the DOM/events real.
  Object.defineProperty(select, 'value', { value: category, writable: true });
  Object.defineProperty(form, 'elements', { value: { query, category: select } });
  const entries = [...document.querySelectorAll('[data-item-entry]')];
  const scrolls = [];
  for (const entry of entries) {
    entry.open = false;
    entry.scrollIntoView = options => scrolls.push({ id: entry.id, options });
  }
  const location = { search, hash };
  const window = {
    document, location,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
    dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
  };
  vm.runInNewContext(client, { document, window, location, URLSearchParams, Intl, console }, { filename: 'foundation-40.js' });
  return {
    document, form, query, select, entries, scrolls, location,
    item: id => document.getElementById(`item-${id}`),
    filter(text, selected) {
      query.value = text; select.value = selected;
      form.dispatchEvent(new Event('input', { bubbles: true }));
    },
    changeHash(value) {
      location.hash = value;
      window.dispatchEvent(new Event('hashchange'));
    },
    click(id, nested = false) {
      const anchor = document.getElementById(id);
      const event = new Event('click', { bubbles: true, cancelable: true });
      (nested ? anchor.querySelector('span') : anchor).dispatchEvent(event);
      return event;
    },
  };
}

function assertRevealed(f, id) {
  assert.equal(f.item(id).hidden, false, 'The linked item must be visible');
  assert.equal(f.item(id).open, true, 'The linked details must be expanded');
  assert.equal(f.query.value, '', 'Clear a search that hides the linked item');
  assert.equal(f.select.value, '', 'Clear a category that hides the linked item');
  assert(f.entries.every(entry => !entry.hidden), 'Recompute all filtered rows after resetting');
  assert.equal(f.document.querySelector('[data-item-count]').textContent, '3 items');
  assert.equal(f.document.querySelector('[data-item-empty]').hidden, true);
}

test('initial query and category cannot keep a directly linked item hidden; no forced initial scroll', () => {
  const f = fixture({ search: '?q=alpha', hash: '#item-%62eta', category: 'resource' });
  assertRevealed(f, 'beta');
  assert.equal(f.form.hidden, false);
  assert.equal(f.item('alpha').open, false);
  assert.equal(f.item('gamma').open, false);
  assert.deepEqual(f.scrolls, []);
});

test('hashchange reveals a different filtered-out item and scrolls to its details', () => {
  const f = fixture({ search: '?q=alpha', hash: '#item-alpha', category: 'resource' });
  assert.equal(f.item('alpha').open, true);
  assert.equal(f.item('beta').hidden, true);
  assert.equal(f.query.value, 'alpha', 'A visible initial target does not discard useful filters');
  assert.equal(f.select.value, 'resource');
  f.changeHash('#item-beta');
  assertRevealed(f, 'beta');
  assert.deepEqual(f.scrolls.map(x => x.id), ['item-beta']);
});

test('clicking the same hash again, including its nested label, reopens and reveals the item', () => {
  const f = fixture({ hash: '#item-beta' });
  f.item('beta').open = false;
  f.filter('alpha', 'resource');
  assert.equal(f.item('beta').hidden, true);
  const originalHash = f.location.hash;
  f.click('beta-link', true);
  assertRevealed(f, 'beta');
  assert.equal(f.location.hash, originalHash, 'The test does not manufacture a hashchange event');
  assert.deepEqual(f.scrolls.map(x => x.id), ['item-beta']);
  f.item('beta').open = false;
  f.click('beta-link');
  assert.equal(f.item('beta').open, true);
  assert.deepEqual(f.scrolls.map(x => x.id), ['item-beta', 'item-beta']);
});

test('irrelevant, missing and malformed anchors preserve filters, visibility and open state', () => {
  for (const hash of ['#vip-shop', '#item-missing', '#item-%E0%A4%A', '#']) {
    const f = fixture({ search: '?q=alpha', hash, category: 'resource' });
    const snapshot = () => JSON.stringify({
      query: f.query.value, category: f.select.value,
      items: f.entries.map(e => [e.id, e.hidden, e.open]),
      count: f.document.querySelector('[data-item-count]').textContent,
      empty: f.document.querySelector('[data-item-empty]').hidden,
      scrolls: f.scrolls,
    });
    assert.equal(f.query.value, 'alpha');
    assert.equal(f.select.value, 'resource');
    assert.equal(f.item('alpha').hidden, false);
    assert.equal(f.item('beta').hidden, true);
    assert(f.entries.every(e => !e.open));
    const before = snapshot();
    for (const value of ['#vip-shop', '#item-missing', '#item-%E0%A4%A', '#']) {
      assert.doesNotThrow(() => f.changeHash(value));
      assert.equal(snapshot(), before);
    }
    for (const id of ['heading-link', 'missing-link', 'malformed-link', 'bare-link']) {
      assert.doesNotThrow(() => f.click(id));
      assert.equal(snapshot(), before);
    }
  }
});
