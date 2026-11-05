'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom'),R=require('./building-data-registry'),B=require('./build-building-system'),runtime=require('../js/building-system');
const ROOT=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8'),locales=require('../data/i18n/locales.json').locales;
const runtimeCode=read('js/building-system.js'),shellCode=read('js/site-locales.js'),sheets=new Map(),parse=html=>parseHTML(html).document;
const tuple=q=>[q.buildingId,q.level,q.rank||0];
function browser(cfg,query='',native=false){
 const key=JSON.stringify(cfg);if(!sheets.has(key))sheets.set(key,B.sheetFromConfig(cfg));
 const d=parse(native?read(cfg.lang+'/buildings/'+cfg.slug+'/index.html'):'<!doctype html><html><head></head><body>'+sheets.get(key)+'</body></html>');
 if(native){const template=d.createElement('template');template.innerHTML=sheets.get(key);d.querySelector('[data-building-system]').replaceWith(template.content);}
 for(const select of d.querySelectorAll('[data-building-system] select')){let value=select.querySelector('option[selected]')?.getAttribute('value')??select.querySelector('option')?.getAttribute('value')??'';Object.defineProperty(select,'value',{configurable:true,get:()=>value,set:v=>{value=String(v);}});}
 let url=new URL('https://tilessurvive.net/'+cfg.lang+'/buildings/'+cfg.slug+'/'+query);
 const listeners={},location={href:url.href,origin:url.origin,pathname:url.pathname,search:url.search,hash:url.hash,assign(value){this.assigned=value;}};
 const window={document:d,location,history:{replaceState(_a,_b,next){url=new URL(next,url);Object.assign(location,{href:url.href,pathname:url.pathname,search:url.search,hash:url.hash});}},addEventListener(name,fn){listeners[name]=fn;}};
 const context=vm.createContext({window,URL,URLSearchParams});if(native)vm.runInContext(shellCode,context);vm.runInContext(runtimeCode,context);
 const host=d.querySelector('[data-building-system]'),choice=host.querySelector('[data-bs-choice]'),form=host.querySelector('form'),output=host.querySelector('[data-bs-result]');
 return{d,window,location,listeners,host,choice,form,output,set(name,value){const n=form.querySelector('[name="'+name+'"]');n.value=String(value);n.dispatchEvent(new d.defaultView.Event('input',{bubbles:true}));},choose(value){choice.value=value;choice.dispatchEvent(new d.defaultView.Event('change',{bubbles:true}));}};
}
function raw(building){return R.model.buildings.find(b=>b.id===building.id);}
function good(row){return Array.isArray(row.resources)&&row.resources.every(Number.isSafeInteger)&&Number.isSafeInteger(row.seconds)&&Array.isArray(row.constructionItems)&&row.availability!=='initial_conditions_unconfirmed';}

test('all 22 sheets expose one unified table per ID and only multi-building selectors remain visible',()=>{
 let count=0;for(const lang of R.langs)for(const slug of R.slugs){const cfg=B.config(lang,slug),d=parse(B.sheetFromConfig(cfg)),choice=d.querySelector('[data-bs-choice]'),options=[...choice.querySelectorAll('option')].filter(n=>n.getAttribute('value'));
  assert.deepEqual(options.map(n=>n.getAttribute('value')),cfg.buildings.map(b=>b.id+':unified'));
  assert.equal(d.querySelectorAll('[data-bs-profile]').length,cfg.buildings.length);
  assert.equal(Boolean(choice.closest('[hidden]')),cfg.buildings.length===1);
  assert.equal(d.querySelector('[data-bs-inputs]').hasAttribute('disabled'),cfg.buildings.length!==1);
  if(cfg.buildings.length>1)assert.deepEqual(options.map(n=>n.textContent),cfg.buildings.map(b=>b.name[lang]));
  for(const building of cfg.buildings){assert.deepEqual(building.profiles.map(p=>p.id),['unified']);count++;}
 }
 assert.equal(R.slugs.length,22);assert.equal(count,29*6);
});

