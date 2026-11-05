'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization'),G=require('./build-global-locales'),DE=require('./build-german-50'),CN=require('./build-simplified-chinese'),A=require('./build-hero-atlas'),V4=require('./v4-workbench-content'),V6=require('./build-v6-system');
const ROOT=path.resolve(__dirname,'..'),codes=L.registry.locales.map(l=>l.code),groups=L.routeGroups();
const routeIds=['heroes/','heroes/lava/','heroes/sarge/','heroes/undine/'];
const groupFor=id=>{const g=groups.find(x=>x.id===id);assert(g,id+' route');return g;};
// The approved lifecycle reapplies V4 after atlas content and V6 presentation
// last. Exact reviewed owners are validated before projection; no data is ignored.
const projectComplete=(html,locale,route)=>V6.project(V4.project(A.project(html,locale,route),locale,route),locale,route);
const readSource=(id,locale='en')=>{const g=groupFor(id),route=g.routes[locale],file=path.join(ROOT,route.slice(1),'index.html');assert(fs.existsSync(file),'Missing reviewed source '+route);const source=fs.readFileSync(file,'utf8');V4.validateOwnership(source,locale,route);V6.validateOwnership(source,locale,route);return projectComplete(source,locale,route);};
const ownerSnapshot=document=>[...document.querySelectorAll('[data-hero-atlas-owned]')].filter(n=>!n.parentElement?.closest('[data-hero-atlas-owned]')).map(n=>n.outerHTML);
// CN preview keeps a lowercase doctype and appends its exact noindex directive
// after the data owners. Reprojection can move that one tag before the owners.
// Preserve its value and multiplicity, and every other byte, while comparing.
const canonicalPreviewMarkup=html=>{const declaration='<meta content="noindex,nofollow" name="robots">';let out=html.replace(/^<!doctype html>/i,'<!DOCTYPE html>');if(out.includes(declaration)){assert.equal(out.split(declaration).length-1,1);assert(out.indexOf(declaration)<out.indexOf('</head>'));out=out.replace(declaration,'').replace('</head>',declaration+'</head>');}return out;};
function originalNumbers(document){const out={};for(const n of document.querySelectorAll('script[type="application/json"]')){if(n.closest('[data-hero-atlas-owned],[data-v3-owned]')||['ts-global-ui','ts-locale-routes'].includes(n.id))continue;const values=[];const visit=(v,p)=>{if(typeof v==='number'||v===null||typeof v==='boolean'||typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v))values.push([p,v]);else if(Array.isArray(v))v.forEach((x,i)=>visit(x,p+'.'+i));else if(v&&typeof v==='object')for(const k of Object.keys(v).sort())visit(v[k],p+'.'+k);};visit(JSON.parse(n.textContent),'$');if(values.length)out[n.id||n.outerHTML.match(/data-[\w-]+/)?.[0]]=values;}return out;}
function checkOutput(html,locale,id){const g=groupFor(id),d=parseHTML(html).document;A.validateOwnership(html,locale,g.routes[locale]);V4.validateOwnership(html,locale,g.routes[locale]);assert.equal(canonicalPreviewMarkup(projectComplete(html,locale,g.routes[locale])),canonicalPreviewMarkup(html),'Atlas + exact V4/V6 lifecycle idempotence '+locale+' '+id);assert.equal(d.querySelectorAll('[data-v4-owned="navigation"]').length,id==='heroes/'?1:0);if(id==='heroes/')assert.equal(d.querySelector('[data-v4-owned="navigation"] a').getAttribute('href'),'/'+locale+'/tools/#v4-formation');assert(d.querySelector('[data-hero-atlas-owned]'));assert.equal(d.querySelector('link[rel="canonical"]').href,L.publicOrigin+g.routes[locale]);
 if(id==='heroes/'){const cfg=JSON.parse(d.querySelector('[data-atlas-config]').textContent);assert.equal(cfg.locale,locale);assert.equal(d.querySelectorAll('.hero-atlas-card').length,37);assert.equal(d.querySelectorAll('.hero-atlas-card[data-publication="published"]').length,31);assert.equal(d.querySelectorAll('.hero-atlas-card[data-publication="held"]').length,6);assert.equal(d.querySelectorAll('.hero-item').length,0);assert.equal(d.querySelectorAll('[data-character-empty]').length,0);}
 for(const n of d.querySelectorAll('script[type="application/ld+json"][data-hero-atlas-owned]')){const x=JSON.parse(n.textContent);if(x['@type']==='WebPage'){assert.equal(x.url,L.publicOrigin+g.routes[locale]);assert.equal(x.inLanguage,L.byCode.get(locale).htmlLang);}if(x['@type']==='BreadcrumbList')for(const row of x.itemListElement||[]){const value=typeof row.item==='string'?row.item:row.item?.['@id'];if(value){const url=new URL(value,L.publicOrigin);assert(url.pathname==='/'||url.pathname.startsWith('/'+locale+'/'),'Localized breadcrumb '+locale+' '+id+' '+value);}}}
 V6.validateOwnership(html,locale,g.routes[locale]);return d;
}

