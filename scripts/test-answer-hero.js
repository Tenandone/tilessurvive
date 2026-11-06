'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('./answer-guides/hero'),M=require('./answer-guides/hero-math'),D=require('./xssr-details-data'),Detail=require('./xssr-detail-content');
const C=require('../data/answer-guide-hero-copy.json'),codes=require('../data/i18n/locales.json').locales.map(x=>x.code),ROOT=path.resolve(__dirname,'..');
test('hero answers retain 21 complete localized templates and identical neutral models',()=>{
 assert.deepEqual(Object.keys(C.locales).sort(),codes.slice().sort());
 const keys=Object.keys(C.locales.en).sort(),parameters=s=>[...s.matchAll(/\{(\w+)\}/g)].map(x=>x[1]).sort();
 const baseline=A.guides('en').map(g=>g.answers.map(a=>a.model));
 for(const locale of codes){
  assert.deepEqual(Object.keys(C.locales[locale]).sort(),keys);
  for(const key of keys){assert(C.locales[locale][key].trim());assert.deepEqual(parameters(C.locales[locale][key]),parameters(C.locales.en[key]),locale+':'+key);}
  const guides=A.guides(locale);assert.equal(guides.length,3);assert.deepEqual(guides.map(g=>g.answers.map(a=>a.model)),baseline);
  assert(!/undefined|NaN|\{\w+\}|<color=/.test(JSON.stringify(guides)));
  for(const g of guides){assert.equal(g.answers.length,5);assert.equal(new Set(g.answers.map(a=>a.id)).size,5);assert(g.title.includes(D.name(D.heroes().find(h=>h.clientId===g.targetId).id,locale)));}
 }
});
test('fragment answers keep source growth stages, recruitment and universal exchange separate',()=>{
 for(const h of D.heroes()){
  const p=M.projectHero(h.id),a=A.guides('en').find(g=>g.targetId===h.clientId).answers[0];
  assert.deepEqual(p.growth.slice(0,3).map(x=>x.incremental.value),[24,70,165]);
  assert.deepEqual(p.growth.slice(0,3).map(x=>x.cumulative.value),[24,94,259]);
  assert.equal(p.growth.at(-1).cumulative.value,3049);assert.equal(p.growthExample.value,2790);
  assert.equal(a.model.value,259);assert.equal(a.model.source.recordIds.length,18);
  assert.deepEqual(a.model.source.recordIds,h.growth.rankRows.slice(0,18).map(x=>x.clientRowId));
  assert.equal(a.model.scope.visualStarMappingVerified,false);assert.equal(a.model.scope.recruitmentExcluded,true);
  assert.deepEqual(a.model.recruitment,{itemId:h.recruitment.cost.itemId,quantity:10,included:false});
  const u=a.model.universalConversion;assert(u.requiresOwnedHero);assert.equal(u.usableForRecruitment,false);assert.deepEqual(u.exchangeRatio,{universal:1,dedicated:1});
  assert.equal(a.model.material.id,h.growth.fragmentItemId);
 }
});
test('skill costs use destination rows and exclude the automatic skill',()=>{
 for(const h of D.heroes()){
  const p=M.projectHero(h.id),a=A.guides('en').find(g=>g.targetId===h.clientId).answers[1];
  assert.equal(p.skills.length,3);assert.equal(a.model.value,35555);assert.equal(a.model.material.id,201725);assert.equal(a.model.source.recordIds.length,147);
  for(const {skill,total,example} of p.skills){assert.equal(total.value,35555);assert.equal(example.value,230);assert.equal(M.skillRange(skill,1,2).value,1);assert.equal(M.skillRange(skill,2,3).value,3);assert.deepEqual(total.recordIds,skill.materialCosts.map(r=>r.clientRowId));}
  assert.throws(()=>M.skillRange(h.skills[3],1,5),/Automatic/);
  assert.throws(()=>M.skillRange(h.skills[0],0,2),/Invalid skill/);
  assert.throws(()=>M.skillRange(h.skills[0],1,51),/Invalid skill/);
 }
});
test('gear intervals include destination costs and distinguish acquisition from existing gear',()=>{
 for(const h of D.heroes()){
  const p=M.projectHero(h.id);assert.equal(p.gear.total.value,650);assert.equal(p.gear.fromOne.value,640);assert.equal(p.gear.example.value,430);
  assert.equal(M.gearRange(h,0,1).value,10);assert.equal(M.gearRange(h,1,2).value,5);
  assert.deepEqual(p.gear.fromOne.recordIds,h.exclusiveGear.levels.slice(1).map(r=>r.clientRowId));
  assert.equal(p.gear.unchanged.value,0);assert.equal(p.gear.unchanged.status,'confirmed-zero');assert.deepEqual(p.gear.unchanged.recordIds,[]);
  assert.throws(()=>M.gearRange(h,5,4),/Invalid hero/);assert.throws(()=>M.gearRange(h,0,21),/Invalid hero/);assert.throws(()=>M.gearRange(h,0.5,1),/Invalid hero/);
 }
});
test('unknown requirements remain partial and never become a zero or complete total',()=>{
 const data=structuredClone(D.data),h=data.heroes.lava;
 h.growth.rankRows[0].cost.quantity=null;h.exclusiveGear.levels[10].cost.quantity=null;h.skills[0].materialCosts[0].cost.quantity=null;
 const p=M.projectHero('lava',data);
 assert.equal(p.growth[0].cumulative.status,'partial');assert.equal(p.growth[0].cumulative.value,null);assert.equal(p.growth[0].cumulative.knownSubtotal,21);
 assert.deepEqual(p.growth[0].cumulative.unknownRecordIds,[h.growth.rankRows[0].clientRowId]);
 assert.equal(p.skills[0].example.value,null);assert.equal(p.skills[0].example.knownSubtotal,229);assert.equal(p.gear.example.value,null);assert.equal(p.gear.example.knownSubtotal,400);
 assert.equal(M.gearRange(h,10,10).status,'confirmed-zero');
 const onlyUnknown=M.interval([{level:1,quantity:null,recordId:7}],0,1);assert.equal(onlyUnknown.value,null);assert.equal(onlyUnknown.status,'partial');
 assert.throws(()=>M.interval([{level:1,quantity:-1,recordId:7}],0,1),/Invalid material/);
 assert.throws(()=>M.interval([{level:1,quantity:Number.MAX_SAFE_INTEGER,recordId:7},{level:2,quantity:1,recordId:8}],0,2),/Unsafe/);
 assert.throws(()=>M.interval([{level:2,quantity:1,recordId:7}],0,1),/Missing or duplicated/);
});
test('skill effect answers preserve native units and existing localized formatter output',()=>{
 for(const locale of codes)for(const h of D.heroes()){
  const a=A.guides(locale).find(g=>g.targetId===h.clientId).answers[2],s=h.skills[0];
  assert.equal(a.model.targetId,s.clientId);assert.equal(a.model.scope.growthAndGearBonusesIncluded,false);
  assert.deepEqual(a.model.parameters,[1,50].map(level=>({level,values:D.skillParameters(h.id,s.clientId,level)})));
  assert.deepEqual(a.table.rows.map(r=>r[1]),[1,50].map(level=>Detail.skillText(h,s,level,locale)));
 }
 assert.deepEqual(A.guides('en')[2].answers[2].model.parameters[0].values,['100%','30%','10%','2']);
});
test('gear effects retain source attributes and unreleased availability remains conditional',()=>{
 for(const g of A.guides('ko')){
  const h=D.heroes().find(h=>h.clientId===g.targetId),a=g.answers[4];
  assert.deepEqual(a.model.attributes.map(r=>[r.attack,r.defense,r.health,r.power]),[[3600,720,240000,98880],[30960,6190,2064000,977876]]);
  assert.deepEqual(a.model.source.recordIds,[h.exclusiveGear.levels[0].clientRowId,h.exclusiveGear.levels.at(-1).clientRowId]);
  for(const answer of g.answers){assert.equal(answer.model.scope.liveServerUnlockVerified,false);assert.deepEqual(answer.model.source.version,{game:'2.6.300',build:1531});assert.equal(answer.model.source.verifiedAt,'2026-11-05');}
 }
 const alita=A.guides('ko')[2];assert(alita.basis.text.includes(C.locales.ko.preview));assert.equal(alita.answers[0].model.scope.releaseStatus,'upcoming');
});
test('all answer links reuse existing localized canonical pages and anchors without a new calculator',()=>{
 for(const locale of codes)for(const g of A.guides(locale)){
  assert(fs.existsSync(path.join(ROOT,g.route,'index.html')));const html=fs.readFileSync(path.join(ROOT,g.route,'index.html'),'utf8');
  for(const link of [...g.answers.flatMap(a=>a.links||[]),...(g.example.links||[]),...(g.basis.links||[])]){
   assert(link.href.startsWith('/'+locale+'/'));const [route,anchor]=link.href.split('#');assert(fs.existsSync(path.join(ROOT,route,'index.html')));
   if(anchor)assert(html.includes('id="'+anchor+'"'),link.href);
  }
 }
});
