'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),S=require('../js/v4-state');
test('shared plans round trip across language paths without exposing state as query parameters',()=>{
 const state={schema:1,tab:'growth',plans:{formation:{front:['rusty',null],back:['beka','lava',null],petId:'fluffy'},growth:{goals:[{id:'goal1',kind:'building',from:1,to:3,quantity:1}],held:{food:4000}},vs:{day:4,quantities:{book:300}}}};
 assert.deepEqual(S.decode(S.encode(state)),state);const en=new URL(S.url('https://tilessurvive.net/en/tools/',state));assert.equal(en.search,'');en.pathname='/ko/tools/';assert.deepEqual(S.fromHash(en.hash),state);
 assert.deepEqual(S.fromHash('#v4-vs'),{schema:1,tab:'vs',plans:{}});assert.equal(S.fromHash('#other'),null);
});
test('malformed, oversized, unsafe and foreign-schema state is rejected',()=>{
 for(const v of ['','!','e30','A'.repeat(17000),'_w'])assert.throws(()=>S.decode(v),/invalidState/);
 for(const v of [{schema:2,tab:'vs',plans:{}},{schema:1,tab:'foreign',plans:{}},{schema:1,tab:'vs',plans:{unknown:{}}},{schema:1,tab:'vs',plans:{vs:{n:Infinity}}},{schema:1,tab:'vs',plans:{vs:{n:-1}}},{schema:1,tab:'vs',plans:{vs:{n:.5}}},{schema:1,tab:'vs',plans:{vs:{n:Number.MAX_SAFE_INTEGER+1}}},{schema:1,tab:'vs',plans:{vs:{s:'x'.repeat(161)}}},{schema:1,tab:'vs',plans:{vs:{a:Array(121).fill(0)}}},JSON.parse('{"schema":1,"tab":"vs","plans":{"vs":{"__proto__":{"evil":true}}}}')])assert.throws(()=>S.validate(v),/invalidState/);
 assert.equal({}.evil,undefined);let deep={};for(let i=0;i<12;i++)deep={a:deep};assert.throws(()=>S.validate({schema:1,tab:'vs',plans:{vs:deep}}),/invalidState/);
});
test('storage errors remain explicit and restore never mutates an existing plan',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},state=S.empty();assert.equal(S.restore(storage,'plan'),null);S.save(storage,'plan',state);assert.deepEqual(S.restore(storage,'plan'),state);
 store.set('plan','{"schema":7}');assert.throws(()=>S.restore(storage,'plan'));assert.deepEqual(state,S.empty());
 assert.throws(()=>S.save({setItem(){throw Error('quota');}},'plan',state),/quota/);
});
