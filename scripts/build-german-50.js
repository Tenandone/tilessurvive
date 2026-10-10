'use strict';
// Static localisation only. Source numbers, IDs, formulas and assets are retained.
const fs = require('fs');
const path = require('path');
const { parseHTML } = require('linkedom');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data/product-50/german.json');
const locales = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const humanKeys = new Set(['name','title','description','headline','text','caption','alt','label','unit','invalid','missing','total','shortage','updated','scope','note','summary','condition','labelText','body','question','answer','activities','rewards']);
const nonDisplay = new Set(['id','type','kind','unitType','category','currency','conditionCode','status','source','version','gameVersion','schemaVersion','target','href','url','src','slug','route','language','inLanguage','@type','@context','@id','internalId','skillId','role','position','image','code']);
const clean = value => value.trim().replace(/\s+/gu, ' ');
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]);
function germanNumbers(source,target) {
  const protectedRE=/\b(?:v?\d+(?:\.\d+){2,}|\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|(?:19|20)\d{2})\b/g;
  const numberRE=/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d+/g;
  const mask=s=>s.replace(protectedRE,x=>' '.repeat(x.length));
  const replacements=new Map([...mask(source).matchAll(numberRE)].map(m=>{const [whole,fraction]=m[0].replaceAll(',','').split('.');return[m[0],whole.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction===undefined?'':','+fraction)];}));
  const visible=mask(target);return target.replace(numberRE,(match,offset)=>visible.slice(offset,offset+match.length)===match?(replacements.get(match)||match):match);
}
function createTranslator(catalog, inventory) {
  const missing = new Map();
  function translate(raw, context) {
    const text = clean(raw);
    if (!text || !/[A-Za-z]/u.test(text)) return germanNumbers(raw,raw);
    if (/^(?:https?:\/\/|\/|#)/.test(text) || /^[\d\s.,:;()%+−–—→×/|\-]*$/.test(text)) return raw;
    if (/^(?:[+−-]?[\d,.]+[KMB]|[+−-]?[\d,.]+%?\s*(?:ATK|DEF|HP|EXP)|(?:\d+[dhms]\s*)+|(?:Lv\.?\s*)?\d+(?:\s*[→–-]\s*\d+)?|T\d+|SSR|SR|R|EXP|ATK|DEF|HP|PvP|PvE|VIP|TilesSurvive(?:\.net)?|LootBar|Discord|YouTube|Facebook|Instagram|TikTok|FunPlus|Google|Apple|iOS|Android|PayPal)$/u.test(text)) return germanNumbers(raw,raw);
    const result = catalog.exact[text];
    if (typeof result !== 'string') {
      if (!missing.has(text)) missing.set(text, []);
      if (missing.get(text).length < 4) missing.get(text).push(context);
      return raw;
    }
    if (!result.trim()) throw new Error('Empty German translation: ' + text);
    return raw.replace(raw.trim(),germanNumbers(text,result));
  }
  return { translate, missing };
}
function localizeJSON(value, translate, context, parentKey='', prose=false) {
  if (Array.isArray(value)) return value.map((v,i)=>localizeJSON(v,translate,context+'.'+i,parentKey,prose));
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value,'en') && (Object.hasOwn(value,'ko') || Object.hasOwn(value,'ja'))) {
      const copy = {...value}; copy.de = localizeJSON(value.en,translate,context+'.de',parentKey,true); return copy;
    }
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k, (k==='language'||k==='inLanguage') && v==='en' ? 'de' : localizeJSON(v,translate,context+'.'+k,k,prose||['copy','labels','descriptionTemplate'].includes(k))]));
  }
  if (typeof value !== 'string') return value;
  if (['not-shown','one-time-purchase','percent-damage','percent-atk','percent-reduction','percent-bonus'].includes(value)) return value;
  if (/^(?:https:\/\/tilessurvive\.net)?\/en(?:\/|$)/.test(value)) return value.replace('/en','/de');
  if (prose || humanKeys.has(parentKey)) return translate(value,context);
  return value;
}
function localizeProgram(source,translate,route) {
  let code=source;
  if(code.includes('function normalizeLang')) code=code.replace(/if\s*\(low === 'en'\) return 'en';/g,"if (low === 'de') return 'de'; if (low === 'en') return 'en';").replace(/if\(low==='en'\)return'en';/g,"if(low==='de')return'de';if(low==='en')return'en';").replaceAll('(ko|en|ja|ru|zh-tw)','(ko|en|ja|ru|zh-tw|de)');
  for(const name of ['CODE_LABELS','LANG_DATA']) {
    const regex=new RegExp('(const '+name+' = \\{)([\\s\\S]*?)(\\n    \\};)');
    code=code.replace(regex,(_,before,body,after)=>before+body.replace(/(\b[A-Za-z]\w*\s*:\s*)("(?:[^"\\]|\\.)*")/g,(_,key,quoted)=>key+JSON.stringify(translate(JSON.parse(quoted),route+':inline.'+name))).replace(/\ben: \{/,'de: {')+after);
  }
  if(source.includes('const LANG_DATA'))code=code.replaceAll('LANG_DATA.en','LANG_DATA.de').replace('applyLanguage("en")','applyLanguage("de")');
  if(source.includes('const CODE_LABELS')) {
    for(const value of ['Active Codes + Permanent Codes + Next Expiry Countdown','Currently Active Codes (','There are currently no limited-time codes, and the latest limited-time code was ','There are currently no active codes.','Link copied','Failed to load code data.'])code=code.replaceAll(JSON.stringify(value),JSON.stringify(translate(value,route+':inline.coupons')));
    code=code.replace('Intl.DateTimeFormat("en-US"','Intl.DateTimeFormat("de-DE"').replace('hour12:true','hour12:false');
  }
  return code;
}
function render(source, translate, route) {
  const {document} = parseHTML(source);
  require('./build-pet-skill-levels').stripOwnedSections(document, 'en');
  // These six-language sections are regenerated by their owning late builders.
  document.querySelectorAll('[data-growth-50],[data-growth-research-50],[data-growth50-asset],[data-package-offer-50],[data-event-calendar-entry]').forEach(node=>node.remove());
  document.documentElement.lang='de'; document.documentElement.dataset.lang='de';
  // Display-localized cells retain their source lexemes for existing numeric readers.
  for(const cell of document.querySelectorAll('td')) cell.setAttribute('data-ts-original-value',cell.textContent.trim());
  function visit(node) {
    if (node.nodeType===3 && !['SCRIPT','STYLE'].includes(node.parentNode?.tagName) && !node.parentElement?.closest('[lang]:not([lang="en"]):not(html),.ts3-language nav,.language-switcher')) node.textContent=translate(node.textContent,route+':text');
    for (const child of [...(node.childNodes||[])]) visit(child);
  }
  visit(document);
  for (const el of document.querySelectorAll('*')) {
    for (const attr of ['alt','title','aria-label','placeholder','data-idle','data-results','data-error']) if(el.hasAttribute(attr)) el.setAttribute(attr,translate(el.getAttribute(attr),route+':'+attr));
    for (const attr of ['href','action','data-search-url']) if(el.hasAttribute(attr)) {
      if(el.matches('link[rel="alternate"],a[hreflang],.ts3-language a[lang]')) continue;
      el.setAttribute(attr,el.getAttribute(attr).replace(/^(https:\/\/tilessurvive\.net)?\/en(?=\/|$)/,'$1/de'));
    }
    if(el.tagName==='META') {
      const key=el.getAttribute('name')||el.getAttribute('property');
      if(['description','keywords','og:title','og:description','twitter:title','twitter:description'].includes(key)) el.setAttribute('content',translate(el.getAttribute('content')||'',route+':meta'));
      if(['og:url','twitter:url'].includes(key))el.setAttribute('content',el.getAttribute('content').replace('/en/','/de/'));
      if(key==='og:locale')el.setAttribute('content','de_DE');
    }
  }
  for (const script of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
    script.textContent=JSON.stringify(localizeJSON(JSON.parse(script.textContent),translate,route+':json','',script.id==='ts3-copy'));
  }
  for(const script of document.querySelectorAll('script:not([src])'))if(!script.type?.includes('json'))script.textContent=localizeProgram(script.textContent,translate,route);
  // The canonical language routes are completed by the shared six-language finalizer.
  const langNav=document.querySelector('.ts3-language nav');
  if(langNav){for(const a of langNav.querySelectorAll('a')){if(a.lang==='de')a.remove();else a.removeAttribute('aria-current');}const a=document.createElement('a');a.href='/de/'+route.replace(/index\.html$/,'');a.lang='de';a.setAttribute('hreflang','de');a.textContent='Deutsch';a.setAttribute('aria-current','page');langNav.append(a);document.querySelector('.ts3-language summary').textContent='DE';}
  for(const item of document.querySelectorAll('[data-pet-name]')){const n=item.querySelector('h3')?.textContent;if(n)item.dataset.petName+=' '+n;}
  return document.toString();
}
function build({inventoryPath}={}) {
  const catalog=fs.existsSync(DATA)?JSON.parse(fs.readFileSync(DATA,'utf8')):{exact:{}};
  for(const name of ['german-core-review.json','german-hero-review.json','german-calculator-review.json','german-growth-review.json','german-editorial-review.json','german-root-overrides.json','german-building-review.json']){const file=path.join(ROOT,'data/product-50',name);if(fs.existsSync(file))Object.assign(catalog.exact,JSON.parse(fs.readFileSync(file,'utf8')).exact);}
  const {translate,missing}=createTranslator(catalog,!!inventoryPath);
  const outputs=[];
  const inheritedRoutes=JSON.parse(fs.readFileSync(path.join(ROOT,'data/product-50/german-routes.json'),'utf8'));
  for(const route of inheritedRoutes) {
    // This route and its index entry are generated directly in all six languages.
    if(route==='events/calendar/index.html')continue;
    const input=path.join(ROOT,'en',route);
    outputs.push({route,path:path.join(ROOT,'de',route),content:render(fs.readFileSync(input,'utf8'),translate,route)});
  }
  for(const name of ['header.html','footer.html']) {
    const input=path.join(ROOT,'components/en',name);
    if(fs.existsSync(input))outputs.push({route:'components/'+name,path:path.join(ROOT,'components/de',name),content:render(fs.readFileSync(input,'utf8'),translate,'components/'+name)});
  }
  for(const name of ['event-helper-events','event-helper-calculators']) {
    const input=path.join(ROOT,'data',name+'.json');
    const value=localizeJSON(JSON.parse(fs.readFileSync(input,'utf8')),translate,'data/'+name);
    outputs.push({route:'data/'+name,path:path.join(ROOT,'data/product-50/german-'+name+'.json'),content:JSON.stringify(value,null,2)+'\n'});
  }
  if(inventoryPath){fs.mkdirSync(path.dirname(inventoryPath),{recursive:true});fs.writeFileSync(inventoryPath,JSON.stringify([...missing].map(([source,contexts])=>({source,contexts})),null,2)+'\n');return {untranslated:missing.size};}
  if(missing.size)throw new Error('German catalog has '+missing.size+' untranslated strings. First: '+[...missing.keys()].slice(0,5).join(' | '));
  let changed=0;for(const o of outputs){fs.mkdirSync(path.dirname(o.path),{recursive:true});if(!fs.existsSync(o.path)||fs.readFileSync(o.path,'utf8')!==o.content){fs.writeFileSync(o.path,o.content);changed++;}}
  return {routes:outputs.filter(o=>!o.route.startsWith('components/')&&!o.route.startsWith('data/')).length,components:2,dataFiles:2,changed,missing:0};
}
module.exports={build,render,localizeJSON,createTranslator,localizeProgram,germanNumbers};
if(require.main===module){const i=process.argv.indexOf('--inventory');console.log(JSON.stringify(build({inventoryPath:i>=0?path.resolve(process.argv[i+1]):null})));}
