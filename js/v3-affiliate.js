(function () {
  'use strict';
  if (!document.documentElement.hasAttribute('data-v3-affiliate') || window.TS_V3_AFFILIATE) return;
  var TEN = 'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive';
  var OLD_KEY = 'tiles.v3.analyticsConsent', OBJECTION_KEY = 'tiles.analytics.objection.v1';
  // Retire the old system without reading either historical decision.
  try { window.localStorage.removeItem(OLD_KEY); } catch (_) {}
  var GA_ID = 'G-Z2MJ6TXZHK', HISTORICAL_IDS = ['G-TMGDGSEWW6','G-Z2MJ6TZXHK'];
  var SCHEMA = window.TS_ANALYTICS_SCHEMA;
  if (!SCHEMA) return;
  var requestedIds = window.TS_V3_GA_IDS === undefined ? [GA_ID] : window.TS_V3_GA_IDS;
  var idsValid = Array.isArray(requestedIds) && requestedIds.length === 1 && requestedIds[0] === GA_ID;
  var LOCALES = new Set(SCHEMA.locales), FEATURES = new Set(SCHEMA.features), ACTIONS = new Set(SCHEMA.actions), PLACEMENTS = new Set(SCHEMA.placements);
  var TEN_PLACEMENTS = new Set(['banner','footer','guide','additional_coupon','bookmark']);
  var TEN_ACTIONS = new Set(['code_copy','url_copy','bookmark_help']);
  var gaReady = false, pageSent = false, guideSent = false, landingSent = false, objection = false;
  try { objection = window.localStorage.getItem(OBJECTION_KEY) === 'true'; } catch (_) { objection = true; }
  function uiVersion(){var home=document.querySelector('[data-v5-home]'),version=home&&home.getAttribute('data-ui-version');return ['v6','v6.1'].includes(version)?version:'v5';}
  function restricted() {
    var nav = window.navigator || {}, dnt = nav.doNotTrack || window.doNotTrack || nav.msDoNotTrack;
    var test = false;try { test = new URLSearchParams(location.search).get('analytics_test') === '1'; } catch (_) {}
    return objection || nav.globalPrivacyControl === true || dnt === '1' || dnt === 'yes' || nav.webdriver === true || test;
  }
  function enabled() { return production() && idsValid && !restricted() && !!pageMetadata(); }
  function syncGACollection() {
    window['ga-disable-' + GA_ID] = !enabled();
    HISTORICAL_IDS.forEach(function (id) { window['ga-disable-' + id] = true; });
  }
  // A publisher-controlled canonical path is used, never user query/hash data.
  function pageMetadata() {
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) return null;
    try { var url = new URL(link.href, location.origin);return url.origin === 'https://tilessurvive.net' ? SCHEMA.classify(url.pathname) : null; } catch (_) { return null; }
  }
  function pageType() { var meta=pageMetadata();return meta ? meta.page_type : 'content'; }
  function safePath() { var meta=pageMetadata();return meta ? meta.page : ''; }
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
    return Object.assign({}, pageMetadata(), {site_language: pageMetadata().language, source_category: sourceCategory(), measurement_version: 'global-1', campaign: 'lootbar_ten'});
  }
  function startGA() {
    syncGACollection();
    if (!enabled() || gaReady) return;
    try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    if (!window.TS_ANALYTICS_BOOTSTRAPPED) {
      window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      window.gtag('set','ads_data_redaction',true);window.gtag('set','url_passthrough',false);
      window.TS_ANALYTICS_BOOTSTRAPPED=true;
    }
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {send_page_view: false, page_location: 'https://tilessurvive.net' + safePath(), page_referrer: '', page_title: 'TilesSurvive.net | ' + pageType(), allow_google_signals: false, allow_ad_personalization_signals: false, ignore_referrer: true, campaign_id:'',campaign_name:'',campaign_source:'',campaign_medium:'',campaign_term:'',campaign_content:''});
    var script = document.createElement('script');script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    script.dataset.v3GaLoader = '';document.head.appendChild(script);gaReady = true;
    } catch (_) { gaReady = false; }
  }
  function send(name, extra) {
    if (SCHEMA.events.indexOf(name) === -1) return false;
    syncGACollection();
    if (!enabled() || !gaReady || typeof window.gtag !== 'function' || (name === 'page_view' && pageSent)) return false;
    var payload = Object.assign(base(), SCHEMA.dimensions(extra));
    payload.page_location = 'https://tilessurvive.net' + safePath();payload.page_referrer = '';
    payload.page_title = 'TilesSurvive.net | ' + pageType();payload.send_to = GA_ID;
    try { window.gtag('event', name, payload); } catch (_) { return false; }
    if (name === 'page_view') pageSent = true;
    return true;
  }
  function pageViews() {
    send('page_view');
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
    var tenPlacement=anchor.getAttribute('data-ten-placement');
    if(TEN_PLACEMENTS.has(tenPlacement)){result.ten_placement=tenPlacement;result.component=anchor.hasAttribute('data-ten-view')?'ten_banner':'ten_program';result.ui_version='v6.1';if(anchor.hasAttribute('data-ten-view'))result.destination_type='external';}
    return result;
  }
  var seen = new WeakSet(), observed = new WeakSet(), timers = new Map(), ratios = new Map(), observer,tenBannerSeen=false;
  function stop(anchor) { clearTimeout(timers.get(anchor)); timers.delete(anchor); }
  function start(anchor) {
    if (!enabled() || document.hidden || seen.has(anchor) || (anchor.hasAttribute('data-ten-view')&&tenBannerSeen) || timers.has(anchor) || (ratios.get(anchor) || 0) < 0.6) return;
    timers.set(anchor, setTimeout(function () {
      timers.delete(anchor);
      if (!enabled() || document.hidden || !anchor.isConnected || (ratios.get(anchor) || 0) < 0.6 || seen.has(anchor) || (anchor.hasAttribute('data-ten-view')&&tenBannerSeen)) return;
      if (send('affiliate_viewable', dimensions(anchor))) {
        if(anchor.hasAttribute('data-ten-view'))tenBannerSeen=true;
        seen.add(anchor); ratios.delete(anchor); observer.unobserve(anchor);
      }
    }, 1000));
  }
  function updateControls() {
    document.querySelectorAll('[data-analytics-status]').forEach(function (p) { p.textContent = enabled() ? p.dataset.active : p.dataset.stopped; });
    document.querySelectorAll('[data-analytics-stop]').forEach(function (button) { button.setAttribute('aria-pressed',String(objection)); });
    document.querySelectorAll('[data-analytics-resume]').forEach(function (button) { button.setAttribute('aria-pressed',String(!objection)); });
  }
  function applyPreference() {
    syncGACollection();updateControls();
    if (enabled()) {startGA();pageViews();ratios.forEach(function (_, a) {start(a);});}
    else timers.forEach(function (_, a) {stop(a);});
    return enabled();
  }
  function stopAnalytics() {objection=true;try {window.localStorage.setItem(OBJECTION_KEY,'true');} catch (_) {}applyPreference();return true;}
  function resumeAnalytics() {objection=false;try {window.localStorage.removeItem(OBJECTION_KEY);} catch (_) {}return applyPreference();}
  window.TS_ANALYTICS = Object.freeze({track:send,isEnabled:enabled,stop:stopAnalytics,resume:resumeAnalytics});
  window.TS_V3_AFFILIATE = Object.freeze({
    trackFeature: function (feature, action) {
      if (!FEATURES.has(feature) || !ACTIONS.has(action)) return false;
      return send('v3_feature_use', {feature: feature, action: action});
    },
    trackLanding: function (action, section) {
      if(!document.querySelector('[data-v5-home]')||!ACTIONS.has(action)||SCHEMA.dimensions({section:section}).section!==section)return false;
      return send('landing_use',{ui_version:uiVersion(),action:action,section:section});
    },
    trackCoupon: function () { return send('coupon_copy',{feature:'coupon',action:'copy'}); },
    trackTen: function (action, placement) {
      if(!TEN_ACTIONS.has(action)||!TEN_PLACEMENTS.has(placement)||!document.querySelector('[data-v61-ten]'))return false;
      return send('ten_program_use',{ui_version:'v6.1',component:'ten_program',action:action,ten_placement:placement});
    }
  });
  document.addEventListener('click', function (event) {
    var target = event.target && (event.target.nodeType === 1 ? event.target : event.target.parentElement);
    if (!target || !target.closest) return;
    if (target.closest('[data-analytics-stop]')) { stopAnalytics(); return; }
    if (target.closest('[data-analytics-resume]')) { resumeAnalytics(); return; }
    if (target.closest('[data-bookmark-cta]:not([data-ten-bookmark])')) {
      var hint = document.querySelector('[data-bookmark-hint]');
      if (hint) hint.hidden = false;
    }
    var anchor = target.closest('a[href]'), destination = kind(anchor);
    if (!destination) return;
    // One click has one semantic event; an outbound click is not a purchase.
    send(destination === 'external' ? 'lootbar_outbound_click' : destination === 'free' ? 'free_progress_open' : 'topup_guide_open', dimensions(anchor));
  });
  function scan(root) {
    var selector='a[href],[data-ten-view]',nodes = root.matches && root.matches(selector) ? [root].concat(Array.from(root.querySelectorAll(selector))) : Array.from(root.querySelectorAll(selector));
    nodes.forEach(function (anchor) {
      var banner=anchor.matches('[data-v61-ten="banner"][data-ten-view][data-ten-placement="banner"]');
      if ((banner||(kind(anchor)&&!anchor.closest('[data-ten-view]'))) && !observed.has(anchor)) { observed.add(anchor); observer.observe(anchor); }
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
    if (event.key === OLD_KEY) {try {window.localStorage.removeItem(OLD_KEY);} catch (_) {}return;}
    if (event.key === OBJECTION_KEY) {objection=event.newValue === 'true';applyPreference();}
    else if (event.key === null) {objection=false;applyPreference();}
  });
  applyPreference();
})();
