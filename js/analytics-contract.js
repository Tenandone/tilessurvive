(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TS_ANALYTICS_SCHEMA = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  var locales = ['en','ko','ja','zh-tw','de','ru','zh-cn','ar','nl','fr','id','it','pl','pt','es','sv','th','tr','vi','ms','nb'];
  var events = ['page_view','topup_guide_view','landing_view','v3_feature_use','landing_use','ten_program_use','affiliate_viewable','lootbar_outbound_click','free_progress_open','topup_guide_open','calculator_run','planner_use','coupon_copy','content_action'];
  var features = ['calculator','power_plant','calendar','search','home','tools','topup','content','nuclear_fuel','building_growth','formation','vs','growth','hero_growth','pet_growth','speedup','event_planner','coupon','hero_catalog'];
  var actions = ['result','save','restore','clear','select','open','change','view','copy','previous','next','share','code_copy','url_copy','bookmark_help'];
  var placements = ['guide','result','header','footer','banner','content','landing_top','landing_bottom','additional_coupon','bookmark','calculator','planner','catalog','home'];
  var sections = ['dashboard','missions','duel','scores','guides','codes','heroes','pets','factions','glossary','simulators','tools','events','news','topup','common_event','event_official','event_guide','event_rules','event_schedule','planner','bookmark','score_preview','score_planner','coupon'];
  var fields = {
    feature: features, action: actions, placement: placements, ten_placement: placements,
    section: sections, ui_version: ['v5','v6','v6.1'], component: ['ten_banner','ten_program'],
    destination_type: ['external','internal','free'], creative_type: ['banner','text_link']
  };
  // No arbitrary values, URL, input, coupon text, search term or identifier can
  // enter a custom event through this interface.
  function dimensions(input) {
    var out = {};
    Object.keys(fields).forEach(function (key) {
      if (input && fields[key].indexOf(input[key]) !== -1) out[key] = input[key];
    });
    return out;
  }
  function classify(path) {
    if (typeof path !== 'string' || path.length > 220 || !/^\/(?:[a-z0-9-]+\/)*(?:index\.html)?$/.test(path)) return null;
    var parts = path.split('/'), language = parts[1];
    if (locales.indexOf(language) === -1) return null;
    var p = path.slice(language.length + 1).replace(/index\.html$/, '');
    var type = 'content', content = '';
    if (p === '/') type = 'home';
    else if (/^\/eras\/nuclear-age\//.test(p)) { type = 'nuclear_guide'; content = 'nuclear-age'; }
    else if (/^\/heroes\/[^/]+\/$/.test(p)) { type = 'hero_detail'; content = p.split('/')[2]; }
    else if (/^\/database\/pet-system\/[^/]+\/$/.test(p)) { type = 'pet_detail'; content = p.split('/')[3]; }
    else if (/^\/buildings\/[^/]+\//.test(p)) { type = 'building_detail'; content = p.split('/')[2]; }
    else if (/^\/top-up\//.test(p)) type = 'topup';
    else if (/^\/search\//.test(p)) type = 'search';
    else if (/^\/tools\//.test(p)) { type = 'tool'; content = p.split('/')[2] || 'tools'; }
    else if (/^\/codes\//.test(p)) type = 'coupon';
    else if (/^\/events\//.test(p)) type = 'event';
    else if (/^\/guides\//.test(p)) type = 'guide';
    else if (/research/.test(p)) type = 'research';
    else if (/^\/database\//.test(p)) type = 'database';
    return {page: path, language: language, page_type: type, content_id: content};
  }
  return Object.freeze({locales: Object.freeze(locales), events: Object.freeze(events), features: Object.freeze(features), actions: Object.freeze(actions), placements: Object.freeze(placements), dimensions: dimensions, classify: classify});
});
