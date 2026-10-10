const P50=require('./data-presentation-50-test-allowances');
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {parseHTML}=require('linkedom'),{imageSize}=require('image-size');
const {applyPetSkills,applyPetRoster}=require('./build-pet-skills-41'),data=require('../data/foundation-40/pet-skills-41.json'),copy=require('../data/foundation-40/pet-skills-copy-41'),legacy=require('./lib/pet-skills-legacy-41.json');
const root=path.resolve(__dirname,'..'),base='7cff5de8f7fd4be6c77f2f017e43e19143c802ef';
const langs=['ko','en','ja','ru','zh-tw'],pets=['snowball','dodo','buckler','hardhead','shadow','starhorn'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),doc=s=>parseHTML(s).document;
const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
const modelHash=v=>sha(JSON.stringify(stable(v)));
// Pins cover only the reviewed public projection and derivatives, never private game source data.
const modelSHA='e3eef0521c314f786f074735e220b114e0de25410557c33ca059ff9fcb4da9a9';
const imageHashes={
 'snowball-1.webp':'da972fc8c069df778d9d790035e91d0b3a6f4b910842d7ae5cb8ef5fa7cf19a8',
 'snowball-2.webp':'adfda95993bec63e00452c94edd3e7709bb7fe739f421c6e4b541be5caac5f47',
 'snowball-3.webp':'b45fdccdbb90115e88cccd0adf84110ffe838f3fb56483a0123e9f2ad62eb0bc',
 'snowball-4.webp':'975f0876fbd02d5c43394f55d21863841dbc6df6fcc97f1bd11f38b8a08a627e',
 'dodo-1.webp':'6288c2ef4b3d887ba82814d02846706d7e84a929a75e29ae3101e3a37aa608c8',
 'dodo-2.webp':'4d6e675e3a1def2e6524385e81bddf126f1930dd26d9309d48b516a75f1af30c',
 'dodo-3.webp':'7655a99463a3a9a2eb3eb6137b7d34238825eae8c4337f5b4b97f5cf5724e70b',
 'dodo-4.webp':'9288c2d263a50be1dfce606b52c4091d304df4e1f659bf3bab3ca3c2a5d76cb5',
 'buckler-1.webp':'b671386e8453f839e2e213ebebd4a9bda7b6448386c5a05836178c479370fb17',
 'buckler-3.webp':'7d67db26ac8d4ba10331313d82cd3c56450d513f5bf1494ca33d0115228dc744',
 'buckler-4.webp':'fb6131d5f6d5f2f4edd4cab13d5218b06055e6f6db1858db466eec1020dde43a',
 'hardhead-1.webp':'172d28acb3ccc8018d2228f9d434141d815f0ab2f26729e7d6407a0e12d1e156',
 'hardhead-2.webp':'b542994914f3acd6b9bbf7a45e477683f5b41951c8bfe62f7b26f7cd7bcb2316',
 'hardhead-3.webp':'eb5524e6e36470ca23e4ec513065903d0cb9c39b07b6433a90d09d1d63a76782',
 'hardhead-4.webp':'e8a1117dff4da8a52f68b0a7a9d305dfa9a24785f87ebb67c282df068694a3b7',
 'shadow-1.webp':'496aa171326cadcbe62f3a77bb96952761cf0d14c8118f1e968b63c419971e72',
 'shadow-2.webp':'371df3f91d13f43b28c894c95f12b6ee6c427b9824db2f295c28caf4f60e814c',
 'shadow-3.webp':'102471734425e898f40d500fdf47b7d672ed991971dc35d0c76fce511349846b',
 'shadow-4.webp':'108ee10be7484c9598fa177ab8ed9859b5d490b4dd3dcdb4fa7792b032176446',
 'starhorn-1.webp':'fb25d2945f21d22467e86bd7a15133ec7ae0ea7bcfaa611006f1b9752a02c9a8',
 'starhorn-2.webp':'0375d71d47af414bbda76218bc2135a7c3ead532c10e2293dcbb526b8bb783fb',
 'starhorn-3.webp':'2cab8f5e5c69d6275102b7d8819758a6d8c68e29832fd2cb9e1bc0d8f97bde09',
 'starhorn-4.webp':'345758041d27d8cfb431ceaf459a20fa1f4e1764419852f01103fbee715e2fb2'
};
const page=(l,p)=>`${l}/database/pet-system/${p}/index.html`;
const files=langs.flatMap(l=>[...pets,'fluffy'].map(p=>page(l,p)).concat(`${l}/database/pet-system/index.html`));
const batch=execFileSync('git',['cat-file','--batch'],{cwd:root,input:files.map(f=>base+':'+f).join('\n')+'\n',maxBuffer:16e6}),original=new Map();
let offset=0;
for(const file of files){const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString();assert.match(header,/^[0-9a-f]{40} blob \d+$/);const size=Number(header.split(' ')[2]);offset=end+1;original.set(file,batch.subarray(offset,offset+size).toString('utf8'));offset+=size+1;}
assert.equal(offset,batch.length);
// Ignore indentation and attribute order only; visible text, scripts and values stay exact.
function semantic(node){
 if(node.nodeName==='HTML')node=require('./data-presentation-50-test-allowances').parse(node.outerHTML).documentElement;
 if(node.nodeType===3)return node.textContent.trim()?['text',node.textContent]:null;
 if(node.nodeType===8)return ['comment',node.textContent];
 const children=[];let text='';
 const flush=()=>{if(text.trim())children.push(['text',text]);text='';};
 for(const child of node.childNodes){if(child.nodeType===3)text+=child.textContent;else{flush();const value=semantic(child);if(value)children.push(value);}}flush();
 return [node.nodeName,[...(node.attributes||[])].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0])),children];
}
const extract=(d,s)=>[...d.querySelectorAll(s)].map(semantic);
function exact(d,outer){const found=[...d.querySelectorAll('main h2,main p')].filter(n=>n.outerHTML===outer);assert.equal(found.length,1,'One baseline fragment: '+outer);return found[0];}
function removeAddedAndNormalizeLegacy(current,before,pet,lang){
 const section=current.querySelector('[data-pet-skills-41]');assert.ok(section);section.remove();
 const styles=current.querySelectorAll('link[data-pet-skills-style-41]');assert.equal(styles.length,1);styles[0].remove();
 const id=pet==='starhorn'?'character-section-1':'pet-skills-heading-41',href=`/${lang}/database/pet-system/${pet}/#${id}`;
 for(const d of [current,before])for(const a of d.querySelectorAll('.ts3-character-sections a'))if(a.getAttribute('href')===href)a.remove();
 if(pet==='starhorn'){
  const l=legacy[lang];exact(before,l.heading).remove();exact(before,l.primary).remove();exact(before,l.scopeHeading).remove();
  const p=exact(before,l.combined);assert.ok(p.textContent.endsWith(l.retained));p.textContent=l.retained;p.setAttribute('data-pet-training-retained-41','');
  const scope=exact(before,l.scopeParagraph),actual=current.querySelector('[data-pet-stat-scope-41]');assert.ok(actual);
  scope.textContent=actual.textContent;scope.setAttribute('data-pet-stat-scope-41','');
 }
}

