'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {unifyBuilding}=require('./building-data/unified'),R=require('./building-data-registry');
const baseline=require('./building-data/baseline-7a82e23b.json'),power=require('../data/power-plant-unified.json');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const source=()=>structuredClone(R.model.buildings.find(b=>b.id===800005));
const a=b=>b.profiles.find(p=>p.id==='original').rows,d=b=>b.profiles.find(p=>p.id==='d').rows;
const identity=r=>r.level+':'+r.rank;
const rawRows=R.model.buildings.flatMap(b=>b.profiles.flatMap(p=>p.rows));
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};

test('29 unified buildings preserve every A value and every ordered D prerequisite without changing 58 raw profiles',()=>{
 const before=hash(R.model),outputs=R.slugs.flatMap(R.publicBuildings);
 assert.equal(before,baseline.modelSha256);assert.equal(R.model.buildings.length,29);
 assert.equal(R.model.buildings.flatMap(b=>b.profiles).length,58);assert.equal(rawRows.length,1522);
 assert.equal(outputs.length,29);assert.equal(outputs.flatMap(b=>b.profiles).length,29);
 assert.equal(outputs.flatMap(b=>b.profiles.flatMap(p=>p.rows)).length,761);
 let rows=0,prerequisites=0;
 for(const out of outputs){
  const original=R.model.buildings.find(b=>b.id===out.id),expected=structuredClone(a(original));
  for(const row of expected)row.requirements=structuredClone(d(original).find(r=>identity(r)===identity(row)).requirements);
  assert.deepEqual(out.profiles,[{id:'unified',rows:expected}],out.id+' full independent A/D projection');
  assert.deepEqual(out.name,original.name);assert.equal(out.slug,original.slug);
  rows+=expected.length;prerequisites+=expected.reduce((n,r)=>n+(r.requirements?.length||0),0);
 }
 assert.equal(rows,761);assert(prerequisites>0);assert.equal(hash(R.model),before);
 assert.equal(hash(R.evidence.effects),baseline.effectsSha256,'Profile-specific effect evidence is immutable');
});

test('the generic Power Plant join is exactly the previously approved 30-row unified model',()=>{
 const output=unifyBuilding(source());
 const rows=output.profiles[0].rows.map(r=>({level:r.level,rank:r.rank,resources:r.resources,seconds:r.seconds,battlePower:r.battlePower,constructionItems:r.constructionItems.map(i=>({id:i.id,quantity:i.quantity})),requirements:r.requirements.map(q=>({buildingId:q.buildingId,level:q.level,rank:q.rank}))}));
 assert.deepEqual(rows,power.rows);assert.equal(output.profiles[0].id,power.profile);
 assert.equal(rows.reduce((n,r)=>n+r.requirements.length,0),63);
 assert.deepEqual(rows.find(r=>r.level===15).requirements.map(q=>[q.buildingId,q.level,q.rank]),[[800016,13,0],[800007,14,0],[800010,5,0]]);
 assert.deepEqual(rows.at(-1).requirements.map(q=>[q.buildingId,q.level,q.rank]),[[800012,29,0],[800007,29,0],[800147,26,0]]);
});

test('all nine unknown initial A rows keep their exact nulls, special materials and calculation guards',()=>{
 const outputs=R.slugs.flatMap(R.publicBuildings),unknown=[];
 for(const b of outputs)for(const r of b.profiles[0].rows)if(r.resources===null||r.resources.some(v=>v===null)||r.availability==='initial_conditions_unconfirmed')unknown.push({id:b.id,row:r});
 assert.deepEqual(unknown.map(x=>x.id),[800007,800008,800009,800012,800016,800001,800003,800004,800168]);
 for(const {id,row}of unknown){
  const old=a(R.model.buildings.find(b=>b.id===id)).find(r=>identity(r)===identity(row));
  for(const key of ['resources','seconds','battlePower','constructionItems','availability'])assert.deepEqual(row[key],old[key],id+' retains '+key);
  assert.equal(row.level,1);
 }
 for(const id of [800004,800168])assert.equal(unknown.find(x=>x.id===id).row.availability,'initial_conditions_unconfirmed');
 assert.equal(unknown.find(x=>x.id===800008).row.constructionItems[0].id,208847);
});

