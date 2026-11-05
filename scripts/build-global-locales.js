'use strict';
// New locales are staged outside the deployable tree until every route passes.
// Numeric source models and upstream client files are read-only. Existing display
// corrections require an exact route, skill slot and retained-client evidence.
const fs = require('node:fs');
const path = require('node:path');
const { parseHTML } = require('linkedom');
const L = require('./lib/global-localization');
const Nuclear = require('./build-nuclear-age');
const DELIVERY = path.resolve(L.ROOT, '../global-language-delivery-20261104');
const STAGE = path.join(DELIVERY, 'staging');
const attrs = ['alt','title','aria-label','placeholder','data-idle','data-results','data-error','data-search-title','data-search-description'];
const metaKeys = new Set(['description','og:title','og:description','twitter:title','twitter:description']);
function contextualTranslator(locale, group, translator) {
  // Legacy labels can refer to different skills on different hero pages.
  // Existing languages use the narrower DOM repair in enhance below.
  if (L.existing.has(locale)) return translator.translate;
  const groupId=group.id || group.routes?.en?.replace(/^\/en\//,'');
  const entries=L.readJSON(path.join(L.ROOT,'data/i18n/contextual-terms.json'),{entries:[]}).entries.filter(entry=>entry.groupId===groupId);
  const overrides=new Map();
  for(const entry of entries)for(const row of entry.exact) {
    const value=row.translations[locale];
    if(typeof value!=='string'||!value.trim())throw Error('Missing contextual term '+locale+':'+entry.id);
    if(JSON.stringify(L.numberSignature(row.source))!==JSON.stringify(L.numberSignature(value)) || JSON.stringify(L.placeholders(row.source))!==JSON.stringify(L.placeholders(value)))throw Error('Invalid contextual term '+locale+':'+entry.id);
    overrides.set(L.clean(row.source),{value,provenance:entry.names[locale].provenance});
    // Corrected EN source pages must be valid inputs to every later build.
    // The historical external quotation keeps its original source sentence.
    if(row.source===entry.sourceAlias||row.source.startsWith(entry.sourceAlias+' · '))overrides.set(L.clean(row.source.replaceAll(entry.sourceAlias,entry.officialEnglishName)),{value,provenance:entry.names[locale].provenance});
  }
  return (raw,context='')=>{
    const override=typeof raw==='string'&&overrides.get(L.clean(raw));
    if(!override)return translator.translate(raw,context);
    translator.used.set(L.clean(raw),'contextual-'+override.provenance);
    return raw.replace(raw.trim(),override.value);
  };
}
function repairContextualHeroNames(document,locale,group) {
  const groupId=group.id || group.routes?.en?.replace(/^\/en\//,'');
  if(!L.existing.has(locale)||groupId!=='heroes/undine/')return [];
  const entry=L.readJSON(path.join(L.ROOT,'data/i18n/contextual-terms.json')).entries.find(row=>row.id==='undine-skill-2');
  const name=entry.names[locale];
  if(name?.provenance!=='retained-client'||!name.value)throw Error('Missing verified Undine name: '+locale);
  const allowed=new Set([entry.existingDisplayNames[locale],name.value]);
  const targets=[
    'button[data-skill-target="character-skill-0-2"]',
    'details.ts-skill#character-skill-0-2 summary'
  ].map(selector=>{
    const nodes=[...document.querySelectorAll(selector)];
    if(nodes.length!==1||!nodes[0].querySelector('img[data-game-40-icon="skill:undine-3"]'))throw Error('Unexpected Undine skill slot: '+locale);
    const label=nodes[0].querySelector('span');
    if(!label||!allowed.has(label.textContent))throw Error('Unreviewed Undine skill label: '+locale);
    return {label,selector};
  });
  const script=document.getElementById('hero-skill-levels-data');
  if(!script)throw Error('Missing Undine comparison model: '+locale);
  const model=JSON.parse(script.textContent),skills=model.hero?.skills?.filter(row=>row.id==='undine-wild-hunt-10-11');
  if(skills?.length!==1)throw Error('Unexpected Undine comparison skill: '+locale);
  const skill=skills[0],before=skill.name?.[locale],parts=typeof before==='string'&&before.match(/^(.*?)(\s*[·・][\s\S]*)$/);
  if(!parts||!allowed.has(parts[1].trim()))throw Error('Unreviewed Undine comparison label: '+locale);
  // Validate every target first, then touch only the two display labels and the
  // current locale's name prefix. IDs, units, levels, other locales and the
  // historical external-reference paragraph are intentionally untouched.
  const changes=[];
  for(const {label,selector}of targets)if(label.textContent!==name.value){changes.push({selector,before:label.textContent,after:name.value});label.textContent=name.value;}
  const after=name.value+parts[2];
  if(before!==after){skill.name[locale]=after;script.textContent=JSON.stringify(model).replace(/</g,'\\u003c');changes.push({selector:'hero-skill-levels-data:undine-wild-hunt-10-11:name.'+locale,before,after});}
  return changes;
}
function featureSources() {
  const workbench=require('../js/data-workbench-30'),speedup=require('../js/tools-speedup-calculator'),events=require('../js/event-helper');
  return {dataWorkbench:workbench.copy.en,speedup:speedup.UI.en,eventHelper:{ui:events.UI.en,dayLabels:events.DAY_LABELS.en}};
}
function translateFeature(value,translate,context,units={},key='') {
  if(Array.isArray(value))return value.map((x,i)=>translateFeature(x,translate,context+'.'+i,units,key));
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,translateFeature(v,translate,context+'.'+k,units,k)]));
  if(typeof value!=='string')return value;
  if(['d','h','m','s'].includes(key) && units[key])return units[key];
  return translate(value,context);
}
function featurePayloads(document,locale,translate,groups,catalog) {
  const features={}, sources=featureSources();
  const uses=name=>!!document.querySelector('script[src^="/js/'+name+'.js"]');
  if(uses('data-workbench-30'))features.dataWorkbench=translateFeature(sources.dataWorkbench,translate,'runtime:dataWorkbench',catalog.units);
  if(uses('tools-speedup-calculator')||document.querySelector('[data-speedup-calculator-page]'))features.speedup=translateFeature(sources.speedup,translate,'runtime:speedup',catalog.units);
  if(uses('event-helper')||document.querySelector('[data-event-helper-page]')) {
    features.eventHelper=translateFeature(sources.eventHelper,translate,'runtime:eventHelper',catalog.units);
    for(const kind of ['events','calculators']) {
      const input=require('../data/event-helper-'+kind+'.json');
      L.jsonScript(document,'event-helper-'+kind+'-data',L.localizeJSON(input,locale,translate,groups,'data:event-helper-'+kind));
    }
  }
  return features;
}
function catalogFor(locale) {
  const catalog = L.readJSON(path.join(L.ROOT,'data/i18n/messages',locale+'.json'), { exact:{},templates:[],allowUnchanged:[] });
  // Power Plant prose has one maintained locale owner alongside its unified data.
  const powerCopy=require('../data/power-plant-unified-copy.json');
  if(powerCopy[locale])for(const [key,source] of Object.entries(powerCopy.en))catalog.exact[source]=powerCopy[locale][key];
  const official = {};
  const terms = require('../data/i18n/client-terms.json').terms;
  const ambiguous = new Set();
  for (const values of Object.values(terms)) if (values.en && values[locale]) {
    const source=L.clean(values.en), target=L.clean(values[locale]);
    if (official[source] && official[source]!==target) ambiguous.add(source);
    else official[source]=target;
  }
  for (const source of ambiguous) delete official[source];
  const extra=L.readJSON(path.join(L.ROOT,'data/i18n/official-message-catalog.json'),{});
  for (const entry of Object.values(extra.messages||{})) if (entry.translations?.[locale]) official[entry.source]=entry.translations[locale];
  const ui=L.readJSON(path.join(L.ROOT,'data/i18n/ui',locale+'.json'),null);
  const english=L.readJSON(path.join(L.ROOT,'data/i18n/ui/en.json'),null);
  if (ui && english) {
    for (const [key, source] of Object.entries(english.copy)) if (typeof ui.copy[key]==='string') {
      catalog.exact[source] ??= ui.copy[key];
      if(source===ui.copy[key]) {catalog.allowUnchanged??=[];catalog.allowUnchanged.push(source);}
    }
    english.affiliate.forEach((source,i)=>{if(ui.affiliate[i])catalog.exact[source]??=ui.affiliate[i];});
    // The web navigation menu is not the client's kitchen/food-menu item.
    catalog.exact[english.copy.menu]=ui.copy.menu;
  }
  const structural=L.readJSON(path.join(L.ROOT,'data/i18n/structural-copy.json'),{locales:{}}).locales[locale]||{};
  return {...catalog, phrases:{...structural.phrases,...catalog.phrases},units:{...structural.units,...catalog.units},official};
}
function inlineProgram(code, locale, translate, context) {
  // Coupon pages own their runtime strings inline. Only known presentation
  // tables and labels are rewritten; timers, coupon IDs and GA/AdSense stay intact.
  if (code.includes('const LANG_DATA')) {
    code=code.replace(/(const LANG_DATA = \{)([\s\S]*?)(\n    \};)/,(_,a,body,z)=>a+body.replace(/(\b[A-Za-z]\w*\s*:\s*)("(?:[^"\\]|\\.)*")/g,(_,key,v)=>key+JSON.stringify(translate(JSON.parse(v),context+':LANG_DATA'))).replace(/\ben: \{/,'"'+locale+'": {')+z);
    code=code.replaceAll('LANG_DATA.en','LANG_DATA['+JSON.stringify(locale)+']').replace('applyLanguage("en")','applyLanguage('+JSON.stringify(locale)+')');
  }
  if (code.includes('const CODE_LABELS')) {
    code=code.replace(/(const CODE_LABELS = \{)([\s\S]*?)(\n    \};)/,(_,a,body,z)=>a+body.replace(/(\b[A-Za-z]\w*\s*:\s*)("(?:[^"\\]|\\.)*")/g,(_,key,v)=>key+JSON.stringify(translate(JSON.parse(v),context+':CODE_LABELS')))+z);
    for (const value of ['Active Codes + Permanent Codes + Next Expiry Countdown','Currently Active Codes (','There are currently no limited-time codes, and the latest limited-time code was ','There are currently no active codes.','Link copied','Failed to load code data.']) {
      code=code.replaceAll(JSON.stringify(value),JSON.stringify(translate(value,context+':coupons')));
    }
    code=code.replace('Intl.DateTimeFormat("en-US"','Intl.DateTimeFormat('+JSON.stringify(L.byCode.get(locale).numberLocale));
  }
  return code;
}
function unifiedPowerPlantOwner(document, group) {
  const route=group.id || group.routes?.en?.replace(/^\/en\//,'');
  if(route!=='buildings/power-plant/')return null;
  const host=document.querySelector('[data-building-system="power-plant"]');
  const script=host?.querySelector('[data-building-system-model]');
  if(!script)return null;
  const cfg=JSON.parse(script.textContent);
  if(cfg.slug!=='power-plant'||cfg.buildings?.length!==1||cfg.buildings[0].id!==800005||cfg.buildings[0].profiles?.length!==1||cfg.buildings[0].profiles[0].id!=='unified')return null;
  // These captions, examples and totals are renderer-owned combinations of the
  // translated model labels. Recompose them instead of cataloguing each numeric
  // combination. Refuse unexpected authored content rather than dropping it.
  const renderer=require('./build-building-system').sheetFromConfig;
  const before=host.cloneNode(true),anchors=[...before.querySelectorAll('[data-bs-legacy-anchor]')];
  for(const anchor of anchors)anchor.remove();
  const expected=parseHTML(renderer(cfg)).document.querySelector('[data-building-system]');
  if(before.outerHTML!==expected.outerHTML)throw Error('Unexpected content in unified Power Plant renderer owner: '+group.file);
  return {host,script,renderer,anchors};
}
function localizePage(source, locale, group, groups, translator) {
  source=require('./build-v6-system').strip(source);
  const nuclearGuide=group.id==='eras/nuclear-age/';
  if(nuclearGuide)Nuclear.validateOwnership(source,'en',group.routes.en);
  // Validate English cards before removing them. The V4 owner validates native
  // cards, so these must not survive into generic translation or target V4.
  // Registered pages require the card. Small translation-only fragments lack
  // a route-group ID, but any explicit Nuclear block must still be validated.
  if(Nuclear.linkRoutes('en').includes(group.routes.en)&&(group.id||/TS_NUCLEAR_LINK_|data-nuclear-owned=["']link/.test(source))){
    Nuclear.validateLinks(source,'en',group.routes.en);source=Nuclear.stripLinks(source);
  }
  if(source.includes('data-v5-home'))require('./build-v5-landing').validateOwnership(source,'en');
  if(group.id==='codes/'&&source.includes('data-gift-owned'))require('./build-gift-codes').validateOwnership(source,'en');
  require('./build-hero-pet-pages').validateOwnership(source,'en');
  require('./v4-workbench-content').validateOwnership(source,'en',group.routes.en);
  if(source.includes('data-hero-atlas-owned'))require('./build-hero-atlas').validateOwnership(source,'en',group.routes.en);
  if(source.includes('data-v3-platform'))require('./build-v3-platform').validateOwnership(source,'en',group.routes.en);
  const {document}=parseHTML(source), info=L.byCode.get(locale), t=contextualTranslator(locale,group,translator);
  const powerOwner=unifiedPowerPlantOwner(document,group);
  // These inherited top-up links remain in place when the TEN owner is
  // regenerated. Validate the English owner above, then localize only their
  // route and the retained affiliate-policy link label. Benefit prose stays
  // excluded from generic translation and is restored by the locale owner.
  if(group.id==='top-up/'&&document.documentElement.hasAttribute('data-v3-platform')){
    for(const link of document.querySelectorAll('a[data-v3-owned="topup-bookmark-link"],p[data-v3-owned="topup-policy-disclosure"] a')){
      link.setAttribute('href',L.routeURL(link.getAttribute('href'),locale,groups));
      if(link.closest('[data-v3-owned="topup-policy-disclosure"]'))link.textContent=t(link.textContent,group.file+':ten-inherited-policy-link');
    }
  }
  document.documentElement.setAttribute('lang',info.htmlLang);
  document.documentElement.setAttribute('data-lang',locale);
  document.documentElement.setAttribute('dir',info.dir);
  const walker=document.createTreeWalker(document,4); const nodes=[]; let node;
  while((node=walker.nextNode())) if(!node.parentElement?.closest('script,style,template,.ts3-language nav,.language-switcher,[data-v3-owned],[data-hero-atlas-owned],[data-hero-pet-owned],[data-v4-owned],[data-v5-owned],[data-gift-owned],[data-nuclear-owned]') && !(nuclearGuide&&node.parentElement?.tagName==='TITLE') && !powerOwner?.host.contains(node)) nodes.push(node);
  for (const n of nodes) n.data=t(n.data,group.file+':text:'+n.parentElement?.tagName);
  for (const el of document.querySelectorAll('*')) {
    if(el.closest('[data-v3-owned],[data-hero-atlas-owned],[data-hero-pet-owned],[data-v4-owned],[data-v5-owned],[data-gift-owned],[data-nuclear-owned]'))continue;
    if(powerOwner?.host.contains(el))continue;
    if(el.getAttribute('data-lang')==='en')el.setAttribute('data-lang',locale);
    for (const attr of attrs) if(el.hasAttribute(attr))el.setAttribute(attr,t(el.getAttribute(attr),group.file+':'+attr));
    for (const attr of ['href','action','data-search-url']) if(el.hasAttribute(attr) && !el.matches('link[rel="alternate"],a[hreflang],.ts3-language a[lang]'))el.setAttribute(attr,L.routeURL(el.getAttribute(attr),locale,groups));
    if(el.tagName==='META') {
      const key=el.getAttribute('name')||el.getAttribute('property');
      // The source owner already proved this route's exact metadata. Rebuild it
      // from native Nuclear copy later, without weakening catalog checks elsewhere.
      if(metaKeys.has(key)&&!nuclearGuide)el.setAttribute('content',t(el.getAttribute('content')||'',group.file+':meta'));
      if(['og:url','twitter:url'].includes(key))el.setAttribute('content',L.routeURL(el.content,locale,groups));
      if(key==='og:locale')el.setAttribute('content',info.numberLocale.replace('-','_'));
    }
  }
  for(const script of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
    if(script.closest('[data-v3-owned],[data-hero-atlas-owned],[data-hero-pet-owned],[data-v4-owned],[data-v5-owned],[data-gift-owned],[data-nuclear-owned]'))continue;
    const value=JSON.parse(script.textContent);
    const translated=L.localizeJSON(value,locale,t,groups,group.file+':'+(script.id||'json'),'',/^(?:ts3|event-calendar)-copy$/.test(script.id));
    // Building calculators read this display configuration at runtime. Keep
    // model enums (for example unit: 'day') intact and localize only this schema.
    if(script.hasAttribute('data-building-system-model') && translated.locale?.units) {
      const units=catalogFor(locale).units;
      translated.locale.numberLocale=info.numberLocale;
      translated.locale.units.duration=['d','h','m','s'].map(key=>units[key]||key);
      translated.locale.units.seconds=' '+(units.s||'s');
    }
    if(script.id==='research-phase3-data')for(const row of translated.groups||[])row.search=(row.search+' '+row.name).normalize('NFKC').toLocaleLowerCase();
    script.textContent=JSON.stringify(translated).replace(/</g,'\\u003c');
  }
  if(powerOwner) {
    const cfg=JSON.parse(powerOwner.script.textContent);
    cfg.copy.sample=cfg.locale.labels.levelPrefix+'2';
    const replacement=parseHTML(powerOwner.renderer(cfg)).document.querySelector('[data-building-system]');
    for(const anchor of [...powerOwner.anchors].reverse())if(!replacement.querySelector('[id="'+anchor.id+'"]'))replacement.prepend(anchor);
    powerOwner.host.replaceWith(replacement);
  }
  for(const script of document.querySelectorAll('script:not([src])')) if(!script.type?.includes('json')&&!script.closest('[data-v3-owned],[data-hero-atlas-owned],[data-hero-pet-owned],[data-v4-owned],[data-v5-owned],[data-gift-owned],[data-nuclear-owned]'))script.textContent=inlineProgram(script.textContent,locale,t,group.file);
  const canonical=document.querySelector('link[rel="canonical"]');
  if(canonical)canonical.href=L.publicOrigin+group.routes[locale];
  return document;
}
function enhance(document, locale, group, available, ui, {preview=false}={}) {
  // The shared runtime is inserted before the first deferred script. Remove
  // V6's two owned asset tags first so that insertion can never land inside
  // the V6 marker block and be removed by its final projection below.
  for(const asset of document.querySelectorAll('[data-v6-owned="system-assets"]'))asset.remove();
  repairContextualHeroNames(document,locale,group);
  const retired={
    'heroes/legend-gear-star/':'database/legend-gear-star/',
    'seasons/season-1-wave-of-fury/':'seasons/season-1/',
    'seasons/season-2-awakening-of-manryong/':'seasons/season-2/',
    'seasons/season-3-undecided/':'seasons/season-3/'
  };
  const repairReference=value=>{
    if(Array.isArray(value))return value.map(repairReference);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,repairReference(v)]));
    if(value===L.publicOrigin+'/img/buildings/comms-outpost-cover.webp')return L.publicOrigin+'/img/buildings/comms-outpost.webp';
    if(typeof value==='string'&&value.startsWith(L.publicOrigin+'/')) {
      const u=new URL(value),parts=u.pathname.slice(1).split('/'),code=parts.shift();
      const destination=retired[parts.join('/')];
      if(L.byCode.has(code)&&destination&&destination===group.id)return L.publicOrigin+group.routes[locale]+u.search+u.hash;
    }
    return value;
  };
  for(const schema of document.querySelectorAll('script[type="application/ld+json"]'))schema.textContent=JSON.stringify(repairReference(JSON.parse(schema.textContent))).replace(/</g,'\\u003c');
  // Catalog links and existing bookmarks use this older building-table fragment.
  // New building sheets replaced those tables; retain their navigation target.
  const sheet=document.querySelector('[data-building-system] #upgrade-sheet');
  if(sheet&&!document.getElementById('ts3-data-table-0')) {
    const anchor=document.createElement('span');anchor.id='ts3-data-table-0';anchor.setAttribute('data-bs-legacy-anchor','');anchor.setAttribute('aria-hidden','true');sheet.before(anchor);
  }
  for(const el of document.querySelectorAll('link[rel="alternate"][hreflang]'))el.remove();
  const routes={};
  for(const code of available) if(group.routes[code]) {
    routes[code]=group.routes[code];
    const link=document.createElement('link');link.rel='alternate';link.hreflang=L.byCode.get(code).hreflang;link.href=L.publicOrigin+routes[code];document.head.append(link);
  }
  const fallback=document.createElement('link');fallback.rel='alternate';fallback.hreflang='x-default';fallback.href=L.publicOrigin+(group.routes.en==='/en/'?'/':group.routes.en);document.head.append(fallback);
  L.jsonScript(document,'ts-locale-routes',routes);
  const languageNav=document.querySelector('.ts3-language nav');
  if(languageNav) {
    languageNav.replaceChildren();
    for(const [code,route] of Object.entries(routes)) {
      const item=L.byCode.get(code),a=document.createElement('a');a.href=route;a.lang=item.htmlLang;a.setAttribute('hreflang',item.hreflang);a.textContent=item.nativeName;
      if(code===locale)a.setAttribute('aria-current','page');languageNav.append(a);
    }
    const summary=document.querySelector('.ts3-language summary');if(summary)summary.textContent=locale.toUpperCase();
  }
  if(ui) {
    // Existing feature payloads survive metadata-only rebuilding.
    let features={};const payload=document.getElementById('ts-global-ui');
    if(payload)features=JSON.parse(payload.textContent).featureCopies||{};
    L.jsonScript(document,'ts-global-ui',{locale,copy:ui.copy,affiliate:ui.affiliate,featureCopies:{...features,...ui.featureCopies}});
  }
  const old=document.querySelector('script[src^="/js/site-locales.js"]');if(old)old.remove();
  const runtime=document.createElement('script');runtime.src='/js/site-locales.js?v='+L.digest(fs.readFileSync(path.join(L.ROOT,'js/site-locales.js'))).slice(0,12);runtime.defer=true;
  const first=document.head.querySelector('script[src][defer]');if(first)first.before(runtime);else document.head.append(runtime);
  // A head-deferred calculator runs before bottom-deferred scripts. Its locale
  // dictionary must therefore precede it, even on the very first render.
  let i18n=document.querySelector('script[src^="/js/platform-i18n.js"]');
  if(!i18n){i18n=document.createElement('script');i18n.src='/js/platform-i18n.js';}
  i18n.defer=true;runtime.after(i18n);
  for(const script of document.querySelectorAll('script[src^="/js/"]')) {
    const pathname=script.src.split('?')[0], file=path.join(L.ROOT,pathname.slice(1));
    if(fs.existsSync(file))script.src=pathname+'?v='+L.digest(fs.readFileSync(file)).slice(0,12);
  }
  if(!document.querySelector('link[href="/css/global-locales.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/css/global-locales.css';document.head.append(css);}
  if(preview) {
    // V3 intentionally skips public enhancement on noindex pages. Staging still
    // needs its reviewed content owners, so apply preview indexing protection
    // after projection; an inherited preview flag must not erase those blocks.
    document.querySelector('meta[name="robots"]')?.remove();
    document.documentElement.dataset.translationStatus='preview-unpublished';
  }
  // Canonicalize managed alternate-link placement after newly added runtime
  // metadata as well. A fresh page and its subsequent rebuild then serialize
  // identically without changing a URL, hreflang or executable script order.
  for(const alternate of document.querySelectorAll('link[rel="alternate"][hreflang]'))document.head.append(alternate);
  const serialized='<!doctype html>\n'+document.documentElement.outerHTML+'\n';
  let projected=document.documentElement.hasAttribute('data-v3-platform')?require('./build-v3-platform').project(serialized,locale,group.routes[locale]):serialized;
  if(document.querySelector('main')&&/^\/[^/]+\/heroes\//.test(group.routes[locale])){
    const atlas=require('./build-hero-atlas');
    if(atlas.isOwnedRoute(group.routes[locale]))projected=atlas.project(projected,locale,group.routes[locale]);
  }
  if(/^\/[^/]+\/database\/pet-system\//.test(group.routes[locale]))projected=require('./build-hero-pet-pages').project(projected,locale);
  projected=require('./v4-workbench-content').project(projected,locale,group.routes[locale]);
  if(group.id===''&&document.querySelector('[data-v5-home]'))projected=require('./build-v5-landing').project(projected,locale);
  if(group.id==='codes/')projected=require('./build-gift-codes').project(projected,locale);
  if(group.id==='eras/nuclear-age/')projected=Nuclear.project(projected,locale,group.routes[locale]);
  if(Nuclear.linkRoutes(locale).includes(group.routes[locale]))projected=Nuclear.projectLinks(projected,locale,group.routes[locale]);
  if(preview){const staged=parseHTML(projected).document;let robots=staged.querySelector('meta[name="robots"]');if(!robots){robots=staged.createElement('meta');robots.name='robots';staged.head.append(robots);}robots.content='noindex,nofollow';projected='<!doctype html>\n'+staged.documentElement.outerHTML+'\n';}
  // Older feature owners append their assets. Finalize presentation last so
  // every supported route, including a newly localized page, has one fresh V6
  // bundle after the retained feature styles. This never rewrites page data.
  return require('./build-v6-system').project(projected,locale,group.routes[locale]);
}
function build({locales,stage=STAGE,publish=false}={}) {
  const groups=L.routeGroups(), targets=locales||L.registry.locales.filter(x=>!L.existing.has(x.code)).map(x=>x.code);
  const outputs=[],report={schemaVersion:1,mode:publish?'publish':'private-preview',pagesPerLocale:groups.length,locales:{}};
  for(const locale of targets) {
    if(L.existing.has(locale))throw new Error('Existing language content must not be retranslated: '+locale);
    const catalog=catalogFor(locale),translator=L.createTranslator(locale,catalog);
    const ui=L.readJSON(path.join(L.ROOT,'data/i18n/ui',locale+'.json'),null);
    const local=[],sources=[];
    for(const group of groups) {
      const before=translator.missing.size;
      const source=fs.readFileSync(path.join(L.ROOT,group.file),'utf8');
      sources.push({path:group.file,sha256:L.digest(source)});
      const doc=localizePage(source,locale,group,groups,translator);
      const features=featurePayloads(doc,locale,translator.translate,groups,catalog);
      local.push({path:group.routes[locale].slice(1)+'index.html',body:enhance(doc,locale,group,targets.concat([...L.existing]),ui?{...ui,featureCopies:{...features,...ui.featureCopies}}:null,{preview:!publish}),newMissing:translator.missing.size-before});
    }
    report.locales[locale]={pages:local.length,uiComplete:!!ui,missingMessages:translator.missing.size,errors:translator.errors.length,usedMessages:translator.used.size,
      missing:[...translator.missing].map(([source,contexts])=>({source,contexts})),validationErrors:translator.errors,sources,
      outputs:local.map(x=>({path:x.path,sha256:L.digest(x.body)}))};
    outputs.push(...local);
  }
  const valid=Object.values(report.locales).every(x=>x.uiComplete && !x.missingMessages && !x.errors);
  report.valid=valid;
  fs.mkdirSync(DELIVERY,{recursive:true});fs.writeFileSync(path.join(DELIVERY,'translation-build-report.json'),JSON.stringify(report,null,2));
  for(const [code,result] of Object.entries(report.locales))L.safeWrite(path.join(DELIVERY,'translation-build-'+code+'.json'),JSON.stringify({locale:code,mode:report.mode,...result},null,2)+'\n');
  if(publish && !valid)throw new Error('Publication blocked: incomplete or inconsistent translations; see private translation-build-report.json');
  // Transactional gate: no deployable page is written before all targets pass.
  for(const output of outputs)L.safeWrite(path.join(publish?L.ROOT:stage,output.path),output.body);
  console.log(JSON.stringify({mode:report.mode,valid,pages:outputs.length,locales:Object.fromEntries(Object.entries(report.locales).map(([k,v])=>[k,{pages:v.pages,missing:v.missingMessages,errors:v.errors}]))}));
  return report;
}
module.exports={catalogFor,contextualTranslator,repairContextualHeroNames,featureSources,featurePayloads,translateFeature,inlineProgram,localizePage,enhance,build};
if(require.main===module){const arg=process.argv.find(x=>x.startsWith('--locales='));build({locales:arg?arg.slice(10).split(','):undefined,publish:process.argv.includes('--publish')});}
