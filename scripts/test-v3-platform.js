'use strict';
// Read-only integration checks against the original data and task-start release. No build,
// browser automation, network request, or public write is performed here.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),BASE='c1d9151593f621249338409c6fcbc8972f0514a5',ORIGINAL='edbac42bb41ba4289c24caa5635e388f1cd80e53',TASK_START='c24bf28940a8e2322b71764140e3c687377e12a1';
const P=require('./build-v3-platform'),A=require('./v3-affiliate-content'),registry=require('../data/i18n/locales.json'),codes=registry.locales.map(l=>l.code);
const Atlas=require('./build-hero-atlas');
const HeroPet=require('./build-hero-pet-pages');
const V4=require('./v4-workbench-content');
const System=require('./build-v6-system'),Privacy=require('./build-analytics-privacy'),Analytics=require('./analytics-invariants'),Reviewed=require('./reviewed-routes');
const petRoutes=new Set(codes.flatMap(locale=>[null,...require('../data/hero-pet-relations.json').pets.map(p=>p.id)].map(id=>`/${locale}/database/pet-system/${id?id+'/':''}`)));
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8'),lf=value=>value.replaceAll('\r\n','\n'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const git=(args,options={})=>execFileSync('git',args,{cwd:ROOT,maxBuffer:150e6,...options});
const filesAt=commit=>git(['ls-tree','-r','--name-only',commit],{encoding:'utf8'}).trim().split('\n');
function batch(files,commit=BASE){
  const bytes=git(['cat-file','--batch'],{input:files.map(file=>commit+':'+file).join('\n')+'\n'}),out=new Map();let offset=0;
  for(const file of files){const end=bytes.indexOf(10,offset),header=bytes.subarray(offset,end).toString(),m=/^[a-f0-9]+ blob (\d+)$/.exec(header);assert(m,file+' missing baseline: '+header);offset=end+1;const size=Number(m[1]);out.set(file,bytes.subarray(offset,offset+size).toString('utf8'));offset+=size+1;}
  assert.equal(offset,bytes.length);return out;
}
const cacheFiles=['building-system','platform-search','product-30','platform-affiliate','affiliate-tracking'];
const normalizeCache=html=>html.replace(new RegExp('(/js/(?:'+cacheFiles.join('|')+')\\.js)\\?v=[a-f0-9]+','g'),'$1?v=REVIEWED_RUNTIME');
function inherited(html){return normalizeCache(lf(A.transformAnalytics(P.strip(html))));}
function knownTopupCorrection(html,locale){
  const d=parseHTML(html).document,p=d.querySelector('[data-topup-step="2"] p');if(!p)return html;
  const before=p.outerHTML;p.textContent=require('../data/v3-affiliate-copy.json').locales[locale].faq[3][1];p.setAttribute('data-v3-owned','topup-step');
  assert(html.includes(before),'Exact legacy topup paragraph must be replaceable '+locale);html=html.replace(before,p.outerHTML);
  // The TEN policy update authorizes replacing this one inherited bookmark
  // section and its same-page TOC labels. Compare the exact renderer result;
  // do not strip arbitrary content or permit changes to neighboring sections.
  const section=d.querySelector('[data-bookmark-cta]')?.closest('section');assert(section,locale+' inherited bookmark section');
  const id=section.querySelector('h2')?.id;assert(id,locale+' inherited bookmark anchor');
  const candidates=[section,...d.querySelectorAll('a[href]')].filter(node=>{
    if(node===section)return true;
    const u=new URL(node.getAttribute('href'),'https://tilessurvive.net/'+locale+'/top-up/');
    return u.origin==='https://tilessurvive.net'&&u.pathname==='/'+locale+'/top-up/'&&u.hash==='#'+id;
  });
  const legacyFaq=d.querySelector('.topup-faq > details'),legacyDisclosure=d.querySelector('p.topup-disclosure');
  assert(legacyFaq&&legacyDisclosure,locale+' exact legacy benefit-copy targets');candidates.push(legacyFaq,legacyDisclosure);
  const previous=candidates.map(node=>({node,html:node.outerHTML}));
  const benefits=require('./ten-benefits-content');benefits.projectBookmark(d,locale);benefits.projectLegacyBenefitCopy(d,locale);
  for(const old of previous)if(old.html!==old.node.outerHTML){assert(html.includes(old.html),'Exact authorized bookmark node must exist '+locale);html=html.replace(old.html,old.node.outerHTML);}
  return html;
}
function metadata(html){
  const head=parseHTML(html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)?.[0]||'<head></head>').document;
  const tags=[...head.querySelectorAll('title,meta,link[rel="canonical"],link[rel="alternate"][hreflang]')].map(n=>[n.tagName,[...n.attributes].map(a=>[a.name,a.value]).sort(),n.tagName==='TITLE'?n.textContent:'']);
  const json=[...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>JSON.parse(m[1]));
  return {tags,json};
}
function ads(html){return [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m=>m[0]).filter(s=>/adsbygoogle|googlesyndication|fundingchoices|__tcfapi|__gpp/i.test(s)).map(lf);}
function numericModels(d){
  const out={};
  for(const script of d.querySelectorAll('script[type="application/json"]')){
    if(script.closest('[data-v3-owned],[data-v4-owned],[data-v5-owned]')||['ts-global-ui','ts-locale-routes'].includes(script.id))continue;
    const key=script.id||[...script.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name).sort().join('|'),values=[];
    function visit(value,p){if(typeof value==='number'||typeof value==='string'&&/^-?\d+(?:\.\d+)?$/.test(value))values.push([p,value]);else if(Array.isArray(value))value.forEach((v,i)=>visit(v,p+'.'+i));else if(value&&typeof value==='object')for(const k of Object.keys(value).sort())visit(value[k],p+'.'+k);}
    visit(JSON.parse(script.textContent),'$');if(values.length)out[key]=values;
  }return out;
}
function canonicalInherited(html){
  // V3 content is separately checked against its exact native owner. Asset
  // groups may move when owners run; their actual current hashes are checked
  // before this comparison. Normalize only line endings and whitespace-only
  // layout nodes, retaining every visible word, program, model and attribute.
  const d=parseHTML(P.refreshRuntimeAssets(A.transformAnalytics(P.strip(System.strip(lf(html)))))).document;
  function node(n){if(n.nodeType===3)return n.textContent.trim()?['text',n.textContent]:null;if(n.nodeType===8)return ['comment',n.textContent];if(n.nodeType!==1)return null;return [n.tagName,[...n.attributes].map(a=>[a.name,a.value]).sort(),[...n.childNodes].map(node).filter(Boolean)];}
  return JSON.stringify(node(d.documentElement));
}
function sameContent(before,after,file,locale){
  const route='/'+file.replace(/index\.html$/,'');Analytics.preserved(before,after);System.validateOwnership(after,locale,route);
  if(file===locale+'/privacy/index.html'){before=Privacy.project(before,locale);Privacy.validateOwnership(after,locale);}
  P.validateOwnership(System.strip(after),locale,route);
  for(const script of parseHTML(after).document.querySelectorAll('script[src]')){const url=new URL(script.getAttribute('src'),'https://tilessurvive.net'),relative=url.pathname.slice(1);if(url.origin==='https://tilessurvive.net'&&P.runtimeFiles.includes(relative))assert.equal(url.searchParams.get('v'),sha(fs.readFileSync(path.join(ROOT,relative))).slice(0,12),file+' current registered runtime '+relative);}
  const expected=canonicalInherited(before),actual=canonicalInherited(after);
  let i=0;if(expected!==actual)while(i<expected.length&&expected[i]===actual[i])i++;
  assert.equal(sha(actual),sha(expected),file+' original content differs at '+i+'; expected '+JSON.stringify(expected.slice(i,i+100))+'; actual '+JSON.stringify(actual.slice(i,i+100)));
}
function verifyManifest(d,locale,route,file){
  const rel=route.slice(locale.length+2),power=rel==='buildings/power-plant/',event=['events/','events/calendar/','tools/event-helper/'].includes(rel),topup=rel==='top-up/';
  const nav=['tools/','events/','tools/event-helper/','buildings/power-plant/','events/calendar/','top-up/'].includes(rel);
  const trust=Boolean(d.querySelector('[data-building-system]'))||rel==='database/research/';
  for(const [selector,count]of [['[data-v3-owned="planner"]',+power],['[data-v3-owned="events"]',event?2:0],['[data-v3-owned="affiliate"]',+topup],['[data-v3-owned="navigation"]',+nav],['[data-v3-owned="trust"]',+trust],['[data-v3-owned="privacy"]',0],['[data-v3-owned="topup-step"]',+topup],['[data-v3-owned="topup-bookmark"]',+topup],['[data-v3-owned="topup-bookmark-faq"]',+topup],['[data-v3-owned="topup-policy-disclosure"]',+topup]])assert.equal(d.querySelectorAll(selector).length,count,file+' exact feature manifest '+selector);
  assert(d.documentElement.hasAttribute('data-v3-platform'));assert(d.documentElement.hasAttribute('data-v3-affiliate'));
  assert.equal(d.querySelectorAll('[data-v3-ga-bootstrap]').length,1,file+' denied-default bootstrap');
  const bootstrap=d.querySelector('[data-v3-ga-bootstrap]').textContent;for(const key of ['analytics_storage','ad_storage','ad_user_data','ad_personalization'])assert(bootstrap.includes(key+":'denied'"),file+' '+key+' denied');assert(!/gtag\(['"]config/.test(bootstrap));assert(!bootstrap.includes('granted'));assert(bootstrap.includes('window.TS_V3_GA_IDS=["G-Z2MJ6TXZHK"]'));assert(bootstrap.includes("'url_passthrough',false"));assert(bootstrap.includes("'ads_data_redaction',true"));
  const scripts=[...d.querySelectorAll('script[src]')];
  const index=name=>scripts.findIndex(n=>n.getAttribute('src').split('?')[0]==='/js/'+name+'.js');
  for(const name of ['v3-search-core','analytics-contract','v3-affiliate']){assert.equal(scripts.filter(n=>n.getAttribute('src').startsWith('/js/'+name+'.js')).length,1,file+' '+name);assert(scripts[index(name)].hasAttribute('defer'));}
  assert(index('analytics-contract')<index('v3-affiliate'),file+' analytics schema executes before tracking');
  for(const name of ['platform-search','product-30'])if(index(name)>=0)assert(index('v3-search-core')<index(name),file+' search core executes first');
  assert.equal(index('v3-planner')>=0,power);assert.equal(index('v3-events')>=0,event||rel==='');
  assert.equal(d.querySelectorAll('[data-v3-consent]').length,0);assert.equal(d.querySelectorAll('[data-v3-consent] button').length,0);
  assert.equal(d.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').length,0,file+' GA loader remains controlled by the runtime objection and privacy-signal checks');
  for(const n of scripts){const src=n.getAttribute('src');const m=src.match(/^\/js\/((?:v3-[a-z-]+|analytics-contract|building-system|platform-search|product-30|platform-affiliate|affiliate-tracking)\.js)\?v=([a-f0-9]+)$/);if(m)assert.equal(m[2],sha(fs.readFileSync(path.join(ROOT,'js',m[1]))).slice(0,12),file+' latest runtime '+m[1]);}
  if(power){const c=JSON.parse(d.querySelector('[data-v3-planner-copy]').textContent);assert.deepEqual(c,require('../data/v3-planner-copy').locales[locale]);const m=JSON.parse(d.querySelector('[data-building-system-model]').textContent);assert.deepEqual(m.buildings[0].profiles.map(p=>p.id),['unified']);assert.equal(m.buildings[0].profiles[0].rows.length,30);assert.equal(d.querySelectorAll('#growth-plan').length,1);}
  if(event){const c=JSON.parse(d.getElementById('v3-events-data').textContent);assert.equal(c.locale,locale);assert.deepEqual(c.copy,require('../data/v3-events-copy.json').copy[locale]);assert.equal(c.events.length,3);assert.equal(c.events.flatMap(e=>e.profiles).length,7);assert.deepEqual(c.confirmedSchedules,[]);}
  if(topup){
    const a=d.querySelector('#v3-topup-guide [data-v3-cta="outbound"]');assert.equal(a.getAttribute('href'),A.TEN_URL);assert(a.rel.includes('sponsored'));
    assert.equal(d.querySelector('[data-topup-step="2"] p').textContent,require('../data/v3-affiliate-copy.json').locales[locale].faq[3][1]);assert.equal(d.querySelectorAll('.v3-topup-question').length,require('../data/v3-affiliate-copy.json').locales[locale].faq.slice(0,7).length);assert.equal(d.querySelectorAll('#v3-topup-guide [data-v61-ten="program"]').length,1);
    const bookmark=d.querySelector('[data-v3-owned="topup-bookmark"]'),heading=bookmark.querySelector('h2[id]'),values=require('./ten-benefits-content').get(locale).values;
    assert.equal(bookmark.querySelectorAll('[data-bookmark-cta]').length,1);assert.equal(d.querySelectorAll('[data-bookmark-hint]').length,1);assert(heading);assert.equal(heading.textContent,values.bookmarkTitle);
    assert.equal(d.querySelectorAll('#ten-bookmark').length,1);assert.equal(d.querySelectorAll('.v61-ten-guide[data-ten-bookmark-link][data-ten-placement="guide"]').length,1);assert.equal(d.querySelector('.v61-ten-guide[data-ten-bookmark-link]').getAttribute('href'),'/'+locale+'/top-up/#ten-bookmark');
    const toc=[...d.querySelectorAll('[data-v3-owned="topup-bookmark-link"]')];assert(toc.length>0,file+' retained bookmark contents link');
    for(const link of toc){assert.equal(link.textContent,heading.textContent);assert.equal(new URL(link.getAttribute('href'),'https://tilessurvive.net'+route).href,'https://tilessurvive.net/'+locale+'/top-up/#'+heading.id,file+' localized inherited bookmark URL');}
    const disclosure=d.querySelector('[data-v3-owned="topup-policy-disclosure"]');assert.equal(disclosure.querySelector('a').getAttribute('href'),'/'+locale+'/affiliate-disclosure/',file+' localized inherited policy link');
  }
  const benefitAssets=[...d.querySelectorAll('link[rel="stylesheet"]')].filter(n=>n.getAttribute('href').split('?')[0]==='/css/ten-benefits.css');assert.equal(benefitAssets.length,+topup,file+' TEN styles only on top-up pages');if(topup)assert.equal(benefitAssets[0].getAttribute('href'),'/css/ten-benefits.css?v='+sha(fs.readFileSync(path.join(ROOT,'css/ten-benefits.css'))).slice(0,12));
  const atlas=Atlas.isOwnedRoute(route),hub=rel==='heroes/',atlasCSS=[...d.querySelectorAll('link[rel="stylesheet"]')].filter(n=>n.getAttribute('href').split('?')[0]==='/css/hero-atlas.css'),atlasJS=scripts.filter(n=>n.getAttribute('src').split('?')[0]==='/js/hero-atlas.js');
  assert.equal(atlasCSS.length,+atlas,file+' atlas styles only on approved hero routes');assert.equal(atlasJS.length,+hub,file+' atlas runtime only on hubs');
  if(atlas){assert(d.querySelector('[data-hero-atlas-owned]'),file+' reviewed atlas owner');assert.equal(atlasCSS[0].getAttribute('href'),'/css/hero-atlas.css?v='+sha(fs.readFileSync(path.join(ROOT,'css/hero-atlas.css'))).slice(0,12));}
  if(hub){assert.equal(atlasJS[0].getAttribute('src'),'/js/hero-atlas.js?v='+sha(fs.readFileSync(path.join(ROOT,'js/hero-atlas.js'))).slice(0,12));assert(atlasJS[0].hasAttribute('defer'));assert.equal(d.querySelectorAll('.hero-atlas-card').length,37);assert.equal(d.querySelectorAll('.hero-atlas-card[data-publication="published"]').length,31);assert.equal(d.querySelectorAll('.hero-atlas-card[data-publication="held"]').length,6);}
  const petPage=petRoutes.has(route),petCSS=[...d.querySelectorAll('link[rel="stylesheet"]')].filter(n=>n.getAttribute('href').split('?')[0]==='/css/hero-pet.css');
  assert.equal(petCSS.length,+(atlas||petPage||rel==='tools/'),file+' hero/pet stylesheet only on reviewed routes');
  if(atlas||petPage||rel==='tools/'){assert.equal(petCSS[0].getAttribute('href'),HeroPet.asset().match(/href="([^"]+)"/)[1],file+' current hero/pet stylesheet');assert(petCSS[0].hasAttribute(atlas?'data-hero-atlas-owned':petPage?'data-hero-pet-owned':'data-v4-owned'));}
  assert.equal(d.querySelectorAll('[data-hero-pet-owned="pets"]').length,+petPage,file+' exact pet panel scope');
  if(petPage)HeroPet.validateOwnership(d.toString(),locale);
  if(V4.kindFor(route))V4.validateOwnership(d.toString(),locale,route);
  const originalIds=[...d.querySelectorAll('[id]')].map(n=>n.id),counts=new Map();originalIds.forEach(id=>counts.set(id,(counts.get(id)||0)+1));for(const [id,n]of counts)if(id.startsWith('v3-')||id==='growth-plan')assert.equal(n,1,file+' unique V3 anchor '+id);
}

if(require.main===module){
  test('all 21 native analytics shells remove legacy controls and keep exact denied bootstrap, schema order and inherited page data',()=>{
    for(const locale of codes){
      const route='/'+locale+'/about/',source='<html lang="'+locale+'"><head><title>Retained reference</title><link rel="canonical" href="https://tilessurvive.net'+route+'"><meta name="description" content="Retained description"></head><body><main><h1>Retained reference</h1><p id="original">Original guide</p><script type="application/json" id="original-numbers">{"cost":37,"time":120,"missing":null}</script><ins class="adsbygoogle" data-ad-client="ca-pub-review" data-ad-slot="777"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></main><!-- TS_V3_PRIVACY_BEGIN --><aside data-v3-owned="privacy" data-v3-consent><button>Allow</button><button>Deny</button></aside><!-- TS_V3_PRIVACY_END --></body></html>';
      const html=P.project(source,locale,route),d=parseHTML(html).document;verifyManifest(d,locale,route,locale+' in-memory shell');assert.equal(P.project(html,locale,route),html);assert.deepEqual(metadata(html),metadata(source));assert.deepEqual(ads(html),ads(source));assert.deepEqual(numericModels(d),numericModels(parseHTML(source).document));assert.equal(d.querySelector('#original').textContent,'Original guide');assert.equal(d.querySelectorAll('[data-ad-client="ca-pub-review"][data-ad-slot="777"]').length,1);
    }
  });
  test('all original 104 game/reference files retain exact data, with only the previously reviewed 11-code publication',()=>{
    const original=filesAt(ORIGINAL).filter(f=>/^data\//.test(f)&&/\.(json|js)$/.test(f)&&!/^data\/(?:i18n\/|search\/|search-index\.json)/.test(f));assert.equal(original.length,104);
    const files=[...original,'data/power-plant-unified.json','scripts/building-data/dependencies-2026-10-13.json'],old=batch(files);
    for(const file of files){
      if(file==='data/tilessurvive-coupons.json'){
        const prior=JSON.parse(old.get(file)),current=JSON.parse(read(file)),reviewed=batch([file],TASK_START).get(file);assert.equal(sha(lf(read(file))),sha(lf(reviewed)),file+' exact approved task-start model');assert.equal(prior.coupons.length,10);assert.equal(current.coupons.length,11);assert.deepEqual(current.coupons.filter(c=>!prior.coupons.some(p=>p.code===c.code)).map(c=>c.code),['THANKS40MLN']);for(const row of prior.coupons){const retained=current.coupons.find(c=>c.code===row.code);assert(retained,row.code);for(const [key,value]of Object.entries(row))assert.deepEqual(retained[key],value,row.code+' original '+key);}assert.equal(require('./gift-codes-content').validate(),true);
      }else assert.equal(sha(lf(read(file))),sha(lf(old.get(file))),file+' source content unchanged (LF-normalized checkout)');
    }
  });
  test('sitemap preserves 2522 original entries plus exactly 63 X-SSR and 21 reviewed Nuclear Age URLs; robots stays exact',()=>{
    const old=batch(['sitemap.xml','robots.txt']);assert.equal(lf(read('robots.txt')),lf(old.get('robots.txt')),'robots directives');
    const entries=html=>new Map([...html.matchAll(/<url>\s*<loc>(.*?)<\/loc>[\s\S]*?<\/url>/g)].map(m=>[m[1],m[0]]));
    const before=entries(lf(old.get('sitemap.xml'))),after=entries(lf(read('sitemap.xml')));assert.equal(before.size,2522);assert.equal(after.size,2606);assert.equal(lf(read('sitemap.xml')),lf(batch(['sitemap.xml'],TASK_START).get('sitemap.xml')),'Sitemap remains exact from task start');
    assert.equal([...read('sitemap.xml').matchAll(/<loc>/g)].length,after.size,'unique sitemap entries');
    for(const [url,entry]of before)assert.equal(after.get(url),entry,'preserved sitemap node '+url);
    assert.deepEqual([...after.keys()].filter(url=>!before.has(url)).sort(),[...codes.flatMap(locale=>['lava','furiosa','alita'].map(id=>'https://tilessurvive.net/'+locale+'/heroes/'+id+'/')),...Reviewed.routes().map(r=>'https://tilessurvive.net'+r.route)].sort());
  });
  const legacyTracked=filesAt(BASE).filter(f=>codes.includes(f.split('/')[0])&&f.endsWith('/index.html')),tracked=filesAt(TASK_START).filter(f=>codes.includes(f.split('/')[0])&&f.endsWith('/index.html'));
  assert.equal(legacyTracked.length,2537);assert.equal(tracked.length,2621);
  assert.deepEqual(tracked.filter(f=>!legacyTracked.includes(f)).sort(),codes.flatMap(locale=>['heroes/lava/','heroes/furiosa/','heroes/alita/','eras/nuclear-age/'].map(route=>locale+'/'+route+'index.html')).sort(),'Only reviewed routes were added before this task');
  for(const locale of codes)test(locale+': every task-start locale page preserves original content/SEO/ads and its exact current owner manifest',()=>{
    const files=tracked.filter(f=>f.startsWith(locale+'/')),old=batch(files,TASK_START),failures=[],expectedCanonical=[],actualCanonical=[];
    const isCanonical=(d,route)=>d.querySelector('link[rel="canonical"]')?.getAttribute('href')==='https://tilessurvive.net'+route&&!/noindex/i.test(d.querySelector('meta[name="robots"]')?.content||'');
    for(const file of files){try{
      const before=old.get(file),current=read(file),d=parseHTML(current).document,prior=parseHTML(before).document,route='/'+file.replace(/index\.html$/,'');
      if(isCanonical(prior,route))expectedCanonical.push(route);if(isCanonical(d,route))actualCanonical.push(route);
      assert.deepEqual(metadata(current),metadata(before),file+' exact task-start SEO/schema');assert.deepEqual(ads(current),ads(before),file+' exact AdSense/CMP scripts');
      if(d.documentElement.hasAttribute('data-v3-platform')&&!/noindex/i.test(d.querySelector('meta[name="robots"]')?.content||''))verifyManifest(d,locale,route,file);
      sameContent(before,current,file,locale);
      if(Atlas.isOwnedRoute(route))Atlas.validateOwnership(current,locale,route);
      if(route==='/'+locale+'/codes/')require('./build-gift-codes').validateOwnership(current,locale);
      if(route==='/'+locale+'/')require('./build-v5-landing').validateOwnership(current,locale);
      if(route===require('./build-nuclear-age').route(locale))require('./build-nuclear-age').validateOwnership(current,locale,route);
      if(require('./build-nuclear-age').linkRoutes(locale).includes(route))require('./build-nuclear-age').validateLinks(current,locale,route);
      if(/^\/[^/]+\/heroes\/(lava|furiosa|alita)\/$/.test(route)){
        const id=route.split('/')[3],alternatives=[...d.querySelectorAll('link[rel="alternate"][hreflang]')];assert.equal(alternatives.length,22);assert.equal(new Set(alternatives.map(a=>a.getAttribute('hreflang'))).size,22);
        for(const {code,hreflang}of registry.locales)assert(alternatives.some(a=>a.getAttribute('hreflang')===hreflang&&a.getAttribute('href')==='https://tilessurvive.net/'+code+'/heroes/'+id+'/'),file+' alternate '+code);
        assert(alternatives.some(a=>a.getAttribute('hreflang')==='x-default'&&a.getAttribute('href')==='https://tilessurvive.net/en/heroes/'+id+'/'));
      }
    }catch(error){failures.push({file,message:error.message});}}
    assert.deepEqual(failures,[],locale+' preservation/manifest errors');assert.deepEqual(actualCanonical.sort(),expectedCanonical.sort(),locale+' exact task-start canonical route set');
  });
  test('every derived search URL, fragment and alias provenance remains valid in the integrated site',()=>{
    const pages=new Map(),shardFiles=codes.map(locale=>'data/search/'+locale+'.json'),oldShards=batch(shardFiles),taskStartShards=batch(shardFiles,TASK_START),mainHeroRoutes=require('./build-hero-atlas-search').atlasRoutes();let count=0,retainedCount=0;
    for(const locale of codes){const original=JSON.parse(read('data/search/'+locale+'.json')),derived=JSON.parse(read('data/v3-search/'+locale+'.json'));assert.deepEqual(derived.items.map(({search,...record})=>record),original.items);
      assert.deepEqual(original,JSON.parse(taskStartShards.get('data/search/'+locale+'.json')),locale+' exact approved task-start search data');
      const baseline=JSON.parse(oldShards.get('data/search/'+locale+'.json')).items,byUrl=new Map(original.items.map(item=>[item.url,item]));
      assert.equal(byUrl.size,original.items.length,locale+' unique search records');
      assert.deepEqual(original.items.slice(0,baseline.length).map(item=>item.url),baseline.map(item=>item.url),locale+' every prior record and order retained');
      for(const item of baseline){const current=byUrl.get(item.url);assert(current,item.url+' retained search record');retainedCount++;
        if(mainHeroRoutes.has(item.url)||item.url==='/'+locale+'/'){const {title,description,...remaining}=current,{title:oldTitle,description:oldDescription,...oldRemaining}=item;assert.deepEqual(remaining,oldRemaining,item.url+' hero search changes only reviewed metadata');const doc=parseHTML(read(item.url.slice(1)+'index.html')).document;assert.equal(title,doc.querySelector('title').textContent.trim().replace(/\s+/g,' '));assert.equal(description,doc.querySelector('meta[name="description"]').getAttribute('content').trim().replace(/\s+/g,' '));}
        else assert.deepEqual(current,require('./v4-release-gate').projectOriginalSearchRow(item,locale),item.url+' unchanged search row or exact reviewed gift/TEN metadata');
      }
      assert.deepEqual(original.items.slice(baseline.length).map(item=>item.url).sort(),['/'+locale+'/heroes/furiosa/','/'+locale+'/heroes/alita/','/'+locale+'/heroes/lava/','/'+locale+'/heroes/lava/#lava-skills','/'+locale+'/heroes/lava/#lava-growth',...require('./build-v4-search').records(locale).map(r=>r.url),...Reviewed.searchRecords(locale).map(r=>r.url)].sort(),locale+' exact reviewed atlas, V4 and Nuclear Age additions');
      for(const item of derived.items){const u=new URL(item.url,'https://tilessurvive.net');assert.equal(u.origin,'https://tilessurvive.net');assert(u.pathname.startsWith('/'+locale+'/'));const file=u.pathname.slice(1)+'index.html';if(!pages.has(file))pages.set(file,read(file));if(u.hash){const id=decodeURIComponent(u.hash.slice(1));assert(new RegExp('\\bid=["\\\']'+id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\\\']').test(pages.get(file)),item.url+' real fragment');}
        for(const a of item.search.aliases){assert(codes.includes(a.language));assert.equal(typeof a.value,'string');assert(['site-label','site-alias','retained-client','retained-english-fallback','official-announcement','official-english-fallback'].includes(a.source));if(['ar','vi','nb'].includes(a.language))assert.notEqual(a.source,'retained-client');
          if(a.source==='retained-english-fallback'){assert(['ar','vi','nb'].includes(a.language));assert(item.search.hero,'Fallback is tied to an explicit client hero');const hero=require('./lib/xssr-catalog').heroes().find(h=>h.id===item.search.hero.formId);assert(hero);assert.equal(a.termKey,hero.nameKey);assert.equal(hero.names[a.language].status,'english-fallback');assert.equal(a.value,hero.names.en.value,'English fallback never claims a verified local client name');}
        }count++;
      }
    }
    assert.equal(retainedCount,9175);assert.equal(count,9364);
  });
  test('the shared TEN summary is an exact native mapping and altered or unrelated prose still fails translation review',()=>{
    const L=require('./lib/global-localization'),G=require('./build-global-locales'),TEN=require('./ten-benefits-content');
    for(const locale of codes.filter(c=>!L.existing.has(c)&&c!=='zh-cn')){const t=L.createTranslator(locale,G.catalogFor(locale));assert.equal(t.translate(TEN.summary('en'),'reviewed TEN metadata'),TEN.summary(locale));assert.deepEqual([...t.missing],[]);const altered=TEN.summary('en')+' UNREVIEWED_ADDED_PROMISE',unknown='UNREVIEWED_TEN_METADATA_FIXTURE';t.translate(altered,'changed TEN metadata');t.translate(unknown,'unrelated metadata');assert(t.missing.has(altered));assert(t.missing.has(unknown));}
  });
  test('future global regeneration keeps 14 locales times 3 V3 feature routes fully translated and owned',()=>{
    const L=require('./lib/global-localization'),G=require('./build-global-locales'),groups=L.routeGroups(),targets=codes.filter(c=>!L.existing.has(c)&&c!=='zh-cn');assert.equal(targets.length,14);let count=0;
    for(const id of ['buildings/power-plant/','events/calendar/','top-up/']){const group=groups.find(g=>g.id===id),source=read(group.file),originalNumbers=numericModels(parseHTML(source).document);
      for(const locale of targets){const t=L.createTranslator(locale,G.catalogFor(locale)),d=G.localizePage(source,locale,group,groups,t);assert.deepEqual([...t.missing],[],locale+' '+id+' missing');assert.deepEqual(t.errors,[],locale+' '+id+' errors');const html=G.enhance(d,locale,group,codes,require('../data/i18n/ui/'+locale+'.json'),{preview:false}),out=parseHTML(html).document;verifyManifest(out,locale,group.routes[locale],locale+'/'+id);assert.deepEqual(numericModels(out),originalNumbers,locale+' '+id+' every original numeric/numeric-string model leaf');assert.deepEqual(ads(html),ads(source));assert.equal(out.querySelector('link[rel="canonical"]').href,'https://tilessurvive.net'+group.routes[locale]);P.validateOwnership(System.strip(html),locale,group.routes[locale]);if(id==='top-up/'){const expected=require('./ten-benefits-content').summary(locale);for(const selector of ['meta[name="description"]','meta[property="og:description"]'])assert.equal(out.querySelector(selector).getAttribute('content'),expected,locale+' exact TEN metadata');const pages=[...out.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)).filter(j=>j['@type']==='WebPage'&&j.url==='https://tilessurvive.net/'+locale+'/top-up/');assert(pages.length>0);for(const page of pages)assert.equal(page.description,expected,locale+' exact TEN structured description');}assert.equal(System.project(V4.project(P.project(html,locale,group.routes[locale]),locale,group.routes[locale]),locale,group.routes[locale]),html,locale+' '+id+' V3→V4→V6 lifecycle idempotence');count++;}
    }assert.equal(count,42);
  });
}
module.exports={BASE,batch,inherited,sameContent,ads,metadata,verifyManifest};
