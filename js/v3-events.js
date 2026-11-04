/* One-off personal plans; never inferred official event schedules. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.TS_V3_EVENTS = api;
    var ready = function () { api.mount(root.document, root); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', ready, {once: true});
    else ready();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var STORAGE_KEY = 'ts-v3-event-plans-v1';
  var MAX_PLANS = 20;
  var MINUTE = 60000;
  var MAX_TIME = Date.UTC(10000, 0, 1);
  var escape = function (value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  function validOffset(minutes) { return Number.isInteger(minutes) && Math.abs(minutes) <= 840 && minutes % 15 === 0; }
  function parseOffset(hours) {
    if (typeof hours !== 'string' && typeof hours !== 'number') return null;
    if (typeof hours === 'string' && !/^[+-]?\d+(?:\.\d{1,2})?$/.test(hours.trim())) return null;
    var n = Number(hours) * 60;
    return validOffset(n) ? n : null;
  }
  function offsetLabel(minutes) {
    if (!validOffset(minutes)) throw new Error('Invalid UTC offset');
    var n = Math.abs(minutes);
    return 'UTC' + (minutes < 0 ? '−' : '+') + String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  }
  function instant(value) { return Number.isSafeInteger(value) && value >= 0 && value < MAX_TIME; }
  function parseWallTime(value, offset) {
    if (!validOffset(offset) || typeof value !== 'string') return null;
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    var a = match.slice(1).map(Number);
    if (a[0] < 1970 || a[0] > 9999 || a[1] < 1 || a[1] > 12 || a[2] < 1 || a[2] > 31 || a[3] > 23 || a[4] > 59) return null;
    var wall = Date.UTC(a[0], a[1] - 1, a[2], a[3], a[4]);
    var date = new Date(wall);
    if (date.getUTCFullYear() !== a[0] || date.getUTCMonth() !== a[1] - 1 || date.getUTCDate() !== a[2]) return null;
    var utc = wall - offset * MINUTE;
    return instant(utc) ? utc : null;
  }
  function isoInstant(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value)) return null;
    var ms = Date.parse(value);
    return instant(ms) && new Date(ms).toISOString() === value ? ms : null;
  }
  function validPlan(plan, eventIds) {
    return plan && typeof plan === 'object' && typeof plan.id === 'string' && /^p-[a-z0-9-]{1,64}$/.test(plan.id) &&
      eventIds.indexOf(plan.eventId) !== -1 && instant(plan.start) && instant(plan.end) && plan.start < plan.end;
  }
  function hydrate(raw, eventIds) {
    var empty = {version: 1, offset: 0, plans: []};
    if (raw === null || raw === undefined) return {state: empty, error: false};
    try {
      if (typeof raw !== 'string' || raw.length > 20000) throw new Error('Invalid storage');
      var parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !validOffset(parsed.offset) || !Array.isArray(parsed.plans) || parsed.plans.length > MAX_PLANS) throw new Error('Invalid storage');
      var seen = new Set();
      var plans = parsed.plans.map(function (plan) {
        if (!validPlan(plan, eventIds) || seen.has(plan.id)) throw new Error('Invalid plan');
        seen.add(plan.id);
        return {id: plan.id, eventId: plan.eventId, start: plan.start, end: plan.end};
      });
      return {state: {version: 1, offset: parsed.offset, plans: plans}, error: false};
    } catch (_) { return {state: empty, error: true}; }
  }
  function addPlan(state, input, eventIds, id) {
    if (!state || !validOffset(state.offset) || !Array.isArray(state.plans)) return {error: 'invalidPlan'};
    if (state.plans.length >= MAX_PLANS) return {error: 'limitReached'};
    var plan = {id: id, eventId: input.eventId, start: parseWallTime(input.start, state.offset), end: parseWallTime(input.end, state.offset)};
    if (!validPlan(plan, eventIds) || state.plans.some(function (p) { return p.id === id; })) return {error: 'invalidPlan'};
    return {state: {version: 1, offset: state.offset, plans: state.plans.concat([plan])}};
  }
  function phase(plan, now) {
    if (!instant(plan.start) || !instant(plan.end) || plan.end <= plan.start || !instant(now)) throw new Error('Invalid event interval');
    if (now < plan.start) return {kind: 'upcoming', remaining: plan.start - now};
    if (now < plan.end) return {kind: 'current', remaining: plan.end - now};
    return {kind: 'ended', remaining: 0};
  }
  function countdown(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Invalid countdown');
    var seconds = Math.ceil(milliseconds / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }
  function formatTime(ms, offset, locale, local) {
    if (!instant(ms) || !validOffset(offset)) return '';
    return new Intl.DateTimeFormat(locale, {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: local ? undefined : 'UTC'}).format(local ? ms : ms + offset * MINUTE);
  }
  /* A finite, sourced, explicitly scoped occurrence is required. Weekly patterns are not occurrences. */
  function confirmedOccurrence(record, eventIds) {
    if (!record || !eventIds.includes(record.eventId) || !['observed', 'official'].includes(record.status) ||
        typeof record.scope !== 'string' || !record.scope.trim() || typeof record.evidence !== 'string' || !/^https:\/\//.test(record.evidence) ||
        typeof record.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.checkedAt)) return null;
    var start = isoInstant(record.startUtc), end = isoInstant(record.endUtc);
    var checked = parseWallTime(record.checkedAt + 'T00:00', 0);
    if (start === null || end === null || end <= start || checked === null || checked > end) return null;
    return {eventId: record.eventId, scope: record.scope, start: start, end: end, status: record.status, evidence: record.evidence, checkedAt: record.checkedAt};
  }
  function mount(document, host) {
    var root = document.getElementById('v3-events');
    if (!root || root.getAttribute('data-mounted') === 'true') return null;
    var json = document.getElementById('v3-events-data');
    if (!json) return null;
    var data = JSON.parse(json.textContent), t = data.copy;
    if (!t || !Array.isArray(data.events) || !data.locale) throw new Error('Missing event dashboard localization');
    var ids = data.events.map(function (e) { return e.id; });
    var map = Object.create(null); data.events.forEach(function (e) { map[e.id] = e; });
    var loaded;
    try { loaded = hydrate(host.localStorage.getItem(STORAGE_KEY), ids); }
    catch (_) { loaded = hydrate('invalid', ids); }
    var state = loaded.state;
    var select = function (s) { return root.querySelector(s); };
    var message = select('[data-v3-message]');
    var offsetInput = select('[data-v3-offset]');
    var form = select('[data-v3-plan-form]');
    var list = select('[data-v3-plans]');
    var now = function () { return Date.now(); };
    function notify(key) { message.textContent = t[key]; }
    function save(key) {
      try { host.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); notify(key); }
      catch (_) { notify('storageUnavailable'); }
    }
    function tick() {
      var time = now();
      select('[data-v3-server-clock]').textContent = formatTime(time, state.offset, data.numberLocale, false) + ' · ' + offsetLabel(state.offset);
      select('[data-v3-local-clock]').textContent = formatTime(time, 0, data.numberLocale, true);
      var zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
      select('[data-v3-local-zone]').textContent = zone;
      list.querySelectorAll('[data-v3-plan-id]').forEach(function (node) {
        var plan = state.plans.find(function (p) { return p.id === node.getAttribute('data-v3-plan-id'); });
        if (!plan) return;
        var result = phase(plan, time);
        node.setAttribute('data-phase', result.kind);
        node.querySelector('[data-v3-phase]').textContent = t[result.kind];
        node.querySelector('[data-v3-countdown]').textContent = result.kind === 'ended' ? '' : t[result.kind === 'current' ? 'endsIn' : 'startsIn'] + ' ' + countdown(result.remaining);
      });
      root.querySelectorAll('[data-v3-confirmed-id]').forEach(function (node) {
        var occurrence = (data.confirmedSchedules || []).find(function (p) { return p.id === node.getAttribute('data-v3-confirmed-id'); });
        if (!occurrence) return;
        var result = phase(occurrence, time);
        node.setAttribute('data-phase', result.kind);
        node.querySelector('[data-v3-phase]').textContent = t[result.kind];
        node.querySelector('[data-v3-countdown]').textContent = result.kind === 'ended' ? '' : t[result.kind === 'current' ? 'endsIn' : 'startsIn'] + ' ' + countdown(result.remaining);
      });
    }
    function renderPlans() {
      select('[data-v3-input-zone]').textContent = t.inputTimezone + ' ' + offsetLabel(state.offset);
      offsetInput.value = String(state.offset / 60);
      list.innerHTML = state.plans.length ? state.plans.slice().sort(function (a, b) { return a.start - b.start; }).map(function (plan) {
        var name = map[plan.eventId].name;
        return '<li class="v3-plan" data-v3-plan-id="' + escape(plan.id) + '"><strong>' + escape(name) + '</strong><span class="v3-event-badge" data-v3-phase></span><p>' + escape(formatTime(plan.start, state.offset, data.numberLocale, false)) + ' – ' + escape(formatTime(plan.end, state.offset, data.numberLocale, false)) + ' · ' + escape(offsetLabel(state.offset)) + '</p><span data-v3-countdown></span><button type="button" data-v3-remove="' + escape(plan.id) + '" aria-label="' + escape(t.remove + ': ' + name) + '">' + escape(t.remove) + '</button></li>';
      }).join('') : '<li class="v3-empty">' + escape(t.noPlans) + '</li>';
      select('[data-v3-clear]').disabled = state.plans.length === 0;
      tick();
    }
    offsetInput.addEventListener('change', function () {
      var offset = parseOffset(offsetInput.value);
      if (offset === null) { offsetInput.value = String(state.offset / 60); notify('invalidOffset'); return; }
      state = {version: 1, offset: offset, plans: state.plans};
      renderPlans(); save('offsetSaved');
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var id = 'p-' + now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      var result = addPlan(state, {eventId: select('[data-v3-event]').value, start: select('[data-v3-start]').value, end: select('[data-v3-end]').value}, ids, id);
      if (result.error) { notify(result.error); return; }
      state = result.state; renderPlans(); save('saved');
    });
    list.addEventListener('click', function (event) {
      var button = event.target.closest('[data-v3-remove]');
      if (!button || !list.contains(button)) return;
      var id = button.getAttribute('data-v3-remove');
      state = {version: 1, offset: state.offset, plans: state.plans.filter(function (p) { return p.id !== id; })};
      renderPlans(); save('saved');
    });
    select('[data-v3-clear]').addEventListener('click', function () {
      state = {version: 1, offset: state.offset, plans: []}; renderPlans(); save('clearDone');
    });
    root.setAttribute('data-mounted', 'true');
    root.querySelectorAll('[data-v3-interactive]').forEach(function (node) { node.hidden = false; });
    renderPlans();
    if (loaded.error) notify('storageUnavailable');
    var interval = host.setInterval(function () { if (!document.hidden) tick(); }, 1000);
    var onVisibility = function () { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return {getState: function () { return JSON.parse(JSON.stringify(state)); }, refresh: tick, destroy: function () { host.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); }};
  }
  return {STORAGE_KEY: STORAGE_KEY, MAX_PLANS: MAX_PLANS, validOffset: validOffset, parseOffset: parseOffset, offsetLabel: offsetLabel, parseWallTime: parseWallTime, hydrate: hydrate, addPlan: addPlan, phase: phase, countdown: countdown, formatTime: formatTime, confirmedOccurrence: confirmedOccurrence, mount: mount};
}));