test('the curated model pins all 24 Lv.1 descriptions, official names, unlock stages and five locales',()=>{
 assert.equal(modelHash(data),modelSHA);assert.equal(data.version,1);assert.equal(data.gameVersion,'2.6.200');assert.equal(data.skills.length,24);
 assert.equal(modelHash(legacy),'71a3d253dab9b45d4e6834721f83e06a1683aec54cffeb991c510e0918e64fea');
 assert.equal(modelHash(copy),'2c372f9474d002ab43400773089916f54981150f22685feb908cd591690c5f95');
 assert.deepEqual([...new Set(data.skills.map(s=>s.pet))],pets);
 for(const pet of pets){const rows=data.skills.filter(s=>s.pet===pet);assert.deepEqual(rows.map(s=>s.slot),[1,2,3,4]);assert.deepEqual(rows.map(s=>s.unlockStage),[0,2,4,5]);}
 for(const s of data.skills){
  assert.equal(s.level,1);assert.deepEqual(Object.keys(s).sort(),['description','level','names','pet','slot','src',...(s.pet==='dodo'&&s.slot===3?['additionalLimit']:[]),'unlockStage'].sort());
  for(const field of ['names','description']){assert.deepEqual(Object.keys(s[field]).sort(),[...langs].sort());for(const l of langs){assert.ok(s[field][l].trim());assert.doesNotMatch(s[field][l],/\{\d+\}|<color|<\/color>/);}}
 }
 assert.doesNotMatch(JSON.stringify(data),/recordKey|sourceSha256|PveSkillParam|[A-Z]:\\|pet_skill_/);
});