test('all 29 IDs map original and d links to unified while rejecting foreign or malformed selections',()=>{
 let checked=0;for(const slug of R.slugs){const cfg=B.config('en',slug);for(const building of cfg.buildings){const rows=building.profiles[0].rows,row=rows.find(r=>good(r)&&Array.isArray(r.requirements)),from=row?row.level-1:0,to=row?row.level:1;
  for(const alias of ['original','d','unified']){const b=browser(cfg,'?profile='+building.id+':'+alias+'&from='+from+'&to='+to+'&campaign=retained#building-'+building.id);assert.equal(b.choice.value,building.id+':unified');assert.equal(b.host.querySelector('[data-bs-inputs]').disabled,false);assert.equal(new URL(b.location.href).searchParams.get('profile'),building.id+':unified');assert.equal(new URL(b.location.href).searchParams.get('campaign'),'retained');
   if(row){const a=raw(building).profiles.find(p=>p.id==='original').rows.find(r=>r.level===row.level&&r.rank===row.rank),result=JSON.parse(b.output.dataset.result);assert.deepEqual(result.resources,a.resources);assert.equal(result.seconds,a.seconds);}else assert.equal(b.output.dataset.result,'missing');checked++;}
 }
 for(const value of ['', '999999:original',cfg.buildings[0].id+':unknown']){const b=browser(cfg,'?profile='+encodeURIComponent(value)+'&capture=1');assert.equal(b.choice.value,'');assert.equal(b.host.querySelector('[data-bs-inputs]').disabled,true);assert.equal(b.output.dataset.result,'invalid');}
 }
 assert.equal(checked,87);
});

test('multi-building choice preserves live inputs, exact range, capture and hash without A/B controls',()=>{
 for(const slug of ['barracks','houses']){
  const cfg=B.config('en',slug),first=cfg.buildings[0],last=cfg.buildings.at(-1),blank=browser(cfg);assert.equal(blank.choice.value,'');assert.equal(blank.output.dataset.result,'unselected');assert(!blank.choice.closest('[hidden]'));
  blank.choose(last.id+':unified');assert.equal(blank.host.querySelector('[data-bs-inputs]').disabled,false);assert.equal(new URL(blank.location.href).searchParams.get('profile'),last.id+':unified');blank.choose('');assert.equal(blank.output.dataset.result,'unselected');assert(!new URL(blank.location.href).searchParams.has('profile'));
  const b=browser(cfg,'?profile='+first.id+':d&range=10-10&exact=1&capture=1&from=9&to=10&held-0=123&campaign=keep#upgrade-sheet');
  assert.equal(b.host.querySelector('[data-bs-level]').value,'10');assert.equal(b.host.querySelector('[data-bs-exact]').checked,true);assert(b.d.documentElement.hasAttribute('data-building-capture'));
  b.choose(last.id+':unified');b.set('held-1',456);const u=new URL(b.location.href);
  for(const [key,value]of Object.entries({profile:last.id+':unified',level:'10',exact:'1',capture:'1',from:'9',to:'10','held-0':'123','held-1':'456',campaign:'keep'}))assert.equal(u.searchParams.get(key),value,slug+' '+key);assert.equal(u.hash,'#upgrade-sheet');assert(!u.searchParams.has('range'));
  b.location.hash='#building-'+first.id;b.listeners.hashchange();assert.equal(b.choice.value,first.id+':unified');
  b.window.BUILDING_SYSTEM.init(b.d);assert.equal(b.host.querySelectorAll('[data-bs-choice]').length,1);
 }
});

test('every A-only interval retains independent BigInt totals and a single inventory subtraction',()=>{
 let intervals=0;for(const source of R.model.buildings){const published=R.publicBuildings(source.slug).find(b=>b.id===source.id).profiles[0].rows,a=source.profiles.find(p=>p.id==='original').rows,max=Math.max(...a.map(r=>r.level));
  for(let from=0;from<=max;from++)for(let to=from;to<=max;to++){const selected=a.filter(r=>r.level>from&&r.level<=to);if(selected.length!==to-from||selected.some(r=>!good(r))){assert.throws(()=>runtime.sumRange(published,from,to),/missing/);continue;}
   const sums=[0,1,2,3].map(i=>Number(selected.reduce((sum,r)=>sum+BigInt(r.resources[i]),0n))),seconds=Number(selected.reduce((sum,r)=>sum+BigInt(r.seconds),0n)),held=sums.map((n,i)=>i===0?n+1:i===1?Math.floor(n/2):0),result=runtime.sumRange(published,from,to,held);
   assert.deepEqual(result.resources,sums,source.id+' '+from+'-'+to);assert.equal(result.seconds,seconds);assert.deepEqual(result.shortage,sums.map((n,i)=>Math.max(0,n-held[i])));intervals++;
  }
 }assert(intervals>10000);
});

