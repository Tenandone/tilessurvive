const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/sea-hero-growth.json'),C=require('../data/foundation-40/sea-hero-growth-copy'),N=require('../data/foundation-40/official-character-locales.json'),M=require('../js/sea-hero-growth-40');
const langs=['ko','en','ja','ru','zh-tw'],read=p=>fs.readFileSync(path.join(root,p),'utf8');let groups=0;
const check=fn=>{fn();groups++;};
check(()=>{
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(D)).digest('hex'),'08df39434fd3f58e852b5ee2b020f475a2b53ba4a50a74197c77400a26bb18c1');
 assert.deepEqual([D.dave.observedCap,D.dave.maxConfiguredLevel],[20,40]);assert.deepEqual(D.dave.skills.map(s=>s.id),['auto','combat','passive']);
 for(const s of D.dave.skills){assert.equal(s.values.length,40);assert(s.values.every((r,i)=>r.level===i+1&&/^\d+\.\d{2}$/.test(r.value)));}
 assert.deepEqual(D.gears.map(g=>g.id),['lagnar','dave']);for(const g of D.gears){assert.deepEqual(g.levels.map(r=>r.level),Array.from({length:15},(_,i)=>i+1));assert.deepEqual(g.unlocks.map(r=>r.level),[10,15]);}
 assert(!/originals|normalized-complete|tscfg:|recordId|pve_effect|pve_buff|C:\\|ItemNeed/.test(JSON.stringify(D)));
});
check(()=>{
 assert.deepEqual(M.compareSkills(D.dave.skills,10,11).map(s=>[s.from,s.to]),[['109.00','110.00'],['1471.50','1485.00'],['2.18','2.20']]);
 assert.deepEqual(M.compareSkills(D.dave.skills,1,40).map(s=>[s.from,s.to]),[['100.00','139.00'],['1350.00','1876.50'],['2.00','2.78']]);
 assert.deepEqual(M.compareSkills(D.dave.skills,40,1).map(s=>[s.from,s.to]),[['139.00','100.00'],['1876.50','1350.00'],['2.78','2.00']]);
 for(const bad of [0,41,-1,NaN,Infinity,1.5,'10',null])assert.throws(()=>M.compareSkills(D.dave.skills,bad,11));
 assert.throws(()=>M.compareSkills([{id:'x',values:[]}],1,2));
});
check(()=>{
 for(const g of D.gears)for(const lang of langs){const v=M.compareGear(g,lang,1,15);assert(v.from&&!/\{\d+\}|<color/.test(v.from+v.to));assert.equal(v.from,M.format(g.descriptionTemplate[lang],g.levels[0].args));assert.equal(v.to,M.format(g.descriptionTemplate[lang],g.levels[14].args));for(const u of g.unlocks)assert(!/\{\d+\}/.test(M.format(u.descriptionTemplate[lang],u.args)));}
 assert(M.compareGear(D.gears[0],'ko',1,15).from.includes('6%'));assert(M.compareGear(D.gears[0],'ko',1,15).to.includes('18%'));
 assert(M.compareGear(D.gears[1],'ko',1,15).from.includes('20%'));assert(M.compareGear(D.gears[1],'ko',1,15).to.includes('60%'));
 assert.throws(()=>M.compareGear(D.gears[0],'missing',1,15));assert.throws(()=>M.compareGear(D.gears[0],'ko',1,16));assert.throws(()=>M.format('{1}',['one']));
});
for(const id of ['lagnar','dave'])for(const lang of langs)check(()=>{
 const d=parseHTML(read(`${lang}/heroes/${id}/index.html`)).document,gear=D.gears.find(g=>g.id===id),names=N.heroes.find(h=>h.id===id),t=C[lang];
 assert.equal(d.querySelectorAll('#sea-exclusive-gear-levels').length,1);assert.equal(d.querySelectorAll('#sea-hero-growth-data').length,1);assert.equal(d.querySelectorAll('script[src^="/js/sea-hero-growth-40.js"]').length,1);assert.equal(d.querySelectorAll('link[href^="/css/sea-hero-growth-40.css"]').length,1);
 const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);
 assert.equal(d.querySelector('link[rel=canonical]').href,`https://tilessurvive.net/${lang}/heroes/${id}/`);assert.equal(d.querySelectorAll('h1').length,1);
 const banner=d.querySelector('.ts-lootbar-slot--hero');assert.equal(d.querySelectorAll('.ts-lootbar-slot--hero').length,1);assert(banner.previousElementSibling.querySelector('[data-character-skills]'));assert(banner.nextElementSibling.querySelector('#sea-exclusive-gear-levels'));assert.equal(d.querySelectorAll('.ts-skill-body').length,4);
 const gearRows=[...d.querySelectorAll('[data-sea-growth="gear"] details tbody tr')];assert.equal(gearRows.length,15);for(const [i,row]of gearRows.entries())assert.deepEqual([...row.children].map(n=>n.textContent),[String(i+1),M.format(gear.descriptionTemplate[lang],gear.levels[i].args)]);
 assert.deepEqual([...d.querySelectorAll('[data-sea-growth="gear"] li strong')].map(n=>n.textContent),['Lv.10','Lv.15']);assert(d.querySelector('[data-sea-growth="gear"]').textContent.includes(t.gearCondition));
 if(id==='dave'){
  const rows=[...d.querySelectorAll('[data-sea-growth="skills"] details tbody tr')];assert.equal(rows.length,40);for(const [i,row]of rows.entries())assert.deepEqual([...row.querySelectorAll('td')].map(n=>n.textContent.replace(',','.')),D.dave.skills.map(s=>s.values[i].value+(s.unit==='percent-atk'?'% ATK':'%')));
  assert(d.querySelector('[data-sea-growth="skills"]').textContent.includes(t.skillCondition));assert.equal(d.querySelectorAll('[data-sea-gear-note]').length,1);assert.equal(d.querySelector('[data-sea-gear-note]').textContent,t.gearNote.replace('{name}',names.gear.name[lang]));
  const oldRows=[...d.querySelectorAll('[data-dave-skill]')].map(r=>[...r.querySelectorAll('td')].map(n=>n.textContent.replace(',','.')));assert.deepEqual(oldRows,[['109.0%','110.0%'],['1471.50% ATK','1485.0% ATK'],['2.18%','2.20%']]);
 }
 const initialBodies=[...d.querySelectorAll('.ts-skill-body')].map(n=>n.textContent),window=d.defaultView;
 // Linkedom lacks a writable select.value; provide the browser behavior used by this client.
 for(const select of d.querySelectorAll('[data-sea-growth-controls] select')){let selected=select.querySelector('option[selected]').getAttribute('value');Object.defineProperty(select,'value',{get:()=>selected,set:value=>{selected=String(value);}});}
 vm.runInNewContext(read('js/sea-hero-growth-40.js'),{window,document:d});
 for(const form of d.querySelectorAll('[data-sea-growth-controls]')){assert.equal(form.hidden,false);const max=form.getAttribute('data-sea-growth-controls')==='skills'?40:15;assert.equal(form.querySelectorAll('option').length,max*2);form.querySelector('[name=from]').value=max;form.querySelector('[name=to]').value=1;form.dispatchEvent(new window.Event('change'));assert(form.querySelector('[role=status]').textContent.includes(String(max)));const table=d.getElementById(max===40?'dave-live-level-table':'sea-gear-live-table');assert.equal(table.querySelectorAll('thead th')[1].textContent,'Lv.'+max);if(max===40)assert.equal(table.querySelector('[data-dave-skill="combat"] td').textContent,lang==='ru'?'1876,50% ATK':'1876.50% ATK');else assert.equal(table.querySelector('tbody td').textContent,M.compareGear(gear,lang,15,1).from);
  const before=table.textContent;form.querySelector('[name=from]').value=999;form.dispatchEvent(new window.Event('change'));assert.equal(form.querySelector('[role=status]').textContent,t.invalid);assert.equal(table.textContent,before);
 }
 assert.deepEqual([...d.querySelectorAll('.ts-skill-body')].map(n=>n.textContent),initialBodies);
});
console.log(JSON.stringify({passed:true,groups,pages:10,explicitDaveValues:120,gearLevelRecords:30,unlockEffects:4,scope:'Source integrity, exact static rows, invalid inputs, browser-like change events and existing content/affiliate placement; visual layout is separate'}));
