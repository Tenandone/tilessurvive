// Shared by the static root and the localized V5 dashboards.
(function (host, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.TS_HOME_FORM_STATE = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const KEY = 'tiles.v5.dashboard.v1';
  const PREF_KEY = 'tiles.v6.preferences.v1';
  const pending = new WeakMap();

  function hydrate(raw, profiles) {
    const empty = {version:1, profile:profiles[0].id, day:null, checks:{}};
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || !profiles.some(p => p.id === data.profile)) return empty;
      if (data.day !== null && !(Number.isInteger(data.day) && data.day >= 1 && data.day <= 6)) return empty;
      return {version:1, profile:data.profile, day:data.day, checks:data.checks && typeof data.checks === 'object' && !Array.isArray(data.checks) ? data.checks : {}};
    } catch (_) { return empty; }
  }
  function preferences(raw) {
    let data;
    try { data = JSON.parse(raw); } catch (_) { /* Use the dashboard defaults. */ }
    if (data?.version !== 1) data = {};
    const validOffset = Number.isInteger(data.offset) && data.offset >= -840 && data.offset <= 840 && data.offset % 15 === 0;
    return {
      version: 1, offset: validOffset ? data.offset : 0,
      quantity: Number.isSafeInteger(data.quantity) && data.quantity >= 0 ? data.quantity : 0,
      target: Number.isSafeInteger(data.target) && data.target >= 0 ? data.target : 0,
    };
  }
  function read(host, profiles) {
    let dashboard, prefs;
    try { dashboard = host.localStorage.getItem(KEY); prefs = host.localStorage.getItem(PREF_KEY); } catch (_) { dashboard = prefs = null; }
    return {saved:hydrate(dashboard,profiles), prefs:preferences(prefs), prepared:false, scoreEdited:false};
  }
  function persist(host, key, value) {
    try { host.localStorage.setItem(key,JSON.stringify(value)); } catch (_) { /* Keep the current tab usable. */ }
  }
  function offsetMinutes(raw) {
    const minutes = Number(raw) * 60;
    return raw !== '' && Number.isInteger(minutes) && minutes % 15 === 0 && minutes >= -840 && minutes <= 840 ? minutes : null;
  }
  function commitOffset(input, state, host) {
    const minutes = offsetMinutes(input.value);
    if (minutes === null) {
      input.value = String(state.prefs.offset / 60);
      return state.prefs.offset;
    }
    state.prefs.offset = minutes;
    persist(host,PREF_KEY,state.prefs);
    return minutes;
  }
  function restoreInput(input, value) {
    // A native edit can precede even the first deferred script. Preserve it.
    const initial = input.defaultValue ?? input.getAttribute('value') ?? '';
    if (input.value === initial && input.value !== String(value)) input.value = String(value);
  }
  function prepare(document, host) {
    if (pending.has(document) || !document.documentElement.hasAttribute('data-root-home')) return;
    const root = document.querySelector('[data-v5-home]'), config = root?.querySelector('[data-v5-config]');
    if (!root || !config || root.hasAttribute('data-mounted')) return;
    let profiles;
    try { profiles = JSON.parse(config.textContent).profiles; } catch (_) { return; }
    if (!Array.isArray(profiles) || !profiles.length) return;
    const profile = root.querySelector('[data-v5-profile]'), offset = root.querySelector('[data-v6-offset]');
    const quantity = root.querySelector('[data-v6-quantity]'), target = root.querySelector('[data-v6-target]');
    if (!profile || !offset || !quantity || !target) return;
    const state = read(host,profiles);
    state.prepared = true;
    restoreInput(offset,state.prefs.offset / 60);
    state.displayOffset = offsetMinutes(offset.value) ?? state.prefs.offset;
    restoreInput(quantity,state.prefs.quantity);
    restoreInput(target,state.prefs.target);
    const options = Array.from(profile.options);
    const initialProfile = (options.find(o=>o.defaultSelected) || options[0])?.value;
    if (profile.value && profile.value !== initialProfile && profiles.some(p=>p.id===profile.value)) state.saved.profile = profile.value;
    else if (profile.value !== state.saved.profile) {
      const option = options.find(o=>o.value===state.saved.profile);
      if (option) option.selected = true;
    }
    function showDay() {
      const active = state.saved.day !== null;
      for (const button of root.querySelectorAll('[data-v5-day]')) {
        button.setAttribute('aria-pressed',String(Number(button.dataset.v5Day)===state.saved.day));
      }
      quantity.disabled = target.disabled = !active;
    }
    showDay();
    function edit(event) {
      const control = event.target;
      if (control === profile && profiles.some(p=>p.id===control.value)) {
        state.saved.profile = control.value;
        if (event.type === 'change') persist(host,KEY,state.saved);
      } else if (control === offset) {
        state.displayOffset = event.type === 'change' ? commitOffset(offset,state,host) : (offsetMinutes(offset.value) ?? state.displayOffset);
      } else if ((control === quantity || control === target) && !control.disabled && event.type === 'input') {
        // The normal score calculator validates and persists the pending pair on mount.
        state.scoreEdited = true;
      }
    }
    function chooseDay(event) {
      const button = event.target.closest?.('[data-v5-day]');
      if (!button || button.disabled) return;
      const day = Number(button.dataset.v5Day);
      if (!profiles.find(p=>p.id===state.saved.profile)?.days.some(d=>d.day===day)) return;
      state.saved.day = day;
      showDay();
      persist(host,KEY,state.saved);
    }
    root.addEventListener('input',edit);
    root.addEventListener('change',edit);
    root.addEventListener('click',chooseDay);
    pending.set(document,{state,release(){
      root.removeEventListener('input',edit);
      root.removeEventListener('change',edit);
      root.removeEventListener('click',chooseDay);
    }});
  }
  function take(document) {
    const entry = pending.get(document);
    if (!entry) return null;
    entry.release();
    pending.delete(document);
    return entry.state;
  }
  return {KEY,PREF_KEY,hydrate,preferences,read,persist,offsetMinutes,commitOffset,prepare,take};
});
