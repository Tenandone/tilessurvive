(function () {
  'use strict';
  if (!document.documentElement.hasAttribute('data-v3-affiliate') || window.TS_V3_AFFILIATE) return;
  var TEN = 'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive';
  var KEY = 'tiles.v3.analyticsConsent';
  var GA_ID = 'G-Z2MJ6TXZHK';
  var APPROVED_IDS = new Set([GA_ID, 'G-TMGDGSEWW6', 'G-Z2MJ6TZXHK']);
  var requestedIds = window.TS_V3_GA_IDS === undefined ? [GA_ID] : window.TS_V3_GA_IDS;
  var idsValid = Array.isArray(requestedIds) && requestedIds.includes(GA_ID) && requestedIds.every(function (id) { return APPROVED_IDS.has(id); });
  var gaIds = idsValid ? Array.from(new Set(requestedIds)) : [];
  var LOCALES = new Set(['en','ko','ja','zh-tw','de','ru','zh-cn','ar','nl','fr','id','it','pl','pt','es','sv','th','tr','vi','ms','nb']);
  var FEATURES = new Set(['calculator','power_plant','calendar','search','home','tools','topup','content']);
  var PLACEMENTS = new Set(['guide','result','header','footer','banner','content','landing_top','landing_bottom']);
  var LANDING_SECTIONS = new Set(['dashboard','missions','duel','scores','guides','codes','heroes','pets','factions','glossary','simulators','tools','events','news','topup','common_event','event_official','event_guide','event_rules','event_schedule','planner','bookmark','score_preview','score_planner','coupon']);
  var ACTIONS = new Set(['result','save','restore','clear','select','open','change']);
  var LANDING_ACTIONS = new Set(Array.from(ACTIONS).concat(['view','copy','previous','next']));
  function uiVersion(){var home=document.querySelector('[data-v5-home]');return home&&home.getAttribute('data-ui-version')==='v6'?'v6':'v5';}
  var consent = false, gaReady = false, pageSent = new Set(), guideSent = false, landingSent = false;
  try { consent = window.localStorage.getItem(KEY) === 'granted'; } catch (_) {}
  function language() {
    var fromRegistry = window.TS_LOCALES && window.TS_LOCALES.current();
    var lang = fromRegistry || location.pathname.split('/')[1] || document.documentElement.dataset.lang;
    return LOCALES.has(lang) ? lang : 'en';
  }
  function pageType() {
    var p = location.pathname.replace(/^\/[^/]+(?=\/)/, '');
    if (/^\/(?:index\.html)?$/.test(p)) return 'home';
    if (/^\/top-up\//.test(p)) return 'topup';
    if (/^\/buildings\/power-plant\//.test(p)) return 'power_plant';
    if (/calendar/.test(p)) return 'calendar';
    if (/^\/search\//.test(p)) return 'search';
    if (/^\/tools\//.test(p)) return 'tools';
    if (/^\/heroes\/[^/]+\//.test(p)) return 'hero_detail';
    if (/^\/database\/pet-system\/[^/]+\//.test(p)) return 'pet_detail';
    if (/^\/buildings\/[^/]+\//.test(p)) return 'building_detail';
    if (/^\/guides\//.test(p)) return 'guide';
    if (/^\/events\//.test(p)) return 'event';
    if (/^\/codes\//.test(p)) return 'coupon';
    if (/research/.test(p)) return 'research';
    if (/^\/database\//.test(p)) return 'database';
    return 'content';
  }
  // A publisher-controlled canonical path is used, never location.search/hash.
  function safePath() {
    var link = document.querySelector('link[rel="canonical"]');
    if (link) {
      try {
        var url = new URL(link.href, location.origin);
        if (url.hostname === 'tilessurvive.net' && /^\/(?:[a-z0-9-]+\/)*(?:index\.html)?$/.test(url.pathname) && url.pathname.length <= 220) return url.pathname;
      } catch (_) {}
    }
    return '/' + language() + '/' + (pageType() === 'home' ? '' : pageType() + '/');
  }
  function sourceCategory() {
    if (!document.referrer) return 'direct';
    try {
      var host = new URL(document.referrer).hostname.toLowerCase();
      if (host === location.hostname || host === 'tilessurvive.net' || host === 'www.tilessurvive.net') return 'internal';
      if (/(^|\.)(google\.[a-z.]+|bing\.com|yahoo\.[a-z.]+|duckduckgo\.com|yandex\.[a-z.]+|baidu\.com|naver\.com)$/.test(host)) return 'search';
      if (/(^|\.)(facebook\.com|instagram\.com|reddit\.com|youtube\.com|t\.co|x\.com|discord\.com|kakao\.com)$/.test(host)) return 'social';
      return 'external';
    } catch (_) { return 'external'; }
  }
  function production() { return location.hostname === 'tilessurvive.net'; }
  function base() {
    return {page: safePath(), page_type: pageType(), language: language(), source_category: sourceCategory(), measurement_version: 'v3.1', campaign: 'lootbar_ten'};
  }
  function startGA() {
    if (!consent || !production() || gaReady || !idsValid) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'update', {analytics_storage: 'granted'});
    window.gtag('js', new Date());
    gaIds.forEach(function (id) {
      window.gtag('config', id, {send_page_view: false, page_location: 'https://tilessurvive.net' + safePath(), page_referrer: '', page_title: 'TilesSurvive.net | ' + pageType(), allow_google_signals: false, allow_ad_personalization_signals: false});
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    script.dataset.v3GaLoader = '';
    document.head.appendChild(script);
    gaReady = true;
  }
  function send(name, extra, destination) {
    destination = destination || GA_ID;
    if (!consent || !production() || !gaReady || !gaIds.includes(destination) || typeof window.gtag !== 'function') return false;
    var payload = Object.assign(base(), extra || {});
    // These overrides also apply to the custom events, independent of defaults.
    payload.page_location = 'https://tilessurvive.net' + safePath();
    payload.page_referrer = '';
    payload.page_title = 'TilesSurvive.net | ' + pageType();
    payload.send_to = destination;
    window.gtag('event', name, payload);
    return true;
  }
  function pageViews() {
    gaIds.forEach(function (id) {
      if (!pageSent.has(id) && send('page_view', null, id)) pageSent.add(id);
    });
    if (!guideSent && document.querySelector('[data-v3-guide]') && send('topup_guide_view', {feature: 'topup'})) guideSent = true;
    if (!landingSent && document.querySelector('[data-v5-home]') && send('landing_view', {ui_version:uiVersion()})) landingSent = true;
  }
  function kind(anchor) {
    if (!anchor) return '';
    if (anchor.href === TEN) return 'external';
    try {
      var url = new URL(anchor.href, location.origin);
      if (url.origin !== location.origin) return '';
      if (new RegExp('^/(' + Array.from(LOCALES).join('|') + ')/top-up/(?:index\\.html)?$').test(url.pathname)) return 'internal';
      if (anchor.dataset.v3Cta === 'free' && new RegExp('^/(' + Array.from(LOCALES).join('|') + ')/events/daily-missions/$').test(url.pathname)) return 'free';
    } catch (_) {}
    return '';
  }
  function dimensions(anchor) {
    var placement = anchor.dataset.v3Placement || (anchor.classList.contains('ts-lootbar') ? 'banner' : 'content');
    var feature = anchor.dataset.v3Feature || pageType();
    var result={placement: PLACEMENTS.has(placement) ? placement : 'content', feature: FEATURES.has(feature) ? feature : 'content', destination_type: kind(anchor), creative_type: anchor.classList.contains('ts-lootbar') ? 'banner' : 'text_link'};
    if(document.querySelector('[data-v5-home]'))result.ui_version=uiVersion();
    return result;
  }
  var seen = new WeakSet(), observed = new WeakSet(), timers = new Map(), ratios = new Map(), observer;
  function stop(anchor) { clearTimeout(timers.get(anchor)); timers.delete(anchor); }
  function start(anchor) {
    if (!consent || !production() || document.hidden || seen.has(anchor) || timers.has(anchor) || (ratios.get(anchor) || 0) < 0.6) return;
    timers.set(anchor, setTimeout(function () {
      timers.delete(anchor);
      if (!consent || document.hidden || !anchor.isConnected || (ratios.get(anchor) || 0) < 0.6 || seen.has(anchor)) return;
      if (send('affiliate_viewable', dimensions(anchor))) {
        seen.add(anchor); ratios.delete(anchor); observer.unobserve(anchor);
      }
    }, 1000));
  }
  function updateControls() {
    document.querySelectorAll('[data-v3-consent-allow]').forEach(function (b) { b.setAttribute('aria-pressed', String(consent)); });
    document.querySelectorAll('[data-v3-consent-deny]').forEach(function (b) { b.setAttribute('aria-pressed', String(!consent)); });
    document.querySelectorAll('[data-v3-consent-status]').forEach(function (p) { p.textContent = consent ? p.dataset.allowed : p.dataset.denied; });
  }
  function setConsent(allowed) {
    consent = allowed === true;
    try { window.localStorage.setItem(KEY, consent ? 'granted' : 'denied'); } catch (_) {}
    updateControls();
    if (consent) {
      startGA();
      // The GA script is already initialized after a previous allow/revoke cycle.
      if (gaReady && production()) window.gtag('consent', 'update', {analytics_storage: 'granted'});
      pageViews(); ratios.forEach(function (_, a) { start(a); });
    } else {
      timers.forEach(function (_, a) { stop(a); });
      if (gaReady && production()) window.gtag('consent', 'update', {analytics_storage: 'denied'});
    }
    return consent;
  }
  window.TS_V3_AFFILIATE = Object.freeze({
    setConsent: setConsent,
    hasConsent: function () { return consent; },
    trackFeature: function (feature, action) {
      if (!FEATURES.has(feature) || !ACTIONS.has(action)) return false;
      return send('v3_feature_use', {feature: feature, action: action});
    },
    trackLanding: function (action, section) {
      if(!document.querySelector('[data-v5-home]')||!LANDING_ACTIONS.has(action)||!LANDING_SECTIONS.has(section))return false;
      return send('landing_use',{ui_version:uiVersion(),action:action,section:section});
    }
  });
  document.addEventListener('click', function (event) {
    var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
    if (!target || !target.closest) return;
    if (target.closest('[data-v3-consent-allow]')) { setConsent(true); return; }
    if (target.closest('[data-v3-consent-deny]')) { setConsent(false); return; }
    if (target.closest('[data-bookmark-cta]')) {
      var hint = document.querySelector('[data-bookmark-hint]');
      if (hint) hint.hidden = false;
    }
    var anchor = target.closest('a[href]'), destination = kind(anchor);
    if (!destination) return;
    // One click has one semantic event; an outbound click is not a purchase.
    send(destination === 'external' ? 'lootbar_outbound_click' : destination === 'free' ? 'free_progress_open' : 'topup_guide_open', dimensions(anchor));
  });
  function scan(root) {
    var nodes = root.matches && root.matches('a[href]') ? [root].concat(Array.from(root.querySelectorAll('a[href]'))) : Array.from(root.querySelectorAll('a[href]'));
    nodes.forEach(function (anchor) {
      if (kind(anchor) && !observed.has(anchor)) { observed.add(anchor); observer.observe(anchor); }
    });
  }
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        ratios.set(entry.target, entry.intersectionRatio);
        if (entry.intersectionRatio >= 0.6) start(entry.target); else stop(entry.target);
      });
    }, {threshold: [0, 0.6, 1]});
    scan(document);
    if ('MutationObserver' in window) new MutationObserver(function (records) {
      records.forEach(function (record) { record.addedNodes.forEach(function (node) { if (node.nodeType === 1) scan(node); }); });
      ratios.forEach(function (_, anchor) { if (!anchor.isConnected) { stop(anchor); ratios.delete(anchor); observer.unobserve(anchor); } });
    }).observe(document.body, {childList: true, subtree: true});
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) timers.forEach(function (_, a) { stop(a); });
      else ratios.forEach(function (_, a) { start(a); });
    });
  }
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) setConsent(event.key === KEY && event.newValue === 'granted');
  });
  updateControls(); startGA(); pageViews();
})();