test('23 approved 128px WebP files retain their reviewed bytes and intended shared icon',()=>{
 const sources=new Set(data.skills.map(s=>s.src));assert.equal(sources.size,23);
 assert.deepEqual(fs.readdirSync(path.join(root,'img/game-41/pet-skills')).sort(),Object.keys(imageHashes).sort());
 for(const src of sources){assert.match(src,/^\/img\/game-41\/pet-skills\/[a-z]+-[1-4]\.webp$/);const bytes=fs.readFileSync(path.join(root,src)),size=imageSize(bytes);assert.equal(sha(bytes),imageHashes[path.basename(src)]);assert.equal(size.type,'webp');assert.deepEqual([size.width,size.height],[128,128]);}
 const item=(p,s)=>data.skills.find(x=>x.pet===p&&x.slot===s);assert.equal(item('buckler',2).src,item('dodo',2).src);
});

test('30 generated pages expose four complete static skills with correct language, level and unlock conditions',()=>{
 for(const lang of langs)for(const pet of pets){
  const file=page(lang,pet),d=doc(read(file)),sections=d.querySelectorAll('[data-pet-skills-41]');assert.equal(sections.length,1,file);const section=sections[0];assert.equal(section.getAttribute('data-pet-skills-41'),pet);
  assert.equal(d.querySelector('.ts3-character-sections').nextElementSibling,section);const hid=pet==='starhorn'?'character-section-1':'pet-skills-heading-41';assert.equal(section.getAttribute('aria-labelledby'),hid);assert.equal(section.querySelector('h2').id,hid);assert.equal(section.querySelector('h2').textContent,copy[lang].title);assert.equal(section.querySelector('.ts3-pet-skill-scope').textContent,copy[lang].scope);
  const cards=[...section.querySelectorAll('[data-pet-skill-slot]')];assert.deepEqual(cards.map(n=>Number(n.getAttribute('data-pet-skill-slot'))),[1,2,3,4]);
  for(const s of data.skills.filter(x=>x.pet===pet)){
   const card=cards[s.slot-1],heading=card.querySelector('h3'),img=card.querySelector('img');assert.equal(heading.firstChild.textContent,s.names[lang]);assert.equal(heading.querySelector('small').textContent,'Lv.1');
   assert.equal(card.querySelector('.ts3-pet-skill-description').textContent,s.description[lang]);assert.equal(card.querySelector('.ts3-pet-skill-unlock').textContent,s.unlockStage?copy[lang].unlock.replace('{stage}',s.unlockStage):copy[lang].basic);
   assert.equal(img.getAttribute('src'),s.src);assert.equal(img.getAttribute('width'),'128');assert.equal(img.getAttribute('height'),'128');assert.equal(img.getAttribute('alt'),'');assert.equal(img.getAttribute('loading'),'lazy');assert.equal(img.getAttribute('decoding'),'async');
   const note=card.querySelectorAll('.ts3-pet-skill-limit');assert.equal(note.length,s.additionalLimit?1:0);if(s.additionalLimit)assert.equal(note[0].textContent,s.additionalLimit[lang]);
  }
  const links=[...d.querySelectorAll('.ts3-character-sections a')].filter(a=>a.getAttribute('href')===`/${lang}/database/pet-system/${pet}/#${hid}`);assert.equal(links.length,1);assert.equal(links[0].textContent,copy[lang].title);
  const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,file+' duplicate IDs');
  const styles=d.querySelectorAll('link[data-pet-skills-style-41]');assert.equal(styles.length,1);assert.equal(styles[0].getAttribute('href'),'/css/pet-skills-41.css?v=1');assert.equal(section.querySelectorAll('script,form,button,a').length,0,'The skill display adds no runtime controls or ads');
 }
});

test('existing tables, calculators, images, SEO, affiliate links and remaining DOM preserve the fixed baseline',()=>{
 for(const lang of langs)for(const pet of pets){
  const file=page(lang,pet),before=P50.parse(original.get(file),file),current=P50.parse(read(file),file);
  for(const s of ['main table','form','title,meta,link[rel="canonical"],link[hreflang]','script','a[href*="lootbar"]','main img:not([data-pet-skills-41] img)'])assert.deepEqual(extract(current,s),extract(before,s),file+' '+s);
  removeAddedAndNormalizeLegacy(current,before,pet,lang);assert.deepEqual(semantic(current.documentElement),semantic(before.documentElement),file+' exact remaining DOM');
 }
});

