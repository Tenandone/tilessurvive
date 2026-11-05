'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom');
const B=require('./build-buildings-unified'),R=require('./building-data-registry');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const document=html=>parseHTML(html).document;
const payload=d=>JSON.parse(d.querySelector('[data-building-system-model]').textContent);
const tuple=q=>[q.buildingId,q.level,q.rank];
const identity=r=>r.level+':'+r.rank;
function outside(html){const d=document(html);for(const selector of ['[data-building-system]','[data-bs-effects]'])for(const n of d.querySelectorAll(selector))html=html.replace(n.outerHTML,'');return html;}
function modifyModel(html,change){const d=document(html),script=d.querySelector('[data-building-system-model]'),cfg=JSON.parse(script.textContent);change(cfg);script.textContent=JSON.stringify(cfg);return d.toString();}

test('all 21 locales and 22 routes publish exactly A values and ordered B conditions without changing unowned content',()=>{
 const rawFiles=['data/client-buildings-52.json','data/content-60/buildings.json','data/content-60/buildings-phase2.json','data/building-system-evidence.json'];
 const hashes=()=>rawFiles.map(f=>crypto.createHash('sha256').update(read(f)).digest('hex'));const initial=hashes();
 let pages=0,buildings=0,rows=0,powerExact=0;
 for(const locale of B.codes)for(const slug of B.slugs){
  const before=read(`${locale}/buildings/${slug}/index.html`),after=B.project(before,locale,slug),d=document(after),cfg=payload(d);
  assert.equal(outside(after),outside(before),locale+'/'+slug+' unowned HTML');assert.equal(cfg.lang,locale);
  for(const b of cfg.buildings){const raw=R.model.buildings.find(x=>x.id===b.id),a=raw.profiles.find(p=>p.id==='original'),bp=raw.profiles.find(p=>p.id==='d');
   assert.deepEqual(b.profiles.map(p=>p.id),['unified']);assert.equal(b.profiles[0].rows.length,a.rows.length);buildings++;
   for(const row of b.profiles[0].rows){const x=a.rows.find(r=>identity(r)===identity(row)),y=bp.rows.find(r=>identity(r)===identity(row));
    for(const key of ['resources','seconds','battlePower'])assert.deepEqual(row[key],x[key],locale+'/'+b.id+':'+identity(row)+':'+key);
    assert.deepEqual(row.constructionItems.map(i=>[i.id,i.quantity]),x.constructionItems.map(i=>[i.id,i.quantity]));
    assert.deepEqual(row.requirements.map(tuple),y.requirements.map(tuple));
    assert.equal(!!row.calculationBlocked,x.availability==='initial_conditions_unconfirmed');rows++;
   }
  }
  const effect=R.evidence.effects.find(x=>x.slug===slug);
  if(effect){const p=effect.profiles.find(x=>x.id.toLowerCase()==='original'),metrics=p.metrics||effect.metrics,panel=d.querySelector('[data-bs-effect-profile]');assert.equal(d.querySelectorAll('[data-bs-effect-profile]').length,1);assert.equal(panel.dataset.bsEffectProfile,'unified');assert.deepEqual([...panel.querySelectorAll('thead th')].slice(1).map(x=>x.textContent.includes('%')),metrics.map(x=>x.unit==='percent'));}
  if(slug==='power-plant'){assert.equal(after,before,locale+' Power Plant publication remains exact');powerExact++;}
  pages++;
 }
 assert.equal(pages,462);assert.equal(buildings,609);assert.equal(rows,15981);assert.equal(powerExact,21);assert.deepEqual(hashes(),initial,'Retained source files must not be changed');
});

test('every route is idempotent and validates strict sheet and effect ownership',()=>{
 for(const slug of B.slugs){const output=B.project(read(`en/buildings/${slug}/index.html`),'en',slug);assert.equal(B.project(output,'en',slug),output,slug);assert.equal(B.validateOwnership(output,'en',slug),true);}
 const source=B.project(read('en/buildings/hospital/index.html'),'en','hospital');
 for(const selector of ['[data-building-system]','[data-bs-effects]','[data-bs-effect-profile]']){const d=document(source),p=d.createElement('p');p.textContent='Unexpected authored addition';d.querySelector(selector).append(p);assert.throws(()=>B.validateOwnership(d.toString(),'en','hospital'),/Unexpected content/);}
});

test('publication rejects changed identities, A numbers, B conditions, missing translations and effect units',()=>{
 const source=read('fr/buildings/lab-2/index.html');
 const mutations=[
  [c=>c.buildings[0].profiles[0].rows[1].resources[0]++,/A numeric values changed/],
  [c=>(c.buildings[0].profiles.find(p=>p.id==='d')||c.buildings[0].profiles.find(p=>p.id==='unified')).rows[1].requirements[0].level++,/B prerequisites changed/],
  [c=>c.buildings[0].profiles[0].rows[1].rank++,/identity mismatch/],
  [c=>delete c.buildings[0].name.fr,/Missing localized building name/],
  [c=>delete c.buildings[0].profiles[0].rows[0].constructionItems[0].name.fr,/Missing localized construction item/]
 ];
 for(const [change,message] of mutations){const mutated=modifyModel(source,change);assert.throws(()=>B.project(mutated,'fr','lab-2'),message);}
 const stele=B.project(read('en/buildings/cursed-wound-stele/index.html'),'en','cursed-wound-stele');
 for(const change of [d=>d.querySelector('[data-effect-value]').textContent='99',d=>d.querySelector('[data-effect-value]').setAttribute('data-effect-value','99'),d=>d.querySelector('[data-bs-effects] thead th:nth-child(2)').textContent+=' (%)']){const d=document(stele);change(d);assert.throws(()=>B.project(d.toString(),'en','cursed-wound-stele'),/Effect|effect/);}
});

test('nine unknown construction costs and two initial-condition guards survive the publication',()=>{
 let unknown=0,blocked=0;
 for(const slug of B.slugs){const cfg=payload(document(B.project(read(`ko/buildings/${slug}/index.html`),'ko',slug)));for(const b of cfg.buildings)for(const row of b.profiles[0].rows){if(row.resources===null||row.resources.some(x=>x===null))unknown++;if(row.calculationBlocked)blocked++;}}
 assert.equal(unknown,9);assert.equal(blocked,2);
});

test('publication preserves the original parent, sibling position and attributes of inherited anchors',()=>{
 const anchors=d=>[...d.querySelectorAll('[data-building-system] [data-bs-legacy-anchor]')].map(n=>({id:n.id,attributes:[...n.attributes].map(a=>[a.name,a.value]),parent:{id:n.parentElement.id,tag:n.parentElement.tagName,class:n.parentElement.className},index:[...n.parentElement.children].indexOf(n)}));
 for(const slug of ['artifact-workshop','power-plant','barracks']){const original=execFileSync('git',['show',`de528513e740b6cdc11b295656c95a196230df45:ko/buildings/${slug}/index.html`],{cwd:root,encoding:'utf8'}),expected=anchors(document(original));assert(expected.length>0);const output=B.project(original,'ko',slug);assert.deepEqual(anchors(document(output)),expected,slug);}
});
