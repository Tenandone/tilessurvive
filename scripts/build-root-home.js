'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {parseHTML} = require('linkedom');
const L = require('./lib/global-localization');
const Identity = require('./site-identity');
const origin = 'https://tilessurvive.net';
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 12);
const lf = text => text.replace(/\r\n/g,'\n');
const published = () => L.registry.locales.filter(x => x.status === 'published').map(x => x.code);
const compactJSON = value => JSON.stringify(value).replace(/</g, '\\u003c');
const jsonTypes = new Set(['application/json', 'application/ld+json']);
const earlyScripts = ['js/site-locales.js','js/home-form-state.js'];
// Only the root uses these short titles. Keep localized homepage titles that already fit.
const shortRootLabels = {
  en:'Tiles Survive Guide', de:'Events und Spieltipps', ru:'События и гайды',
  ar:'الفعاليات وأدلة اللعب', nl:'Evenementen en tips', fr:'Événements et guides',
  id:'Event dan panduan', it:'Eventi e guide', pl:'Wydarzenia i porady',
  pt:'Eventos e guias', es:'Eventos y guías', sv:'Evenemang och guider',
  th:'กิจกรรมและคู่มือเกม', tr:'Etkinlik rehberi', vi:'Sự kiện và hướng dẫn',
  ms:'Acara dan panduan', nb:'Hendelser og guider',
};
const headSelectors = [
  'title', 'meta[name="description"]', 'meta[name="keywords"]',
  'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:locale"]',
  'meta[name="twitter:title"]', 'meta[name="twitter:description"]',
  '#ts-global-ui', '#ts-locale-routes', '#ts-website-schema', '#ts-org-schema',
  'script[type="application/ld+json"][data-v5-owned="metadata"]'
];