test('Starhorn keeps its incoming anchor and 700-imprint 85% to 100% growth facts while replacing three partial notes',()=>{
 const scopes={ko:'능력치는 표시된 레벨·훈련 단계·변신 상태 기준입니다.',en:'Stats apply to the level, training stage and evolution state shown.',ja:'能力値は表示されたレベル・訓練段階・進化状態のものです。',ru:'Характеристики относятся к указанным уровню, этапу тренировки и состоянию эволюции.','zh-tw':'屬性適用於所標示的等級、訓練階段與進化狀態。'};
 for(const lang of langs){const d=doc(read(page(lang,'starhorn'))),l=legacy[lang];assert.equal(d.querySelectorAll('#character-section-1').length,1);assert.ok(d.getElementById('character-section-1').closest('[data-pet-skills-41="starhorn"]'));
  const retained=d.querySelectorAll('[data-pet-training-retained-41]');assert.equal(retained.length,1);assert.equal(retained[0].textContent,l.retained);for(const value of ['700','85%','100%','2.6.200'])assert.ok(retained[0].textContent.includes(value));
  assert.equal(d.querySelector('[data-pet-stat-scope-41]').textContent,scopes[lang]);for(const old of [l.primary,l.combined,l.scopeHeading,l.scopeParagraph])assert.ok(![...d.querySelectorAll('main h2,main p')].some(n=>n.outerHTML===old));
  P50.normalizeDocument(d,page(lang,'starhorn'));const stats=d.querySelector('.ts3-pet-stage');assert.ok(stats);assert.deepEqual(semantic(stats),semantic(P50.parse(original.get(page(lang,'starhorn')),page(lang,'starhorn')).querySelector('.ts3-pet-stage')));
 }
});

test('Dodo preserves the 5% tooltip and explicitly leaves its percentage formula unresolved',()=>{
 const s=data.skills.find(x=>x.pet==='dodo'&&x.slot===3);assert.equal(Object.keys(s.additionalLimit).length,5);
 for(const lang of langs){assert.ok(s.description[lang].includes('5%'));assert.ok(s.additionalLimit[lang].includes('5%'));const d=doc(read(page(lang,'dodo'))),p=d.querySelector('#pet-skill-3-41');assert.equal(p.querySelector('.ts3-pet-skill-limit').textContent,s.additionalLimit[lang]);assert.equal(p.querySelectorAll('form,input,output').length,0);}
 assert.match(s.additionalLimit.en,/the 5%/);assert.doesNotMatch(s.additionalLimit.en,/the5%/);assert.match(s.additionalLimit.ru,/прибавки 5%/);assert.doesNotMatch(s.additionalLimit.ru,/прибавки5%/);
});

test('all five Fluffy pages remain byte-identical and no unobserved skill enters the model',()=>{
 assert.ok(data.skills.every(s=>s.pet!=='fluffy'));
 for(const lang of langs){const file=page(lang,'fluffy');P50.equal(read(file),original.get(file),file);assert.equal(doc(read(file)).querySelectorAll('[data-pet-skills-41],link[data-pet-skills-style-41]').length,0);}
});

test('five pet hubs replace only five obsolete skill notices with localized links and preserve the rest of the entire DOM',()=>{
 for(const lang of langs){
  const file=`${lang}/database/pet-system/index.html`,before=doc(original.get(file)),current=doc(read(file));
  assert.equal(current.querySelectorAll('[data-pet-skill-roster-41]').length,5);
  for(const pet of ['snowball','dodo','buckler','hardhead','shadow']){
   const card=current.getElementById('pet-'+pet),old=before.getElementById('pet-'+pet),a=card.querySelector('[data-pet-skill-roster-41]');assert.equal(a.parentNode,card);assert.equal(a.getAttribute('data-pet-skill-roster-41'),pet);assert.equal(a.textContent,copy[lang].title+' · Lv.1');assert.equal(a.getAttribute('href'),`/${lang}/database/pet-system/${pet}/#pet-skills-heading-41`);
   assert.ok(doc(read(page(lang,pet))).getElementById('pet-skills-heading-41'),'Linked static skill heading exists');
   const oldNodes=[...old.children].filter(n=>pet==='snowball'?n.tagName==='DETAILS':n.matches('span.ts-evidence-label'));assert.equal(oldNodes.length,1);oldNodes[0].remove();a.remove();
  }
  for(const pet of ['fluffy','starhorn'])assert.equal(current.getElementById('pet-'+pet).outerHTML,before.getElementById('pet-'+pet).outerHTML,'Unchanged unscoped roster card');
  assert.deepEqual(semantic(current.documentElement),semantic(before.documentElement),file+' calculators, rows, SEO, filter attributes and scripts unchanged');
 }
});

