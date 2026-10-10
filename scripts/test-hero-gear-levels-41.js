'use strict';
const test=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),{execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/hero-gear-levels-41.json'),M=require('../js/sea-hero-growth-40'),N=require('../data/foundation-40/official-character-locales.json'),B=require('./build-hero-gear-levels-41');
const P50=require('./data-presentation-50-test-allowances');
const langs=['ko','en','ja','ru','zh-tw'],ids=['beka','candy','jacob','kiki','kiron','laila','light','maddy','mike','nikola','ray','rosie','shark','tara','tarzan','tony','undine'],base='ebe0cd9f738e1c4e497ad17934139618a40c43f6',sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const load=(l,id)=>parseHTML(fs.readFileSync(path.join(root,B.route(l,id)),'utf8')).document;
const text=s=>s.replace(/\s+/g,' ').trim();
function reviewedPortrait(d,id){
 const a=require('../data/foundation-40/hero-portrait-assets-41.json').assets.find(a=>a.entity===id);if(!a)return;
 const image=d.querySelector('.ts3-character-art img');assert(image);
 assert.equal(image.getAttribute('src'),id==='knotty'?'/img/heroes/knotty-game.webp':'/img/heroes/'+id+'.webp');
 for(const key of ['src','width','height'])image.setAttribute(key,String(a[key]));
 image.setAttribute('alt',d.querySelector('main h1').textContent.trim());image.setAttribute('data-game-41-portrait',id);
}
test('17 anchored primary-effect profiles pin 255 explicit level rows without unlock/cost fields',()=>{
 assert.equal(sha(JSON.stringify(D)),'c45eb15c9e7647879e9318473dcbd4cf00b8bdaa5bbd8ae1535dc540a5870028');assert.deepEqual(D.gears.map(g=>g.id),ids);assert.equal(D.effectScope,'primary-display-effect');assert.equal(D.gameVersion,'2.6.200');
 for(const g of D.gears){assert.deepEqual(Object.keys(g).sort(),['descriptionTemplate','id','levels']);assert.deepEqual(g.levels.map(r=>r.level),Array.from({length:15},(_,i)=>i+1));assert.deepEqual(Object.keys(g.descriptionTemplate).sort(),langs.slice().sort());for(const l of langs){assert(!/<|>/.test(g.descriptionTemplate[l]));for(const row of g.levels){assert.deepEqual(Object.keys(row).sort(),['args','level']);assert(row.args.every(x=>typeof x==='string'));assert(!/\{\d+\}/.test(M.format(g.descriptionTemplate[l],row.args)));}}}
 assert(!D.gears.some(g=>['knotty','dave','lagnar'].includes(g.id)));assert(!/C:\\|audit-results|tscfg:|sourceRecord|mainTemplateKey|GearSkill|InternalId|Unlock|Cost/.test(JSON.stringify(D)));
});
test('all 19,125 localized level pairs equal explicit formatter rows, including reversed/same comparisons',()=>{
 let checked=0;for(const g of D.gears)for(const l of langs)for(let a=1;a<=15;a++)for(let b=1;b<=15;b++){const expected={from:M.format(g.descriptionTemplate[l],g.levels[a-1].args),to:M.format(g.descriptionTemplate[l],g.levels[b-1].args)};assert.deepEqual(M.compareGear(g,l,a,b),expected);checked++;}assert.equal(checked,19125);
 for(const level of [0,16,-1,NaN,1.5])assert.throws(()=>M.compareGear(D.gears[0],'ko',level,15));assert.throws(()=>M.compareGear(D.gears[0],'missing',1,15));assert.throws(()=>M.format('{1}',['10%']));
});
test('85 existing pages retain every original skill, table, gear paragraph, image, SEO and one middle banner',()=>{
 for(const g of D.gears)for(const l of langs){const route=B.route(l,g.id),old=parseHTML(execFileSync('git',['show',base+':'+route],{cwd:root,encoding:'utf8',maxBuffer:4e6})).document,d=load(l,g.id),block=d.querySelector('[data-hero-gear-levels-41]');assert(block,route);
  const growth=d.querySelector('[data-growth-50]');
  if(growth){const growthBuilder=require('./build-growth-50'),hero=require('../data/product-50/growth-gear.json').heroes.find(h=>h.id===g.id);assert(hero);assert.equal(d.querySelectorAll('[data-growth-50]').length,1);const expected=parseHTML(growthBuilder.render(l,hero)).document.querySelector('[data-growth-50]');assert.equal(growth.outerHTML,expected.outerHTML,route+' exact reviewed growth50 addition');growth.remove();}
  reviewedPortrait(old,g.id);
  require('./foundation-40-test-allowances').reviewedHeroSkillImages(old,route);P50.normalizeDocument(old,route);P50.normalizeDocument(d,route);
  const extract=(doc,selector)=>[...doc.querySelectorAll(selector)].map(n=>text(n.outerHTML));
  for(const sel of ['title,meta[name=description],link[rel=canonical],link[hreflang]','.ts-skill-body','main img','.ts-lootbar-slot--hero'])assert.deepEqual(extract(d,sel),extract(old,sel),route+' '+sel);
  const section=doc=>g.id==='undine'?doc.querySelector('[data-hero-observations-40="equipment"]').closest('section'):doc.querySelector('.equipment-grid').closest('section');
  const clone=section(d).cloneNode(true);clone.querySelector('[data-hero-gear-levels-41]').remove();assert.equal(text(clone.innerHTML),text(section(old).innerHTML),route+' existing gear content');
  const oldTables=extract(old,'main table'),newTables=[...d.querySelectorAll('main table')].filter(n=>!n.closest('[data-hero-gear-levels-41]')).map(n=>text(n.outerHTML));assert.deepEqual(newTables,oldTables,route+' old tables');
  const banner=d.querySelector('.ts-lootbar-slot--hero'),oldBanner=old.querySelector('.ts-lootbar-slot--hero');assert.equal(d.querySelectorAll('.ts-lootbar-slot--hero').length,1);assert.equal(banner.previousElementSibling.tagName,oldBanner.previousElementSibling.tagName);assert.equal(text(banner.previousElementSibling.textContent),text(oldBanner.previousElementSibling.textContent));assert.equal(banner.nextElementSibling.querySelector('h2')?.textContent,oldBanner.nextElementSibling.querySelector('h2')?.textContent);
  assert.equal(d.querySelectorAll('[id]').length,new Set([...d.querySelectorAll('[id]')].map(n=>n.id)).size,route+' unique IDs');assert.equal(d.querySelectorAll('#sea-hero-growth-data').length,1);assert.equal(d.querySelectorAll('script[src^="/js/sea-hero-growth-40.js"]').length,1);assert.equal(d.querySelectorAll('link[href^="/css/sea-hero-growth-40.css"]').length,1);
 }
});
test('static 15-row tables, two selectors and payload match each exact species/localized profile',()=>{
 for(const g of D.gears)for(const l of langs){const d=load(l,g.id),block=d.querySelector('[data-hero-gear-levels-41]'),rows=[...block.querySelectorAll('[data-hero-gear-all-41] tbody tr')];assert.equal(rows.length,15);assert.deepEqual(rows.map(r=>[...r.children].map(x=>x.textContent)),g.levels.map(r=>[String(r.level),M.format(g.descriptionTemplate[l],r.args)]));
  const controls=block.querySelector('[data-sea-growth-controls="gear"]');assert(controls.hasAttribute('hidden'));for(const name of ['from','to'])assert.deepEqual([...controls.querySelectorAll(`[name="${name}"] option`)].map(o=>Number(o.value)),g.levels.map(r=>r.level));
  assert(block.textContent.includes(B.copy[l].condition));assert(block.textContent.includes(N.heroes.find(n=>n.id===g.id).gear.skillName[l]));const cfg=JSON.parse(d.getElementById('sea-hero-growth-data').textContent);assert.deepEqual(cfg.gear,g);assert.equal(cfg.language,l);assert.deepEqual(cfg.skills,[]);
 }
});
test('actual unchanged client makes every page comparison interactive with correct accessibility feedback',()=>{
 for(const g of D.gears)for(const l of langs){const {document:d,window}=parseHTML(fs.readFileSync(path.join(root,B.route(l,g.id)),'utf8')),form=d.querySelector('[data-sea-growth-controls]'),handlers={};let from='2',to='14';Object.defineProperty(form.querySelector('[name=from]'),'value',{get:()=>from});Object.defineProperty(form.querySelector('[name=to]'),'value',{get:()=>to});form.addEventListener=(type,fn)=>handlers[type]=fn;
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/sea-hero-growth-40.js'),'utf8'),{window,globalThis:window});assert(!form.hidden);handlers.change();const table=d.getElementById('sea-gear-live-table'),cells=table.querySelectorAll('tbody td'),value=M.compareGear(g,l,2,14);assert.deepEqual([...cells].map(n=>n.textContent),[value.from,value.to]);assert.equal(table.querySelectorAll('thead th')[1].textContent,'Lv.2');assert.equal(table.querySelectorAll('thead th')[2].textContent,'Lv.14');assert(form.querySelector('[role=status]').textContent.includes('14'));from='0';handlers.change();assert.equal(form.querySelector('[role=status]').textContent,JSON.parse(d.getElementById('sea-hero-growth-data').textContent).copy.invalid);assert.deepEqual([...cells].map(n=>n.textContent),[value.from,value.to]);let stopped=false;handlers.submit({preventDefault(){stopped=true}});assert(stopped);
 }
});
test('source/style and other hero content retain the baseline apart from reviewed Knotty image overlays',()=>{
 for(const f of ['js/sea-hero-growth-40.js','css/sea-hero-growth-40.css','data/foundation-40/sea-hero-growth.json',...langs.flatMap(l=>['knotty','dave','lagnar'].map(id=>l+'/heroes/'+id+'/index.html'))]){
  let expected=execFileSync('git',['show',base+':'+f],{cwd:root,encoding:'utf8',maxBuffer:4e6}).replaceAll('\r\n','\n');
  if(f.includes('/heroes/knotty/')){
   const old=parseHTML(expected).document,d=parseHTML(fs.readFileSync(path.join(root,f),'utf8')).document;reviewedPortrait(old,'knotty');
   const icons=[...d.querySelectorAll('[data-game-41-skill-icon]')],fallbacks=[...old.querySelectorAll('[data-skill-target] .ts3-skill-number')];
   assert.equal(icons.length,6);assert.equal(fallbacks.length,3);
   for(let i=0;i<3;i++){
    const id=`character-skill-0-${i}`,label=old.querySelector('#'+id+' summary').textContent.trim();
    const iconPair=icons.filter(n=>n.getAttribute('data-game-41-skill-icon')===`skill:knotty-${i+1}`);assert.equal(iconPair.length,2);
    for(const img of iconPair){assert.equal(img.getAttribute('src'),`/img/game-41/skills/knotty-${i+1}.webp`);assert(img.parentElement.matches(`[data-skill-target="${id}"],#${id} summary`));img.remove();}
    const fallback=old.querySelector(`[data-skill-target="${id}"] .ts3-skill-number`);assert.equal(fallback.getAttribute('aria-hidden'),'true');assert.equal(fallback.textContent.trim(),label);fallback.remove();
   }
   assert.equal(P50.html(d.documentElement.outerHTML,f),P50.html(old.documentElement.outerHTML,f),f);continue;
  }
  P50.equal(fs.readFileSync(path.join(root,f),'utf8'),expected,f);
 }
});
