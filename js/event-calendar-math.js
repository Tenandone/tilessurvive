(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EventCalendarMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY_MS = 86400000, WEEK_MS = 7 * DAY_MS;
  const finiteTime = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 8.64e15;
  function validatePattern(pattern) {
    if (!pattern || pattern.kind !== 'timed' || pattern.periodSeconds !== 604800 || !Array.isArray(pattern.slots) || !pattern.slots.length) return false;
    let previousEnd = 0;
    const ids = new Set();
    return pattern.slots.every(slot => {
      const ok = typeof slot.id === 'string' && !ids.has(slot.id) && Number.isSafeInteger(slot.offsetSeconds) && slot.offsetSeconds >= previousEnd && Number.isSafeInteger(slot.durationSeconds) && slot.durationSeconds > 0 && slot.offsetSeconds + slot.durationSeconds <= pattern.periodSeconds;
      ids.add(slot.id);
      previousEnd = slot.offsetSeconds + slot.durationSeconds;
      return ok;
    });
  }
  function patternKey(pattern) {
    if (!validatePattern(pattern)) return '';
    return JSON.stringify([pattern.periodSeconds, pattern.slots.map(s => [s.id, s.offsetSeconds, s.durationSeconds])]);
  }
  function personalAnchor(value) {
    if (!value || !Number.isInteger(value.weekday) || value.weekday < 0 || value.weekday > 6 || typeof value.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time)) return null;
    const [h, m] = value.time.split(':').map(Number);
    // This Sunday is a mathematical origin for a user-selected weekly rule, not a game occurrence.
    return Date.UTC(1970, 0, 4 + value.weekday, h, m);
  }
  function resolveAnchor(profile, personal) {
    if (!profile || !validatePattern(profile.pattern)) return null;
    const supplied = profile.confirmedAnchorUtc;
    if (typeof supplied === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/.test(supplied)) {
      const timestamp = Date.parse(supplied);
      // Date.parse normalizes impossible dates (for example February 30); do not accept them as evidence.
      const normalized = finiteTime(timestamp) ? new Date(timestamp).toISOString() : null;
      const expected = supplied.replace(/T(\d{2}):(\d{2})Z$/, 'T$1:$2:00Z').replace(/(?<!\.\d{3})Z$/, '.000Z');
      if (finiteTime(timestamp) && normalized === expected) return { timestamp, kind: 'confirmed' };
    }
    if (personal && personal.patternKey !== undefined && personal.patternKey !== patternKey(profile.pattern)) return null;
    const timestamp = personalAnchor(personal);
    return timestamp === null ? null : { timestamp, kind: 'personal' };
  }
  function occurrences(pattern, anchor, start, end) {
    if (!validatePattern(pattern) || ![anchor, start, end].every(finiteTime) || end <= start || end - start > 32 * DAY_MS) return [];
    const rows = [], first = Math.floor((start - anchor) / WEEK_MS) - 1, last = Math.floor((end - anchor) / WEEK_MS);
    for (let cycle = first; cycle <= last; cycle++) {
      const base = anchor + cycle * WEEK_MS;
      pattern.slots.forEach((slot, slotIndex) => {
        const from = base + slot.offsetSeconds * 1000, to = from + slot.durationSeconds * 1000;
        if (to > start && from < end) rows.push({ id: slot.id, start: from, end: to, slotIndex, day: slot.day || Math.floor(slot.offsetSeconds / 86400) + 1, names: slot.names });
      });
    }
    return rows.sort((a, b) => a.start - b.start);
  }
  function eventState(pattern, anchor, now) {
    if (!finiteTime(now)) return { current: null, next: null };
    const rows = occurrences(pattern, anchor, now, now + WEEK_MS + DAY_MS);
    return { current: rows.find(r => r.start <= now && now < r.end) || null, next: rows.find(r => r.start > now) || null };
  }
  function utcWindow(now, mode) {
    if (!finiteTime(now) || !['today', 'tomorrow', 'sevenDays'].includes(mode)) return null;
    const d = new Date(now), midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const start = midnight + (mode === 'tomorrow' ? DAY_MS : 0);
    return { start, end: start + (mode === 'sevenDays' ? 7 : 1) * DAY_MS };
  }
  function formatInstant(ms, timeZone, locale = 'en-GB') {
    if (!finiteTime(ms)) return '';
    try {
      return new Intl.DateTimeFormat(locale, { timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
    } catch (_) { return ''; }
  }
  function calculate(rules, quantities) {
    if (!Array.isArray(rules) || !Array.isArray(quantities) || quantities.length !== rules.length) return { valid: false, total: null };
    let total = 0;
    for (let i = 0; i < rules.length; i++) {
      const raw = quantities[i], text = typeof raw === 'string' ? raw.trim() : raw;
      if (text !== '' && (typeof text === 'string' ? !/^\d+$/.test(text) : typeof text !== 'number')) return { valid: false, total: null };
      const quantity = text === '' ? 0 : Number(text), points = rules[i].points;
      if (!Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(points) || points < 0 || !Number.isSafeInteger(quantity * points) || !Number.isSafeInteger(total + quantity * points)) return { valid: false, total: null };
      total += quantity * points;
    }
    return { valid: true, total };
  }
  function countdown(ms) {
    const seconds = Math.max(0, Math.ceil(Number(ms) / 1000));
    if (!Number.isFinite(seconds)) return '';
    const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds / 60) % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return { DAY_MS, WEEK_MS, validatePattern, patternKey, personalAnchor, resolveAnchor, occurrences, eventState, utcWindow, formatInstant, calculate, countdown };
});
