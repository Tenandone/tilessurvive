'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const R=path.resolve(__dirname,'..');
const G=require('./build-german-50'),W=require('../js/data-workbench-30'),M=require('../js/platform-math');
const building=require('./building-data-registry'),buildingBaseline=require('./building-data/baseline-7a82e23b.json');
const cat=JSON.parse(fs.readFileSync(path.join(R,'data/product-50/german.json'),'utf8'));
for(const name of ['core','hero','calculator','growth','editorial','building','client52']){const p=path.join(R,'data/product-50/german-'+name+'-review.json');if(fs.existsSync(p))Object.assign(cat.exact,JSON.parse(fs.readFileSync(p,'utf8')).exact);}
Object.assign(cat.exact,JSON.parse(fs.readFileSync(path.join(R,'data/product-50/german-root-overrides.json'),'utf8')).exact);
const {translate,missing}=G.createTranslator(cat);
let checks=0,numericLeaves=0,cells=0,forms=0,ranges=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function typed(value,out={},prefix='') {if(value&&typeof value==='object'){for(const [k,v]of Object.entries(value)){if(k!=='de')typed(v,out,prefix+'/'+k);}}else if(typeof value!=='string')out[prefix]=value;return out;}
const strip=d=>{require('./strip-refinement-51').strip(d);require('./build-pet-skill-levels').stripOwnedSections(d,'en');d.querySelectorAll('[data-growth-50],[data-growth-research-50],[data-growth50-asset],[data-package-offer-50]').forEach(n=>n.remove());};
const inheritedRoutes=JSON.parse(fs.readFileSync(path.join(R,'data/product-50/german-routes.json'),'utf8'));
const routes=[...inheritedRoutes,...building.slugs.map(slug=>`buildings/${slug}/index.html`).filter(route=>!inheritedRoutes.includes(route))];
let ownedBuildingPages=0;
eq(require('node:crypto').createHash('sha256').update(JSON.stringify(building.model)).digest('hex'),buildingBaseline.modelSha256,'common building source values retain the frozen baseline');
function ownedBuildingProjection(d,lang,slug,route){
 const host=d.querySelector('[data-building-system]');assert(host,route+' common owner '+lang);
 const payload=JSON.parse(host.querySelector('[data-building-system-model]').textContent);
 const expected=building.publicBuildings(slug);
 for(const b of expected)for(const p of b.profiles)for(const row of p.rows){if(row.availability==='initial_conditions_unconfirmed')row.calculationBlocked=true;delete row.availability;}
 eq(payload.lang,lang,route+' payload language');
 const ids=buildings=>buildings.map(b=>({id:b.id,slug:b.slug,profiles:b.profiles.map(p=>p.id)}));
 eq(ids(payload.buildings),ids(expected),route+' independent building and profile identities '+lang);
 eq(typed(payload.buildings),typed(expected),route+' original numeric/boolean/null building model '+lang);
 const number=(node,attribute)=>{const value=node?.getAttribute(attribute);return value===null||value===undefined||value==='null'?null:Number(value);};
 for(const b of expected)for(const p of b.profiles){
  const table=host.querySelector(`[data-bs-profile="${b.id}:${p.id}"] table.bs-table`);assert(table,route+' owned table '+lang);
  const actual=[...table.querySelectorAll('tbody tr[data-level]')].map(row=>({level:number(row,'data-level'),rank:number(row,'data-rank'),resources:[0,1,2,3].map(i=>number(row.querySelector(`[data-resource="${i}"]`),'data-raw')),seconds:number(row.querySelector('[data-seconds]'),'data-seconds'),battlePower:number(row.querySelector('[data-power]'),'data-power'),requirements:[...row.querySelectorAll('[data-building-id]')].map(n=>({buildingId:number(n,'data-building-id'),level:number(n,'data-required-level'),rank:number(n,'data-rank')}))}));
  eq(actual,p.rows.map(row=>({level:row.level,rank:row.rank,resources:row.resources||[null,null,null,null],seconds:row.seconds,battlePower:row.battlePower??null,requirements:row.requirements.map(q=>({buildingId:q.buildingId,level:q.level,rank:q.rank||0}))})),route+' rendered source quantities '+lang+' '+b.id+':'+p.id);
  cells+=actual.length*6;
 }
 numericLeaves+=Object.keys(typed(payload.buildings)).length;
 return payload;
}
for(const route of routes){
 const source=fs.readFileSync(path.join(R,'en',route),'utf8');
 const en=parseHTML(source).document,de=parseHTML(G.render(source,translate,route)).document;
 const buildingSlug=/^buildings\/([^/]+)\/index\.html$/.exec(route)?.[1];
 if(route==='buildings/index.html'&&en.documentElement.hasAttribute('data-building-system-catalog')){
  for(const [lang,d] of [['en',en],['de',de]]){
   assert(d.documentElement.hasAttribute('data-building-system-catalog'),route+' common catalog '+lang);
   const cards=[...d.querySelectorAll('.building-card')];
   eq(cards.map(card=>card.querySelector('.building-link').getAttribute('href')).sort(),building.slugs.map(slug=>`/${lang}/buildings/${slug}/`).sort(),route+' complete catalog routes '+lang);
   // Category option values were already language-specific. Keep each locale's
   // established controls rather than stripping only the EN phase-2 options.
   const baseline=parseHTML(require('node:child_process').execFileSync('git',['show',`7a82e23b:${lang}/${route}`],{cwd:R,encoding:'utf8',maxBuffer:16e6})).document;
   const controls=document=>[...document.querySelectorAll('input,select option')].map(n=>['name','type','value','min','max','step'].map(attr=>n.getAttribute(attr)));
   eq(controls(d),controls(baseline),route+' preserved native catalog controls '+lang);
  }
  eq(de.documentElement.lang,'de',route+' language');
  eq([...de.querySelectorAll('img')].map(n=>n.getAttribute('src')),[...en.querySelectorAll('img')].map(n=>n.getAttribute('src')),route+' same catalog image sources');
  continue;
 }
 if(building.slugs.includes(buildingSlug)){
  // This owner renders reviewed EN/DE copy independently. Compare its model and
  // raw numeric attributes, never translated prerequisite names or unit labels.
  const a=ownedBuildingProjection(en,'en',buildingSlug,route),b=ownedBuildingProjection(de,'de',buildingSlug,route);
  eq(typed(b.buildings),typed(a.buildings),route+' EN/DE numeric parity');
  eq(de.documentElement.lang,'de',route+' language');
  eq([...de.querySelectorAll('img')].map(n=>n.getAttribute('src')),[...en.querySelectorAll('img')].map(n=>n.getAttribute('src')),route+' same image sources');
  const attrs=n=>['name','type','value','min','max','step'].map(attr=>n.getAttribute(attr));
  eq([...de.querySelectorAll('[data-building-system] input,[data-building-system] select option')].map(attrs),[...en.querySelectorAll('[data-building-system] input,[data-building-system] select option')].map(attrs),route+' common control values');
  const damaged=structuredClone(b.buildings),row=damaged.flatMap(n=>n.profiles.flatMap(p=>p.rows)).find(r=>Array.isArray(r.resources)&&Number.isFinite(r.resources[0]));row.resources[0]++;
  assert.throws(()=>assert.deepEqual(typed(damaged),typed(a.buildings)),assert.AssertionError,route+' resource mutation must be detected');
  ownedBuildingPages++;continue;
 }
 require('./content-60-owned').strip(en);strip(en);
 // This six-language owner has an independent exact-copy contract. Verify its
 // complete EN and DE sections before excluding it from the generic translator
 // lexeme test; all other cells and all other routes retain the existing tests.
 if(route==='buildings/power-plant/index.html'){
  const power=require('./build-power-plant-original'),signature=require('./client-truth-52-test-allowances').signature;
  for(const [lang,d] of [['en',en],['de',de]]){const owned=d.querySelector('[data-power-plant-original]');assert(owned,'Power Plant owned section '+lang);eq(signature(owned),signature(parseHTML(power.render(lang)).document.querySelector('[data-power-plant-original]')),'exact owned Power Plant '+lang);const payload=JSON.parse(owned.querySelector('[data-power-plant-model]').textContent);eq(payload.model,power.model,'same single baseline '+lang);owned.remove();}
 }
 eq(de.documentElement.lang,'de',route+' language');
 const ec=[...en.querySelectorAll('td')],dc=[...de.querySelectorAll('td')];eq(ec.length,dc.length,route+' cells');
 ec.forEach((e,i)=>{eq(W.sourceValue(dc[i]),e.textContent.trim(),route+' raw cell '+i);cells++;
  const s=e.textContent.trim();if(/^[+−-]?[\d,.]+(?:%|[KMB])?$/.test(s))eq(dc[i].textContent.trim(),G.germanNumbers(s,s),route+' displayed numeric cell '+i);
 });
 const attrs=n=>['name','type','value','min','max','step'].map(a=>n.getAttribute(a));
 eq([...de.querySelectorAll('input,select option')].map(attrs),[...en.querySelectorAll('input,select option')].map(attrs),route+' form values');forms+=en.querySelectorAll('input,select').length;
 eq([...de.querySelectorAll('img')].map(x=>x.getAttribute('src')),[...en.querySelectorAll('img')].map(x=>x.getAttribute('src')),route+' same image sources');
 const es=[...en.querySelectorAll('script[type*="json"]')],ds=[...de.querySelectorAll('script[type*="json"]')];eq(es.length,ds.length,route+' JSON count');
 es.forEach((s,i)=>{let a,b;try{a=JSON.parse(s.textContent);b=JSON.parse(ds[i].textContent);}catch(err){throw new Error(route+' invalid JSON '+err.message);}const aa=typed(a),bb=typed(b);eq(bb,aa,route+' numeric/boolean/null model');numericLeaves+=Object.keys(aa).length;});
 for(const form of en.querySelectorAll('form[data-table]')){
  const id=form.dataset.table,et=en.getElementById(id),dt=de.getElementById(id);if(!et||!dt)continue;
  const rows=t=>[...t.querySelectorAll('tbody tr')].map(r=>({level:+W.sourceValue(r.children[0]),cells:[...r.children].map(W.sourceValue)}));
  const er=rows(et),dr=rows(dt);eq(dr,er,route+' arithmetic input rows');
  const lev=er.map(r=>r.level).filter(Number.isFinite);for(const from of lev.slice(0,3))for(const to of lev.filter(n=>n>from).slice(0,3)){
   let a,b;try{a=M.sumRange(er,from,to,[2,3,4,5],Number(form.dataset.timeColumn));}catch(e){a={error:e.message};}try{b=M.sumRange(dr,from,to,[2,3,4,5],Number(form.dataset.timeColumn));}catch(e){b={error:e.message};}eq(b,a,route+' sumRange '+from+' '+to);ranges++;
  }
 }
}
for(const [a,b] of [['2,500','2.500'],['10.00%','10,00%'],['1,234.5K','1.234,5K'],['v2.6.200','v2.6.200'],['2026-10-09','2026-10-09'],['Lv.1 → Lv.2','Lv.1 → Lv.2'],['4.29M','4,29M']])eq(G.germanNumbers(a,a),b,'German display '+a);
const raw=parseHTML('<td data-ts-original-value="1,234.5">1.234,5</td>').document.querySelector('td');eq(W.numeric(W.sourceValue(raw)),1234.5,'raw numeric value');
eq(W.compare(W.sourceValue(raw),'20','de',1)>0,true,'numeric order unaffected by German display');
eq(G.germanNumbers('2,500','2.500'),'2.500','already-localized override preserved');
const unknown=G.createTranslator({exact:{}});unknown.translate('Never silently inherit this English sentence','fixture');eq(unknown.missing.size,1,'unknown strings held');
const detailFixture='<html lang="en"><head></head><body><main><p>Details</p></main></body></html>';
eq(parseHTML(G.render(detailFixture,translate,'heroes/lagnar/index.html')).document.querySelector('main p').textContent,'Einzelheiten','generic hero wording is preserved');
eq(parseHTML(G.render(detailFixture,translate,'seasons/season-1/index.html')).document.querySelector('main p').textContent,'Einzelheiten','generic season wording is preserved');
eq(parseHTML(G.render(detailFixture,translate,'buildings/index.html')).document.querySelector('main p').textContent,'Details','building control wording remains scoped');
eq(missing.size,0,'all inherited strings have catalog coverage');
eq(ownedBuildingPages,22,'all common building routes checked independently');
console.log(JSON.stringify({status:'PASS',checks,routes:routes.length,ownedBuildingPages,cells,numericLeaves,controls:forms,rangeComparisons:ranges,scope:'Inherited German projection outside the common building owner; all 22 building routes independently preserve source-model and rendered numeric values.'}));
