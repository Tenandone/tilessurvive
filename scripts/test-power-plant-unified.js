'use strict';

// Read-only release checks. Expected values come from the fixed pre-change
// source and independently audited prerequisite pins, never from the new join.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {parseHTML} = require('linkedom');
const root = path.resolve(__dirname, '..');
const BASE = 'f487f7317ac12fdcfc3a8d8179b4ea4a6cb0e198';
const sourceFile = 'data/client-buildings-52.json';
const pinFile = 'scripts/building-data/dependencies-2026-10-13.json';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const previous = file => execFileSync('git', ['show', BASE + ':' + file], {cwd:root, encoding:'utf8', maxBuffer:20e6});
const source = JSON.parse(previous(sourceFile));
const power = source.buildings.find(building => building.buildingId === 800005);
const aRows = power.profiles.find(profile => profile.id === 'original').levels;
const bRows = power.profiles.find(profile => profile.id === 'd').levels;
const pins = JSON.parse(previous(pinFile)).powerPlantProfiles.find(profile => profile.profile === 'd').rows;
const generator = require('./build-power-plant-unified-data');
const registry = require('./building-data-registry');
const builder = require('./build-building-system');
const runtime = require('../js/building-system');
const locales = require('../data/i18n/locales.json').locales;
// V3 adds reviewed, independently checked feature blocks and replaces the
// known GA bootstrap with explicit consent. Game models remain immutable.
const v3Preservation = require('./test-v3-platform');
const v3Publisher = require('./build-v3-platform');
const v3Affiliate = require('./v3-affiliate-content');
const tuple = q => [q.buildingId, q.level, q.rank];
const numeric = row => ({level:row.level,rank:row.rank,resources:row.resources,seconds:row.seconds,battlePower:row.battlePower,constructionItems:row.constructionItems.map(i=>({id:i.id??i.key??i.itemId,quantity:i.quantity??i.value})),requirements:row.requirements.map(q=>({buildingId:q.buildingId,level:q.level,rank:q.rank}))});
const expectedRows = aRows.map(a => ({...numeric(a), requirements:pins.find(p=>p.level===a.level&&p.rank===a.rank).requirements.map(([buildingId,level,rank])=>({buildingId,level,rank}))}));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const doc = html => parseHTML(html).document;
const payload = html => {
  const matches=[...html.matchAll(/<script\b[^>]*\bdata-building-system-model(?:=[^>]*)?[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(matches.length,1,'exactly one building payload');
  return JSON.parse(matches[0][1]);
};
// One Git process per locale avoids hundreds of shell launches. Parse blob
// lengths, not delimiter-like text that may legitimately occur inside HTML.
function baselineBatch(files) {
  const bytes=execFileSync('git',['cat-file','--batch'],{cwd:root,input:files.map(f=>BASE+':'+f).join('\n')+'\n',maxBuffer:100e6});
  let offset=0;const result=new Map();
  for(const file of files){const end=bytes.indexOf(10,offset),header=bytes.subarray(offset,end).toString('utf8'),match=header.match(/^[a-f0-9]+ blob (\d+)$/);assert(match,'baseline blob '+file+': '+header);const size=Number(match[1]);offset=end+1;result.set(file,bytes.subarray(offset,offset+size).toString('utf8'));offset+=size+1;}
  assert.equal(offset,bytes.length,'complete baseline batch');return result;
}

test('unified central data matches all 30 frozen A rows and all 63 independently pinned B prerequisites', () => {
  assert.equal(read(sourceFile).replaceAll('\r\n','\n'),previous(sourceFile).replaceAll('\r\n','\n'),'retained source is immutable');
  assert.equal(read(pinFile).replaceAll('\r\n','\n'),previous(pinFile).replaceAll('\r\n','\n'),'independent prerequisite pins are immutable');
  assert.deepEqual(bRows.map(r=>[r.level,r.rank,r.requirements.map(tuple)]),pins.map(r=>[r.level,r.rank,r.requirements]),'B source independently agrees with audited record IDs');
  const expected={schemaVersion:1,buildingId:800005,profile:'unified',resourceIds:source.resources.map(r=>r.id),rows:expectedRows};
  const actual=JSON.parse(read('data/power-plant-unified.json'));
  assert.deepEqual(actual,expected);
  assert.deepEqual(generator.createModel(source),expected);
  assert.equal(actual.rows.length,30);
  assert.equal(actual.rows.reduce((n,r)=>n+r.requirements.length,0),63);
  assert.equal(actual.rows.filter(r=>r.requirements.length>1).length,25);
  assert(actual.rows.every(r=>r.constructionItems.length===0),'no special material invented for the current source');
  assert.deepEqual(actual.rows.map(r=>r.rank),[...Array(29).fill(0),1]);
  assert.deepEqual(actual.rows.find(r=>r.level===15).requirements.map(tuple),[[800016,13,0],[800007,14,0],[800010,5,0]]);
  assert.deepEqual(actual.rows.find(r=>r.level===30).requirements.map(tuple),[[800012,29,0],[800007,29,0],[800147,26,0]]);
});

test('join refuses missing, duplicate and mismatched source identities instead of guessing or substituting zero', () => {
  const profiles=s=>s.buildings.find(b=>b.buildingId===800005).profiles;
  const a=s=>profiles(s).find(p=>p.id==='original').levels;
  const b=s=>profiles(s).find(p=>p.id==='d').levels;
  for(const mutate of [s=>a(s).pop(),s=>b(s).splice(14,1),s=>b(s)[29].rank=0,s=>a(s)[5].level=5,s=>b(s)[7].level=7,s=>a(s)[0].resources=null,s=>a(s)[1].resources[0]=null,s=>a(s)[9].seconds=null,s=>a(s)[0].battlePower=null,s=>a(s)[0].constructionItems=null,s=>b(s)[14].requirements=null,s=>b(s)[14].requirements.push({...b(s)[14].requirements[0]}),s=>delete b(s)[14].requirements[0].level,s=>profiles(s).push(structuredClone(profiles(s)[0]))]){
    const changed=structuredClone(source);mutate(changed);assert.throws(()=>generator.createModel(changed),undefined,'incomplete or ambiguous source must fail');
  }
  for(const level of [1,29,30]){const changed=structuredClone(source);for(const rows of [a(changed),b(changed)])rows[level-1].rank=level===30?0:1;assert.throws(()=>generator.createModel(changed),/rank/,'matching but unsupported A/B rank must fail');}
  const actual=JSON.parse(read('data/power-plant-unified.json'));
  for(const mutate of [m=>m.rows[9].seconds=bRows[9].seconds,m=>m.rows[0].resources[0]=100,m=>m.rows[14].requirements.splice(1,1),m=>m.rows[29].rank=0,m=>m.rows[0].constructionItems.push({id:999,quantity:1})]){
    const changed=structuredClone(actual);mutate(changed);assert.throws(()=>generator.validateModel(changed,source));
  }
  const irrelevant=structuredClone(source);b(irrelevant)[9].resources=[1,2,3,4];b(irrelevant)[9].seconds=1;
  assert.deepEqual(generator.createModel(irrelevant).rows,expectedRows,'B numerical fields never leak into the approved projection');
  const withItem=structuredClone(source);a(withItem)[4].constructionItems=[{id:123456,quantity:7}];
  assert.deepEqual(generator.createModel(withItem).rows[4].constructionItems,[{id:123456,quantity:7}],'a supplied A special material is preserved without deriving one from requirements');
});

test('all 496 inclusive boundary pairs use independent BigInt A-only totals and one inventory subtraction', () => {
  const rows=registry.publicBuildings('power-plant')[0].profiles[0].rows,before=JSON.stringify(rows);let count=0;
  for(let from=0;from<=30;from++)for(let to=from;to<=30;to++){
    const selected=aRows.filter(r=>r.level>from&&r.level<=to),totals=[0n,0n,0n,0n];let seconds=0n;
    for(const r of selected){r.resources.forEach((n,i)=>totals[i]+=BigInt(n));seconds+=BigInt(r.seconds);}
    const expected=totals.map(Number),held=expected.map((n,i)=>i===0?n+1:i===1?Math.floor(n/2):0),result=runtime.sumRange(rows,from,to,held);
    assert.deepEqual(result.resources,expected,from+'->'+to);assert.equal(result.seconds,Number(seconds));
    assert.deepEqual(result.shortage,expected.map((n,i)=>Math.max(0,n-held[i])));assert.deepEqual(result.levels,selected.map(r=>r.level));assert.deepEqual(result.constructionItems,[]);count++;
  }
  assert.equal(count,496);assert.equal(JSON.stringify(rows),before);
  assert.deepEqual(runtime.sumRange(rows,1,3).resources,[37400,37400,0,0]);assert.equal(runtime.sumRange(rows,1,3).seconds,7);
  assert.equal(runtime.sumRange(rows,9,10).seconds,26100,'A time, not B 21600');assert.equal(runtime.sumRange(rows,24,25).seconds,2202900,'retain the non-monotonic A value');
  for(const args of [[-1,2],[2,1],[0,31],[1.5,2],[NaN,2]])assert.throws(()=>runtime.sumRange(rows,...args));
  for(const mutate of [r=>r.splice(4,1),r=>r[4].resources[0]=null,r=>r[4].seconds=null,r=>r[4].constructionItems=null]){const damaged=structuredClone(rows);mutate(damaged);assert.throws(()=>runtime.sumRange(damaged,0,6),/missing/);}
});

function browser(query='',lang='en',published=false) {
  const d=doc(published?read(lang+'/buildings/power-plant/index.html'):builder.sheet(lang,'power-plant'));
  for(const select of d.querySelectorAll('select')){let value=select.querySelector('option[selected]')?.getAttribute('value')??select.querySelector('option')?.getAttribute('value')??'';Object.defineProperty(select,'value',{configurable:true,get:()=>value,set:v=>{value=String(v);}});}
  let url=new URL('https://tilessurvive.net/'+lang+'/buildings/power-plant/'+query);
  const location={href:url.href,origin:url.origin,pathname:url.pathname,search:url.search,hash:url.hash,assign(value){this.assigned=value;}};
  const window={document:d,location,history:{replaceState(_a,_b,next){url=new URL(next,url);Object.assign(location,{href:url.href,pathname:url.pathname,search:url.search,hash:url.hash});}},addEventListener(){}};
  const context=vm.createContext({window,URL,URLSearchParams});
  if(published)vm.runInContext(read('js/site-locales.js'),context);
  vm.runInContext(read('js/building-system.js'),context);
  return {d,window,location,host:d.querySelector('[data-building-system]')};
}

test('Power Plant auto-selects once and maps both old profile URLs to the same unified calculation', () => {
  for(const key of ['', '800005:original','800005:d','800005:unified']){
    const q=key?'?profile='+encodeURIComponent(key):'',b=browser(q),choice=b.host.querySelector('[data-bs-choice]');
    assert.equal(choice.value,'800005:unified');assert.equal(b.host.querySelector('[data-bs-inputs]').disabled,false);
    assert.deepEqual(JSON.parse(b.host.querySelector('[data-bs-result]').dataset.result).resources,[14800,14800,0,0]);
    if(key)assert.equal(new URL(b.location.href).searchParams.get('profile'),'800005:unified');
    assert(choice.hidden||choice.closest('[hidden]'),'profile implementation control must not expose A/B selection');
    b.window.BUILDING_SYSTEM.init(b.d);assert.equal(b.host.querySelectorAll('[data-bs-choice]').length,1);
  }
  const b=browser('?profile=800005%3Ad&range=26-30&exact=1&from=9&to=10&held-0=500000&held-1=100&held-2=0&held-3=0#upgrade-sheet');
  const result=JSON.parse(b.host.querySelector('[data-bs-result]').dataset.result);
  assert.deepEqual(result.resources,[1170000,1170000,0,0]);assert.equal(result.seconds,26100);assert.deepEqual(result.shortage,[670000,1169900,0,0]);
  assert.equal(b.host.querySelector('[data-bs-level]').value,'26-30');assert.equal(b.host.querySelector('[data-bs-exact]').checked,true);
  const url=new URL(b.location.href);assert.equal(url.hash,'#upgrade-sheet');assert.equal(url.searchParams.get('from'),'9');assert.equal(url.searchParams.get('held-0'),'500000');
  for(const value of ['800005:unknown','', '800003:original']){
    const unknown=browser('?profile='+encodeURIComponent(value)+'&from=9&to=10');
    assert.equal(unknown.host.querySelector('[data-bs-inputs]').disabled,true,'unknown profile must not silently become A');
    assert.doesNotThrow(()=>JSON.parse(unknown.host.querySelector('[data-building-system-model]').textContent));
    assert.equal(unknown.host.querySelector('[data-bs-result]').dataset.result,'invalid');
  }
  const last=browser('?profile=800005%3Ad&range=30-30');
  assert.equal(last.host.querySelector('[data-bs-level]').value,'30');
  assert.equal(new URL(last.location.href).searchParams.get('level'),'30');
  for(const query of ['?from=&to=10','?from=1.5&to=10','?from=9&to=8','?held-0=-1','?held-1=NaN'])assert.equal(browser(query).host.querySelector('[data-bs-result]').dataset.result,'invalid',query);
});

test('every selected destination retains its full B prerequisite list in all 496 checklist intervals', () => {
  const cfg=builder.config('en','power-plant'),rows=cfg.buildings[0].profiles[0].rows;
  let count=0;
  for(let from=0;from<=30;from++)for(let to=from;to<=30;to++){
    const rendered=doc(runtime.renderRequirementsPath(rows,from,to,cfg));
    const steps=[...rendered.querySelectorAll('[data-destination-level]')],expected=expectedRows.filter(r=>r.level>from&&r.level<=to);
    assert.deepEqual(steps.map(n=>[Number(n.dataset.destinationLevel),Number(n.dataset.destinationRank)]),expected.map(r=>[r.level,r.rank]));
    for(let i=0;i<steps.length;i++)assert.deepEqual([...steps[i].querySelectorAll('li[data-building-id]')].map(n=>[Number(n.dataset.buildingId),Number(n.dataset.requiredLevel),Number(n.dataset.rank)]),expected[i].requirements.map(tuple),from+'->'+to+' Lv'+expected[i].level);
    if(from===to){assert.equal(steps.length,0);assert(rendered.querySelector('[data-bs-requirements-path]').textContent.includes(cfg.locale.labels.none));}
    count++;
  }
  assert.equal(count,496);
  for(const mutate of [r=>r.splice(14,1),r=>r[14].requirements=null,r=>r[14].requirements.push({...r[14].requirements[0]})]){const damaged=structuredClone(rows);mutate(damaged);assert.throws(()=>runtime.renderRequirementsPath(damaged,14,15,cfg),/missing/);}
});

test('all 21 localized calculators preserve every prerequisite and live input in their language links', () => {
  let linksChecked=0;
  for(const locale of locales){
    const b=browser('?profile=800005%3Ad&range=26-30&exact=1&from=14&to=15&held-0=500000&campaign=retained#upgrade-sheet',locale.code,true);
    const form=b.host.querySelector('form'),output=b.host.querySelector('[data-bs-result]');
    const verify=(from,to)=>{
      const selected=expectedRows.filter(r=>r.level>from&&r.level<=to),steps=[...output.querySelectorAll('[data-bs-requirements-path] [data-destination-level]')];
      assert.deepEqual(steps.map(n=>Number(n.dataset.destinationLevel)),selected.map(r=>r.level));
      for(let i=0;i<steps.length;i++)assert.deepEqual([...steps[i].querySelectorAll('li[data-building-id]')].map(n=>[Number(n.dataset.buildingId),Number(n.dataset.requiredLevel),Number(n.dataset.rank)]),selected[i].requirements.map(tuple));
      assert.deepEqual(JSON.parse(output.dataset.result).resources,[0,1,2,3].map(i=>Number(selected.reduce((sum,r)=>sum+BigInt(r.resources[i]),0n))));
    };
    verify(14,15);
    const set=(name,value)=>{const input=form.querySelector('[name="'+name+'"]');input.value=String(value);input.dispatchEvent(new b.d.defaultView.Event('input',{bubbles:true}));};
    set('to',30);set('from',29);set('held-0',123456);set('held-1',987);verify(29,30);
    const links=[...b.d.querySelectorAll('.ts3-language a[hreflang]')];
    assert.equal(new Set(links.map(a=>b.window.TS_LOCALES.normalize(a.getAttribute('hreflang')))).size,21);
    for(const link of links){const u=new URL(link.getAttribute('href'),b.location.href),target=b.window.TS_LOCALES.normalize(link.getAttribute('hreflang'));
      assert.equal(u.pathname,'/'+target+'/buildings/power-plant/');assert.equal(u.hash,'#upgrade-sheet');
      for(const [key,value] of Object.entries({profile:'800005:unified',level:'26-30',exact:'1',from:'29',to:'30','held-0':'123456','held-1':'987',campaign:'retained'}))assert.equal(u.searchParams.get(key),value,locale.code+' to '+target+' '+key);
      assert.equal(u.searchParams.has('range'),false);linksChecked++;
    }
    set('from',30);verify(30,30);
  }
  assert.equal(linksChecked,441);
});

const linkedFiles=new Map();
function verifyConditions(container,row,cfg,label) {
  const actual=[...container.querySelectorAll('li[data-building-id]')];
  assert.deepEqual(actual.map(n=>[Number(n.dataset.buildingId),Number(n.dataset.requiredLevel),Number(n.dataset.rank)]),row.requirements.map(tuple),label+' full ordered requirements');
  for(let i=0;i<actual.length;i++){
    const q=row.requirements[i],name=q.name?.[cfg.lang]||cfg.names[q.buildingId]?.[cfg.lang],slug=q.slug||cfg.links[q.buildingId];
    assert(name,label+' localized name');assert(actual[i].textContent.includes(name),label+' visible localized name');
    const link=actual[i].querySelector('a');assert.equal(link?.getAttribute('href')??null,slug?'/'+cfg.lang+'/buildings/'+slug+'/#building-'+q.buildingId:null,label+' correct target');
    if(slug){const file=cfg.lang+'/buildings/'+slug+'/index.html';if(!linkedFiles.has(file)){assert(fs.existsSync(path.join(root,file)),label+' target exists');linkedFiles.set(file,read(file));}assert(linkedFiles.get(file).includes('id="building-'+q.buildingId+'"'),label+' target fragment exists');}
    assert(actual[i].querySelector('span')?.textContent.includes(String(q.level)),label+' visible level');
  }
}

test('all 21 published Power Plant JSON payloads, desktop rows and mobile cards have the same numeric identity', () => {
  let rows=0,conditions=0;const signatures=new Set();assert.equal(locales.length,21);
  for(const locale of locales){const lang=locale.code,file=lang+'/buildings/power-plant/index.html',d=doc(read(file)),cfg=JSON.parse(d.querySelector('[data-building-system-model]').textContent),b=cfg.buildings[0];
    assert.equal(cfg.lang,lang);assert.equal(cfg.slug,'power-plant');assert.equal(b.id,800005);assert.equal(cfg.buildings.length,1);assert.deepEqual(b.profiles.map(p=>p.id),['unified']);
    const profile=b.profiles[0];assert.deepEqual(profile.rows.map(numeric),expectedRows,file);signatures.add(hash(profile.rows.map(numeric)));
    const panels=d.querySelectorAll('[data-bs-profile]');assert.equal(panels.length,1);assert.equal(panels[0].getAttribute('data-bs-profile'),'800005:unified');
    const desktop=[...panels[0].querySelectorAll('.desktop-table tbody tr')],mobile=[...panels[0].querySelectorAll('.mobile-cards > article')];assert.equal(desktop.length,30);assert.equal(mobile.length,30);
    for(let i=0;i<30;i++){const row=profile.rows[i];for(const node of [desktop[i],mobile[i]]){assert.equal(Number(node.dataset.level),row.level);assert.deepEqual([...node.querySelectorAll('[data-resource][data-raw]')].map(n=>Number(n.dataset.raw)),row.resources);assert.equal(Number(node.querySelector('[data-seconds]').dataset.seconds),row.seconds);assert.equal(Number(node.querySelector('[data-kind="power"]').dataset.value),row.battlePower);verifyConditions(node.querySelector(node===desktop[i]?'.condition':'.card-conditions'),row,cfg,file+' Lv'+row.level);}
      rows++;conditions+=row.requirements.length;}
    assert.equal(d.querySelector('link[rel="canonical"]').getAttribute('href'),'https://tilessurvive.net/'+lang+'/buildings/power-plant/');
    assert.equal(d.querySelectorAll('h1').length,1);assert(d.querySelector('meta[name="description"]').content.length>0);
    for(const target of locales)assert(d.querySelector(`link[rel="alternate"][hreflang="${target.hreflang}"][href="https://tilessurvive.net/${target.code}/buildings/power-plant/"]`),file+' alternate '+target.code);
    const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,file+' duplicate IDs');
    for(const id of ['upgrade-sheet','building-800005','ts3-data-table-1'])assert(d.getElementById(id),file+' legacy anchor '+id);
    const old=doc(previous(file));
    for(const selector of ['title','meta[name="description"]','meta[name="robots"]','link[rel="canonical"]','meta[property="og:url"]','meta[property="og:title"]'])assert.equal(d.querySelector(selector)?.outerHTML,old.querySelector(selector)?.outerHTML,file+' unchanged SEO '+selector);
    assert.deepEqual([...d.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)),[...old.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)),file+' unchanged structured data');
    const protectedScripts=x=>[...x.querySelectorAll('script')].filter(n=>/adsbygoogle|googletagmanager|gtag\(|consent|fundingchoices|__tcfapi/i.test(n.outerHTML)).map(n=>n.outerHTML);
    const migrated=x=>doc(v3Affiliate.transformAnalytics(v3Publisher.strip(x.toString())));
    assert.deepEqual(protectedScripts(migrated(d)),protectedScripts(migrated(old)),file+' protected scripts with only the reviewed GA consent migration');
    const adSlots=x=>[...x.querySelectorAll('[data-ad-client],[data-ad-slot]')].map(n=>n.outerHTML);assert.deepEqual(adSlots(d),adSlots(old),file+' unchanged ad slots');
    const affiliate=x=>[...doc(v3Publisher.strip(x.toString())).querySelectorAll('a[href]')].map(n=>n.getAttribute('href')).filter(h=>/lootbar|affiliate/i.test(h));assert.deepEqual(affiliate(d),affiliate(old),file+' original affiliate destinations');
    assert.equal(d.getElementById('ts3-data-table-1').textContent,old.getElementById('ts3-data-table-1').textContent,file+' unrelated coal table');
  }
  assert.equal(signatures.size,1);assert.equal(rows,630);assert.equal(conditions,1323);
});

test('every other building page retains its exact model and original content outside reviewed V3 blocks and GA migration', () => {
  let checked=0;
  const withoutCache=v3Preservation.inherited;
  for(const locale of locales){const files=registry.slugs.filter(s=>s!=='power-plant').map(s=>locale.code+'/buildings/'+s+'/index.html'),old=baselineBatch(files);
    for(const file of files){const current=read(file),baseline=old.get(file);assert.deepEqual(payload(current),payload(baseline),file+' other-building model must be unchanged');assert.equal(hash(withoutCache(current)),hash(withoutCache(baseline)),file+' original content preserved after exact known GA migration and five reviewed runtime cache keys');checked++;}}
  assert.equal(checked,441);
});
