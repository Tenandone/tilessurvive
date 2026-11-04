'use strict';
const test = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {parseHTML} = require('linkedom');
const B = require('./build-v3-events');
const M = require('../js/v3-events');
const registry = require('../data/i18n/locales.json');
const trust = require('../data/v3-data-trust.json');
const calendar = require('../data/event-calendar.json');
const root = path.resolve(__dirname, '..');
const locales = registry.locales.map(row => row.code);
const ids = calendar.events.map(event => event.id);
const clone = value => JSON.parse(JSON.stringify(value));
const t0 = Date.UTC(2026, 10, 4, 0, 0);

function fixture(locale = 'en', raw = null, options = {}) {
  const {document, window} = parseHTML('<!doctype html><html><body>' + B.render(locale) + '</body></html>');
  const storage = new Map(raw === null ? [] : [[M.STORAGE_KEY, raw]]);
  let intervals = 0;
  const host = {
    localStorage: {getItem: key => {if (options.blocked) throw Error('Storage denied'); return storage.get(key) ?? null;}, setItem: (key, value) => {if (options.blocked) throw Error('Storage denied'); storage.set(key, value);}},
    setInterval: () => ++intervals,
    clearInterval: () => --intervals
  };
  const api = M.mount(document, host);
  const find = selector => document.querySelector(selector);
  const change = (selector, value) => {const input = find(selector); input.value = value; input.dispatchEvent(new window.Event('change', {bubbles: true}));};
  const submit = (start, end) => {
    const select = find('[data-v3-event]'); select.options[0].selected = true;
    find('[data-v3-start]').value = start;
    find('[data-v3-end]').value = end;
    find('[data-v3-plan-form]').dispatchEvent(new window.Event('submit', {cancelable: true, bubbles: true}));
  };
  const click = selector => find(selector).dispatchEvent(new window.Event('click', {bubbles: true}));
  return {api, document, window, host, storage, find, change, submit, click, intervals: () => intervals};
}