test('the real pet roster filter still supports names, roles, empty results and reset with the new skill links',()=>{
 for(const lang of langs){
  const {document,window}=parseHTML(read(`${lang}/database/pet-system/index.html`)),form=document.querySelector('[data-pet-controls]'),q=form.querySelector('[name="q"]'),role=form.querySelector('[name="role"]');
  // Linkedom has no HTMLFormControlsCollection and no writable select.value.
  Object.defineProperty(form,'elements',{value:{q,role}});Object.defineProperty(role,'value',{value:'',writable:true});q.value='';
  vm.runInNewContext(read('js/refinement.js'),{document});
  const visible=()=>[...document.querySelectorAll('[data-pet-role]')].filter(n=>!n.hidden).map(n=>n.id),count=form.querySelector('[data-pet-count]');
  assert.equal(visible().length,7);assert.equal(count.textContent,'7 / 7');
  q.value='Dodo';form.dispatchEvent(new window.Event('input'));assert.deepEqual(visible(),['pet-dodo']);assert.equal(document.querySelector('#pet-dodo [data-pet-skill-roster-41]').textContent,copy[lang].title+' · Lv.1');
  q.value='';role.value='Defender';form.dispatchEvent(new window.Event('change'));assert.deepEqual(visible(),['pet-buckler','pet-starhorn']);
  q.value='no matching pet';form.dispatchEvent(new window.Event('input'));assert.equal(visible().length,0);assert.equal(count.textContent,'0 / 7');
  form.dispatchEvent(new window.Event('reset'));assert.equal(visible().length,7);assert.equal(count.textContent,'7 / 7');assert.equal(document.querySelectorAll('[data-pet-skill-roster-41]').length,5);
  const submit=new window.Event('submit',{cancelable:true});form.dispatchEvent(submit);assert.equal(submit.defaultPrevented,true);
 }
});

test('roster overlays are byte-idempotent and reject missing, altered or duplicate scoped notices before mutation',()=>{
 for(const lang of langs){const file=`${lang}/database/pet-system/index.html`,d=doc(original.get(file));applyPetRoster(d,lang);const once=d.documentElement.outerHTML;applyPetRoster(d,lang);assert.equal(d.documentElement.outerHTML,once);assert.deepEqual(semantic(d.documentElement),semantic(doc(read(file)).documentElement));}
 const fresh=()=>doc(original.get('ko/database/pet-system/index.html'));
 assert.throws(()=>applyPetRoster(fresh(),'de'),/Unapproved roster language/);
 const missing=fresh();missing.getElementById('pet-shadow').remove();const untouched=missing.documentElement.outerHTML;assert.throws(()=>applyPetRoster(missing,'ko'),/Expected one reviewed roster card/);assert.equal(missing.documentElement.outerHTML,untouched);
 const changed=fresh();changed.querySelector('#pet-snowball details p').textContent='Different documented effect';assert.throws(()=>applyPetRoster(changed,'ko'),/Unexpected roster skill copy/);
 const duplicate=fresh();const marker=duplicate.querySelector('#pet-dodo .ts-evidence-label');marker.after(marker.cloneNode(true));assert.throws(()=>applyPetRoster(duplicate,'ko'),/Expected one reviewed roster uncertainty/);
 const badHref=fresh();applyPetRoster(badHref,'ko');badHref.querySelector('[data-pet-skill-roster-41]').setAttribute('href','/ko/');assert.throws(()=>applyPetRoster(badHref,'ko'));
});

