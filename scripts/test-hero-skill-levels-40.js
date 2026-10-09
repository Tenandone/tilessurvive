'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),{parseHTML}=require('linkedom');
const R=path.resolve(__dirname,'..'),D=require('../data/foundation-40/hero-skill-levels.json'),{compare}=require('../js/hero-skill-levels-40');
const G=require('../data/foundation-40/hero-gear-levels.json');
const checks=[];const test=(name,fn)=>{fn();checks.push(name);};
const anchors={undine:{10:['47.96','397.85','6.54'],11:['48.40','401.50','6.60'],20:['52.36','434.35','7.14'],21:['52.80','438.00','7.20'],40:['61.16','507.35','8.34']},lagnar:{10:['98.10','436.00','10.90'],11:['99.00','440.00','11.00'],40:['125.10','556.00','13.90']}};
test('240 explicit contiguous values and independent current/max anchors',()=>{assert.equal(D.heroes.length,2);for(const h of D.heroes){assert.equal(h.skills.length,3);for(const s of h.skills){assert.equal(s.values.length,40);assert.deepEqual(s.values.map(v=>v.level),Array.from({length:40},(_,i)=>i+1));assert.ok(s.values.every(v=>/^\d+\.\d{2}$/.test(v.value)));}for(const [level,expected]of Object.entries(anchors[h.id]))assert.deepEqual(compare(h,Number(level),Number(level)).map(v=>v.from),expected);}});
test('Comparison uses selected stored rows, supports reverse/equal and rejects absent levels',()=>{const h=D.heroes[0];assert.deepEqual(compare(h,40,10).map(v=>[v.from,v.to]),[['61.16','47.96'],['507.35','397.85'],['8.34','6.54']]);assert.ok(compare(h,10,10).every(v=>v.from===v.to));for(const n of [0,-1,41,10.5,NaN,Infinity,'10'])assert.throws(()=>compare(h,n,11));assert.throws(()=>compare({skills:[{id:'missing',values:[]}]},10,11));});
for(const h of D.heroes)for(const lang of ['ko','en','ja','ru','zh-tw'])test(h.id+'/'+lang+' static rows, scoped placement and client selection',()=>{
 const file=path.join(R,lang,'heroes',h.id,'index.html'),{document,Event}=parseHTML(fs.readFileSync(file,'utf8'));
 const block=document.getElementById('skill-level-comparison-40'),table=block.querySelector('[data-level-comparison-table]'),all=block.querySelector('[data-hero-levels-40="table"]');
 assert.equal(all.querySelectorAll('tbody tr').length,40);assert.equal(table.querySelectorAll('tbody tr').length,3);assert.equal(document.querySelectorAll('[data-skill-level-compare]').length,1);
 assert.equal(document.querySelectorAll('.ts-lootbar-slot--hero').length,1);assert.ok(document.querySelector('.ts-lootbar-slot--hero').previousElementSibling.contains(block));
 const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
 assert.equal(document.querySelector('link[rel="canonical"]').href,'https://tilessurvive.net/'+lang+'/heroes/'+h.id+'/');
 assert.ok(block.querySelector('[data-skill-level-condition]').textContent.includes(String(h.observedCap)));assert.equal(document.querySelectorAll('script[src^="/js/hero-skill-levels-40.js"]').length,1);
 for(const [index,row]of [...all.querySelectorAll('tbody tr')].entries()){assert.equal(Number(row.querySelector('th').textContent),index+1);const cells=[...row.querySelectorAll('td')];for(let s=0;s<3;s++)assert.equal(Number(cells[s].textContent.replace(',','.').replace(/[^\d.]/g,'')),Number(h.skills[s].values[index].value));}
 const form=block.querySelector('[data-skill-level-compare]'),from=form.querySelector('[name="from"]'),to=form.querySelector('[name="to"]');assert.ok(form.hidden);
 Object.defineProperty(from,'value',{value:'10',writable:true});Object.defineProperty(to,'value',{value:'11',writable:true});
 vm.runInContext(fs.readFileSync(path.join(R,'js/hero-skill-levels-40.js'),'utf8'),vm.createContext({window:{document},Number,Error}));assert.equal(form.hidden,false);
 const values=()=>[...table.querySelectorAll('tbody tr')].map(r=>[...r.querySelectorAll('td')].map(c=>Number(c.textContent.replace(',','.').replace(/[^\d.]/g,''))));
 from.value='40';to.value='10';form.dispatchEvent(new Event('change'));assert.deepEqual(values(),h.skills.map(s=>[Number(s.values[39].value),Number(s.values[9].value)]));assert.equal(table.querySelectorAll('thead th')[1].textContent,'Lv.40');
 const before=table.outerHTML;from.value='41';form.dispatchEvent(new Event('change'));assert.equal(table.outerHTML,before);assert.ok(form.querySelector('[data-level-status]').textContent.length>0);
});
test('No raw IDs, local paths, remote calls, saved progress or invented effect fields',()=>{assert.ok(!/InternalId|RaidSkillParam|referenceClass|C:[\\/]|rawHex/.test(JSON.stringify(D)));const script=fs.readFileSync(path.join(R,'js/hero-skill-levels-40.js'),'utf8');assert.ok(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon/.test(script));assert.ok(D.heroes.every(h=>h.skills.every(s=>['percent-atk','percent-damage','percent-bonus'].includes(s.unit))));});
test('Undine gear15 explicit levels preserve endpoint anchors and omit conflicting costs',()=>{
 assert.deepEqual(G.levels.map(r=>r.level),Array.from({length:15},(_,i)=>i+1));
 assert.deepEqual(G.levels[0],{level:1,attack:3600,defense:720,hp:240000,power:98880,frontDefense:10,backAttack:10});
 assert.deepEqual(G.levels[14],{level:15,attack:23760,defense:4750,hp:1584000,power:750452,frontDefense:30,backAttack:30});
 assert.ok(!/cost|ItemNeed|fragment|rawHex|internalId/i.test(JSON.stringify(G)));
 for(const lang of ['ko','en','ja','ru','zh-tw']){
  const d=parseHTML(fs.readFileSync(path.join(R,lang,'heroes/undine/index.html'),'utf8')).document,rows=[...d.querySelectorAll('[data-hero-levels-40="gear"] tbody tr')];assert.equal(rows.length,15);
  for(const [i,row]of rows.entries())assert.deepEqual([...row.querySelectorAll('td')].map(c=>Number(c.textContent.replace(/[^\d]/g,''))),['attack','defense','hp','power','frontDefense','backAttack'].map(k=>G.levels[i][k]));
  assert.ok(d.querySelector('.ts-lootbar-slot--hero').nextElementSibling.contains(d.querySelector('[data-hero-levels-40="gear"]')));
 }
});
test('Verified art and one icon per skill control preserve text labels',()=>{
 const assets=require('../data/foundation-40/image-assets.json').assets,crypto=require('crypto');
 for(const h of D.heroes){
  for(const a of assets.filter(a=>a.entity===h.id))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(R,a.src))).digest('hex'),a.sha256);
  for(const lang of ['ko','en','ja','ru','zh-tw']){
   const d=parseHTML(fs.readFileSync(path.join(R,lang,'heroes',h.id,'index.html'),'utf8')).document,art=assets.find(a=>a.id==='hero:'+h.id),img=d.querySelector('.ts3-character-art img');
   for(const k of ['src','width','height'])assert.equal(img.getAttribute(k),String(art[k]));
   const panels=[...d.querySelectorAll('[data-character-skills] .ts-skill')];assert.equal(panels.length,h.id==='lagnar'?4:3);
   for(const [i,p]of panels.entries()){
    const button=d.querySelector('[data-skill-target="'+p.id+'"]');assert.equal(button.querySelectorAll('img').length,1);assert.equal(p.querySelector('summary').querySelectorAll('img').length,1);
    assert.equal(button.querySelector('img').src,'/img/game-40/skills/'+h.id+'-'+(i+1)+'.webp');
    assert.equal(button.querySelector('img').alt,'');assert.equal(button.textContent.trim(),p.querySelector('summary').textContent.trim());
   }
  }
 }
});
test('Owned extracted CSS is removed exactly without touching unrelated styles',()=>{
 const {removeExtractedStyle}=require('./lib/hero-assets-40'),crypto=require('crypto');
 const d=parseHTML('<html><head><style data-test>.owned{color:red}</style><link rel="stylesheet" href="/css/unrelated.css"></head></html>').document,style=d.querySelector('style'),hash=crypto.createHash('sha256').update(style.textContent).digest('hex').slice(0,16);
 for(let i=0;i<2;i++){const link=d.createElement('link');link.rel='stylesheet';link.href='/css/content/'+hash+'.css';d.head.append(link);}
 removeExtractedStyle(d,style);assert.equal(d.querySelectorAll('link').length,1);assert.equal(d.querySelector('link').href,'/css/unrelated.css');assert.equal(style.textContent,'.owned{color:red}');
 for(const h of D.heroes)for(const lang of ['ko','en','ja','ru','zh-tw']){
  const page=parseHTML(fs.readFileSync(path.join(R,lang,'heroes',h.id,'index.html'),'utf8')).document;
  for(const s of page.querySelectorAll('style[data-hero-levels-style],style[data-game-40-art-style]')){const own=crypto.createHash('sha256').update(s.textContent).digest('hex').slice(0,16);assert(!page.querySelector('link[href="/css/content/'+own+'.css"]'));}
 }
});
console.log(JSON.stringify({passed:true,checks:checks.length,heroes:2,languages:5,explicitValues:240,scope:'Static and Node/Linkedom event checks; browser layout is separate'}));