test('the canonical route manifest preserves the exact 120 old groups and permits only reviewed X-SSR introductions',()=>{
 assert(CN.validateRouteManifest(groups));assert.throws(()=>CN.validateRouteManifest(groups.filter(g=>g.id!=='heroes/lava/')),/reviewed|Missing/);
 const wrong=groups.map(g=>g.id==='heroes/lava/'?{...g,id:'heroes/alita/'}:g);assert.throws(()=>CN.validateRouteManifest(wrong),/Lava|Duplicate/);
 const renamed=groups.map(g=>g.id==='heroes/sarge/'?{...g,id:'heroes/other/'}:g);assert.throws(()=>CN.validateRouteManifest(renamed),/original 120/);
 assert.throws(()=>CN.validateRouteManifest([...groups,groups[0]]),/Duplicate/);
});

test('four real atlas route shapes regenerate in every ordinary new locale without generic owner translation or numeric-model changes',()=>{
 const targets=codes.filter(c=>!L.existing.has(c)&&c!=='zh-cn');assert.equal(targets.length,14);let checked=0;
 for(const id of routeIds){const g=groupFor(id),source=readSource(id),numbers=originalNumbers(parseHTML(source).document);
  for(const locale of targets){const t=L.createTranslator(locale,G.catalogFor(locale)),document=G.localizePage(source,locale,g,groups,t);assert.deepEqual([...t.missing],[],locale+' '+id+' missing');assert.deepEqual(t.errors,[],locale+' '+id+' inconsistent');
   const output=G.enhance(document,locale,g,codes,require('../data/i18n/ui/'+locale+'.json'),{preview:false}),d=checkOutput(output,locale,id);assert.deepEqual(originalNumbers(d),numbers,locale+' '+id+' original numeric data');checked++;
  }
 }assert.equal(checked,56);
});

test('German keeps atlas text and assets outside its generic catalog while retaining the original detail structure',()=>{
 for(const id of routeIds){const source=readSource(id),calls=[],route=id+'index.html';const output=DE.render(source,text=>{calls.push(text.trim());return text;},route),d=checkOutput(output,'de',id);
  if(id==='heroes/'){assert.equal(d.querySelector('[data-atlas-config]')&&JSON.parse(d.querySelector('[data-atlas-config]').textContent).copy.compare,A.copy('de').compare);assert(!calls.includes(A.copy('en').includeHeld));}
  if(!['heroes/','heroes/lava/'].includes(id)){assert(d.querySelector('.ts3-character-stage'));assert(d.querySelectorAll('.ts-skill').length>0);}
 }
});

test('Traditional-to-Simplified Chinese uses the reviewed atlas owner and preserves original JSON numbers',()=>{
 for(const id of routeIds){const source=readSource(id,'zh-tw'),before=originalNumbers(parseHTML(source).document),out=CN.localizePage(source,groupFor(id),groups),d=checkOutput(out.html,'zh-cn',id);
  assert.equal(d.documentElement.lang,'zh-Hans');assert.equal(d.querySelector('meta[name="robots"]').content,'noindex,nofollow');assert.deepEqual(originalNumbers(d),before,id+' original numeric data');
  const expected=parseHTML(A.project(out.html,'zh-cn',groupFor(id).routes['zh-cn'])).document;assert.deepEqual(ownerSnapshot(parseHTML(V6.strip(out.html)).document),ownerSnapshot(expected));
 }
});

