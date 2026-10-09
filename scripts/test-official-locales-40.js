'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
const {entries,replaceLabels}=require('./lib/official-locales-40');
const root=path.resolve(__dirname,'..'),release='9a931a56a557686f84953d8854a9af2a41adf75d';
const langs=['ko','en','ja','ru','zh-tw'];
test('official labels cover existing 28 heroes and 7 pets in five locales',()=>{
 for(const lang of langs)for(const e of entries(lang)){
  const file=e.route.slice(1)+'index.html',d=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document;
  assert.equal(d.querySelector('h1').textContent,e.entity.names[lang],file);
  assert.ok(d.title.includes(e.entity.names[lang]),file+' title');
  if(e.type==='heroes')assert.deepEqual([...d.querySelectorAll('details.ts-skill summary>span')].map(n=>n.textContent),e.entity.skills.map(s=>s.name[lang]),file);
  assert.ok(![...d.querySelectorAll('details.ts-skill summary>span')].some(n=>/\{\d+\}|<color/.test(n.textContent)),file+' no unresolved game tokens');
 }
});
test('same production routes, canonical, hreflang and hero banners survive naming corrections',()=>{
 for(const lang of langs)for(const e of entries(lang)){
  const file=e.route.slice(1)+'index.html';
  const old=parseHTML(execFileSync('git',['show',release+':'+file],{cwd:root,encoding:'utf8',maxBuffer:5e6})).document;
  const current=parseHTML(fs.readFileSync(path.join(root,file),'utf8')).document;
  for(const selector of ['link[rel=canonical]','link[hreflang]','.ts-lootbar-slot'])assert.deepEqual([...current.querySelectorAll(selector)].map(n=>n.outerHTML),[...old.querySelectorAll(selector)].map(n=>n.outerHTML),file+' '+selector);
  const oldBodies=[...old.querySelectorAll('.ts-skill-body')],bodies=[...current.querySelectorAll('.ts-skill-body')];
  assert.equal(bodies.length,oldBodies.length,file+' complete skill panels');
  // Human-reviewed labels may change; every original displayed quantity must remain.
  oldBodies.forEach((body,i)=>{const numbers=s=>(s.normalize('NFKC').match(/\d+(?:[.,]\d+)*(?:%)?/g)||[]);assert.deepEqual(numbers(bodies[i].textContent),numbers(body.textContent),file+' existing skill quantities '+i);});
 }
});
test('renaming preserves old names for roster and site search',()=>{
 const index=JSON.parse(fs.readFileSync(path.join(root,'data/search-index.json'))).items;
 for(const lang of langs){
  const d=parseHTML(fs.readFileSync(path.join(root,lang,'heroes/index.html'),'utf8')).document;
  for(const e of entries(lang)){
   const indexed=index.find(i=>i.url===e.route);assert.ok(indexed, e.route);
   for(const alias of e.names)assert.ok(indexed.aliases.includes(alias),e.route+' alias '+alias);
   if(e.type==='heroes'){
    const card=d.querySelector('[data-character-id="'+e.entity.id+'"]');assert.ok(card,e.route+' roster');
    assert.ok(card.textContent.includes(e.entity.names[lang]),e.route+' official roster label');
    assert.ok(card.dataset.searchAliases.includes(e.entity.names.en),e.route+' English search alias');
   }
  }
 }
});
test('short labels never replace substrings or repeatedly expand names',()=>{
 assert.equal(replaceLabels('Roy Royal Roy42 (Roy)',[['Roy','ロイ']]),'ロイ Royal Roy42 (ロイ)');
 const pairs=[['Undine','ウンディーネ']];assert.equal(replaceLabels(replaceLabels('Undine',pairs),pairs),'ウンディーネ');
 assert.equal(replaceLabels('100.25% ATK',pairs),'100.25% ATK');
});
