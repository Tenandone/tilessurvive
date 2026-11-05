'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {plan} = require('../js/nuclear-age');
const model = require('../data/nuclear-age.json');

// Reviewed against the fresh 2.6.400 Buildings rows, not calculated from the
// implementation. Source IDs deliberately retain their non-sequential order.
const coreFuel = [40,56,72,88,104,120,136,152,168,168,168,168,168,168,168];
const golden = [
 {id:800005,ids:[501051,501052,501053,501246,501054,501055,501056,501057,501247,501058,501059,501060,501061,501248,501249],fuel:[null,70,90,110,130,150,170,190,210,210,210,210,210,210,210],total:2380},
 {id:800007,ids:[501183,501184,501185,501290,501186,501187,501188,501189,501291,501190,501191,501192,501193,501292,501293],fuel:coreFuel,total:1944},
 {id:800008,ids:[501087,501088,501089,501258,501090,501091,501092,501093,501259,501094,501095,501096,501097,501260,501261],fuel:coreFuel,total:1944},
 {id:800009,ids:[501075,501076,501077,501254,501078,501079,501080,501081,501255,501082,501083,501084,501085,501256,501257],fuel:coreFuel,total:1944},
 {id:800010,ids:[501147,501148,501149,501278,501150,501151,501152,501153,501279,501154,501155,501156,501157,501280,501281],fuel:coreFuel,total:1944}
];
const buildings = model.buildings.map(b=>({id:b.id,stages:b.stages.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))}));
buildings.push({id:model.factory.id,stages:model.factory.levels.map(s=>({id:s.sourceId,fuel:s.nuclearFuel}))});

test('all 75 published nuclear steps retain reviewed source IDs, requirements and five-step boundaries',()=>{
 assert.equal(model.buildings.length,5);
 for (const expected of golden) {
  const b=model.buildings.find(x=>x.id===expected.id);
  assert.deepEqual(b.stages.map(s=>s.sourceId),expected.ids);
  assert.deepEqual(b.stages.map(s=>s.nuclearFuel),expected.fuel);
  for(let i=0;i<15;i++) {
   const s=b.stages[i];assert.equal(s.sequence,i+1);
   assert.equal(s.targetNuclearLevel,Math.ceil((i+1)/5));
   assert.equal(s.step,i%5+1);assert.equal(s.completedNuclearLevel,Math.floor((i+1)/5));
  }
  const result=plan(buildings,b.id,0,15);
  assert.equal(result.stageCount,15);assert.equal(result.knownFuel,expected.total);
  assert.equal(result.complete,b.id!==800005);
 }
});

test('completed starting stage is excluded and target stage is included across nuclear levels',()=>{
 assert.equal(plan(buildings,800005,1,2).knownFuel,70);
 assert.equal(plan(buildings,800005,4,6).knownFuel,280);
 assert.equal(plan(buildings,800005,9,11).knownFuel,420);
 assert.equal(plan(buildings,800007,0,5).knownFuel,360);
 assert.equal(plan(buildings,800007,1,5).knownFuel,320);
 assert.equal(plan(buildings,800007,5,10).knownFuel,744);
 assert.equal(plan(buildings,800007,10,15).knownFuel,840);
 assert.equal(plan(buildings,800007,4,6).knownFuel,224);
});

test('unknown Power Plant requirement is reported separately and never becomes a complete zero-cost upgrade',()=>{
 assert.deepEqual(plan(buildings,800005,0,1),{buildingId:800005,from:0,to:1,stageCount:1,knownFuel:0,complete:false,missingStages:[501051]});
 const all=plan(buildings,800005,0,15);assert.equal(all.knownFuel,2380);assert.deepEqual(all.missingStages,[501051]);assert.equal(all.complete,false);
 const after=plan(buildings,800005,1,15);assert.equal(after.knownFuel,2380);assert.equal(after.complete,true);assert.deepEqual(after.missingStages,[]);
 const explicitZero=plan([{id:1,stages:[{id:2,fuel:0}]}],1,0,1);assert.equal(explicitZero.knownFuel,0);assert.equal(explicitZero.complete,true);
});

test('factory uses its own twelve levels and requirements rather than nuclear five-step labels',()=>{
 assert.deepEqual(model.factory.levels.map(s=>s.sourceId),[507644,507645,507646,507647,507648,507649,507650,507651,507652,507653,507654,507655]);
 assert.deepEqual(model.factory.levels.map(s=>s.nuclearFuel),[null,5,10,15,20,30,40,50,60,70,80,100]);
 const whole=plan(buildings,800419,0,12);assert.equal(whole.knownFuel,480);assert.equal(whole.complete,false);assert.deepEqual(whole.missingStages,[507644]);
 assert.equal(plan(buildings,800419,1,12).complete,true);
 assert.equal(plan(buildings,800419,2,4).knownFuel,25);
 assert.throws(()=>plan(buildings,800419,0,13),/INVALID_RANGE/);
});

test('building selection is isolated and empty ranges need no upgrade or material',()=>{
 const before=JSON.stringify(buildings);
 assert.equal(plan(buildings,'800005',1,2).knownFuel,70);
 assert.equal(plan(buildings,'800007',1,2).knownFuel,56);
 assert.equal(plan(buildings,'800419',1,2).knownFuel,5);
 for(const b of buildings)for(const completed of [0,5,b.stages.length]){
  const r=plan(buildings,b.id,completed,completed);assert.equal(r.knownFuel,0);assert.equal(r.stageCount,0);assert.equal(r.complete,true);assert.deepEqual(r.missingStages,[]);
 }
 const unrelated=structuredClone(buildings);unrelated.find(b=>b.id===800005).stages[1].fuel=NaN;
 assert.equal(plan(unrelated,800007,0,5).knownFuel,360);
 assert.equal(JSON.stringify(buildings),before);
 assert.throws(()=>plan(buildings,999999,0,1),/INVALID_RANGE/);
});

test('malformed ranges and invalid requirements are rejected instead of producing NaN or unsafe sums',()=>{
 for(const [from,to]of [[-1,1],[2,1],[0,16],[NaN,1],[0,NaN],[0.5,1],[0,1.5],[Infinity,15],[0,Infinity],['0',1],[0,'1'],[null,1],[0,null]])assert.throws(()=>plan(buildings,800005,from,to),/INVALID_RANGE/);
 for(const fuel of [NaN,Infinity,-1,0.5,'70',undefined,true])assert.throws(()=>plan([{id:1,stages:[{id:2,fuel}]}],1,0,1),/INVALID_REQUIREMENT/);
 assert.throws(()=>plan([{id:1,stages:[{id:2,fuel:Number.MAX_SAFE_INTEGER},{id:3,fuel:1}]}],1,0,2),/OVERFLOW/);
});
