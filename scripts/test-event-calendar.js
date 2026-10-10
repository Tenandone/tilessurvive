'use strict';

/* Independent UTC and calculator regression cases. These tests do not claim
 * that an unanchored client pattern is a currently active server timetable. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const math = require('../js/event-calendar-math');
const calendar = require('../data/event-calendar.json');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '53315914dad64cb788ca345fd2912f22719d39d0';
const HOUR = 3600000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const anchor = Date.parse('2026-10-07T02:30:00Z'); // Wednesday, deliberately not Monday.
const pattern = {
  id: 'independent-week-fixture', kind: 'timed', periodSeconds: 604800,
  slots: Array.from({length: 42}, (_, i) => ({
    id: 'slot-' + i, offsetSeconds: i * 14400, durationSeconds: 14400,
    day: Math.floor(i / 6) + 1, names: {en: 'Slot ' + i}
  }))
};
const clone = value => JSON.parse(JSON.stringify(value));

test('42 four-hour slots fill one exact UTC week', () => {
  assert.equal(math.DAY_MS, DAY);
  assert.equal(math.WEEK_MS, WEEK);
  assert.equal(math.validatePattern(pattern), true);
  const slots = math.occurrences(pattern, anchor, anchor, anchor + WEEK);
  assert.equal(slots.length, 42);
  assert.equal(slots[0].start, anchor);
  assert.equal(slots.at(-1).end, anchor + WEEK);
  slots.forEach((slot, i) => {
    assert.equal(slot.start, anchor + i * 4 * HOUR);
    assert.equal(slot.end - slot.start, 4 * HOUR);
    assert.equal(slot.slotIndex, i);
    if (i) assert.equal(slots[i - 1].end, slot.start);
  });
});

test('the browser UMD export supplies the same UTC engine', () => {
  const context = vm.createContext({Date,Intl,Number,Math,Set,JSON});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'js/event-calendar-math.js'),'utf8'),context);
  assert.ok(context.EventCalendarMath);
  assert.equal(context.EventCalendarMath.WEEK_MS,WEEK);
  assert.equal(context.EventCalendarMath.personalAnchor({weekday:3,time:'02:30'}),math.personalAnchor({weekday:3,time:'02:30'}));
  assert.equal(context.EventCalendarMath.occurrences(pattern,anchor,anchor,anchor + WEEK).length,42);
});

test('invalid or untimed patterns cannot become a dated schedule', () => {
  assert.equal(math.validatePattern({...pattern, kind: 'ordered'}), false);
  for (const mutate of [
    p => {p.periodSeconds = 0;},
    p => {p.slots = [];},
    p => {p.slots[0].offsetSeconds = -1;},
    p => {p.slots[0].durationSeconds = 0;},
    p => {p.slots[0].durationSeconds = Infinity;},
    p => {p.slots[41].durationSeconds = 14401;},
    p => {p.slots[1].id = p.slots[0].id;},
    p => {p.slots[1].offsetSeconds = 14399;}
  ]) {
    const invalid = clone(pattern); mutate(invalid);
    assert.equal(math.validatePattern(invalid), false);
  }
});

test('missing anchors leave dated previews and current events unavailable', () => {
  const profile = {pattern, confirmedAnchorUtc:null};
  assert.equal(math.resolveAnchor(profile, null), null);
  assert.deepEqual(math.occurrences(pattern, null, anchor, anchor + DAY), []);
  assert.deepEqual(math.eventState(pattern, null, anchor), {current:null,next:null});
  assert.equal(math.resolveAnchor({pattern:{kind:'ordered'},confirmedAnchorUtc:'2026-10-07T02:30:00Z'}, {weekday:3,time:'02:30'}), null);
});

test('personal anchors are labeled and invalidated when the saved pattern changes', () => {
  const profile = {pattern, confirmedAnchorUtc:null};
  const personal = {weekday:3,time:'02:30',patternKey:math.patternKey(pattern)};
  const resolved = math.resolveAnchor(profile, personal);
  assert.equal(resolved.kind, 'personal');
  assert.equal(resolved.timestamp, math.personalAnchor(personal));
  assert.equal(math.resolveAnchor(profile, {...personal,patternKey:'stale-schedule'}), null);
  const changed = clone(pattern); changed.slots[0].durationSeconds = 14399;
  assert.notEqual(math.patternKey(changed), math.patternKey(pattern));
  assert.equal(math.resolveAnchor({pattern:changed,confirmedAnchorUtc:null},personal), null);
});

test('a confirmed UTC anchor is distinct from a personal reference', () => {
  const resolved = math.resolveAnchor({pattern,confirmedAnchorUtc:'2026-10-07T02:30:00Z'}, {weekday:1,time:'00:00'});
  assert.deepEqual(resolved, {timestamp:anchor,kind:'confirmed'});
  for (const invalid of ['2026-10-07 02:30:00','2026-10-07T02:30:00+09:00','2026-13-07T02:30:00Z','2026-02-30T00:00:00Z']) {
    assert.equal(math.resolveAnchor({pattern,confirmedAnchorUtc:invalid}, null), null, invalid);
  }
});

test('occurrences use half-open intervals and exclude a slot ending at range start', () => {
  const edge = anchor + 4 * HOUR;
  const slots = math.occurrences(pattern, anchor, edge, edge + 4 * HOUR);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].slotIndex, 1);
  assert.equal(slots[0].start, edge);
  assert.equal(slots[0].end, edge + 4 * HOUR);
  assert.equal(math.occurrences(pattern, anchor, edge, edge).length, 0);
});

test('a calendar window spanning UTC midnight includes all overlapping slots', () => {
  const start = Date.parse('2026-10-08T00:00:00Z');
  const slots = math.occurrences(pattern, anchor, start, start + DAY);
  assert.equal(slots.length, 7); // 02:30 anchor deliberately straddles midnight.
  assert.ok(slots[0].start < start && slots[0].end > start);
  assert.ok(slots.at(-1).start < start + DAY && slots.at(-1).end > start + DAY);
  assert.equal(slots.reduce((sum, s) => sum + Math.min(s.end, start + DAY) - Math.max(s.start, start), 0), DAY);
});

test('the week repeats across both positive and negative cycle indexes', () => {
  for (const week of [-2, -1, 0, 1, 2]) {
    const start = anchor + week * WEEK;
    const slots = math.occurrences(pattern, anchor, start, start + WEEK);
    assert.equal(slots.length, 42);
    assert.equal(slots[0].slotIndex, 0);
    assert.equal(slots[0].start, start);
    assert.equal(slots.at(-1).end, start + WEEK);
  }
});

test('current and next change exactly at the four-hour and week boundaries', () => {
  const a = math.eventState(pattern, anchor, anchor + 4 * HOUR - 1);
  assert.equal(a.current.slotIndex, 0);
  assert.equal(a.next.slotIndex, 1);
  const b = math.eventState(pattern, anchor, anchor + 4 * HOUR);
  assert.equal(b.current.slotIndex, 1);
  assert.equal(b.next.slotIndex, 2);
  const end = math.eventState(pattern, anchor, anchor + WEEK - 1);
  assert.equal(end.current.slotIndex, 41);
  assert.equal(end.next.slotIndex, 0);
  assert.equal(end.next.start, anchor + WEEK);
  const rollover = math.eventState(pattern, anchor, anchor + WEEK);
  assert.equal(rollover.current.slotIndex, 0);
  assert.equal(rollover.current.start, anchor + WEEK);
});

test('a gap remains empty rather than extending the preceding event', () => {
  const gaps = {kind:'timed',periodSeconds:604800,slots:[
    {id:'first',offsetSeconds:0,durationSeconds:3600},
    {id:'later',offsetSeconds:7200,durationSeconds:3600}
  ]};
  assert.equal(math.validatePattern(gaps),true);
  const state = math.eventState(gaps,anchor,anchor + HOUR);
  assert.equal(state.current,null);
  assert.equal(state.next.id,'later');
  assert.equal(state.next.start,anchor + 2 * HOUR);
});

test('today, tomorrow and seven-day windows use UTC dates across a year boundary', () => {
  const now = Date.parse('2026-12-31T23:59:59.999Z');
  assert.deepEqual(math.utcWindow(now, 'today'), {start: Date.parse('2026-12-31T00:00:00Z'), end: Date.parse('2027-01-01T00:00:00Z')});
  assert.deepEqual(math.utcWindow(now, 'tomorrow'), {start: Date.parse('2027-01-01T00:00:00Z'), end: Date.parse('2027-01-02T00:00:00Z')});
  assert.deepEqual(math.utcWindow(now, 'sevenDays'), {start: Date.parse('2026-12-31T00:00:00Z'), end: Date.parse('2027-01-07T00:00:00Z')});
});

test('UTC windows preserve leap day and remain exactly 24 hours during DST', () => {
  const leap = math.utcWindow(Date.parse('2028-02-28T23:00:00Z'), 'tomorrow');
  assert.equal(new Date(leap.start).toISOString(), '2028-02-29T00:00:00.000Z');
  assert.equal(new Date(leap.end).toISOString(), '2028-03-01T00:00:00.000Z');
  for (const instant of ['2026-03-08T07:00:00Z', '2026-11-01T06:00:00Z']) {
    const day = math.utcWindow(Date.parse(instant), 'today');
    assert.equal(day.end - day.start, DAY);
  }
});

test('host timezone does not change UTC windows or personal UTC anchors', () => {
  const js = 'const m=require(' + JSON.stringify(path.join(ROOT, 'js/event-calendar-math.js')) + ');console.log(JSON.stringify({w:m.utcWindow(Date.parse("2026-03-08T07:00:00Z"),"today"),a:m.personalAnchor({weekday:0,time:"00:00"})}))';
  const outputs = ['UTC', 'Asia/Seoul', 'America/New_York', 'Pacific/Auckland'].map(TZ => execFileSync(process.execPath, ['-e', js], {encoding:'utf8', env:{...process.env, TZ}}));
  outputs.forEach(value => assert.equal(value, outputs[0]));
});

test('personal weekly anchors validate UTC weekday and strict HH:mm', () => {
  for (let weekday = 0; weekday < 7; weekday++) {
    const value = math.personalAnchor({weekday, time:'23:59'});
    assert.ok(Number.isFinite(value));
    const date = new Date(value);
    assert.equal(date.getUTCDay(), weekday);
    assert.equal(date.getUTCHours(), 23);
    assert.equal(date.getUTCMinutes(), 59);
    assert.equal(date.getUTCSeconds(), 0);
    assert.equal(math.personalAnchor({weekday, time:'23:59'}), value);
  }
  for (const value of [null, {}, {weekday:-1,time:'00:00'}, {weekday:7,time:'00:00'}, {weekday:1.5,time:'00:00'}, {weekday:0,time:'24:00'}, {weekday:0,time:'12:60'}, {weekday:0,time:'1:00'}, {weekday:0,time:'00:00Z'}, {weekday:0,time:''}]) {
    assert.equal(math.personalAnchor(value), null, JSON.stringify(value));
  }
});

test('display timezone conversions preserve the same underlying occurrence', () => {
  const instant = Date.parse('2026-10-10T20:00:00Z');
  const before = math.occurrences(pattern, anchor, instant, instant + DAY);
  const utc = math.formatInstant(instant, 'UTC', 'en-GB');
  const seoul = math.formatInstant(instant, 'Asia/Seoul', 'en-GB');
  assert.match(utc, /20:00/);
  assert.match(seoul, /05:00/);
  assert.notEqual(utc, seoul);
  const nyBefore = math.formatInstant(Date.parse('2026-03-08T06:00:00Z'), 'America/New_York', 'en-GB');
  const nyAfter = math.formatInstant(Date.parse('2026-03-08T07:00:00Z'), 'America/New_York', 'en-GB');
  assert.match(nyBefore, /01:00/);
  assert.match(nyAfter, /03:00/);
  assert.deepEqual(math.occurrences(pattern, anchor, instant, instant + DAY), before);
  assert.equal(math.formatInstant(instant,'Invalid/Timezone','en-GB'),'');
});

test('current event is based on the supplied real now, not the selected preview window', () => {
  const now = anchor + HOUR;
  const current = math.eventState(pattern, anchor, now);
  math.occurrences(pattern, anchor, anchor + 6 * DAY, anchor + WEEK);
  assert.deepEqual(math.eventState(pattern, anchor, now), current);
  assert.equal(current.current.slotIndex, 0);
});

test('calculator uses exact integer quantities, including the existing 857-point action', () => {
  const rules = [{points:9000}, {points:1000}, {points:150}, {points:857}, {points:60}];
  const result = math.calculate(rules, [1,2,3,4,5]);
  assert.equal(result.valid, true);
  assert.equal(result.total, 15178);
  assert.equal(math.calculate(rules, [0,0,0,0,0]).total, 0);
  assert.equal(math.calculate(rules, ['','','','','']).total, 0);
  for (const invalid of [-1, 1.5, Infinity, NaN, 'abc', '1,2', '1+2', '<script>']) {
    assert.equal(math.calculate(rules, [invalid,0,0,0,0]).valid, false, String(invalid));
  }
  assert.equal(math.calculate([{points:9000}], [Number.MAX_SAFE_INTEGER]).valid, false);
  assert.equal(math.calculate(rules,[1]).valid,false);
  assert.equal(math.calculate([{points:-1}],[1]).valid,false);
});

test('countdowns are nonnegative and retain hours across a UTC day boundary', () => {
  assert.equal(math.countdown(-1000),'00:00:00');
  assert.equal(math.countdown(0),'00:00:00');
  assert.equal(math.countdown(1),'00:00:01');
  assert.equal(math.countdown(4 * HOUR),'04:00:00');
  assert.equal(math.countdown(25 * HOUR + 61 * 1000),'25:01:01');
  assert.equal(math.countdown(Infinity),'');
});

test('existing calculator formulas, verified source models and affiliate target are preserved', () => {
  for (const file of [
    'js/platform-math.js', 'js/foundation-40-math.js', 'js/tools-speedup-calculator.js',
    'config/affiliate.json', 'data/event-helper-calculators.json',
    'data/product-50/german-event-helper-calculators.json',
    'data/foundation-40/arms-race-hero-rules-41.json'
  ]) {
    const before = execFileSync('git', ['show', BASELINE + ':' + file], {cwd:ROOT});
    assert.equal(fs.readFileSync(path.join(ROOT,file),'utf8').replaceAll('\r\n','\n'), before.toString('utf8').replaceAll('\r\n','\n'), file);
  }
});

test('public profiles have no invented global anchor and keep unconfirmed phase times undated', () => {
  assert.equal(calendar.timeBasis,'UTC');
  assert.deepEqual(calendar.events.map(e=>e.id),['arms-race','alliance-duel','turtle-race']);
  const arms = calendar.events[0];
  for (const event of calendar.events) for (const profile of event.profiles) {
    assert.equal(profile.confirmedAnchorUtc,null,profile.id);
    assert.equal(math.resolveAnchor(profile,null),null,profile.id);
    if (event.id !== 'arms-race') {
      assert.equal(profile.pattern.kind,'ordered');
      assert.equal(math.resolveAnchor(profile,{weekday:1,time:'00:00'}),null);
      assert.deepEqual(math.occurrences(profile.pattern,anchor,anchor,anchor+WEEK),[]);
    }
  }
  assert.equal(arms.profiles[0].pattern.slots.length,42);
  for (const profile of arms.profiles) {
    assert.ok(math.validatePattern(profile.pattern));
    assert.deepEqual(profile.pattern,arms.profiles[0].pattern);
    assert.ok(profile.pattern.slots.every(s=>s.durationSeconds===14400));
  }
  for (const profile of arms.profiles.filter(p=>p.rules.length)) {
    assert.equal(profile.conditions.competitionLevelMin,30);
    assert.equal(profile.conditions.competitionLevelMax,30);
    assert.equal(profile.conditions.rank,null,'An unobserved rank must remain unassigned');
  }
  assert.deepEqual(calendar.events[2].profiles.map(p=>p.conditions.cycle),['first','repeat']);
  assert.deepEqual(calendar.events[1].profiles.map(p=>p.conditions.season),[1,2]);
});

test('all six pages retain searchable 42-slot HTML, metadata, exact embedded data and public links', () => {
  const langs=['ko','en','ja','ru','zh-tw','de'];
  const sitemap=fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8');
  for (const lang of langs) {
    const route=`/${lang}/events/calendar/`,html=fs.readFileSync(path.join(ROOT,lang,'events/calendar/index.html'),'utf8');
    const doc=parseHTML(html).document;
    assert.equal(doc.querySelectorAll('h1').length,1);
    assert.ok(doc.querySelector('title').textContent.trim());
    assert.ok(doc.querySelector('meta[name="description"]').content.trim());
    assert.equal(doc.querySelector('link[rel="canonical"]').href,'https://tilessurvive.net'+route);
    assert.equal(doc.documentElement.getAttribute('data-lang'),lang);
    const alternates=[...doc.querySelectorAll('head link[rel="alternate"][hreflang]')];
    assert.equal(alternates.length,7);
    for (const other of [...langs,'x-default']) assert.equal(alternates.filter(n=>n.hreflang===other).length,1);
    assert.equal(doc.querySelector('#calendar-reference-1 table').querySelectorAll('tbody tr').length,42);
    assert.equal(doc.querySelectorAll('#calendar-reference article').length,3);
    assert.deepEqual(JSON.parse(doc.getElementById('event-calendar-data').textContent),calendar);
    assert.ok(doc.querySelector('#calendar-reference').textContent.includes('857'));
    assert.ok(sitemap.includes('<loc>https://tilessurvive.net'+route+'</loc>'));
    assert.ok(!/tscfg:|client\.sqlite|C:\\Users\\|BEGIN (?:RSA |EC )?PRIVATE KEY/.test(html));
    for (const a of doc.querySelectorAll('main a[href^="/"]')) {
      const url=new URL(a.getAttribute('href'),'https://tilessurvive.net');
      const file=path.join(ROOT,url.pathname,path.extname(url.pathname)?'':'index.html');
      assert.ok(fs.existsSync(file),lang+' '+url.pathname);
      if(url.hash)assert.ok(parseHTML(fs.readFileSync(file,'utf8')).document.getElementById(decodeURIComponent(url.hash.slice(1))),lang+' '+url.href);
    }
    const index=parseHTML(fs.readFileSync(path.join(ROOT,lang,'events/index.html'),'utf8')).document;
    assert.equal(index.querySelectorAll(`a[href="${route}"]`).length,1);
  }
});

test('hero score rules reuse the existing verified public model without widening level scope', () => {
  const source=require('../data/foundation-40/arms-race-hero-rules-41.json');
  const hero=calendar.events[0].profiles.find(p=>p.id==='hero-lv30');
  assert.deepEqual(hero.rules.map(r=>[r.id,r.points]),source.rules.map(r=>[r.id,r.points]));
  assert.equal(hero.conditions.competitionLevelMin,source.competitionBracket.min);
  assert.equal(hero.conditions.competitionLevelMax,source.competitionBracket.max);
  for(const lang of ['ko','en','ja','ru','zh-tw'])assert.deepEqual(hero.rules.map(r=>r.names[lang]),source.rules.map(r=>r.action[lang]));
});

test('training points and threshold rewards exactly reuse the existing six-language calculator data', () => {
  const training=calendar.events[0].profiles.find(p=>p.id==='training-lv30');
  for(const lang of ['ko','en','ja','ru','zh-tw','de']) {
    const doc=parseHTML(fs.readFileSync(path.join(ROOT,lang,'events/arms-race/index.html'),'utf8')).document;
    const source=JSON.parse(doc.getElementById('foundation-data').textContent).event;
    assert.equal(training.conditions.competitionLevelMin,source.conditions.competitionBracketMin);
    assert.equal(training.conditions.competitionLevelMax,source.conditions.competitionBracketMax);
    assert.deepEqual(training.rules.slice(0,10).map(r=>r.points),source.troopPoints);
    assert.equal(training.rules[10].id,'training-speedup-minute');
    assert.equal(training.rules[10].points,source.pointsPerSpeedupMinute);
    assert.deepEqual(training.rewards.map(r=>({points:r.points,rewards:r.items.map(i=>({item:i.id,quantity:i.quantity}))})),source.stages);
    assert.equal(training.confirmedAnchorUtc,null,'A matching hour does not establish the weekly start weekday');
  }
});

test('Alliance projections retain approved task/day identities without combining different-day scores', () => {
  // The retained profile audit established exact task references for these four
  // projections in both season groups; numeric similarity was not used as a join.
  const expected=[['day-1-task-182900035',1,300],['day-1-task-182900036',1,37500],['day-3-task-182900054',3,30000],['day-5-task-182900066',5,37500]];
  for(const profile of calendar.events[1].profiles){
    assert.deepEqual(profile.rules.map(r=>[r.id,r.day,r.points]),expected);
    const first=profile.rules.filter(r=>r.day===1),third=profile.rules.filter(r=>r.day===3);
    assert.equal(math.calculate(first,[0,1]).total,37500);
    assert.equal(math.calculate(third,[1]).total,30000);
    for(const rule of profile.rules)for(const lang of ['ko','en','ja','ru','zh-tw','de'])assert.ok(rule.names[lang]?.trim());
  }
});
