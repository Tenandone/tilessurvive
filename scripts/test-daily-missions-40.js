const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),{parseHTML}=require('linkedom');
/* Reproducible static and DOM regression. No private captures or ledgers required. */
const R=path.resolve(__dirname,'..');
const D=require(path.join(R,'data/foundation-40/daily-missions.json')),M=require(path.join(R,'js/daily-missions-40.js'));
const {refreshHubEntry}=require('./build-daily-missions-40');
const copy=require('../data/foundation-40/daily-missions-copy');
const checks=[];function test(name,fn){fn();checks.push(name);}
test('18 observed missions, seven exact milestones and complete translations',()=>{assert.equal(D.missions.length,18);assert.deepEqual(D.milestones,[25,60,100,140,180,235,290]);assert.equal(new Set(D.missions.map(m=>m.id)).size,18);for(const m of D.missions){assert.ok(m.target>0&&m.points>0);assert.deepEqual(Object.keys(m.names),['ko','en','ja','ru','zh-tw']);}});
test('Empty, partial, all-target, duplicate-ID, over-target and invalid-input calculations',()=>{assert.deepEqual(M.plan(D.missions,[],25),{selected:0,planned:0,remaining:25});assert.deepEqual(M.plan(D.missions,['login','building','research'],60),{selected:3,planned:70,remaining:0});assert.deepEqual(M.plan(D.missions,['login','login'],25),{selected:1,planned:10,remaining:15});assert.equal(M.plan(D.missions,D.missions.map(m=>m.id),290).planned,310);assert.equal(M.plan(D.missions,D.missions.filter(m=>!m.paid).map(m=>m.id),290).remaining,30);assert.throws(()=>M.plan(D.missions,['unknown'],25));for(const target of [-1,0,1.5,NaN,Infinity,'25'])assert.throws(()=>M.plan(D.missions,[],target));assert.throws(()=>M.plan([D.missions[0],D.missions[0]],[],25));for(const points of [-1,0,1.5,NaN])assert.throws(()=>M.plan([{id:'invalid',points}],[],25));});
for(const lang of ['ko','en','ja','ru','zh-tw'])test(lang+' static metadata, links, accessible table and client events',()=>{
 const file=path.join(R,lang,'events/daily-missions/index.html'),html=fs.readFileSync(file,'utf8'),{document,Event}=parseHTML(html),url='https://tilessurvive.net/'+lang+'/events/daily-missions/';
 assert.equal(document.querySelectorAll('h1').length,1);assert.equal(document.querySelector('link[rel="canonical"]').href,url);
 assert.equal(document.querySelectorAll('[data-daily-mission]').length,18);assert.equal(document.querySelectorAll('.ts40-daily-milestones li').length,7);assert.equal(document.querySelectorAll('link[hreflang]').length,6);
 for(const alt of document.querySelectorAll('link[hreflang]'))assert.equal(alt.href,'https://tilessurvive.net/'+(alt.hreflang==='x-default'?'en':alt.hreflang)+'/events/daily-missions/');
 const languageLinks=[...document.querySelectorAll('.ts3-language a[hreflang]')];assert.equal(languageLinks.length,5);for(const a of languageLinks)assert.equal(a.href,'/'+a.getAttribute('hreflang')+'/events/daily-missions/');
 assert.equal(document.querySelector('.ts-skip').href,'/'+lang+'/events/daily-missions/#main');
 assert.ok(document.querySelector('header nav a[aria-current="page"][href="/'+lang+'/events/"]'));
 for(const node of document.querySelectorAll('main [id]'))assert.equal(document.querySelectorAll('[id="'+node.id+'"]').length,1,'No duplicate ID '+node.id);
 for(const row of D.missions){const el=document.querySelector('[data-daily-mission="'+row.id+'"]');assert.ok(el.textContent.includes(row.names[lang]));assert.equal(Number(el.querySelector('td').textContent),row.points);}
 assert.equal(document.querySelectorAll('main a[href*="lootbar"]').length,0);assert.equal(document.querySelectorAll('.ts40-daily-paid').length,1);
 assert.equal(document.querySelectorAll('#foundation-data, script[src^="/js/foundation-40.js"], script[src^="/js/foundation-40-math.js"]').length,0);assert.ok(document.querySelector('link[href^="/css/foundation-40.css"]'));
 const form=document.querySelector('[data-daily-plan]'),target=form.querySelector('select[name="target"]'),inputs=[...form.querySelectorAll('input[name="mission"]')];
 assert.ok(inputs.every(i=>i.disabled&&i.hidden&&!i.hasAttribute('checked')));
 // Linkedom lacks a writable select.value; supply only that standard browser property for event tests.
 Object.defineProperty(target,'value',{value:'25',writable:true});
 const context=vm.createContext({window:{document},Intl,Set,Number,Error});vm.runInContext(fs.readFileSync(path.join(R,'js/daily-missions-40.js'),'utf8'),context);
 assert.ok(inputs.every(i=>!i.disabled&&!i.hidden&&!i.checked));assert.ok([...form.querySelectorAll('[data-daily-enhancement]')].every(n=>!n.hidden));
 const values=()=>[...form.querySelectorAll('[data-daily-result] strong')].map(n=>Number(n.textContent.replace(/\D/g,'')));
 assert.deepEqual(values(),[0,0,25]);inputs[0].checked=true;form.dispatchEvent(new Event('change'));assert.deepEqual(values(),[1,10,15]);
 target.value='60';inputs.find(i=>i.value==='building').checked=true;inputs.find(i=>i.value==='research').checked=true;form.dispatchEvent(new Event('change'));assert.deepEqual(values(),[3,70,0]);
 form.querySelector('[data-daily-clear]').dispatchEvent(new Event('click'));assert.deepEqual(values(),[0,0,60]);assert.ok(inputs.every(i=>!i.checked));
 target.value='999';form.dispatchEvent(new Event('change'));assert.ok(form.querySelector('[data-daily-result]').classList.contains('is-error'));
 for(const hub of ['events','tools']){const h=parseHTML(fs.readFileSync(path.join(R,lang,hub,'index.html'),'utf8')).document;assert.equal(h.querySelectorAll('[data-daily-missions-entry]').length,1);assert.equal(h.querySelector('[data-daily-missions-entry] a').href,'/'+lang+'/events/daily-missions/');assert.ok(h.querySelector('[data-foundation-entry] a[href="/'+lang+'/events/arms-race/"]'));const ids=[...h.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,'No duplicate IDs in '+lang+'/'+hub);if(hub==='events'){assert.equal(h.querySelector('#database-links-22 > h2').id,'database-links-22-heading');for(const a of h.querySelectorAll('.ts3-contents a[href]')){const target=new URL(a.href,'https://tilessurvive.net/'+lang+'/events/');if(target.hash)assert.equal(h.getElementById(target.hash.slice(1))?.textContent.trim(),a.textContent.trim(),'TOC points at its intended heading');}}}
 assert.equal(fs.readFileSync(path.join(R,'sitemap.xml'),'utf8').split('<loc>'+url+'</loc>').length-1,1);
});
test('Source files exclude account actions, storage, rewards and reset claims',()=>{const js=fs.readFileSync(path.join(R,'js/daily-missions-40.js'),'utf8');assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon/.test(js));const source=JSON.stringify(D);assert.ok(!/RewardResource|ResourceReward|accountId|owned|currentProgress|UTC/.test(source));});
test('Fixed observed target/point pairs and repeat-build hub anchor preservation',()=>{
 // Independent transcription fixture from UI 059–067. Account progress and reward amounts omitted.
 const expected=[['login',1,10],['exploration-chest',1,10],['vip-free-package',1,10],['intel',3,10],['heal',10,10],['building',1,30],['research',1,30],['alliance-donation',15,10],['hero-recruit',1,10],['troop-training',50,20],['speedup-use',1,10],['timer-help',5,10],['infected-boss',1,10],['arena-challenge',1,10],['payment',1,50],['dispatch-raid',1,20],['transport-raid',1,20],['speedup-minutes',120,30]];
 assert.deepEqual(D.missions.map(m=>[m.id,m.target,m.points]),expected);assert.deepEqual(D.missions.filter(m=>m.paid).map(m=>m.id),['payment']);
 for(const lang of ['ko','en','ja','ru','zh-tw'])for(const hub of ['events','tools']){
   const title=copy[lang].title;
   const {document}=parseHTML('<html><body><main><nav class="ts3-contents"><a href="#existing-daily-heading">'+title+'</a></nav><section data-foundation-entry><a href="/'+lang+'/events/arms-race/">Existing explorer</a></section><nav id="existing-daily-entry" data-daily-missions-entry><h2 id="existing-daily-heading">'+title+'</h2><a href="old">Old entry</a></nav></main></body></html>');
   refreshHubEntry(document,lang,hub);
   assert.equal(document.querySelectorAll('[data-daily-missions-entry]').length,1);assert.equal(document.querySelector('[data-daily-missions-entry]').id,'existing-daily-entry');assert.equal(document.getElementById('existing-daily-heading').textContent,title);assert.ok(document.querySelector('[data-foundation-entry] a[href="/'+lang+'/events/arms-race/"]'));
   const first=document.documentElement.outerHTML;refreshHubEntry(document,lang,hub);assert.equal(document.documentElement.outerHTML,first);
   const orphan=parseHTML('<html><body><main><nav class="ts3-contents"><a href="#old-daily-id">'+title+'</a></nav></main></body></html>').document;
   refreshHubEntry(orphan,lang,hub);assert.equal(orphan.getElementById('old-daily-id').getAttribute('data-daily-missions-entry'),'');
 }
});
const result={passed:true,checks,checkCount:checks.length,missions:18,milestones:7,languages:5,clientScope:'Node + Linkedom event tests; actual browser layout remains root QA',dataSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(R,'data/foundation-40/daily-missions.json'))).digest('hex')};
console.log(JSON.stringify(result));