test('21 complete authored catalogs; no implicit English locale or missing-key fallback', () => {
  assert.equal(locales.length, 21);
  const baseKeys = Object.keys(B.copy('en')).sort();
  assert.equal(baseKeys.length, 47);
  for (const locale of locales) {
    const copy = B.copy(locale);
    assert.deepEqual(Object.keys(copy).sort(), baseKeys);
    if (locale !== 'en') assert.notEqual(copy.intro, B.copy('en').intro, locale);
    const {document} = parseHTML(B.render(locale));
    assert.equal(document.querySelector('#v3-events-title').textContent, copy.title);
    assert.equal(document.querySelector('#v3-events').getAttribute('data-v3-owned'), 'events');
    assert.equal(document.querySelector('#v3-events-data').getAttribute('data-v3-owned'), 'events');
    assert.equal(document.querySelector('#v3-events').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
    assert.equal(document.querySelectorAll('.v3-event-card').length, 3);
  }
  assert.throws(() => B.render('my'), /Unsupported/);
  const data = clone(B.calendarData('vi')); delete data.events[0].names.vi;
  assert.throws(() => B.payload('vi', data), /Missing vi/);
});

test('all 7 scoped references keep exact counts, names and dates without inventing live schedules', () => {
  assert.equal(trust.confirmedSchedules.length, 0);
  assert.deepEqual(calendar.events.flatMap(e => e.profiles.map(p => p.confirmedAnchorUtc)), Array(7).fill(null));
  for (const locale of locales) {
    const source = B.calendarData(locale), payload = B.payload(locale);
    assert.equal(payload.confirmedSchedules.length, 0);
    assert.deepEqual(payload.events.map(e => e.name), source.events.map(e => e.names[locale]));
    assert.deepEqual(payload.events.flatMap(e => e.profiles.map(p => p.ruleCount)), [0, 11, 5, 4, 4, 0, 0]);
    assert.deepEqual(payload.events.flatMap(e => e.profiles.map(p => p.rewardCount)), [0, 3, 0, 0, 0, 0, 0]);
    const records = payload.events.flatMap(e => e.profiles);
    assert.deepEqual(records.filter(p => p.trust.verifiedAt).map(p => [p.id, p.trust.verifiedAt]), [['hero-lv30', '2026-10-10']]);
    const {document} = parseHTML(B.render(locale));
    assert.equal(document.querySelectorAll('[data-v3-confirmed-id]').length, 0);
    assert.equal(document.querySelectorAll('[data-trust-status]').length, 7);
    assert.equal(document.querySelectorAll('[data-trust-status="observed"]').length, 2);
  }
  const hero = require('../data/foundation-40/arms-race-hero-rules-41.json');
  assert.equal(trust.profiles['arms-race/hero-lv30'].verifiedAt, hero.observedAt);
  assert.equal(trust.profiles['arms-race/hero-lv30'].version, hero.gameVersion);
});

test('pure projection is idempotent and byte-preserving outside managed blocks for all 63 target pages', () => {
  for (const locale of locales) for (const route of ['events/calendar', 'events', 'tools/event-helper']) {
    const input = fs.readFileSync(path.join(root, locale, route, 'index.html'), 'utf8');
    const output = B.project(input, locale);
    assert.equal(B.strip(output), B.strip(input), `${locale}/${route} original bytes outside owned blocks`);
    assert.equal(B.project(output, locale), output, `${locale}/${route} idempotence`);
    const {document} = parseHTML(output);
    assert.equal(document.querySelectorAll('#v3-events').length, 1);
    assert.equal(document.querySelectorAll('script[src^="/js/v3-events.js"]').length, 1);
    assert.equal(document.querySelectorAll('link[href^="/css/v3-events.css"]').length, 1);
    assert.equal(document.querySelector('script[src^="/js/v3-events.js"]').getAttribute('data-v3-owned'), 'assets');
    assert.equal(document.querySelector('link[href^="/css/v3-events.css"]').getAttribute('data-v3-owned'), 'assets');
    assert.equal(document.querySelectorAll('a[href="/' + locale + '/events/calendar/"]').length, parseHTML(input).document.querySelectorAll('a[href="/' + locale + '/events/calendar/"]').length, 'existing menu/calendar links not duplicated');
  }
  assert.throws(() => B.project('<html><head></head><main>' + B.BEGIN + '</main></html>', 'en'), /Malformed/);
  assert.throws(() => B.project('<html><head></head><body></body></html>', 'en'), /content owner/);
});

test('all UTC offsets include half/quarter-hours and ±14 boundaries; malformed offsets fail closed', () => {
  for (let minutes = -840; minutes <= 840; minutes += 15) assert.equal(M.parseOffset(String(minutes / 60)), minutes);
  assert.equal(M.offsetLabel(345), 'UTC+05:45');
  assert.equal(M.offsetLabel(-210), 'UTC−03:30');
  for (const value of ['', ' ', null, true, {}, [], '5:30', 'NaN', 'Infinity', '0x10', '2e0', 14.25, -14.25, 5.1, 0.001]) assert.equal(M.parseOffset(value), null, String(value));
  assert.throws(() => M.offsetLabel(841));
});

test('wall-clock conversion is independent of local DST and rejects rolled-over dates', () => {
  assert.equal(M.parseWallTime('2026-11-04T05:45', 345), t0);
  assert.equal(M.parseWallTime('2026-11-03T20:30', -210), t0);
  assert.equal(M.parseWallTime('2026-11-04T14:00', 840), t0);
  assert.equal(M.parseWallTime('2026-11-03T10:00', -840), t0);
  assert.equal(M.parseWallTime('2024-02-29T00:00', 0), Date.UTC(2024, 1, 29));
  for (const value of ['2026-02-29T00:00', '2026-04-31T00:00', '2026-13-01T00:00', '2026-11-04T24:00', '2026-11-04T10:60', '2026-11-04T01:00Z', '2026-11-04', '2026-1-4T00:00', '2026-11-04T00:00<script>']) assert.equal(M.parseWallTime(value, 0), null, value);
  // New York DST transition cannot change a fixed server reference offset.
  assert.equal(M.parseWallTime('2026-03-08T03:30', -300) - M.parseWallTime('2026-03-08T01:30', -300), 7200000);
});

test('half-open event boundaries and countdowns are exact without negative or false live time', () => {
  const plan = {start: t0, end: t0 + 3600000};
  assert.deepEqual(M.phase(plan, t0 - 1), {kind: 'upcoming', remaining: 1});
  assert.deepEqual(M.phase(plan, t0), {kind: 'current', remaining: 3600000});
  assert.deepEqual(M.phase(plan, t0 + 3600000), {kind: 'ended', remaining: 0});
  assert.equal(M.countdown(1), '00:00:01');
  assert.equal(M.countdown(0), '00:00:00');
  assert.equal(M.countdown(100 * 3600000), '100:00:00');
  assert.throws(() => M.phase({start: t0, end: t0}, t0));
  assert.throws(() => M.countdown(-1));
});

test('manual plan creation is immutable and rejects missing events, invalid dates and full storage', () => {
  const state = {version: 1, offset: 345, plans: []};
  const input = {eventId: ids[0], start: '2026-11-04T05:45', end: '2026-11-04T06:45'};
  const result = M.addPlan(state, input, ids, 'p-one');
  assert.equal(state.plans.length, 0);
  assert.deepEqual(result.state.plans[0], {id: 'p-one', eventId: ids[0], start: t0, end: t0 + 3600000});
  const before = JSON.stringify(result.state);
  for (const bad of [{...input, eventId: 'fake'}, {...input, end: input.start}, {...input, end: '2026-11-03T06:45'}, {...input, start: '2026-02-30T00:00'}]) assert.equal(M.addPlan(result.state, bad, ids, 'p-two').error, 'invalidPlan');
  assert.equal(M.addPlan(result.state, input, ids, 'p-one').error, 'invalidPlan');
  assert.equal(M.addPlan(result.state, input, ids, '<script>').error, 'invalidPlan');
  assert.equal(JSON.stringify(result.state), before);
  const full = {...state, plans: Array.from({length: 20}, (_, i) => ({...result.state.plans[0], id: 'p-' + i}))};
  assert.equal(M.addPlan(full, input, ids, 'p-next').error, 'limitReached');
});

test('storage migration, corruption, duplicate IDs and unsupported event IDs are rejected atomically', () => {
  const value = {version: 1, offset: -210, plans: [{id: 'p-one', eventId: ids[0], start: t0, end: t0 + 1000}]};
  assert.deepEqual(M.hydrate(JSON.stringify(value), ids), {state: value, error: false});
  for (const bad of ['{', 'null', JSON.stringify({...value, version: 2}), JSON.stringify({...value, offset: 15.5}), JSON.stringify({...value, plans: [value.plans[0], value.plans[0]]}), JSON.stringify({...value, plans: [{...value.plans[0], eventId: 'unknown'}]}), JSON.stringify({...value, plans: [{...value.plans[0], end: null}]}), 'x'.repeat(20001)]) {
    assert.deepEqual(M.hydrate(bad, ids), {state: {version: 1, offset: 0, plans: []}, error: true});
  }
});

test('a dated confirmation requires source evidence, a scope, valid dates and qualified status', () => {
  const value = {eventId: ids[0], status: 'official', scope: 'Fixture server only', evidence: 'https://example.com/verified-fixture', checkedAt: '2026-11-03', startUtc: '2026-11-04T00:00:00.000Z', endUtc: '2026-11-04T01:00:00.000Z'};
  assert.equal(M.confirmedOccurrence(value, ids).start, t0);
  for (const bad of [{...value, status: 'retained'}, {...value, status: 'analysis'}, {...value, evidence: ''}, {...value, evidence: 'javascript:alert(1)'}, {...value, scope: ''}, {...value, checkedAt: '2026-02-30'}, {...value, checkedAt: '2026-12-01'}, {...value, startUtc: '2026-02-30T00:00:00.000Z'}, {...value, endUtc: value.startUtc}, {...value, eventId: 'invented'}]) assert.equal(M.confirmedOccurrence(bad, ids), null);
  const edited = clone(trust); edited.confirmedSchedules = [{...value, scope: {en: value.scope}}];
  assert.equal(B.payload('en', B.calendarData('en'), edited).confirmedSchedules.length, 1);
  edited.confirmedSchedules[0].evidence = '';
  assert.throws(() => B.payload('en', B.calendarData('en'), edited), /Unqualified/);
});

test('all five data-trust grades are available in all 21 locales with explicit unknown dates', () => {
  for (const locale of locales) for (const status of trust.statuses) {
    const html = B.renderTrust({status, version: '2.6.200', verifiedAt: null, liveScheduleStatus: 'unverified'}, locale);
    assert(html.includes(B.copy(locale).unknownDate));
    assert(html.includes(B.copy(locale).liveUnverified));
    assert(html.includes('data-trust-status="' + status + '"'));
    const dataHtml = B.renderTrust({status, version: '2.6.200', verifiedAt: null, liveScheduleStatus: 'unverified', scopeKind: 'data'}, locale);
    assert(dataHtml.includes(B.copy(locale).liveDataUnverified));
    assert(!dataHtml.includes(B.copy(locale).liveUnverified));
  }
  assert.throws(() => B.renderTrust({status: 'guessed', version: '2', verifiedAt: null, liveScheduleStatus: 'unverified'}, 'en'));
  assert.throws(() => B.renderTrust({status: 'observed', version: '2', verifiedAt: '2026-02-30', liveScheduleStatus: 'unverified'}, 'en'));
});

test('DOM workflow in all 21 locales: offset, add, persist, restore, remove and reset', () => {
  for (const locale of locales) {
    const f = fixture(locale);
    assert.equal(f.intervals(), 1);
    assert.equal(M.mount(f.document, f.host), null, 'double mount does not duplicate timers');
    f.change('[data-v3-offset]', '5.75');
    f.submit('2026-11-04T05:45', '2026-11-04T06:45');
    assert.equal(f.api.getState().plans.length, 1, locale);
    assert.equal(f.api.getState().plans[0].start, t0);
    assert.equal(f.find('[data-v3-message]').textContent, B.copy(locale).saved);
    assert.equal(f.find('[data-v3-event]').options[0].textContent, B.payload(locale).events[0].name);
    const saved = f.storage.get(M.STORAGE_KEY);
    const restored = fixture(locale, saved);
    assert.deepEqual(restored.api.getState(), f.api.getState());
    const before = restored.api.getState().plans[0].start;
    restored.change('[data-v3-offset]', '-3.5');
    assert.equal(restored.api.getState().plans[0].start, before, 'zone change must not shift stored instant');
    restored.click('[data-v3-remove]');
    assert.equal(restored.api.getState().plans.length, 0);
    assert.equal(restored.find('[data-v3-clear]').disabled, true);
    f.click('[data-v3-clear]');
    assert.equal(f.api.getState().plans.length, 0);
    assert.equal(f.find('[data-v3-message]').textContent, B.copy(locale).clearDone);
    f.api.destroy(); restored.api.destroy();
    assert.equal(f.intervals(), 0);
  }
});

test('DOM invalid edits preserve existing state and visible storage failures remain usable', () => {
  const f = fixture('ko');
  f.change('[data-v3-offset]', '5.75');
  const before = JSON.stringify(f.api.getState());
  f.change('[data-v3-offset]', '5.1');
  assert.equal(JSON.stringify(f.api.getState()), before);
  assert.equal(f.find('[data-v3-message]').textContent, B.copy('ko').invalidOffset);
  f.submit('2026-11-04T05:45', '2026-11-04T04:45');
  assert.equal(JSON.stringify(f.api.getState()), before);
  assert.equal(f.find('[data-v3-message]').textContent, B.copy('ko').invalidPlan);
  const denied = fixture('ar', null, {blocked: true});
  assert.equal(denied.find('[data-v3-message]').textContent, B.copy('ar').storageUnavailable);
  denied.submit('2026-11-04T00:00', '2026-11-04T01:00');
  assert.equal(denied.api.getState().plans.length, 1, 'in-memory use survives denied localStorage');
  assert.equal(denied.find('[data-v3-message]').textContent, B.copy('ar').storageUnavailable);
  const corrupted = fixture('en', '{');
  assert.equal(corrupted.api.getState().plans.length, 0);
  assert.equal(corrupted.find('[data-v3-message]').textContent, B.copy('en').storageUnavailable);
  f.api.destroy(); denied.api.destroy(); corrupted.api.destroy();
});

test('live DOM countdown updates at start/end without replacing focused controls', () => {
  const originalNow = Date.now;
  let time = t0 - 1000;
  Date.now = () => time;
  let f;
  try {
    f = fixture('en', JSON.stringify({version: 1, offset: 0, plans: [{id: 'p-one', eventId: ids[0], start: t0, end: t0 + 3600000}]}));
    const button = f.find('[data-v3-remove]');
    assert.equal(f.find('[data-v3-phase]').textContent, 'Upcoming');
    assert.equal(f.find('[data-v3-countdown]').textContent, 'Starts in 00:00:01');
    time = t0; f.api.refresh();
    assert.equal(f.find('[data-v3-phase]').textContent, 'In progress');
    assert.equal(f.find('[data-v3-countdown]').textContent, 'Ends in 01:00:00');
    time = t0 + 3600000; f.api.refresh();
    assert.equal(f.find('[data-v3-phase]').textContent, 'Ended');
    assert.equal(f.find('[data-v3-countdown]').textContent, '');
    assert.equal(f.find('[data-v3-remove]'), button);
  } finally { Date.now = originalNow; if (f) f.api.destroy(); }
});
