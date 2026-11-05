'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../js/analytics-contract');
test('analytics taxonomy consistently identifies 21 localized public content paths',()=>{
 assert.equal(C.locales.length,21);
 for(const l of C.locales)for(const [path,type,id]of [['','home',''],['heroes/lava/','hero_detail','lava'],['database/pet-system/chompy/','pet_detail','chompy'],['buildings/lab/','building_detail','lab'],['eras/nuclear-age/','nuclear_guide','nuclear-age'],['codes/','coupon',''],['tools/speedup-calculator/','tool','speedup-calculator']])assert.deepEqual(C.classify('/'+l+'/'+path),{page:'/'+l+'/'+path,language:l,page_type:type,content_id:id});
});
test('analytics contract rejects user URLs and query input and strips arbitrary event data',()=>{
 for(const p of ['https://tilessurvive.net/ko/','/ko/?q=secret','/ko/#secret','/ko/%65mail/','//example.com/ko/','/xx/','/ko/../en/',null,'/ko/'+ 'a'.repeat(221)+'/'])assert.equal(C.classify(p),null);
 assert.deepEqual(C.dimensions({feature:'growth',action:'result',placement:'planner',user_id:'private',query:'private',url:'https://private.example',coupon:'secret',input:123}),{feature:'growth',action:'result',placement:'planner'});
 assert.deepEqual(C.dimensions({feature:'private feature',action:'private action',placement:'private placement'}),{});
 assert(!C.events.includes('purchase')&&!C.events.includes('sign_up'));
});