test('the join matches both directions by level and rank and never uses D numeric values or A prerequisites',()=>{
 const original=source(),expected=unifyBuilding(original),changed=source();
 d(changed).reverse();for(const r of d(changed)){r.resources=[1,2,3,4];r.seconds=1;r.battlePower=1;r.constructionItems=[];r.availability='initial_conditions_unconfirmed';}
 for(const r of a(changed))r.requirements=[];
 assert.deepEqual(unifyBuilding(changed),expected,'Only A numbers and D prerequisite fields may be selected');
 for(const mutate of [
  b=>b.profiles.pop(),b=>b.profiles.push(structuredClone(b.profiles[0])),b=>b.profiles[1].id='original',
  b=>a(b).pop(),b=>d(b).pop(),b=>a(b).push(structuredClone(a(b)[0])),b=>d(b).push(structuredClone(d(b)[0])),
  b=>d(b)[29].rank=0,b=>a(b)[1].level=99,b=>d(b).push({...structuredClone(d(b)[0]),level:99}),
  b=>b.id=0,b=>a(b)[0].rank=-1,b=>d(b)[0].level=1.5
 ]){const value=source();mutate(value);assert.throws(()=>unifyBuilding(value));}
});

test('unknown fields remain null and malformed numeric or prerequisite fields are rejected',()=>{
 const value=source();Object.assign(a(value)[0],{resources:[null,null,null,null],seconds:null,battlePower:null,constructionItems:null,availability:'initial_conditions_unconfirmed'});d(value)[0].requirements=null;
 let row=unifyBuilding(value).profiles[0].rows[0];
 assert.deepEqual(row.resources,[null,null,null,null]);for(const key of ['seconds','battlePower','constructionItems','requirements'])assert.equal(row[key],null);
 assert.equal(row.availability,'initial_conditions_unconfirmed');a(value)[0].resources=null;assert.equal(unifyBuilding(value).profiles[0].rows[0].resources,null);
 for(const mutate of [
  b=>delete a(b)[0].seconds,b=>a(b)[0].resources=[1,2],b=>a(b)[0].resources[0]=undefined,
  b=>a(b)[0].seconds=NaN,b=>a(b)[0].battlePower=Infinity,b=>a(b)[0].resources[0]='0',
  b=>a(b)[0].seconds=-1,b=>a(b)[0].seconds=.5,b=>a(b)[0].seconds=Number.MAX_SAFE_INTEGER+1,
  b=>a(b)[0].constructionItems=[{id:1,quantity:-1}],b=>a(b)[0].constructionItems=[{id:1,quantity:1},{id:1,quantity:2}],
  b=>a(b)[0].availability='assumed_available',b=>delete d(b)[0].requirements,b=>d(b)[0].requirements={},
  b=>d(b)[1].requirements.push(structuredClone(d(b)[1].requirements[0])),b=>delete d(b)[1].requirements[0].rank,
  b=>d(b)[1].requirements[0].level=0,b=>d(b)[1].requirements[0].buildingId='800005'
 ]){const changed=source();mutate(changed);assert.throws(()=>unifyBuilding(changed));}
});

test('the pure join and public projection return detached names, materials and prerequisite lists',()=>{
 const original=freeze(source()),before=hash(original),out=unifyBuilding(original);
 out.name.en='changed';out.profiles[0].rows[0].resources[0]=-1;out.profiles[0].rows[1].requirements[0].name.en='changed';
 assert.equal(hash(original),before);
 const barracks=R.publicBuildings('barracks'),rawBefore=hash(R.model);
 barracks[0].profiles[0].rows[0].constructionItems[0].name.en='changed';barracks[0].profiles[0].rows[0].constructionItems[0].quantity=999;
 assert.equal(hash(R.model),rawBefore);
 const extra=source();extra.internalAudit={secret:'not-public'};a(extra)[0].provenance='not-public';d(extra)[1].requirements[0].sourceFile='not-public';
 const text=JSON.stringify(unifyBuilding(extra));assert(!text.includes('not-public'));
});
