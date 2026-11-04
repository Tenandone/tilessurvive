'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseHTML } = require('linkedom');
const ROOT = path.resolve(__dirname, '../..');
const registry = require('../../data/i18n/locales.json');
const byCode = new Map(registry.locales.map(x => [x.code, x]));
const existing = new Set(['en', 'ko', 'ja', 'zh-tw', 'de', 'ru']);
const clean = value => String(value).replace(/\s+/gu, ' ').trim();
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const readJSON = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const publicOrigin = 'https://tilessurvive.net';
const contentKeys = new Set(['name','title','description','headline','text','caption','alt','label','unit','invalid','missing','total','shortage','updated','scope','note','summary','condition','labelText','body','question','answer','activities','rewards']);
const contentContainers = new Set(['copy','labels','messages','descriptionTemplate','names']);
const nonDisplay = new Set(['id','type','kind','unitType','category','currency','conditionCode','status','source','version','gameVersion','schemaVersion','target','href','url','src','slug','route','language','inLanguage','@type','@context','@id','internalId','skillId','role','position','image','code','key','icon','asset']);
const invariant = value => {
  const s = clean(value);
  return !s || !/[A-Za-z]/u.test(s) || (/^(?:https?:\/\/|mailto:)/u.test(s) || /^[/#][^\s]+$/u.test(s)) || /^(?:[rt]-[a-f0-9]{12}|[\d\s.,:;()%+−–—→×/|\-]+|[+−-]?[\d,.]+[KMB]|[+−-]?[\d,.]+%?\s*(?:ATK|DEF|HP|EXP)|(?:Lv\.?\s*)?\d+(?:\s*[→–-]\s*\d+)?|T\d+|SSR|SR|R|EXP|ATK|DEF|HP|PvP|PvE|VIP|TilesSurvive(?:\.net)?|LootBar|Discord|YouTube|Facebook|Instagram|TikTok|FunPlus|Google|Apple|iOS|Android|PayPal)$/u.test(s);
};
function numberSignature(text, locale='en') {
  const info=byCode.get(locale), parts=new Intl.NumberFormat(info?.numberLocale||locale).formatToParts(12345.6);
  const group=parts.find(x=>x.type==='group')?.value, decimal=parts.find(x=>x.type==='decimal')?.value;
  const normalized=String(text).replace(/\b(level|stage|rank|star|tier|step)-(?=\d)/gi,'$1 ').replace(/\b\d{4}-\d{2}-\d{2}\b/g,s=>s.replace(/-/g,' '));
  return (normalized.match(/[+−-]?\d+(?:(?:[.,\u00a0\u202f ]\d{3})+|(?:[.,]\d+))*(?:[KkMB万萬亿億])?/gu)||[]).map(raw=>{
    const unit=raw.match(/[KkMB万萬亿億]$/)?.[0]?.replace('k','K');
    let s=raw.replace(/[KkMB万萬亿億]$/,'').replace(/−/g,'-').replace(/[\u00a0\u202f ]/g,'');
    if(group && !/\s/.test(group))s=s.split(group).join('');
    if(decimal && decimal!=='.')s=s.replace(decimal,'.');
    if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))return raw;
    const factor={K:1e3,M:1e6,B:1e9,'万':1e4,'萬':1e4,'亿':1e8,'億':1e8}[unit]||1;
    return String(Number(s)*factor);
  }).sort();
}
function placeholders(text) { return (String(text).match(/\{\{?[^{}]+\}?\}|%\d*\$?[sdif]/g) || []).sort(); }
function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function createTranslator(locale, { exact = {}, templates = [], phrases = {}, units = {}, allowUnchanged = [], official = {} } = {}) {
  if (!byCode.has(locale) || locale === 'en') throw new Error('Invalid target locale: ' + locale);
  const normalizeMessages=entries=>Object.fromEntries(Object.entries(entries).map(([source,target])=>[clean(source),typeof target==='string'?target.trim():target]));
  exact=normalizeMessages(exact);official=normalizeMessages(official);phrases=normalizeMessages(phrases);
  const missing = new Map(), errors = [], used = new Map(), allowed = new Set(allowUnchanged.map(clean));
  const compiled = templates.map(t => ({ ...t, re: new RegExp(t.pattern, 'u') }));
  const structural=readJSON(path.join(ROOT,'data/i18n/structural-messages.json'),{entries:{}}).entries;
  const duration=value=>String(value).replace(/(\d+)([dhms])/g,(_,n,u)=>n+(units[u]||u));
  function translate(raw, context = '') {
    if (typeof raw !== 'string' || invariant(raw)) return raw;
    const source = clean(raw);
    let target = exact[source], provenance = 'authored';
    if (target === undefined && typeof official[source] === 'string') { target = official[source]; provenance = 'client'; }
    if(target===undefined&&/^\/\s+\S/.test(source)) {
      const caption=source.replace(/^\/\s+/,'');
      const known=exact[caption]!==undefined||official[caption]!==undefined;
      target='/ '+(known?translate(caption,context+':caption'):caption.split(' · ').map(part=>translate(part,context+':caption-part')).join(' · '));provenance='structure';
    }
    if (target === undefined && /^(?:\d+[dhms]\s*)+$/.test(source) && ['d','h','m','s'].every(k=>units[k])) { target=duration(source);provenance='duration'; }
    const structure=structural[source];
    if(target===undefined && structure) {
      const pattern=phrases[structure.template] ?? exact[structure.template];
      if(typeof pattern==='string') {
        if(!same(placeholders(structure.template),placeholders(pattern)))errors.push({source:structure.template,target:pattern,context,error:'template-placeholder-signature'});
        const bindings={...structure.bindings};
        for(const key of structure.translate) bindings[key]=translate(bindings[key],context+':binding:'+key);
        if(structure.duration && bindings.duration) {
          if(['d','h','m','s'].every(k=>units[k])) bindings.duration=duration(bindings.duration);
          else for(const unit of ['day','hour','minute','second'])translate(unit,context+':duration-unit');
        }
        target=pattern.replace(/\{\{(\w+)\}\}/g,(_,key)=>bindings[key]??'');provenance='structure';
      } else {
        if(!missing.has(structure.template))missing.set(structure.template,[context+':template']);
        for(const key of structure.translate)translate(structure.bindings[key],context+':binding:'+key);
        return raw;
      }
    }
    if (target === undefined) for (const entry of compiled) {
      const match = entry.re.exec(source);
      if (!match || match[0] !== source) continue;
      target = entry.value.replace(/\{(\d+)\}/g, (_, i) => match[Number(i)] ?? '');
      provenance = 'template'; break;
    }
    if (target === undefined && allowed.has(source)) { target = source; provenance = 'invariant-name'; }
    if (typeof target !== 'string' || !target.trim()) {
      if (!missing.has(source)) missing.set(source, []);
      if (missing.get(source).length < 4) missing.get(source).push(context);
      return raw;
    }
    if (!same(numberSignature(source), numberSignature(target,provenance==='client'?locale:'en'))) errors.push({ source, target, context, error: 'numeric-signature' });
    if (!same(placeholders(source), placeholders(target))) errors.push({ source, target, context, error: 'placeholder-signature' });
    if (target === source && !['client','structure','duration'].includes(provenance) && !allowed.has(source)) errors.push({ source, context, error: 'unreviewed-unchanged' });
    used.set(source, provenance);
    return raw.replace(raw.trim(), target);
  }
  return { translate, missing, errors, used };
}
function routeGroups(root = ROOT) {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>(https:\/\/tilessurvive\.net\/en\/[^<]*)<\/loc>/g)].map(m => m[1]);
  return urls.map(url => {
    const pathname = new URL(url).pathname;
    const file = pathname.slice(1) + 'index.html';
    const document = parseHTML(fs.readFileSync(path.join(root, file), 'utf8')).document;
    const routes = { en: pathname };
    for (const link of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
      const locale = registry.locales.find(l => l.hreflang.toLowerCase() === link.hreflang.toLowerCase());
      if (!locale || !existing.has(locale.code)) continue;
      const other = new URL(link.href, publicOrigin);
      if (other.origin === publicOrigin && fs.existsSync(path.join(root, other.pathname.slice(1), 'index.html'))) routes[locale.code] = other.pathname;
    }
    for (const locale of registry.locales) if (!existing.has(locale.code)) routes[locale.code] = pathname.replace(/^\/en\//, '/' + locale.code + '/');
    return { id: pathname.slice(4), file, routes };
  });
}
// Retired references still embedded in four source JSON-LD blocks. Their current
// pages/canonicals are verified, and existing public URLs are not removed.
const legacyReferenceRoutes={
 '/en/heroes/legend-gear-star/':'/en/database/legend-gear-star/',
 '/en/seasons/season-1-wave-of-fury/':'/en/seasons/season-1/',
 '/en/seasons/season-2-awakening-of-manryong/':'/en/seasons/season-2/',
 '/en/seasons/season-3-undecided/':'/en/seasons/season-3/'
};
const canonicalAliasCache=new Map();
function routeURL(value, locale, groups) {
  if (typeof value !== 'string' || !/^(?:https:\/\/tilessurvive\.net)?\/en(?:\/|$)/.test(value)) return value;
  const url = new URL(value, publicOrigin);
  let group = groups.find(x => x.routes.en === (legacyReferenceRoutes[url.pathname]||url.pathname));
  if(!group) {
    if(!canonicalAliasCache.has(url.pathname)) {
      const file=path.resolve(ROOT,'.'+url.pathname,'index.html');let canonical=null;
      if(file.startsWith(path.join(ROOT,'en')+path.sep)&&fs.existsSync(file)) {
        const href=parseHTML(fs.readFileSync(file,'utf8')).document.querySelector('link[rel="canonical"]')?.href;
        if(href?.startsWith(publicOrigin+'/en/'))canonical=new URL(href).pathname;
      }
      canonicalAliasCache.set(url.pathname,canonical);
    }
    group=groups.find(x=>x.routes.en===canonicalAliasCache.get(url.pathname));
  }
  if (!group?.routes[locale]) return value;
  const destination = group.routes[locale] + url.search + url.hash;
  return value.startsWith('https:') ? publicOrigin + destination : destination;
}
function localizeJSON(value, locale, translate, groups, context = '', key = '', prose = false) {
  if (Array.isArray(value)) return value.map((v,i) => localizeJSON(v,locale,translate,groups,context+'.'+i,key,prose));
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value,'en') && (Object.hasOwn(value,'ko') || Object.hasOwn(value,'ja'))) {
      return { ...value, [locale]: localizeJSON(value.en,locale,translate,groups,context+'.'+locale,key,true) };
    }
    return Object.fromEntries(Object.entries(value).map(([k,v]) => {
      if (['language','inLanguage','lang'].includes(k) && typeof v === 'string' && /^en(?:-[a-z0-9]+)*$/i.test(v)) return [k, locale];
      if (k === 'locale' && typeof v === 'string' && /^en(?:-[a-z0-9]+)*$/i.test(v)) return [k, byCode.get(locale).numberLocale];
      return [k, localizeJSON(v,locale,translate,groups,context+'.'+k,k,prose || contentContainers.has(k))];
    }));
  }
  if (typeof value !== 'string') return value;
  // Model units are execution enums (calendar day/phase, damage types, etc.).
  // A unit label inside an explicit UI copy object remains translatable.
  if(key==='unit'&&!prose&&['day','phase'].includes(value))return value;
  const routed = routeURL(value, locale, groups);
  if (routed !== value) return routed;
  if (['not-shown','one-time-purchase','percent-damage','percent-atk','percent-reduction','percent-bonus'].includes(value)) return value;
  // Explicit UI dictionaries may use model-like keys (kind, target, source).
  // Those values are labels; the identically named fields outside copy stay enums.
  return prose || (!nonDisplay.has(key) && contentKeys.has(key)) ? translate(value, context) : value;
}
function jsonScript(document, id, value) {
  let node = document.getElementById(id);
  if (!node) { node = document.createElement('script'); node.id = id; node.type = 'application/json'; document.head.append(node); }
  node.textContent = JSON.stringify(value).replace(/</g, '\\u003c');
}
function safeWrite(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file,'utf8') === content) return false;
  fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file,content); return true;
}
module.exports = { ROOT,registry,byCode,existing,publicOrigin,clean,digest,readJSON,invariant,numberSignature,placeholders,createTranslator,routeGroups,routeURL,localizeJSON,jsonScript,safeWrite,contentKeys,contentContainers,nonDisplay };