test('all unified calculators render ordered B prerequisites and reject unknown paths or blocked costs',()=>{
 let rowsChecked=0;for(const slug of R.slugs){const cfg=B.config('en',slug);for(const building of cfg.buildings){const p=building.profiles[0],source=raw(building),bRows=source.profiles.find(x=>x.id==='d').rows;
  for(const row of p.rows){const from=row.level-1,to=row.level,d=parse(runtime.renderTotal(building,p,cfg,from,to,[0,0,0,0])),status=d.querySelector('[data-bs-total-status]').dataset.bsTotalStatus;
   if(!good(row)||!Array.isArray(row.requirements)){assert.equal(status,'missing');continue;}
   assert.equal(status,'complete');const step=d.querySelector('[data-bs-requirements-path] [data-destination-level]');assert(step);assert.equal(Number(step.dataset.destinationLevel),row.level);assert.deepEqual([...step.querySelectorAll('[data-building-id]')].map(n=>[Number(n.dataset.buildingId),Number(n.dataset.requiredLevel),Number(n.dataset.rank)]),bRows.find(r=>r.level===row.level&&r.rank===row.rank).requirements.map(tuple));rowsChecked++;
  }
 }}assert(rowsChecked>700);
 const cfg=B.config('en','hospital'),p=cfg.buildings[0].profiles[0];p.rows.find(r=>r.level===2).requirements=null;const b=browser(cfg,'?from=1&to=2');assert.equal(b.output.dataset.result,'missing');assert(!b.output.querySelector('[data-total-resource]'));
 const blocked=B.publicConfig(B.config('en','lab-2')).buildings[0].profiles[0].rows;assert(blocked[0].calculationBlocked);assert(!Object.hasOwn(blocked[0],'availability'));assert.throws(()=>runtime.sumRange(blocked,0,1),/missing/);assert.equal(browser(B.config('en','lab-2'),'?from=0&to=1').output.dataset.result,'missing');
});

test('all 21 language links preserve calculator state and canonical aliases on a non-Power-Plant page',()=>{
 const publisher=require('./build-buildings-unified');let checked=0;
 for(const locale of locales){const lang=locale.code,slug='hospital',old=JSON.parse(parse(read(lang+'/buildings/'+slug+'/index.html')).querySelector('[data-building-system-model]').textContent),cfg=publisher.localizedConfig(old,lang,slug),b=browser(cfg,'?profile=800010:d&range=26-30&exact=1&from=9&to=10&held-0=123&campaign=keep#upgrade-sheet',true);
  b.set('to',15);b.set('from',14);b.set('held-1',456);
  const links=[...b.d.querySelectorAll('.ts3-language a[hreflang]')];assert.equal(new Set(links.map(a=>b.window.TS_LOCALES.normalize(a.getAttribute('hreflang')))).size,21);
  for(const link of links){const target=b.window.TS_LOCALES.normalize(link.getAttribute('hreflang')),u=new URL(link.getAttribute('href'),b.location.href);assert.equal(u.pathname,'/'+target+'/buildings/hospital/');assert.equal(u.hash,'#upgrade-sheet');for(const [key,value]of Object.entries({profile:'800010:unified',level:'26-30',exact:'1',from:'14',to:'15','held-0':'123','held-1':'456',campaign:'keep'}))assert.equal(u.searchParams.get(key),value,lang+' '+target+' '+key);checked++;}
 }assert.equal(checked,441);
});

test('unified effect tables couple A values with A metric IDs and units, including both steles',()=>{
 let count=0;for(const source of R.evidence.effects)for(const lang of R.langs){const cfg=B.config(lang,source.slug),p=source.profiles.find(p=>p.id.toLowerCase()==='original'),metrics=p.metrics||source.metrics,d=parse(B.effectsFromConfig(cfg,source)),profiles=d.querySelectorAll('[data-bs-effect-profile]');
  assert.equal(profiles.length,1);assert.equal(profiles[0].dataset.bsEffectProfile,'unified');const rows=[...d.querySelectorAll('[data-effect-level]')];assert.equal(rows.length,p.rows.length);
  const headings=[...d.querySelectorAll('thead th')].slice(1);assert.deepEqual(headings.map(n=>n.textContent),metrics.map(m=>m.name[lang]+(m.unit==='percent'?' (%)':'')));
  rows.forEach((row,i)=>{assert.equal(Number(row.dataset.effectLevel),p.rows[i].level);assert.equal(Number(row.dataset.effectRank),p.rows[i].rank);assert.deepEqual([...row.querySelectorAll('[data-effect-id]')].map(n=>Number(n.dataset.effectId)),metrics.map(m=>m.id));assert.deepEqual([...row.querySelectorAll('[data-effect-value]')].map(n=>n.dataset.effectValue==='null'?null:Number(n.dataset.effectValue)),p.rows[i].values);});
  if([800216,800217].includes(source.id)){assert(metrics.every(m=>m.unit==='integer'));assert(headings.every(n=>!n.textContent.includes('%')));}count++;
 }assert(count>0);
 const source=structuredClone(R.evidence.effects.find(e=>e.id===800216));source.profiles.find(p=>p.id.toLowerCase()==='original').metrics=[];assert.throws(()=>B.effectsFromConfig(B.config('en',source.slug),source),/metrics/);
});
