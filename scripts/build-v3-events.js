'use strict';

/* Pure projectors: the V3 publisher owns writing HTML and integrating builds. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const {parseHTML} = require('linkedom');
const runtime = require('../js/v3-events');
const registry = require('../data/i18n/locales.json');
const catalog = require('../data/v3-events-copy.json');
const trust = require('../data/v3-data-trust.json');
const root = path.resolve(__dirname, '..');
const BEGIN = '<!-- TS_V3_EVENTS_BEGIN -->';
const END = '<!-- TS_V3_EVENTS_END -->';
const ASSETS_BEGIN = '<!-- TS_V3_EVENTS_ASSETS_BEGIN -->';
const ASSETS_END = '<!-- TS_V3_EVENTS_ASSETS_END -->';
const statuses = ['observed', 'official', 'retained', 'analysis', 'unverified'];
const statusKeys = {observed: 'statusObserved', official: 'statusOfficial', retained: 'statusRetained', analysis: 'statusAnalysis', unverified: 'statusUnverified'};
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

function localeRecord(locale) {
  const row = registry.locales.find(row => row.code === locale);
  assert(row, `Unsupported events locale: ${locale}`);
  return row;
}
function copy(locale) {
  localeRecord(locale);
  const value = catalog.copy[locale];
  assert(value, `Missing dashboard copy: ${locale}`);
  assert.deepEqual(Object.keys(value).sort(), Object.keys(catalog.copy.en).sort(), `Incomplete dashboard copy: ${locale}`);
  for (const [key, text] of Object.entries(value)) assert.equal(typeof text === 'string' && text.trim().length > 0, true, `${locale}.${key}`);
  return value;
}
function date(value) { return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && runtime.parseWallTime(value + 'T00:00', 0) !== null); }
function validateTrust(record) {
  assert(record && statuses.includes(record.status), 'Unknown data status');
  assert.equal(typeof record.version, 'string');
  assert(record.version.trim(), 'Applicable version is required');
  assert(date(record.verifiedAt), 'Invalid verification date');
  assert(['unverified', 'confirmed'].includes(record.liveScheduleStatus), 'Live schedule status is required');
  return record;
}
function renderTrust(record, locale) {
  validateTrust(record);
  const t = copy(locale);
  return `<div class="v3-trust" data-trust-status="${esc(record.status)}"><strong>${esc(t.trustTitle)}: ${esc(t[statusKeys[record.status]])}</strong><dl><dt>${esc(t.version)}</dt><dd>${esc(record.version)}</dd><dt>${esc(t.checked)}</dt><dd>${esc(record.verifiedAt || t.unknownDate)}</dd></dl>${record.liveScheduleStatus === 'unverified' ? `<p>${esc(record.scopeKind === 'data' ? t.liveDataUnverified : t.liveUnverified)}</p>` : ''}</div>`;
}
function localized(value, locale, field) {
  assert(value && typeof value[locale] === 'string' && value[locale].trim(), `Missing ${locale} event ${field}`);
  return value[locale];
}
function calendarData(locale) {
  localeRecord(locale);
  const file = path.join(root, locale, 'events', 'calendar', 'index.html');
  const {document} = parseHTML(fs.readFileSync(file, 'utf8'));
  const node = document.getElementById('event-calendar-data');
  assert(node, `Calendar JSON missing: ${locale}`);
  return JSON.parse(node.textContent);
}
function payload(locale, source = calendarData(locale), evidence = trust) {
  const info = localeRecord(locale);
  assert(source.schemaVersion === 1 && Array.isArray(source.events), 'Invalid calendar model');
  assert(evidence.schemaVersion === 1 && Array.isArray(evidence.confirmedSchedules), 'Invalid trust model');
  assert.deepEqual(evidence.statuses, statuses, 'Data-trust vocabulary changed');
  const eventIds = new Set();
  const seenProfiles = new Set();
  const events = source.events.map((event, index) => {
    assert(typeof event.id === 'string' && /^[a-z0-9-]+$/.test(event.id) && !eventIds.has(event.id), 'Duplicate/invalid event');
    eventIds.add(event.id);
    assert(Array.isArray(event.profiles) && event.profiles.length, 'Missing profiles');
    return {id: event.id, name: localized(event.names, locale, 'name'), reference: `/${locale}/events/calendar/#calendar-reference-${index + 1}`, profiles: event.profiles.map(profile => {
      const key = event.id + '/' + profile.id;
      assert(!seenProfiles.has(key), 'Duplicate event profile'); seenProfiles.add(key);
      assert(Array.isArray(profile.rules) && Array.isArray(profile.rewards), 'Missing reference arrays');
      const record = validateTrust(evidence.profiles[key]);
      assert.equal(record.version, source.gameVersion, 'Trust record / calendar version mismatch');
      return {id: profile.id, name: localized(profile.names, locale, 'profile name'), scope: localized(profile.scope, locale, 'scope'), ruleCount: profile.rules.length, rewardCount: profile.rewards.length, trust: record};
    })};
  });
  assert.deepEqual([...seenProfiles].sort(), Object.keys(evidence.profiles).sort(), 'Every reference profile needs its own trust record');
  const confirmedSchedules = evidence.confirmedSchedules.map((record, index) => {
    const checked = runtime.confirmedOccurrence({...record, scope: localized(record.scope, locale, 'confirmed scope')}, [...eventIds]);
    assert(checked, `Unqualified dated schedule: ${index}`);
    return {...checked, id: 'confirmed-' + index};
  });
  return {schemaVersion: 1, locale, numberLocale: info.numberLocale, dir: info.dir, copy: copy(locale), events, confirmedSchedules};
}
function render(locale, source, evidence) {
  const data = payload(locale, source, evidence), t = data.copy;
  const count = number => number.toLocaleString(data.numberLocale);
  const cards = data.events.map(event => `<article class="v3-event-card"><h4>${esc(event.name)}</h4><span class="v3-event-badge">${esc(t.timingUnverified)}</span><details><summary>${esc(t.profiles)} · ${count(event.profiles.length)}</summary>${event.profiles.map(profile => `<div class="v3-profile"><strong>${esc(profile.name)}</strong><p><b>${esc(t.scope)}:</b> ${esc(profile.scope)}</p><p>${esc(t.rules)}: ${count(profile.ruleCount)} · ${esc(t.rewards)}: ${count(profile.rewardCount)}</p>${renderTrust(profile.trust, locale)}</div>`).join('')}</details><a class="v3-event-link" href="${esc(event.reference)}">${esc(t.openReference)}</a></article>`).join('');
  const confirmed = data.confirmedSchedules.length ? `<ul class="v3-plan-list">${data.confirmedSchedules.map(record => `<li class="v3-plan" data-v3-confirmed-id="${esc(record.id)}"><strong>${esc(data.events.find(e => e.id === record.eventId).name)}</strong><span class="v3-event-badge" data-v3-phase></span><p>${esc(record.scope)}</p><p>${esc(record.start ? new Date(record.start).toISOString() : '')} – ${esc(new Date(record.end).toISOString())}</p><span data-v3-countdown></span><a href="${esc(record.evidence)}" rel="noopener noreferrer">${esc(t[statusKeys[record.status]])}</a></li>`).join('')}</ul>` : `<p class="v3-event-note">${esc(t.noConfirmed)}</p>`;
  return BEGIN + '\n' + `<section id="v3-events" data-v3-owned="events" dir="${data.dir}" aria-labelledby="v3-events-title"><h2 id="v3-events-title">${esc(t.title)}</h2><p class="v3-event-intro">${esc(t.intro)}</p><div data-v3-interactive hidden><div class="v3-clocks"><div class="v3-clock"><strong>${esc(t.serverClock)}</strong><output aria-live="off" data-v3-server-clock></output></div><div class="v3-clock"><strong>${esc(t.localClock)}</strong><output aria-live="off" data-v3-local-clock></output><small data-v3-local-zone></small></div></div><label>${esc(t.offset)}<input type="number" min="-14" max="14" step="0.25" value="0" inputmode="decimal" data-v3-offset aria-describedby="v3-offset-help"></label><p id="v3-offset-help">${esc(t.offsetHelp)}</p></div><h3>${esc(t.confirmedTitle)}</h3>${confirmed}<div class="v3-event-grid">${cards}</div><div data-v3-interactive hidden><h3 class="v3-plan-title">${esc(t.personalTitle)}</h3><p class="v3-event-note">${esc(t.personalNotice)}</p><p id="v3-input-zone" data-v3-input-zone></p><form class="v3-plan-form" data-v3-plan-form><label>${esc(t.event)}<select data-v3-event required>${data.events.map(event => `<option value="${esc(event.id)}">${esc(event.name)}</option>`).join('')}</select></label><label>${esc(t.start)}<input type="datetime-local" data-v3-start required min="1970-01-01T00:00" max="9999-12-31T23:59" aria-describedby="v3-input-zone"></label><label>${esc(t.end)}<input type="datetime-local" data-v3-end required min="1970-01-01T00:00" max="9999-12-31T23:59" aria-describedby="v3-input-zone"></label><button type="submit">${esc(t.add)}</button></form><p class="v3-message" data-v3-message role="status" aria-live="polite"></p><ul class="v3-plan-list" data-v3-plans></ul><button type="button" data-v3-clear>${esc(t.clear)}</button></div></section><script type="application/json" id="v3-events-data" data-v3-owned="events">${json(data)}</script>` + '\n' + END;
}
function files() {
  const asset = name => {
    const file = path.join(root, name);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
    return {path: '/' + name, hash, url: '/' + name + '?v=' + hash};
  };
  const css = asset('css/v3-events.css'), js = asset('js/v3-events.js');
  return {css: {...css, href: css.url}, js: {...js, src: js.url}};
}
function stripBlock(html, begin, end) {
  const starts = html.split(begin).length - 1, ends = html.split(end).length - 1;
  assert(starts === ends && starts <= 1, 'Malformed V3 events ownership block');
  if (!starts) return html;
  const from = html.indexOf(begin), to = html.indexOf(end, from);
  assert(to >= from, 'Reversed V3 events ownership block');
  return html.slice(0, from) + html.slice(to + end.length);
}
function strip(html) { return stripBlock(stripBlock(html, BEGIN, END), ASSETS_BEGIN, ASSETS_END); }
function project(html, locale) {
  let output = strip(html);
  const {css, js} = files();
  const assets = ASSETS_BEGIN + `\n<link data-v3-owned="assets" rel="stylesheet" href="${css.href}"><script data-v3-owned="assets" src="${js.src}" defer></script>\n` + ASSETS_END;
  assert(/<\/head\s*>/i.test(output), 'Missing head owner');
  output = output.replace(/<\/head\s*>/i, match => assets + match);
  const rendered = render(locale);
  if (/<div\b[^>]*\bid=["']calendar-app["'][^>]*>/i.test(output)) output = output.replace(/<div\b[^>]*\bid=["']calendar-app["'][^>]*>/i, match => rendered + match);
  else {
    assert(/<main\b[^>]*>/i.test(output), 'Missing dashboard content owner');
    output = output.replace(/<main\b[^>]*>/i, match => match + rendered);
  }
  return output;
}
module.exports = {BEGIN, END, ASSETS_BEGIN, ASSETS_END, render, project, payload, files, strip, renderTrust, copy, validateTrust, calendarData};
if (require.main === module) {
  const locales = registry.locales.map(row => row.code);
  locales.forEach(locale => render(locale));
  console.log(JSON.stringify({locales: locales.length, eventFamilies: payload('en').events.length, confirmedSchedules: trust.confirmedSchedules.length, files: files(), writes: 0}));
}
