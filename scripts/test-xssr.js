'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const {parseHTML}=require('linkedom'),X=require('./lib/xssr-catalog'),A=require('./build-hero-atlas');
const ROOT=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),codes=require('../data/i18n/locales.json').locales.map(l=>l.code),R=require('../data/hero-atlas-routes.json'),D=require('../data/hero-atlas-client.json'),M=require('../data/v4-formation.json');
test('retains every client identity, calculation model and trusted pet pairing',()=>{
 for(const f of ['data/hero-atlas-client.json','data/hero-pet-relations.json','data/v4-economy.json'])assert.deepEqual(JSON.parse(read(f)),JSON.parse(cp.execFileSync('git',['show','1b07e46e:'+f],{cwd:ROOT,encoding:'utf8',maxBuffer:32e6})));
 assert.deepEqual(X.counts(),{total:31,released:30,development:1,xssr:3});assert.equal(D.heroes.length,35);assert.equal(M.heroes.length,31);
 for(const id of ['furiosa','alita']){assert(!D.heroes.some(h=>h.id===id));assert(M.heroes.some(h=>h.id===id));assert.equal(X.record(id).clientId,id==='furiosa'?25300243:25300244);}
 assert.equal(X.record('lava').release.status,'released');assert.equal(X.record('furiosa').release.status,'released');assert.equal(X.record('alita').release.status,'upcoming');
});
test('all 21 locales expose three X-SSR cards, search aliases and release-aware comparison',()=>{
 const source=read('js/hero-atlas.js');for(const locale of codes){
  const {document,Event}=parseHTML('<html><body>'+A.renderHub(locale)+'</body></html>');for(const s of document.querySelectorAll('select'))Object.defineProperty(s,'value',{value:'',writable:true});
  vm.runInNewContext(source,{document,window:{location:new URL('https://tilessurvive.net/'+locale+'/heroes/')},URL,Intl,Map,Set});
  const host=document.querySelector('[data-hero-atlas]');assert(host.hasAttribute('data-atlas-ready'));
  const rarity=host.querySelector('[data-atlas-filter="rarity"]');rarity.value='X-SSR';rarity.dispatchEvent(new Event('change'));
  const visible=[...host.querySelectorAll('.hero-atlas-card')].filter(n=>!n.hidden);assert.deepEqual(visible.map(n=>n.dataset.atlasId).sort(),['alita','furiosa','lava']);
  for(const card of visible){const box=card.querySelector('[data-atlas-compare]');box.checked=true;box.dispatchEvent(new Event('change'));}
  assert(host.querySelector('[data-atlas-comparison-table]').textContent.includes(X.copy(locale).upcoming));
  const q=host.querySelector('[data-atlas-query]');q.value='퓨리오사';q.dispatchEvent(new Event('input'));assert.deepEqual([...host.querySelectorAll('.hero-atlas-card')].filter(n=>!n.hidden).map(n=>n.dataset.atlasId),['furiosa']);
 }
});
test('three source-backed guides provide four skills, ten ranks, twenty gear levels, two pets and search IDs across21locales',()=>{
 const localeRegistry=require('../data/i18n/locales.json').locales,G=require('./client-release-gate'),V=require('./xssr-details-data');
 for(const id of ['lava','furiosa','alita'])for(const locale of codes){const r=R.heroes.find(h=>h.id===id),route=r.routes[locale],html=read(route.slice(1)+'index.html'),d=parseHTML(html).document,h=V.record(id);
  G.validateDocument(html,{locale,route,routes:r.routes,registry:localeRegistry});assert.equal(d.querySelector('h1').textContent,X.record(id).names[locale].value);
  assert.equal(d.querySelector('[data-hero-release]').dataset.heroRelease,X.record(id).release.status);assert.equal(Number(d.querySelector('[data-hero-atlas-owned="xssr"]').dataset.clientHeroId),h.clientId);
  assert.equal(d.querySelectorAll('[data-xssr-skill]').length,4);assert.equal(d.querySelectorAll('[data-xssr-skill] img').length,4);assert.equal(d.querySelectorAll('[data-xssr-skill-level]').length,4);
  assert.equal(d.querySelectorAll('[data-xssr-table="rank"] tbody tr').length,10);assert.equal(d.querySelectorAll('[data-xssr-table="gear"] tbody tr').length,20);assert.equal(d.querySelectorAll('[data-xssr-table^="skill-cost-"] tbody tr').length,147);assert.equal(d.querySelectorAll('[data-hp-hero="'+h.id+'"] .hp-card img').length,h.id==='lava'?4:2);
  const visible=d.querySelector('[data-xssr-detail]').cloneNode(true);visible.querySelectorAll('script').forEach(n=>n.remove());assert(!/undefined|NaN|\{\d+\}/.test(visible.textContent));for(const img of d.querySelectorAll('[data-hero-atlas-owned="xssr"] img'))assert(fs.existsSync(path.join(ROOT,img.getAttribute('src'))));
  const shard=JSON.parse(read('data/v3-search/'+locale+'.json')),row=shard.items.find(i=>i.url===route);assert.deepEqual(row.search.clientIds,[{kind:'hero',id:h.clientId}]);
 }
});

test('new copy has complete translations and identical template keys',()=>{
 const copy=require('../data/xssr-copy.json').locales,keys=v=>Object.keys(v).sort();assert.deepEqual(keys(copy),codes.slice().sort());for(const locale of codes){assert.deepEqual(keys(copy[locale]),keys(copy.en));for(const [k,v]of Object.entries(copy.en)){if(typeof v==='object'){assert.deepEqual(keys(copy[locale][k]),keys(v));for(const text of Object.values(copy[locale][k]))assert(typeof text==='string'&&text.trim());}else{assert(copy[locale][k]?.trim());assert.deepEqual((copy[locale][k].match(/\{\w+\}/g)||[]).sort(),(v.match(/\{\w+\}/g)||[]).sort(),locale+':'+k);}}}
});
