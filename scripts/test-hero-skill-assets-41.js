'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {parseHTML}=require('linkedom'),{imageSize}=require('image-size');
const B=require('./build-hero-skill-assets-41'),M=require('../data/foundation-40/hero-skill-assets-41.json'),N=require('../data/foundation-40/official-character-locales.json');
const root=path.resolve(__dirname,'..'),base='606ef9601dac5fe1d8af56b4d05ae2eb487ae513',langs=['ko','en','ja','ru','zh-tw'];
const ids='beka candy chef-ken eva freya ghost jacob kiki kiron laila light lucky maddy mike nikola ray rosie rusty sarge shark tara tarzan tony travis'.split(' ');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),doc=s=>parseHTML(s).document,lf=s=>s.replaceAll('\r\n','\n');
const files=execFileSync('git',['ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.html')||f==='js/characters-30.js'||f==='css/characters-30.css'||f==='data/search-index.json');
const batch=execFileSync('git',['cat-file','--batch'],{cwd:root,input:files.map(f=>base+':'+f).join('\n')+'\n',maxBuffer:100e6}),original=new Map();
let offset=0;
for(const file of files){const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString();assert.match(header,/^[0-9a-f]{40} blob \d+$/);const size=Number(header.split(' ')[2]);offset=end+1;original.set(file,batch.subarray(offset,offset+size).toString('utf8'));offset+=size+1;}
assert.equal(offset,batch.length);
const pairs=(d,a)=>[d.querySelector('#'+a.panelId+' summary img'),d.querySelector(`[data-skill-target="${a.panelId}"] img`)];
const attributes=n=>Object.fromEntries([...n.attributes].map(a=>[a.name,a.value]));

test('94 exact curated assets retain reviewed identities, bytes and square dimensions',()=>{
 assert.equal(sha(lf(read('data/foundation-40/hero-skill-assets-41.json'))),'c5a631b924d16ea8ca9670b427d1e5b6de889ba29ae9a117554e4d79d11ef233');
 assert.deepEqual(Object.keys(M).sort(),['assets','version']);assert.equal(M.version,1);assert.equal(M.assets.length,94);
 assert.deepEqual([...new Set(M.assets.map(a=>a.entity))],ids);assert.equal(B.pages.length,120);assert.equal(new Set(B.pages).size,120);
 assert.equal(new Set(M.assets.map(a=>a.src)).size,94);assert.equal(new Set(M.assets.map(a=>a.previousSrc)).size,94);
 assert.deepEqual(fs.readdirSync(path.join(root,'img/game-41/hero-skills')).sort(),M.assets.map(a=>path.basename(a.src)).sort());
 let bytes=0;
 for(const a of M.assets){
  const slot=Number(a.panelId.split('-').at(-1))+1;
  assert.deepEqual(Object.keys(a).sort(),['bytes','entity','height','id','kind','panelId','previousSrc','sha256','src','version','width']);
  assert.equal(a.id,`skill:${a.entity}-${slot}`);assert.equal(a.panelId,`character-skill-0-${slot-1}`);assert.equal(a.src,`/img/game-41/hero-skills/${a.entity}-${slot}.webp`);assert.equal(a.kind,'skill-icon');assert.equal(a.version,'2.6.200');
  const data=fs.readFileSync(path.join(root,a.src)),im=imageSize(data);assert.equal(sha(data),a.sha256);assert.equal(data.length,a.bytes);assert.equal(im.type,'webp');assert.deepEqual([im.width,im.height,a.width,a.height],[128,128,128,128]);bytes+=data.length;
  const prior=execFileSync('git',['show',base+':'+a.previousSrc.slice(1)],{cwd:root,maxBuffer:1e6});assert.deepEqual(fs.readFileSync(path.join(root,a.previousSrc)),prior,'Historical image remains byte-exact');
 }
 assert.equal(bytes,1741064);assert(!/tscfg:|InternalId|sourcePath|sourceRecord|C:\\|audit-results|serializedFile|pathIdDecimal/.test(JSON.stringify(M)));
});

test('120 complete page DOMs differ only in 940 approved image attribute sets',()=>{
 let count=0;
 for(const file of B.pages){
  const old=doc(original.get(file)),d=doc(read(file)),assets=B.assetsFor(file),lang=file.split('/')[0];
  assert.equal(d.querySelectorAll(`[${B.marker}]`).length,assets.length*2,file);
  for(const a of assets){
   const expected=N.heroes.find(h=>h.id===a.entity).skills[Number(a.panelId.split('-').at(-1))].name[lang];
   assert.equal(d.querySelector('#'+a.panelId+' summary > span').textContent.trim(),expected);
   const before=pairs(old,a),after=pairs(d,a);
   for(let i=0;i<2;i++){
    assert(before[i]&&after[i]);assert.equal(before[i].getAttribute('src'),a.previousSrc);
    const attrs={...attributes(before[i]),src:a.src,width:'128',height:'128',loading:'lazy',decoding:'async',[B.marker]:a.id};
    assert.deepEqual(attributes(after[i]),attrs,file+' '+a.id);
    // Restore only the precisely allowed image node and compare every remaining node.
    after[i].replaceWith(before[i].cloneNode(true));count++;
   }
  }
  assert.equal(d.documentElement.outerHTML,old.documentElement.outerHTML,file+' complete DOM, including values, SEO, URLs, forms, banner and detail state');
 }
 assert.equal(count,940);assert(B.pages.includes('en/heroes/tazan/index.html'));assert(!B.pages.includes('en/heroes/tarzan/index.html'));
});

