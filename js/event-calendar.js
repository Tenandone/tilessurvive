(function () {
  'use strict';
  const root = document.getElementById('event-calendar'), app = document.getElementById('calendar-app'), M = window.EventCalendarMath;
  if (!root || !app || !M) return;
  const data = JSON.parse(document.getElementById('event-calendar-data').textContent), C = JSON.parse(document.getElementById('event-calendar-copy').textContent);
  const lang = root.dataset.lang, locale = { ko: 'ko-KR', en: 'en-GB', ja: 'ja-JP', ru: 'ru-RU', 'zh-tw': 'zh-TW', de: 'de-DE' }[lang] || 'en-GB';
  const storageKey = 'ts-event-calendar-utc-v1', esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
  const label = value => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
  const template = (key, n) => (C[key] || '').replace('{n}', n);
  const fmtNumber = n => new Intl.NumberFormat(locale).format(n);
  let state = { event: data.events[0].id, profile: data.events[0].profiles[0].id, zone: 'UTC', view: 'pattern', scoreDay: null }, saved = {}, quantities = {}, lastSignature = '';
  try { const stored = JSON.parse(localStorage.getItem(storageKey)); if (stored?.version === 1 && stored.anchors && typeof stored.anchors === 'object') saved = stored.anchors; } catch (_) { /* Storage may be unavailable. The planner still works for this page. */ }
  const save = () => { try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, anchors: saved })); return true; } catch (_) { return false; } };
  const event = () => data.events.find(e => e.id === state.event), profile = () => event().profiles.find(p => p.id === state.profile);
  const anchor = () => M.resolveAnchor(profile(), saved[state.event]);
  const zone = () => state.zone === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : state.zone;
  const time = stamp => M.formatInstant(stamp, zone(), locale);
  const scoreDays = () => [...new Set((profile().rules || []).map(r => r.day).filter(Number.isInteger))].sort((a, b) => a - b);
  const activeRules = () => (profile().rules || []).filter(r => !r.day || r.day === state.scoreDay);
  const scoreKey = () => `${state.event}/${state.profile}/${state.scoreDay || ''}`;
  const hhmm = seconds => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}`;
  const options = (rows, selected) => rows.map(r => `<option value="${esc(r.id)}"${r.id === selected ? ' selected' : ''}>${esc(label(r.names))}</option>`).join('');
  function patternHTML() {
    const p = profile().pattern;
    if (M.validatePattern(p)) {
      return `<p class="calendar-muted">${esc(C.slotOffset)}</p><div class="calendar-pattern-grid">${Array.from({ length: 7 }, (_, i) => `<section class="calendar-day"><h3>${esc(template('day', i + 1))}</h3><ol>${p.slots.filter(s => (s.day || Math.floor(s.offsetSeconds / 86400) + 1) === i + 1).map(s => `<li><span class="calendar-slot-time">${hhmm(s.offsetSeconds % 86400)}–${hhmm(s.offsetSeconds % 86400 + s.durationSeconds)}</span><strong>${esc(label(s.names))}</strong></li>`).join('')}</ol></section>`).join('')}</div>`;
    }
    return `<p class="calendar-muted">${esc(C.unknownTiming)}</p><ol class="calendar-ordered">${(p?.days || []).map((d, i) => `<li><span>${esc(d.day ? template('day', d.day) : template('phase', i + 1))}</span><strong>${esc(label(d.names))}</strong></li>`).join('')}</ol>`;
  }
  function datedHTML(now) {
    const a = anchor();
    if (!a || state.view === 'pattern') return patternHTML();
    const window = M.utcWindow(now, state.view), rows = M.occurrences(profile().pattern, a.timestamp, window.start, window.end);
    const dates = [];
    for (let d = window.start; d < window.end; d += M.DAY_MS) {
      const dayRows = rows.filter(r => r.start < d + M.DAY_MS && r.end > d);
      dates.push(`<section class="calendar-date-group"><h3>${new Date(d).toISOString().slice(0, 10)} <small>UTC</small></h3>${dayRows.map(r => `<div class="calendar-occurrence"${r.start <= now && now < r.end ? ' data-current="true"' : ''}><span><time datetime="${new Date(r.start).toISOString()}">${esc(time(r.start))}</time> – <time datetime="${new Date(r.end).toISOString()}">${esc(time(r.end))}</time></span><strong>${esc(label(r.names))}</strong></div>`).join('')}</section>`);
    }
    return `<p class="calendar-muted">${esc(C.utcDates)} <strong>${esc(zone())}</strong></p><div class="calendar-date-grid">${dates.join('')}</div>`;
  }
  function liveHTML(now) {
    const a = anchor();
    if (!a) return '';
    const s = M.eventState(profile().pattern, a.timestamp, now);
    return `<p class="calendar-schedule-status">${esc(a.kind === 'personal' ? C.personalOnly : C.referenceSchedule)}</p><div class="calendar-live"><section><span>${esc(C.current)}</span><strong>${esc(s.current ? label(s.current.names) : C.noCurrent)}</strong>${s.current ? `<small>${esc(time(s.current.start))} – ${esc(time(s.current.end))}</small><span>${esc(C.endsIn)} <b class="calendar-countdown" data-deadline="${s.current.end}">${M.countdown(s.current.end - now)}</b></span>` : ''}</section><section><span>${esc(C.next)}</span><strong>${esc(s.next ? label(s.next.names) : C.noNext)}</strong>${s.next ? `<small>${esc(time(s.next.start))} · ${esc(zone())}</small><span>${esc(C.startsIn)} <b class="calendar-countdown" data-deadline="${s.next.start}">${M.countdown(s.next.start - now)}</b></span>` : ''}</section></div>`;
  }
  function calculatorHTML() {
    const days = scoreDays();
    if (!days.includes(state.scoreDay)) state.scoreDay = days[0] || null;
    const rules = activeRules(), values = quantities[scoreKey()] || rules.map(() => '0'), result = M.calculate(rules, values);
    if (!rules.length) return `<p class="calendar-muted">${esc(C.noRules)}</p>`;
    return `<h3>${esc(C.calculator)}</h3><p class="calendar-muted">${esc(C.scoreScope)}</p>${days.length ? `<label class="calendar-score-day" for="calendar-score-day">${esc(C.missions)}<select id="calendar-score-day">${days.map(d => `<option value="${d}"${d === state.scoreDay ? ' selected' : ''}>${esc(template('day', d))}</option>`).join('')}</select></label>` : ''}<div class="calendar-score-inputs">${rules.map((r, i) => `<label for="calendar-quantity-${i}"><span>${esc(label(r.names))}</span><small>${fmtNumber(r.points)} ${esc(C.points)}</small><input id="calendar-quantity-${i}" class="calendar-quantity" type="number" min="0" step="1" inputmode="numeric" value="${esc(values[i] || '0')}" aria-label="${esc(label(r.names))} · ${esc(C.quantity)}"></label>`).join('')}</div><output class="calendar-total${result.valid ? '' : ' is-error'}" id="calendar-total" aria-live="polite">${result.valid ? `${esc(C.total)} <strong>${fmtNumber(result.total)}</strong> ${esc(C.points)}` : esc(C.errorQuantity)}</output>`;
  }
  function rewardsHTML() {
    const rows = profile().rewards || [];
    if (!rows.length) return '';
    return `<h3>${esc(C.rewards)}</h3><p class="calendar-muted">${esc(C.rewardNote)}</p><div class="calendar-rewards">${rows.map(r => `<section><h4>${fmtNumber(r.points)} ${esc(C.points)}</h4><ul>${r.items.map(it => `<li>${it.route ? `<a href="/${lang}/${esc(it.route)}">${esc(label(it.names))}</a>` : esc(label(it.names))}<strong>× ${fmtNumber(it.quantity)}</strong></li>`).join('')}</ul></section>`).join('')}</div>`;
  }
  function render() {
    const e = event(), p = profile(), a = anchor(), timed = M.validatePattern(p.pattern), now = Date.now(), personal = saved[state.event];
    if (!a) state.view = 'pattern';
    app.innerHTML = `<section class="calendar-controls" aria-label="${esc(C.title)}"><label for="calendar-event">${esc(C.event)}<select id="calendar-event">${options(data.events, state.event)}</select></label><label for="calendar-profile">${esc(C.profile)}<select id="calendar-profile">${options(e.profiles, state.profile)}</select></label><label for="calendar-zone">${esc(C.timezone)}<select id="calendar-zone">${[{ id: 'UTC', names: C.utc }, { id: 'Asia/Seoul', names: C.korea }, { id: 'local', names: C.local }].map(r => `<option value="${r.id}"${r.id === state.zone ? ' selected' : ''}>${esc(r.names)}</option>`).join('')}</select></label></section>
    <div class="calendar-event-heading">${e.image ? `<img src="${esc(e.image)}" width="80" height="80" alt="" loading="lazy">` : ''}<div><h2>${esc(label(e.names))}</h2><p>${esc(label(p.scope))}</p></div></div>
    <details class="calendar-anchor"${!a && timed ? ' open' : ''}><summary>${esc(C.personalAnchor)}</summary><p>${esc(timed ? C.anchorHelp : C.anchorUnavailable)}</p>${timed ? `<form id="calendar-anchor-form"><label for="calendar-weekday">${esc(C.weekday)}<select id="calendar-weekday" required><option value="">—</option>${C.weekdays.map((name, i) => `<option value="${i}"${personal?.weekday === i ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label><label for="calendar-time">${esc(C.hour)}<input type="time" id="calendar-time" required step="60" value="${esc(personal?.time || '')}"></label><button type="submit">${esc(C.apply)}</button><button type="button" id="calendar-anchor-reset">${esc(C.reset)}</button></form><p class="calendar-muted">${esc(C.savedLocal)}</p>` : ''}<p id="calendar-anchor-message" role="status"></p></details>
    <div id="calendar-live">${liveHTML(now)}</div>${!a ? `<p class="calendar-muted">${esc(timed ? C.noAnchor : C.patternOnly)}</p>` : ''}
    <nav class="calendar-view-buttons" aria-label="${esc(C.showCalendar)}">${['pattern', 'today', 'tomorrow', 'sevenDays'].map(key => `<button type="button" data-calendar-view="${key}" aria-pressed="${state.view === key}"${!a && key !== 'pattern' ? ' disabled' : ''}>${esc(C[key])}</button>`).join('')}</nav><div id="calendar-timeline">${datedHTML(now)}</div>
    <section class="calendar-score-section" aria-label="${esc(C.missions)}">${calculatorHTML()}${rewardsHTML()}</section>
    <nav class="calendar-related" aria-label="${esc(C.related)}">${(e.links || []).map(link => `<a href="/${lang}/${esc(link.route)}">${esc(label(link.names))} →</a>`).join('')}</nav>`;
    lastSignature = tickSignature(now);
  }
  function tickSignature(now) {
    const a = anchor();
    return a ? `${M.eventState(profile().pattern, a.timestamp, now).current?.start || ''}/${Math.floor(now / M.DAY_MS)}` : '';
  }
  app.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'calendar-event') { state.event = e.target.value; state.profile = event().profiles[0].id; }
    else if (id === 'calendar-profile') state.profile = e.target.value;
    else if (id === 'calendar-zone') state.zone = e.target.value;
    else if (id === 'calendar-score-day') state.scoreDay = Number(e.target.value);
    else return;
    render(); document.getElementById(id)?.focus();
  });
  app.addEventListener('submit', e => {
    if (e.target.id !== 'calendar-anchor-form') return;
    e.preventDefault();
    const weekday = document.getElementById('calendar-weekday').value, value = { weekday: weekday === '' ? null : Number(weekday), time: document.getElementById('calendar-time').value, patternKey: M.patternKey(profile().pattern) };
    if (M.personalAnchor(value) === null) { document.getElementById('calendar-anchor-message').textContent = C.errorAnchor; return; }
    saved[state.event] = value; const persisted = save(); state.view = 'today'; render();
    document.getElementById('calendar-anchor-message').textContent = persisted ? C.anchorSaved : C.localStorageUnavailable;
    if (!persisted) app.querySelector('.calendar-anchor').open = true;
    app.querySelector('[data-calendar-view="today"]').focus();
  });
  app.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.id === 'calendar-anchor-reset') { delete saved[state.event]; save(); state.view = 'pattern'; render(); document.getElementById('calendar-anchor-message').textContent = C.anchorRemoved; document.getElementById('calendar-weekday')?.focus(); }
    else if (button.dataset.calendarView) {
      state.view = button.dataset.calendarView;
      app.querySelectorAll('[data-calendar-view]').forEach(b => b.setAttribute('aria-pressed', b === button));
      document.getElementById('calendar-timeline').innerHTML = datedHTML(Date.now());
    }
  });
  app.addEventListener('input', e => {
    if (!e.target.matches('.calendar-quantity')) return;
    const inputs = [...app.querySelectorAll('.calendar-quantity')];
    quantities[scoreKey()] = inputs.map(el => el.value);
    const result = inputs.some(el => el.validity.badInput) ? { valid: false } : M.calculate(activeRules(), inputs.map(el => el.value)), output = document.getElementById('calendar-total');
    output.classList.toggle('is-error', !result.valid);
    output.innerHTML = result.valid ? `${esc(C.total)} <strong>${fmtNumber(result.total)}</strong> ${esc(C.points)}` : esc(C.errorQuantity);
  });
  function tick() {
    if (document.hidden) return;
    const now = Date.now(), signature = tickSignature(now);
    if (signature !== lastSignature) {
      document.getElementById('calendar-live').innerHTML = liveHTML(now);
      document.getElementById('calendar-timeline').innerHTML = datedHTML(now);
      lastSignature = signature;
    }
    for (const node of app.querySelectorAll('[data-deadline]')) node.textContent = M.countdown(Number(node.dataset.deadline) - now);
  }
  render(); setInterval(tick, 1000); document.addEventListener('visibilitychange', tick);
})();