// The existing published homes supply the shell, translated content, game data and assets.
// AdSense and the consent bootstrap remain live. The root language runtime starts the
// other deferred scripts in their existing order after the selected language is ready.
function prepareHome(source, locale, available, root) {
  const document = parseHTML(lf(source)).document;
  const html = document.documentElement;
  assert.equal(html.dataset.lang, locale);
  assert(document.querySelector('main [data-v5-home]') && document.querySelector('footer.ts-footer'));
  const info = L.byCode.get(locale);
  html.setAttribute('data-root-home', '');
  html.dir = info.dir;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (locale === 'en' || [document.title,ogTitle.content].some(t => [...t].length > 40)) {
    assert(shortRootLabels[locale], 'Missing short root title: ' + locale);
    const title = shortRootLabels[locale] + ' | TilesSurvive.net';
    assert([...title].length <= 40, 'Root title exceeds 40 characters: ' + locale);
    document.title = title;
    ogTitle.content = title;
  }
  document.querySelector('link[rel="canonical"]').setAttribute('href', origin + '/');
  document.querySelector('meta[property="og:url"]').content = origin + '/';
  const pageSchema = document.querySelector('script[type="application/ld+json"][data-v5-owned="metadata"]');
  const page = JSON.parse(pageSchema.textContent);
  assert.equal(page['@type'], 'WebPage');
  page.url = origin + '/';
  page['@id'] = page.url + '#webpage';
  pageSchema.textContent = compactJSON(page);
  const localeLinks = document.querySelectorAll('.ts3-language a[hreflang]');
  const accepted = new Set(available);
  for (const anchor of localeLinks) {
    const code = anchor.getAttribute('href').split('/')[1];
    if (!accepted.has(code)) anchor.remove();
    else anchor.setAttribute('data-root-locale', code);
  }
  assert.equal(document.querySelectorAll('[data-root-locale]').length, available.length);
  L.jsonScript(document,'ts-locale-routes',Object.fromEntries(available.map(code=>[code,'/'+code+'/'])));
  // Retain direct language paths for all ordinary navigation. Home section links
  // stay on the current root document even with the shared <base href="/">.
  for (const anchor of document.querySelectorAll('a[href]')) {
    const href = anchor.getAttribute('href');
    if (href.startsWith('/' + locale + '/#')) anchor.setAttribute('href', '/'+href.slice(href.indexOf('#')));
  }
  for (const link of document.querySelectorAll('head link[rel="alternate"][hreflang]')) link.remove();
  for (const [lang, href] of [...available.map(code => [L.byCode.get(code).hreflang, '/' + code + '/']), ['x-default','/']]) {
    const link = document.createElement('link');
    link.rel = 'alternate'; link.hreflang = lang; link.href = origin + href;
    document.head.append(link);
  }
  const scripts = [];
  const early = new Set();
  for (const script of document.querySelectorAll('script')) {
    const src = script.getAttribute('src');
    if (jsonTypes.has(script.type) || script.hasAttribute('data-v3-ga-bootstrap')) continue;
    if (!src) {
      assert(script.textContent.includes('window.TS_LANG ='), 'Unreviewed executable inline home script');
      script.remove();
    } else if (src.startsWith('/js/')) {
      assert(script.hasAttribute('defer') && /^\/js\/[a-zA-Z0-9./-]+\.js\?v=[0-9a-f]{12}$/.test(src), src);
      const file = src.slice(1).split('?')[0];
      if (earlyScripts.includes(file)) {
        assert(!early.has(file),'Duplicate early home script: '+file);
        early.add(file);
      } else {
        if (src.startsWith('/js/v3-affiliate.js?')) scripts.push(assetURL(root,'js/root-home-analytics.js'));
        scripts.push(assetURL(root,file));
      }
      script.remove();
    } else {
      assert.equal(src, 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9189957764761115');
    }
  }
  assert.deepEqual([...early],earlyScripts,'Home registry and form state must load once in order');
  assert.equal(new Set(scripts).size, scripts.length);
  html.normalize();
  return {document, scripts};
}

function assetURL(root,file) {
  return '/' + file + '?v=' + digest(lf(fs.readFileSync(path.join(root,file),'utf8')));
}

function jsonDiff(base, target, steps = [], address = []) {
  if (base === target) return steps;
  if (base && target && typeof base === 'object' && typeof target === 'object' &&
      Array.isArray(base) === Array.isArray(target) &&
      JSON.stringify(Object.keys(base).sort()) === JSON.stringify(Object.keys(target).sort())) {
    for (const key of Object.keys(base)) {
      jsonDiff(base[key],target[key],steps,[...address,Array.isArray(base) ? Number(key) : key]);
    }
  } else steps.push([address,target]);
  return steps;
}

// Track text by its gap between child elements/comments. A translation may omit
// an English suffix next to a link or <strong>, without removing that element.
function textGaps(node) {
  const gaps = new Map();
  let gap = 0;
  Array.from(node.childNodes).forEach((child,index) => {
    if (child.nodeType === 3) gaps.set(gap,{index,value:child.nodeValue});
    else gap++;
  });
  return gaps;
}

function changedNodes(base, target, slots, changes) {
  assert.equal(base.localName,target.localName,'Home element shape');
  const attrs = {};
  for (const key of new Set([...base.getAttributeNames(), ...target.getAttributeNames()])) {
    if (key !== 'data-root-slot' && base.getAttribute(key) !== target.getAttribute(key)) attrs[key] = target.getAttribute(key);
  }
  const update = {};
  if (Object.keys(attrs).length) update.attrs = attrs;
  if (base.localName === 'script') {
    assert(jsonTypes.has(base.type) && base.type === target.type, 'Only JSON data can be localized');
    const changes = jsonDiff(JSON.parse(base.textContent),JSON.parse(target.textContent));
    if (changes.length) update.json = changes;
  } else {
    const a = textGaps(base), b = textGaps(target), text = [];
    for (const [gap,t] of b) assert(a.has(gap) || !t.value.trim(), 'Translated text requires a missing base text node');
    for (const [gap,t] of a) {
      const next = b.get(gap)?.value || '';
      if (next !== t.value && (next.trim() || t.value.trim())) text.push([t.index,next]);
    }
    if (text.length) update.text = text;
  }
  if (Object.keys(update).length) {
    if (!slots.has(base)) slots.set(base,slots.size);
    changes.push({id:slots.get(base), ...update});
  }
  const left = [...base.children], right = [...target.children];
  assert.equal(left.length,right.length,'Localized element shape: ' + base.localName + ' ' + base.id);
  for (let i=0;i<left.length;i++) changedNodes(left[i], right[i], slots, changes);
}

function localizedPairs(base, target) {
  const pairs = [[base.body,target.body]];
  for (const selector of headSelectors) {
    const a=base.querySelector(selector), b=target.querySelector(selector);
    assert(a && b, 'Missing home head field ' + selector);
    pairs.push([a,b]);
  }
  const legacyCSS = d => [...d.head.querySelectorAll('link[rel="stylesheet"]')].filter(n=>n.href.startsWith('/css/content/'));
  const a=legacyCSS(base), b=legacyCSS(target);
  assert.equal(a.length,b.length,'Per-language content styles');
  for(let i=0;i<a.length;i++) pairs.push([a[i],b[i]]);
  return pairs;
}

function compile(root=L.ROOT, available=published(), options={}) {
  const readHome = code => options.homes?.get(code) ?? fs.readFileSync(path.join(root,code,'index.html'),'utf8');
  assert(available.includes('en') && new Set(available).size === available.length);
  const base = prepareHome(readHome('en'),'en',available,root);
  const slots = new Map(), patches = new Map();
  for (const code of available.filter(code=>code!=='en')) {
    const target = prepareHome(readHome(code),code,available,root);
    assert.deepEqual(target.scripts,base.scripts,'Unexpected application script difference: '+code);
    const changes=[];
    for (const [a,b] of localizedPairs(base.document,target.document)) changedNodes(a,b,slots,changes);
    patches.set(code,changes);
  }
  for (const [node,id] of slots) node.setAttribute('data-root-slot',String(id));
  const version = digest(base.document.documentElement.outerHTML);
  const manifest = {schemaVersion:1,baseLocale:'en',version,locales:{en:null},scripts:base.scripts};
  const files = new Map();
  for (const [locale,changes] of patches) {
    const {htmlLang:lang,dir}=L.byCode.get(locale);
    const file='data/root-home/'+locale+'.json';
    const data=JSON.stringify({schemaVersion:1,version,locale,lang,dir,changes})+'\n';
    files.set(file,data);
    manifest.locales[locale]='/'+file+'?v='+digest(data);
  }
  const d=base.document;
  if (options.preview) d.querySelector('meta[name="robots"]').content='noindex,nofollow';
  L.jsonScript(d,'ts-root-home',manifest);
  for (const file of [...earlyScripts,'js/root-language.js']) {
    const script=d.createElement('script');script.defer=true;
    script.src=options.assetURLs?.[file] || assetURL(root,file);
    d.head.append(script);
  }
  const html = Identity.project('<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n',{root}).replace(/[\t ]+$/gm,'');
  return {html,files,manifest,slots:slots.size};
}

function build({root=L.ROOT,available=published(),apply=true}={}) {
  const out=compile(root,available);
  let changed=0;
  for(const [file,body] of [...out.files,['index.html',out.html]]) {
    const destination=path.join(root,file);
    if(fs.existsSync(destination)) {
      const current=fs.readFileSync(destination,'utf8');
      if((file==='index.html'?lf(current):current)===body) continue;
    }
    changed++;
    if(apply) L.safeWrite(destination,body);
  }
  return {changed,locales:available.length,payloads:out.files.size,slots:out.slots,bytes:Buffer.byteLength(out.html)};
}
function validate(root=L.ROOT) {
  const result=build({root,apply:false});
  assert.equal(result.changed,0,'Root homepage and selected-language data must match their shared published sources');
  return result;
}
module.exports={compile,build,validate};
if(require.main===module)console.log(JSON.stringify(process.argv.includes('--check')?validate():build()));