test('all unrelated HTML, all fourteen retained skills, runtime styles and search remain byte-exact',()=>{
 let retained=0;
 for(const [file,baseline] of original){
  if(B.pages.includes(file))continue;
  assert.equal(lf(read(file)),lf(baseline),file);
  if(/^ko\/heroes\/(dave|lagnar|undine|knotty)\/index.html$/.test(file))retained+=doc(read(file)).querySelectorAll('[data-character-skills] .ts-skill').length;
 }
 assert.equal(retained,14);
});

test('the scoped builder is idempotent, accepts regenerated tabs and rejects mismatched targets atomically',()=>{
 for(const file of B.pages){
  const d=doc(original.get(file));B.applyHeroSkillImages(d,file);const once=d.documentElement.outerHTML;
  B.applyHeroSkillImages(d,file);assert.equal(d.documentElement.outerHTML,once);assert.equal(doc(read(file)).documentElement.outerHTML,once);
  // The early character builder copies the current source into fresh, unmarked tabs.
  for(const img of d.querySelectorAll('.ts3-skill-selector img')){img.removeAttribute(B.marker);img.removeAttribute('decoding');img.setAttribute('width','44');img.setAttribute('height','44');}
  B.applyHeroSkillImages(d,file);assert.equal(d.documentElement.outerHTML,once);
 }
 const file='ko/heroes/beka/index.html';
 const failures=[
  d=>d.querySelector('[data-character-skills]').remove(),
  d=>d.querySelector('.ts-skill').remove(),
  d=>d.querySelector('.ts-skill').id='missing-target',
  d=>d.querySelector('[data-skill-target]').setAttribute('data-skill-target','missing-target'),
  d=>d.querySelector('.ts-skill summary > span').textContent='wrong skill',
  d=>d.querySelector('[data-skill-target] > span').textContent='wrong skill',
  d=>d.querySelector('.ts-skill summary img').remove(),
  d=>{const i=d.querySelector('.ts-skill summary img');i.after(i.cloneNode(true));},
  d=>d.querySelector('.ts-skill summary img').setAttribute('src','/img/unreviewed.webp'),
  d=>d.querySelector('.ts-skill summary img').setAttribute(B.marker,'skill:foreign-1')
 ];
 for(const mutate of failures){const d=doc(original.get(file));mutate(d);const before=d.documentElement.outerHTML;assert.throws(()=>B.applyHeroSkillImages(d,file));assert.equal(d.documentElement.outerHTML,before,'Failed input must not partly mutate the page');}
 assert.throws(()=>B.applyHeroSkillImages(doc(original.get(file)),'en/heroes/tarzan/index.html'),/Unapproved/);
 assert.throws(()=>B.applyHeroSkillImages(doc(original.get(file)),'ko/heroes/knotty/index.html'),/Unapproved/);
});

test('the unchanged character client preserves image clicks, keyboard control and accessible tabs on all 120 pages',()=>{
 let clicks=0;
 for(const file of B.pages){
  const {document,window}=parseHTML(read(file)),buttons=[...document.querySelectorAll('[data-skill-target]')],panels=buttons.map(b=>document.getElementById(b.dataset.skillTarget));let focused=null;
  buttons.forEach(b=>b.focus=()=>{focused=b;});
  vm.runInNewContext(read('js/characters-30.js'),{document,window,location:{hash:''},URL,MutationObserver:window.MutationObserver});
  assert.equal(document.querySelector('.ts3-skill-selector').hidden,false);
  buttons.forEach((button,i)=>{
   button.querySelector('img').dispatchEvent(new window.Event('click',{bubbles:true}));clicks++;
   buttons.forEach((b,j)=>{assert.equal(b.getAttribute('role'),'tab');assert.equal(b.getAttribute('aria-selected'),String(i===j));assert.equal(b.getAttribute('aria-controls'),panels[j].id);assert.equal(panels[j].hidden,i!==j);assert.equal(panels[j].getAttribute('aria-labelledby'),b.id);assert.equal(b.querySelector('img').getAttribute('alt'),'');});
  });
  for(const [start,key,target] of [[buttons.length-1,'ArrowRight',0],[0,'ArrowLeft',buttons.length-1],[1,'Home',0],[0,'End',buttons.length-1]]){
   const e=new window.Event('keydown',{bubbles:true,cancelable:true});e.key=key;buttons[start].dispatchEvent(e);assert.equal(focused,buttons[target]);assert.equal(buttons[target].getAttribute('aria-selected'),'true');assert.equal(panels[target].hidden,false);assert.equal(e.defaultPrevented,true);
  }
 }
 assert.equal(clicks,470);
});

test('the one overlay runs after existing hero writers and before search without new client code',()=>{
 const p=JSON.parse(read('package.json')),steps=p.scripts.build.split(' && '),step='node scripts/build-hero-skill-assets-41.js';
 assert.equal(steps.filter(s=>s===step).length,1);
 for(const before of ['build-characters-30','build-official-locales-40','build-hero-portraits-41','build-knotty-skill-icons-41'])assert(steps.indexOf(step)>steps.indexOf(`node scripts/${before}.js`));
 assert(steps.indexOf(step)<steps.indexOf('node scripts/build-search-index.js'));assert(p.scripts['test:integration-41'].includes('node --test scripts/test-hero-skill-assets-41.js'));
});
