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
    // Older schema nodes use regional English tags, while newer nodes use en.
    // Only language fields are remapped; literal IDs, units and other locales stay intact.
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k, (k==='language'||k==='inLanguage') && typeof v==='string' && /^en(?:-[a-z0-9]{1,8})*$/i.test(v) ? 'de' : localizeJSON(v,translate,context+'.'+k,k,prose||['copy','labels','descriptionTemplate'].includes(k))]));
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
function projectGlobalUI(value) {
  // The shared runtime dictionary has an explicit locale owner. Reusing its
  // reviewed DE values avoids mixing this UI with the older prose catalog.
  const english=JSON.parse(fs.readFileSync(path.join(ROOT,'data/i18n/ui/en.json'),'utf8'));
  const german=JSON.parse(fs.readFileSync(path.join(ROOT,'data/i18n/ui/de.json'),'utf8'));
  if(value.locale!=='en'||german.locale!=='de')throw new Error('Invalid shared UI projection locale');
  function project(input,source,target,where) {
    if(Array.isArray(input)) {
      if(!Array.isArray(source)||!Array.isArray(target)||input.length!==source.length||input.length!==target.length)throw new Error('Shared UI array mismatch: '+where);
      return input.map((item,index)=>project(item,source[index],target[index],where+'['+index+']'));
    }
    if(input&&typeof input==='object') {
      if(!source||!target||typeof source!=='object'||typeof target!=='object'||JSON.stringify(Object.keys(input).sort())!==JSON.stringify(Object.keys(source).sort())||JSON.stringify(Object.keys(source).sort())!==JSON.stringify(Object.keys(target).sort()))throw new Error('Shared UI key mismatch: '+where);
      return Object.fromEntries(Object.entries(input).map(([key,item])=>[key,project(item,source[key],target[key],where+'.'+key)]));
    }
    if(input!==source)throw new Error('Unreviewed shared UI source: '+where);
    if(typeof input==='string') {
      if(typeof target!=='string'||!target.trim())throw new Error('Missing reviewed German UI: '+where);
      return target;
    }
    if(input!==target)throw new Error('Shared UI scalar changed: '+where);
    return input;
  }
  const featureCopies={};
  for(const [name,input] of Object.entries(value.featureCopies||{})) {
    let source=english.featureCopies?.[name],target=german.featureCopies?.[name];
    if(source===undefined||target===undefined) {
      if(name==='dataWorkbench') {const owner=require('../js/data-workbench-30');source=owner.copy.en;target=owner.copy.de;}
      else if(name==='speedup') {const owner=require('../js/tools-speedup-calculator');source=owner.UI.en;target=owner.UI.de;}
      else if(name==='eventHelper') {const owner=require('../js/event-helper');source={ui:owner.UI.en,dayLabels:owner.DAY_LABELS.en};target={ui:owner.UI.de,dayLabels:owner.DAY_LABELS.de};}
      else throw new Error('Unknown shared UI feature: '+name);
    }
    featureCopies[name]=project(input,source,target,'featureCopies.'+name);
  }
  return {...value,locale:'de',copy:project(value.copy,english.copy,german.copy,'copy'),affiliate:project(value.affiliate,english.affiliate,german.affiliate,'affiliate'),featureCopies};
}
function prepareV3Source(source, locale, route) {
  const document=parseHTML(source).document;
  const actual=[...document.querySelectorAll('[data-v3-owned]')];
  if(!actual.length)return {source,owned:false};
  const owner=require('./build-v3-platform'),publicRoute='/'+locale+'/'+route.replace(/index\.html$/,'');
  const approved=new Set(['analytics','assets','navigation','trust','planner','affiliate','privacy','events','topup-step']);
  for(const node of actual)if(!approved.has(node.getAttribute('data-v3-owned')))throw new Error('Unknown V3 owner in German source: '+route);
  // Older editorial builders decorate all headings, including managed UI, and
  // the affiliate normalizer replaces this one CTA label. Accept only those
  // known transformations; every word, value and link still needs its owner.
  function fingerprint(node) {
    const clone=node.cloneNode(true);
    for(const element of [clone,...clone.querySelectorAll('*')]) {
      if(/^(?:article|character)-section-\d+$/.test(element.id))element.removeAttribute('id');
      if(element.classList.contains('ts3-character-section')) {
        element.classList.remove('ts3-character-section');
        if(!element.className)element.removeAttribute('class');
      }
      if(element.matches('a[data-v3-cta="outbound"]')&&element.textContent==='LootBar →')element.textContent=require('../data/v3-affiliate-copy.json').locales[locale].outbound;
      if(element.getAttribute('data-v3-owned')==='assets')for(const attr of ['src','href'])if(element.hasAttribute(attr))element.setAttribute(attr,element.getAttribute(attr).replace(/([?&]v=)[a-f0-9]{12}(?=&|$)/,'$1content-hash'));
    }
    return clone.outerHTML;
  }
  function withoutOwned(html) {
    const template=parseHTML(owner.strip(html)).document;
    for(const node of template.querySelectorAll('[data-v3-owned]')) {
      if(node.matches('script[data-v3-ga-bootstrap][data-v3-owned="analytics"]'))continue;
      else if(route==='top-up/index.html'&&node.matches('[data-topup-step="2"] p[data-v3-owned="topup-step"]')){node.removeAttribute('data-v3-owned');node.textContent='';}
      else node.remove();
    }
    return template.toString();
  }
  const expected=parseHTML(owner.project(withoutOwned(source),locale,publicRoute)).document;
  const remaining=[...expected.querySelectorAll('[data-v3-owned]')].filter(node=>node.getAttribute('data-v3-owned')!=='assets').map(fingerprint);
  for(const node of actual) {
    if(node.getAttribute('data-v3-owned')==='assets') {
      // Legacy page templates can carry registered V3 assets to another route.
      // Validate the complete tag shape and allowlist, then drop/rebuild assets.
      const script=node.tagName==='SCRIPT',names=[...node.attributes].map(a=>a.name).sort();
      const allowedNames=script?['data-v3-owned','defer','src']:['data-v3-owned','href','rel'];
      const target=node.getAttribute(script?'src':'href')||'';
      if(JSON.stringify(names)!==JSON.stringify(allowedNames)||(!script&&(node.tagName!=='LINK'||node.getAttribute('rel')!=='stylesheet'))||!/^\/(?:css\/v3-(?:platform|events)\.css|js\/v3-(?:search-core|affiliate|planner|events)\.js)\?v=[a-f0-9]{12}$/.test(target))throw new Error('Unreviewed V3 asset in German source: '+route);
      continue;
    }
    const index=remaining.indexOf(fingerprint(node));
    if(index<0)throw new Error('Unreviewed V3 content in German source: '+route+' ('+node.getAttribute('data-v3-owned')+')');
    remaining.splice(index,1);
  }
  // The legacy editorial pass also indexes managed headings in its own TOC.
  // Remove only exact links to validated owned headings: the fresh renderer
  // does not retain legacy-generated heading IDs, so these links would be stale.
  const ownedHeadings=new Map([...document.querySelectorAll('[data-v3-owned] h2[id],[data-v3-owned] h3[id]')].map(node=>[node.id,node.textContent]));
  let tocChanged=false;
  for(const link of document.querySelectorAll('.ts3-contents[data-product-30] a[href],.ts3-character-sections[data-characters-generated] a[href]')) {
    const target=new URL(link.getAttribute('href'),'https://tilessurvive.net'+publicRoute);
    if(target.origin==='https://tilessurvive.net'&&target.pathname===publicRoute&&ownedHeadings.get(target.hash.slice(1))===link.textContent){link.remove();tocChanged=true;}
  }
  // A legacy builder may omit a whole managed block. Recreate it from the DE
  // owner at the end rather than borrowing English text or expanding a catalog.
  return {source:withoutOwned(tocChanged?document.toString():source),owned:true};
}
function render(source, translate, route) {
  const v3=prepareV3Source(source,'en',route);source=v3.source;
  const finishV3=html=>v3.owned?require('./build-v3-platform').project(html,'de','/de/'+route.replace(/index\.html$/,'')):html;
  // The retained Undine skill_2 key supersedes this page's old editorial name.
  // Accept the corrected EN source on subsequent builds without teaching the
  // global dictionary that Travis's distinct Wild Hunt is the same skill.
  if(route==='heroes/undine/index.html') {
    const entry=require('../data/i18n/contextual-terms.json').entries.find(row=>row.id==='undine-skill-2'),inherited=translate;
    const name=entry.names.de.value;
    translate=(raw,context)=>{
      const text=clean(raw);
      if(text===entry.officialEnglishName)return raw.replace(raw.trim(),name);
      if(text===entry.officialEnglishName+' · allied back-row ATK')return raw.replace(raw.trim(),name+' · Allied Backrow ATK');
      return inherited(raw,context);
    };
  }
  // Building pages now have an independent, reviewed six-language owner.
  // Keep the German shell rather than retranslating its rendered source model.
  if(route.startsWith('buildings/')&&source.includes('data-building-system')){
    const current=fs.readFileSync(path.join(ROOT,'de',route),'utf8'),owner=require('./build-building-system');
    return finishV3(route==='buildings/index.html'?owner.catalog(current,'de'):owner.project(current,'de',route.split('/')[1]));
  }
  // Building controls have their own reviewed wording. Keep those overrides
  // local to building routes so a shared word such as "Details" does not
  // overwrite the established translation in hero or season content.
  if(route.startsWith('buildings/')) {
    const scoped={exact:{}};addBuildingCopy(scoped);const inherited=translate;
    translate=(raw,context)=>{const text=clean(raw),value=scoped.exact[text];return typeof value==='string'?raw.replace(raw.trim(),germanNumbers(text,value)):inherited(raw,context);};
  }
  const {document} = parseHTML(source);
  // The Power Plant section has reviewed copy in all six languages. Do not
  // feed its localized number buttons or inline model through the EN catalog.
  const powerPlantOwned=route==='buildings/power-plant/index.html'&&document.querySelector('[data-power-plant-original]');
  if(powerPlantOwned){const slot=document.createElement('section');slot.setAttribute('data-power-plant-original','');powerPlantOwned.replaceWith(slot);}
  require('./content-60-owned').strip(document);
  require('./build-pet-skill-levels').stripOwnedSections(document, 'en');
  require('./strip-refinement-51').strip(document);
  // These six-language sections are regenerated by their owning late builders.
  document.querySelectorAll('[data-growth-50],[data-growth-research-50],[data-growth50-asset],[data-package-offer-50],[data-event-calendar-entry]').forEach(node=>node.remove());
  document.documentElement.lang='de'; document.documentElement.dataset.lang='de';
  // Display-localized cells retain their source lexemes for existing numeric readers.
  for(const cell of document.querySelectorAll('td')) cell.setAttribute('data-ts-original-value',cell.textContent.trim());
  function visit(node) {
    if(node.nodeType===1&&node.hasAttribute('data-v3-owned'))return;
    if (node.nodeType===3 && !['SCRIPT','STYLE'].includes(node.parentNode?.tagName) && !node.parentElement?.closest('[lang]:not([lang="en"]):not(html),.ts3-language nav,.language-switcher')) node.textContent=translate(node.textContent,route+':text');
    for (const child of [...(node.childNodes||[])]) visit(child);
  }
  visit(document);
  for (const el of document.querySelectorAll('*')) {
    if(el.closest('[data-v3-owned]'))continue;
    for (const attr of ['alt','title','aria-label','placeholder','data-idle','data-results','data-error']) if(el.hasAttribute(attr)) el.setAttribute(attr,translate(el.getAttribute(attr),route+':'+attr));
    for (const attr of ['href','action','data-search-url']) if(el.hasAttribute(attr)) {
      if(el.matches('link[rel="alternate"],a[hreflang],.ts3-language a[lang]')) continue;
      el.setAttribute(attr,el.getAttribute(attr).replace(/^(https:\/\/tilessurvive\.net)?\/en(?=\/|$)/,'$1/de'));
    }
    if(el.tagName==='META') {
      const key=el.getAttribute('name')||el.getAttribute('property');
      // Legacy aliases arrive from the English tree. Keep their automatic move
      // in the same language as the localized canonical and Continue link.
      if((el.getAttribute('http-equiv')||'').toLowerCase()==='refresh')el.setAttribute('content',(el.getAttribute('content')||'').replace(/^(\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*["']?)(https:\/\/tilessurvive\.net)?\/en(?=\/|$)/i,'$1$2/de'));
      if(['description','keywords','og:title','og:description','twitter:title','twitter:description'].includes(key)) el.setAttribute('content',translate(el.getAttribute('content')||'',route+':meta'));
      if(['og:url','twitter:url'].includes(key))el.setAttribute('content',el.getAttribute('content').replace('/en/','/de/'));
      if(key==='og:locale')el.setAttribute('content','de_DE');
    }
  }
  for (const script of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
    if(script.closest('[data-v3-owned]'))continue;
    // This is the complete equivalent-route map, not an EN-language content
    // dictionary. Every locale, including DE's own exact slug, must survive.
    if(script.id==='ts-locale-routes')continue;
    if(script.id==='ts-global-ui') {
      script.textContent=JSON.stringify(projectGlobalUI(JSON.parse(script.textContent))).replace(/</g,'\\u003c');
      continue;
    }
    script.textContent=JSON.stringify(localizeJSON(JSON.parse(script.textContent),translate,route+':json','',script.id==='ts3-copy'));
  }
  for(const script of document.querySelectorAll('script:not([src])'))if(!script.type?.includes('json')&&!script.closest('[data-v3-owned]'))script.textContent=localizeProgram(script.textContent,translate,route);
  // The canonical language routes are completed by the shared six-language finalizer.
  const langNav=document.querySelector('.ts3-language nav');
  if(langNav){for(const a of langNav.querySelectorAll('a')){if(a.lang==='de')a.remove();else a.removeAttribute('aria-current');}const a=document.createElement('a');a.href='/de/'+route.replace(/index\.html$/,'');a.lang='de';a.setAttribute('hreflang','de');a.textContent='Deutsch';a.setAttribute('aria-current','page');langNav.append(a);document.querySelector('.ts3-language summary').textContent='DE';}
  for(const item of document.querySelectorAll('[data-pet-name]')){const n=item.querySelector('h3')?.textContent;if(n)item.dataset.petName+=' '+n;}
  const output=document.toString();
  return finishV3(powerPlantOwned?require('./build-power-plant-original').project(output,'de/'+route):output);
}
function addBuildingCopy(catalog){
  // Building UI is owned by the six-language 5.3 renderer; reuse its reviewed copy.
  const buildingCopy=require('./build-building-ux-53').copy;
  for(const key of Object.keys(buildingCopy.en))catalog.exact[buildingCopy.en[key]]=buildingCopy.de[key];
  catalog.exact['← '+buildingCopy.en.back]='← '+buildingCopy.de.back;
  for(const range of ['Lv.1–30','Lv.1–60'])for(const kind of ['cost','effect'])catalog.exact[buildingCopy.en.known+' · '+range+' · '+buildingCopy.en[kind]]=buildingCopy.de.known+' · '+range+' · '+buildingCopy.de[kind];
  catalog.exact[buildingCopy.en.known+' · '+buildingCopy.en.unknown]=buildingCopy.de.known+' · '+buildingCopy.de.unknown;
}
function build({inventoryPath}={}) {
  const catalog=fs.existsSync(DATA)?JSON.parse(fs.readFileSync(DATA,'utf8')):{exact:{}};
  for(const name of ['german-core-review.json','german-hero-review.json','german-calculator-review.json','german-growth-review.json','german-editorial-review.json','german-root-overrides.json','german-building-review.json','german-client52-review.json']){const file=path.join(ROOT,'data/product-50',name);if(fs.existsSync(file))Object.assign(catalog.exact,JSON.parse(fs.readFileSync(file,'utf8')).exact);}
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
module.exports={addBuildingCopy,build,render,localizeJSON,createTranslator,localizeProgram,projectGlobalUI,germanNumbers,prepareV3Source};
if(require.main===module){const i=process.argv.indexOf('--inventory');console.log(JSON.stringify(build({inventoryPath:i>=0?path.resolve(process.argv[i+1]):null})));}
