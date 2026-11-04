'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {parseHTML} = require('linkedom');
const renderer = require('./v3-planner-content');
const root = path.resolve(__dirname, '..');
const KEY = 'tiles.v3.powerPlan.1';
const saved = {schema: 1, input: {from: 14, to: 15, held: [111, 222, 333, 444], bonusMinutes: 60, speedupMinutes: 120}, states: {800016: {level: 13, rank: 0}}};

function fixture({locale = 'en', search = '', stored = null, blocked = false} = {}) {
  const html = renderer.project(fs.readFileSync(path.join(root, locale, 'buildings/power-plant/index.html'), 'utf8'), locale);
  const {document, window} = parseHTML(html);
  Object.defineProperty(document, 'readyState', {value: 'complete', configurable: true});
  // Linkedom omits the browser's select.value setter and implicit first option.
  const prototype = window.HTMLSelectElement.prototype;
  if (!prototype.__v3SelectShim) {
    const original = Object.getOwnPropertyDescriptor(prototype, 'value');
    Object.defineProperty(prototype, 'value', {configurable: true, get() {return Object.prototype.hasOwnProperty.call(this, '_testSelectValue') ? this._testSelectValue : (original.get.call(this) ?? this.options[0]?.value ?? '');}, set(value) {for (const option of this.options) option.removeAttribute('selected'); const selected = [...this.options].find(option => option.value === String(value)); if (selected) selected.setAttribute('selected', ''); this._testSelectValue = selected ? String(value) : '';}});
    Object.defineProperty(prototype, '__v3SelectShim', {value: true});
  }
  let url = new URL('https://tilessurvive.net/' + locale + '/buildings/power-plant/' + search);
  const storage = new Map([['unrelated-key', 'preserve'], ['ts-v3-event-plans-v1', '{"version":1,"plans":[]}']]);
  if (stored !== null) storage.set(KEY, typeof stored === 'string' ? stored : JSON.stringify(stored));
  const removed = [];
  const location = {get href() {return url.href;}, get search() {return url.search;}, get hash() {return url.hash;}, get pathname() {return url.pathname;}, assign(next) {url = new URL(next, url);}};
  Object.defineProperty(window, 'location', {value: location, configurable: true});
  Object.defineProperty(window, 'history', {value: {replaceState(a, b, next) {url = new URL(next, url);}}, configurable: true});
  Object.defineProperty(window, 'localStorage', {value: {getItem(key) {if (blocked) throw Error('Denied'); return storage.get(key) ?? null;}, setItem(key, value) {if (blocked) throw Error('Denied'); storage.set(key, value);}, removeItem(key) {if (blocked) throw Error('Denied'); removed.push(key); storage.delete(key);}}, configurable: true});
  Object.defineProperty(window, 'navigator', {value: {clipboard: {writeText: async () => {throw Error('Clipboard denied');}}}, configurable: true});
  const textarea = document.querySelector('[data-v3-share-text]');
  textarea.select = () => {textarea.dataset.selected = 'true';};
  textarea.focus = () => {};
  const originalCalculator = document.querySelector('.bs-calculator');
  const originalForm = originalCalculator.querySelector('form');
  const originalFrom = originalForm.querySelector('[name="from"]');
  const context = vm.createContext({window, URL, URLSearchParams, console, Event: window.Event});
  for (const file of ['js/site-locales.js', 'js/building-system.js', 'js/v3-planner.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  const find = selector => document.querySelector(selector);
  const change = (selector, value) => {find(selector).value = value; find(selector).dispatchEvent(new window.Event('input', {bubbles: true}));};
  const click = selector => find(selector).dispatchEvent(new window.Event('click', {bubbles: true}));
  const copy = JSON.parse(find('[data-v3-planner-copy]').textContent);
  return {document, window, find, change, click, storage, removed, copy, url: () => url, originalCalculator, originalForm, originalFrom};
}

test('all explicit held-resource query fields override stored plans and retain query/hash', () => {
  for (let i = 0; i < 4; i++) {
    const f = fixture({search: '?held-' + i + '=123&utm_source=fixture#growth-plan', stored: saved});
    assert.equal(f.find('[name="held-' + i + '"]').value, '123');
    assert.equal(f.find('[name="from"]').value, '1');
    assert.equal(f.find('[name="v3-bonus"]').value, '0');
    assert.equal(f.url().searchParams.get('utm_source'), 'fixture');
    assert.equal(f.url().hash, '#growth-plan');
    assert.equal(f.storage.get(KEY), JSON.stringify(saved), 'read-only restore does not overwrite storage');
  }
});

test('valid plans restore fully and the actual calculator nodes move without nested forms', () => {
  for (const locale of ['en', 'ko', 'ar']) {
    const f = fixture({locale, stored: saved});
    const result = JSON.parse(f.find('[data-v3-estimate]').dataset.result);
    assert.equal(result.estimatedSeconds, 126600);
    assert.equal(f.find('[name="held-1"]').value, '222');
    assert.equal(f.find('[data-v3-base-slot] .bs-calculator'), f.originalCalculator);
    assert.equal(f.find('[data-v3-base-slot] form'), f.originalForm);
    assert.equal(f.find('[data-v3-base-slot] [name="from"]'), f.originalFrom);
    assert.equal(f.originalCalculator.open, true);
    assert.equal(f.find('[data-building-system] [data-v3-planner]'), f.find('[data-v3-planner]'));
    assert.equal(f.document.querySelectorAll('form form').length, 0);
    assert.equal(f.document.querySelectorAll('[name="from"]').length, 1);
    const bonusForm = f.find('[name="v3-bonus"]').closest('form');
    assert.notEqual(bonusForm, f.originalForm);
    const submit = new f.window.Event('submit', {cancelable: true, bubbles: true});
    bonusForm.dispatchEvent(submit);
    assert.equal(submit.defaultPrevented, true, 'Enter on bonus form cannot navigate away');
    f.change('[name="to"]', '16');
    const base = JSON.parse(f.find('[data-bs-result]').dataset.result), next = JSON.parse(f.find('[data-v3-estimate]').dataset.result);
    assert.equal(base.seconds, next.seconds, 'original and enhanced calculations share the moved fields');
    assert.deepEqual(base.resources, next.resources);
  }
});

test('corrupt or incompatible saved plans show an error and apply no partial prerequisite state', () => {
  const invalid = JSON.parse(JSON.stringify(saved)); invalid.input.to = -1;
  const noHeld = JSON.parse(JSON.stringify(saved)); delete noHeld.input.held;
  for (const stored of ['{', 'null', {...saved, schema: 2}, invalid, noHeld, {...saved, states: {unknown: {level: 1, rank: 0}}}]) {
    const f = fixture({stored});
    assert.equal(f.find('[data-v3-message]').textContent, f.copy.restoreError);
    assert.equal(f.find('[name="from"]').value, '1');
    assert.equal(f.find('[name="to"]').value, '2');
    assert.equal(f.url().searchParams.get('v3-state'), '{}');
    assert.equal(f.find('[name="v3-bonus"]').value, '0');
    f.change('[name="to"]', '3');
    assert.equal(f.find('[data-v3-message]').textContent, '', 'a new valid edit clears only the stale error');
    assert.equal(f.find('[data-v3-planner]').dataset.valid, 'true');
  }
});

test('malformed URL state remains visibly rejected; legacy profiles normalize and unknown profiles stay blocked', () => {
  for (const raw of ['{', 'null', JSON.stringify({unknown: {level: 1, rank: 0}}), 'x'.repeat(6001)]) {
    const f = fixture({search: '?v3-state=' + encodeURIComponent(raw)});
    assert.equal(f.find('[data-v3-message]').textContent, f.copy.restoreError);
  }
  for (const profile of ['original', 'd', 'unified']) {
    const f = fixture({search: '?profile=800005:' + profile + '&from=14&to=15&v3-bonus=60&v3-speedup=120'});
    assert.equal(f.find('[data-v3-planner]').dataset.valid, 'true');
    assert.equal(JSON.parse(f.find('[data-v3-estimate]').dataset.result).estimatedSeconds, 126600);
    assert.equal(f.url().searchParams.get('profile'), '800005:unified');
  }
  const invalid = fixture({search: '?profile=800005:unknown', stored: saved});
  assert.equal(invalid.find('[data-v3-estimate]').dataset.result, 'invalid');
  invalid.click('[data-v3-save]');
  assert.equal(invalid.storage.get(KEY), JSON.stringify(saved));
});

test('invalid prerequisite edits retain controls for correction and cannot overwrite saved state', () => {
  const f = fixture({search: '?from=14&to=15', stored: saved});
  const selector = '[data-v3-building="800016"] input';
  const control = f.find(selector);
  f.change(selector, '-1');
  assert.equal(f.find('[data-v3-estimate]').dataset.result, 'invalid');
  assert.equal(f.find(selector), control, 'failed calculation must not remove the input needed to recover');
  f.click('[data-v3-save]');
  assert.equal(f.storage.get(KEY), JSON.stringify(saved));
  f.change(selector, '13');
  assert.equal(f.find('[data-v3-planner]').dataset.valid, 'true');
  assert.equal(f.find('[data-v3-building="800016"] [data-v3-condition-status]').dataset.status, 'met');
  f.click('[data-v3-save]');
  assert.equal(JSON.parse(f.storage.get(KEY)).states['800016'].level, 13);
});

test('reset removes only this planner key and retains attribution/hash and unrelated local data', () => {
  const f = fixture({stored: saved, search: '?utm_source=fixture#growth-plan'});
  f.click('[data-v3-reset]');
  assert.deepEqual(f.removed, [KEY]);
  assert.equal(f.storage.has(KEY), false);
  assert.equal(f.storage.get('unrelated-key'), 'preserve');
  assert.equal(f.storage.get('ts-v3-event-plans-v1'), '{"version":1,"plans":[]}');
  assert.equal(f.find('[name="from"]').value, '1');
  assert.equal(f.find('[name="to"]').value, '2');
  assert.equal(f.find('[name="v3-bonus"]').value, '0');
  assert.equal(f.find('[name="v3-speedup"]').value, '0');
  assert.equal(f.url().searchParams.get('v3-state'), '{}');
  assert.equal(f.url().searchParams.get('utm_source'), 'fixture');
  assert.equal(f.url().hash, '#growth-plan');
});

test('denied storage and clipboard expose recovery instead of breaking calculation', async () => {
  const f = fixture({blocked: true, search: '?utm_source=fixture#growth-plan'});
  assert.equal(f.find('[data-v3-message]').textContent, f.copy.restoreError);
  assert.equal(f.find('[data-v3-planner]').dataset.valid, 'true');
  f.click('[data-v3-save]');
  assert.equal(f.find('[data-v3-message]').textContent, f.copy.storageError);
  f.click('[data-v3-share]');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.find('[data-v3-message]').textContent, f.copy.copyFallback);
  assert.equal(f.find('[data-v3-share-text]').hidden, false);
  assert.equal(f.find('[data-v3-share-text]').dataset.selected, 'true');
  const shared = new URL(f.find('[data-v3-share-text]').value);
  assert.equal(shared.searchParams.get('utm_source'), 'fixture');
  assert.equal(shared.hash, '#growth-plan');
  assert.equal(shared.searchParams.get('v3-state'), '{}');
});