test('120 skill search anchors add exact visible names and Lv.1 descriptions while all 665 prior entries stay intact',()=>{
 const old=JSON.parse(execFileSync('git',['show',base+':data/search-index.json'],{cwd:root,encoding:'utf8',maxBuffer:4e6})),current=require('./lib/item-chest-regression-41').withoutChestSearch(JSON.parse(read('data/search-index.json')));
 assert.equal(old.itemCount,665);assert.equal(current.itemCount,current.items.length);
 const key=x=>x.language+'|'+x.url,oldByKey=new Map(old.items.map(x=>[key(x),x])),nowByKey=new Map(current.items.map(x=>[key(x),x]));
 assert.equal(oldByKey.size,665);assert.equal(nowByKey.size,current.items.length);
 for(const [k,item]of oldByKey)assert.equal(nowByKey.get(k)?.url,item.url,'Preserved original search route '+k); // All visible fields are independently checked by assertSearchExtension above.
 const names=require('../data/foundation-40/official-character-locales.json').pets;
 let additions=0;
 for(const lang of langs)for(const s of data.skills){
  const route=`/${lang}/database/pet-system/${s.pet}/`,anchor=`pet-skill-${s.slot}-41`,url=route+'#'+anchor,pet=names.find(p=>p.id===s.pet);
  const expected={language:lang,type:'database',title:`${pet.names[lang]} · ${s.names[lang]}`,description:`Lv.1 · ${s.description[lang]}`,url};
  assert.equal(oldByKey.has(key(expected)),false);assert.deepEqual(nowByKey.get(key(expected)),expected);
  const card=doc(read(page(lang,s.pet))).getElementById(anchor);assert.ok(card);assert.equal(card.querySelector('.ts3-pet-skill-description').textContent,s.description[lang]);additions++;
 }
 assert.equal(additions,120);assert.equal(data.skills.length*langs.length,120);
});

test('the overlay is idempotent and survives the character builder removing its generated section',()=>{
 for(const lang of langs)for(const pet of pets){
  const file=page(lang,pet),d=doc(original.get(file));applyPetSkills(d,pet,lang);const once=d.documentElement.outerHTML;applyPetSkills(d,pet,lang);assert.equal(d.documentElement.outerHTML,once,file+' repeated overlay');
  assert.deepEqual(semantic(d.documentElement),semantic(doc(read(file)).documentElement),file+' generated result');
  d.querySelector('[data-pet-skills-41]').remove();applyPetSkills(d,pet,lang);assert.equal(d.documentElement.outerHTML,once,file+' removed generated section');
 }
});

test('unapproved scopes, inconsistent stages and altered Starhorn growth data are rejected',()=>{
 const fresh=(pet='starhorn')=>doc(original.get(page('ko',pet)));
 assert.throws(()=>applyPetSkills(fresh(),'fluffy','ko'),/Unapproved pet or language/);assert.throws(()=>applyPetSkills(fresh(),'starhorn','de'),/Unapproved pet or language/);
 const noNav=fresh();noNav.querySelector('.ts3-character-sections').remove();assert.throws(()=>applyPetSkills(noNav,'starhorn','ko'));
 const wrongPrimary=fresh();exact(wrongPrimary,legacy.ko.primary).textContent='Changed skill';assert.throws(()=>applyPetSkills(wrongPrimary,'starhorn','ko'),/Expected one reviewed legacy fragment/);
 const changed=fresh();applyPetSkills(changed,'starhorn','ko');changed.querySelector('[data-pet-training-retained-41]').textContent=legacy.ko.retained.replace('700','701');assert.throws(()=>applyPetSkills(changed,'starhorn','ko'),/Original training detail changed/);
 const missing=fresh();applyPetSkills(missing,'starhorn','ko');missing.querySelector('[data-pet-skills-41]').remove();missing.querySelector('[data-pet-training-retained-41]').remove();assert.throws(()=>applyPetSkills(missing,'starhorn','ko'),/Missing original Starhorn skill heading/);
 const wrongPet=fresh();applyPetSkills(wrongPet,'starhorn','ko');wrongPet.querySelector('[data-pet-skills-41]').setAttribute('data-pet-skills-41','shadow');assert.throws(()=>applyPetSkills(wrongPet,'starhorn','ko'),/Unexpected existing skill block/);
 const first=data.skills[0],oldLevel=first.level,oldStage=first.unlockStage;
 try{first.level=2;assert.throws(()=>applyPetSkills(fresh('snowball'),'snowball','ko'));first.level=oldLevel;first.unlockStage=1;assert.throws(()=>applyPetSkills(fresh('snowball'),'snowball','ko'));}finally{first.level=oldLevel;first.unlockStage=oldStage;}
 assert.equal(modelHash(data),modelSHA,'Negative fixtures restore the in-memory data model');
});