test('all three localization entry points reject changed reviewed owner text and substituted atlas assets',()=>{
 for(const mutate of [d=>{d.querySelector('[data-atlas-field="status"]').textContent='Guaranteed released today';},d=>{d.querySelector('script[data-hero-atlas-owned="assets"]').src='https://unreviewed.invalid/atlas.js';},d=>{d.querySelector('title[data-hero-atlas-owned]').textContent='Unreviewed title';}]){
  const en=parseHTML(readSource('heroes/')).document;mutate(en);const changed=en.toString(),g=groupFor('heroes/');
  assert.throws(()=>G.localizePage(changed,'fr',g,groups,L.createTranslator('fr',G.catalogFor('fr'))),/atlas|Atlas/);
  assert.throws(()=>DE.render(changed,x=>x,'heroes/index.html'),/atlas|Atlas/);
  const tw=parseHTML(readSource('heroes/','zh-tw')).document;mutate(tw);assert.throws(()=>CN.localizePage(tw.toString(),g,groups),/atlas|Atlas/);
 }
});

test('the V3 build lifecycle reapplies the atlas without a recursive npm hook',()=>{
 const scripts=require('../package.json').scripts;
 assert.equal(scripts['postbuild:v3'],'npm run build:hero-atlas');
 assert.equal(scripts['build:hero-atlas'],'node scripts/build-hero-atlas.js && node scripts/build-hero-atlas-search.js && node scripts/v4-workbench-content.js && node scripts/build-v4-search.js && node scripts/build-v3-search.js');
 assert(!/npm\s+run\s+build:v3/.test(scripts['build:hero-atlas']));
});

test('in-memory V3 regeneration preserves all 672 reviewed atlas outputs and every original numeric model',()=>{
 const P=require('./build-v3-platform');let count=0;
 const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
 const comparable=html=>{const blocks=html.match(/<!-- TS_V3_ASSETS_BEGIN -->[\s\S]*?<!-- TS_V3_ASSETS_END -->/g);assert.equal(blocks?.length,1,'exactly one reviewed V3 asset block');return parseHTML(html.replace(blocks[0],'').replace('</head>',blocks[0]+'</head>')).document.toString();};
 const owned=groups.filter(g=>A.isOwnedRoute(g.routes.en));assert.equal(owned.length,32);
 for(const group of owned)for(const locale of codes){
  const route=group.routes[locale],source=fs.readFileSync(path.join(ROOT,route.slice(1),'index.html'),'utf8');
  A.validateOwnership(source,locale,route);V4.validateOwnership(source,locale,route);V6.validateOwnership(source,locale,route);
  const before=parseHTML(V6.strip(source)).document;
  const output=P.project(source,locale,route),after=parseHTML(output).document;
  A.validateOwnership(output,locale,route);assert.deepEqual(ownerSnapshot(after),ownerSnapshot(before),locale+' '+group.id+' exact atlas owner preserved');
  assert.deepEqual(originalNumbers(after),originalNumbers(before),locale+' '+group.id+' unchanged numeric models');
  // V3 appends its reviewed assets after existing metadata; on new Lava pages
  // this moves that block past the newly introduced Breadcrumb JSON-LD. Permit
  // only this block position and normal DOM serialization, retaining all of
  // its exact contents and every other node. The complete cycle then settles.
  const final=projectComplete(output,locale,route);V4.validateOwnership(final,locale,route);
  assert.equal(digest(comparable(final)),digest(comparable(source)),locale+' '+group.id+' full content after the approved lifecycle');
  assert.equal(digest(projectComplete(P.project(final,locale,route),locale,route)),digest(final),locale+' '+group.id+' subsequent complete lifecycle byte-idempotence');count++;
 }
 assert.equal(count,672);
});
test('all localization entry points reject forged V4 navigation while preserving exact atlas and numeric owners',()=>{
 for(const sourceLocale of ['en','zh-tw']){const g=groupFor('heroes/'),d=parseHTML(readSource('heroes/',sourceLocale)).document,link=d.querySelector('[data-v4-owned="navigation"] a');assert(link);link.setAttribute('href','https://unreviewed.invalid/');const bad=d.toString();if(sourceLocale==='en'){assert.throws(()=>G.localizePage(bad,'fr',g,groups,L.createTranslator('fr',G.catalogFor('fr'))),/V4/);assert.throws(()=>DE.render(bad,x=>x,'heroes/index.html'),/V4/);}else assert.throws(()=>CN.localizePage(bad,g,groups),/V4/);}
});
