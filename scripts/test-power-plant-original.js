'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),{parseHTML}=require('linkedom');
const B=require('./build-power-plant-original'),A=require('./power-plant-original-test-allowances'),runtime=require('../js/power-plant-original'),copy=require('../data/power-plant-copy.json'),source=require('../data/client-buildings-52.json'),root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),doc=html=>parseHTML(html).document,signature=n=>require('./client-truth-52-test-allowances').signature(n);
const baselineFile=f=>cp.execFileSync('git',['show',A.baseline+':'+f],{cwd:root,maxBuffer:12e6});
const current=f=>doc(read(f)),clone=d=>doc('<!DOCTYPE html>'+d.documentElement.outerHTML);
const seo=d=>[...d.head.querySelectorAll('title,meta,link[rel=canonical],link[rel=alternate],script[type="application/ld+json"]')].map(n=>n.outerHTML);
const projectionHash='77cc81cd0bad3ace13d8b949345ac01fae03e8a495390307953597ca9c5ff948';
test('single public model exactly preserves the approved v3 schema and all Original rows; shared source/D/math remain byte-identical',()=>{
 assert.deepEqual(B.pages,['ko','en','ja','ru','zh-tw','de'].map(l=>`${l}/buildings/power-plant/index.html`));
 assert.deepEqual(Object.keys(B.model),['schemaVersion','building','game','resources','levels','totals']);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(B.model)).digest('hex'),projectionHash,'approved v3 canonical model');
 const original=source.buildings.find(b=>b.buildingId===800005).profiles.find(p=>p.id==='original');
 assert.deepEqual(B.model.levels,original.levels.map(r=>({level:r.level,rank:r.rank,resources:r.resources,seconds:r.seconds,battlePower:r.battlePower,requirements:r.requirements.map(q=>({buildingId:q.buildingId,level:q.level,rank:q.rank,name:{ko:q.name.ko}}))})));
 assert.equal(B.model.levels.length,30);assert.equal(B.model.levels.filter(r=>r.battlePower!==undefined).length,30);
 for(const f of ['data/client-buildings-52.json','js/client-buildings-52.js'])assert.deepEqual(fs.readFileSync(path.join(root,f)),baselineFile(f),f+' byte preservation');
 assert.deepEqual(source.buildings.map(b=>b.profiles.map(p=>p.id)),Array.from({length:4},()=>['original','d']));
 assert.equal(source.buildings.flatMap(b=>b.profiles.flatMap(p=>p.levels)).length,240);
});
test('six documents publish one static Original table and matching mobile cards, not hidden alternate tables or data',()=>{
 for(const file of B.pages){const d=current(file),lang=file.split('/')[0],wrapper=d.querySelector('[data-power-plant-original]');assert(wrapper,file);
  assert.equal(d.querySelectorAll('[data-power-plant-original]').length,1);assert.equal(wrapper.querySelectorAll('table').length,1);assert.equal(wrapper.querySelectorAll('.data-table tbody tr').length,30);assert.equal(wrapper.querySelectorAll('.level-card').length,30);
  assert.equal(d.querySelectorAll('[data-client-building-52],[data-client-building-model],[data-client-building-planner],[data-client-profile-table],[name="client-profile"]').length,0,'no old/hidden alternate presentation');
  const payload=JSON.parse(wrapper.querySelector('script[data-power-plant-model]').textContent);assert.deepEqual(Object.keys(payload),['model','locale','links','lang']);assert.deepEqual(payload.model,B.model);assert.equal(payload.lang,lang);assert.deepEqual(payload.locale,copy.locales[lang]);assert.deepEqual(payload.links,B.links);
  const visible=wrapper.cloneNode(true);visible.querySelectorAll('script').forEach(n=>n.remove());assert(!/\bOriginal\b|\bAB\b|\bprofile\b/i.test(visible.textContent),'no internal profile vocabulary');
  assert.equal(wrapper.querySelector('.variation').textContent,copy.locales[lang].messages.variation);assert(wrapper.querySelector('#capture-basis').textContent.includes('2.6.200'));assert(wrapper.querySelector('#capture-basis').textContent.includes('1512'));
  const rendered=doc(runtime.renderTables({model:payload.model,locale:payload.locale,links:payload.links,lang,range:[1,30],exact:false}));assert.deepEqual(signature(wrapper.querySelector('#tables').firstElementChild),signature(rendered.querySelector('.requirements-block')),'static output equals initial runtime presentation '+lang);
 }
});
test('all six routes preserve the entire surrounding document, SEO, art, affiliate links, coal table and fragment controls',()=>{
 for(const file of B.pages){const before=doc(A.original(file)),after=current(file);assert.deepEqual(seo(after),seo(before),file+' SEO');
  for(const selector of ['[data-building-art-51]','a[href*="lootbar"]','#ts3-data-table-1','#ts3-table-controls-1'])assert.deepEqual([...after.querySelectorAll(selector)].map(n=>n.outerHTML),[...before.querySelectorAll(selector)].map(n=>n.outerHTML),file+' '+selector);
  for(const id of ['upgrade-sheet','ts3-data-table-0','ts3-data-table-1','ts3-table-controls-1'])assert.equal(after.querySelectorAll('#'+id).length,1,file+' #'+id);
  const coal=after.querySelector('#ts3-data-table-1').closest('.ts3-data-workbench');for(const n of coal.querySelectorAll('[aria-controls]'))assert.equal(n.getAttribute('aria-controls'),'ts3-data-table-1');
  const ids=[...after.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,file+' unique IDs');
  before.querySelector('[data-client-building-52]').closest('section.section').remove();after.querySelector('[data-power-plant-original]').remove();
  before.querySelectorAll('[data-client-building-52-asset]').forEach(n=>n.remove());after.querySelectorAll('[data-power-plant-asset]').forEach(n=>n.remove());after.documentElement.removeAttribute('data-power-plant-page');
  assert.deepEqual(signature(after.documentElement),signature(before.documentElement),file+' only approved requirements section/assets/root marker may change');
 }
});
test('localized prerequisite destinations and all new asset URLs resolve without profile payload leakage',()=>{
 for(const file of B.pages){const d=current(file),lang=file.split('/')[0],wrapper=d.querySelector('[data-power-plant-original]');for(const li of wrapper.querySelectorAll('li[data-building-id]')){const id=li.dataset.buildingId,a=li.querySelector('a');assert(a);const target=new URL(a.href);assert.equal(target.origin,'https://tilessurvive.net');assert.equal(target.pathname,B.links[id].replace(/^\/ko\//,`/${lang}/`));assert(fs.existsSync(path.join(root,target.pathname.slice(1),'index.html')),target.pathname);}
  for(const n of [...d.querySelectorAll('[data-power-plant-asset]'),...wrapper.querySelectorAll('img')]){const attr=n.tagName==='LINK'?'href':'src',url=new URL(n.getAttribute(attr),'https://tilessurvive.net');assert.equal(url.origin,'https://tilessurvive.net');const file=url.pathname.slice(1);assert(fs.existsSync(path.join(root,file)),file);if(n.hasAttribute('data-power-plant-asset')){assert.equal(url.searchParams.get('v'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex').slice(0,12));}}
  assert.equal([...d.querySelectorAll('script[src]')].filter(n=>/client-buildings-52\.js/.test(n.src)).length,0);
 }
});
test('dedicated, client and UX projections remain idempotent and unrelated routes are unchanged',()=>{
 const client=require('./build-client-buildings-52'),ux=require('./build-building-ux-53');
 for(const file of B.pages){const html=read(file),lang=file.split('/')[0];assert.equal(B.project(html,file),html);assert.equal(B.project(B.project(A.original(file),file),file),html);assert.equal(client.project(html,file),html);assert.equal(ux.detail(html,lang,'power-plant').html,html);assert.equal(B.project(client.project(ux.detail(html,lang,'power-plant').html,file),file),html);}
 for(const file of ['ko/buildings/barracks/index.html','en/buildings/hospital/index.html','ko/buildings/index.html']){const html=read(file);assert.equal(B.project(html,file),html);}
});
test('German owner handling is limited to the exact Power Plant route and preserves independently localized owned content',()=>{
 const G=require('./build-german-50'),seen=[],translate=(raw,context)=>{seen.push({raw,context});return raw.replaceAll('UNOWNED_SENTINEL','GERMAN_OUTSIDE');};
 const shell=content=>`<!doctype html><html lang="en"><head><title>UNOWNED_SENTINEL</title><link rel="canonical" href="https://tilessurvive.net/en/buildings/power-plant/"></head><body><main><p id="outside">UNOWNED_SENTINEL</p>${content}</main></body></html>`;
 const result=doc(G.render(shell(B.render('en')),translate,'buildings/power-plant/index.html'));
 assert.equal(result.querySelector('#outside').textContent,'GERMAN_OUTSIDE');assert.equal(result.documentElement.lang,'de');
 assert.deepEqual(signature(result.querySelector('[data-power-plant-original]')),signature(doc(B.render('de')).querySelector('[data-power-plant-original]')),'owned content is the exact reviewed German projection');
 assert(!seen.some(x=>x.raw.includes(copy.locales.en.messages.variation)),'owned English copy must not enter the generic catalog');
 const wrongRoute=doc(G.render(shell('<section data-power-plant-original><p>UNOWNED_SENTINEL</p></section>'),translate,'heroes/lagnar/index.html'));
 assert.equal(wrongRoute.querySelector('[data-power-plant-original] p').textContent,'GERMAN_OUTSIDE');assert.equal(wrongRoute.querySelector('[data-power-plant-model]'),null,'marker alone cannot enable Power Plant regeneration');
 const noOwnedSection=doc(G.render(shell('<section><p>UNOWNED_SENTINEL</p></section>'),translate,'buildings/power-plant/index.html'));
 assert.equal(noOwnedSection.querySelector('[data-power-plant-original]'),null,'route alone cannot invent a new owned section');assert.equal(noOwnedSection.querySelector('#outside').textContent,'GERMAN_OUTSIDE');
});
test('strict historical allowance verifies complete new documents before restoring the immutable pre-change DOM',()=>{
 for(const file of B.pages){const d=current(file);assert.doesNotThrow(()=>A.verify(d,file));A.restore(d,file);assert.deepEqual(signature(d.documentElement),signature(doc(A.original(file)).documentElement));assert.doesNotThrow(()=>A.restore(d,file),'safe repeated restoration');const historic=require('./client-truth-52-test-allowances'),legacy=current(file);historic.restore(legacy,file);assert.deepEqual(signature(legacy.documentElement),signature(doc(historic.original(file)).documentElement),'all historical stages remain strict '+file);}
 const file='ko/buildings/power-plant/index.html';assert.throws(()=>A.verify(current(file),'ko/buildings/barracks/index.html'),/Exact Power Plant projection/);
});
test('whole-document allowance rejects actual numeric, condition, unit, locale, SEO, fragment, hidden-data and marker tampering',()=>{
 const file='ko/buildings/power-plant/index.html',fixtures=[
  ['resource raw',d=>d.querySelector('.data-table [data-resource="0"]').setAttribute('data-raw','999')],
  ['visible resource',d=>d.querySelector('.data-table button[data-kind="resource"]').textContent='999'],
  ['seconds',d=>d.querySelector('.data-table [data-seconds]').setAttribute('data-seconds','99')],
  ['power',d=>d.querySelector('.level-card [data-power]').setAttribute('data-power','99')],
  ['condition link',d=>d.querySelector('[data-power-plant-original] li[data-building-id] a').href='https://example.invalid/'],
  ['condition level',d=>d.querySelector('[data-power-plant-original] li[data-building-id]').setAttribute('data-required-level','30')],
  ['unit',d=>d.querySelector('.requirements-foot').lastElementChild.textContent='seconds'],
  ['language',d=>d.documentElement.lang='xx'],
  ['canonical',d=>d.querySelector('link[rel=canonical]').href='https://example.invalid/'],
  ['upgrade fragment',d=>d.querySelector('#upgrade-sheet').id='wrong-upgrade'],
  ['coal fragment',d=>d.querySelector('#ts3-data-table-1').id='wrong-coal'],
  ['hidden D payload',d=>{const n=d.createElement('script');n.type='application/json';n.textContent=JSON.stringify({d:source.buildings[0].profiles[1].levels});d.body.append(n);}],
  ['inline raw payload',d=>{const n=d.querySelector('script[data-power-plant-model]'),x=JSON.parse(n.textContent);x.model.levels[0].resources[0]++;n.textContent=JSON.stringify(x);}],
  ['marker removal',d=>{d.documentElement.removeAttribute('data-power-plant-page');d.querySelector('[data-power-plant-original]').removeAttribute('data-power-plant-original');}]
 ];
 for(const [name,mutate]of fixtures){const d=current(file),before=d.documentElement.outerHTML;mutate(d);assert.notEqual(d.documentElement.outerHTML,before,name+' must change fixture');assert.throws(()=>A.verify(d,file),/Exact Power Plant projection/,name);assert.throws(()=>A.restore(d,file),/Exact Power Plant projection/,name+' restore');}
 const stripped=current(file),before=stripped.documentElement.outerHTML;
 stripped.documentElement.removeAttribute('data-power-plant-page');
 for(const n of stripped.querySelectorAll('[data-power-plant-original],[data-power-plant-model],[data-power-plant-asset],.power-plant-original,.requirements-block')){for(const a of ['data-power-plant-original','data-power-plant-model','data-power-plant-asset'])n.removeAttribute(a);n.classList.remove('power-plant-original','requirements-block');}
 assert.notEqual(stripped.documentElement.outerHTML,before,'removing every allowance marker must change the fixture');
 assert.throws(()=>require('./client-truth-52-test-allowances').restore(stripped,file),/Exact (?:Power Plant|building UI) projection/,'removing all markers must not bypass the whole historical chain');
});
