'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {parseHTML}=require('linkedom'),{imageSize}=require('image-size'),{applyKnottySkillIcons}=require('./build-knotty-skill-icons-41');
const root=path.resolve(__dirname,'..'),M=require('../data/foundation-40/knotty-skill-assets-41.json');
const base='cc0dba810972202b58d4020b813a174abe0d14ae',langs=['ko','en','ja','ru','zh-tw'],marker='data-game-41-skill-icon';
const expectedHashes=['95044ad82cc4b7068897985cf2faedcceb954a78d8dee400dd35d1ca928c5fe0','415ebfb64e227215d83fbb0f2f3f51b5cee36db7c299c678b76501690a7318a7','32c82ed77817f461e27351aed50b16b786eb6624b84c8b76e1abf90582dfd146'];
const labels={ko:['장난스러운 폭탄','축제의 시간','타고난 활력'],en:['Naughty Bomb','Party Time','Born Wild'],ja:['イタズラ爆弾','パーチータイム','やんちゃな本能'],ru:['Озорная бомба','Кутеж','Дикая натура'],'zh-tw':['淘氣爆彈','狂歡時刻','好動天性']};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),doc=s=>parseHTML(s).document;
const files=execFileSync('git',['ls-tree','-r','--name-only',base,'--',...langs.map(l=>l+'/heroes')],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('/index.html'));
const batch=execFileSync('git',['cat-file','--batch'],{cwd:root,input:files.map(f=>base+':'+f).join('\n')+'\n',maxBuffer:32e6}),original=new Map();
let offset=0;
for(const file of files){const end=batch.indexOf(10,offset),header=batch.subarray(offset,end).toString();assert.match(header,/^[0-9a-f]{40} blob \d+$/);const size=Number(header.split(' ')[2]);offset=end+1;original.set(file,batch.subarray(offset,offset+size).toString('utf8'));offset+=size+1;}
assert.equal(offset,batch.length);
const page=l=>`${l}/heroes/knotty/index.html`;

test('three exact lossless WebP derivatives and a minimal curated manifest',()=>{
 assert.deepEqual(Object.keys(M).sort(),['assets','version']);assert.equal(M.version,1);assert.equal(M.assets.length,3);
 assert.deepEqual(fs.readdirSync(path.join(root,'img/game-41/skills')).sort(),['knotty-1.webp','knotty-2.webp','knotty-3.webp']);
 M.assets.forEach((a,i)=>{
  assert.deepEqual(Object.keys(a).sort(),['bytes','entity','height','id','kind','panelId','sha256','src','version','width']);
  assert.equal(a.id,`skill:knotty-${i+1}`);assert.equal(a.entity,'knotty');assert.equal(a.kind,'skill-icon');assert.equal(a.version,'2.6.200');
  assert.equal(a.panelId,`character-skill-0-${i}`);assert.equal(a.src,`/img/game-41/skills/knotty-${i+1}.webp`);
  const bytes=fs.readFileSync(path.join(root,a.src)),im=imageSize(bytes);assert.equal(sha(bytes),expectedHashes[i]);assert.equal(a.sha256,expectedHashes[i]);assert.equal(a.bytes,bytes.length);
  assert.equal(im.type,'webp');assert.deepEqual([im.width,im.height,a.width,a.height],[128,128,128,128]);
 });
});

test('all five pages preserve the entire baseline DOM except three decorative labels and six images',()=>{
 for(const lang of langs){
  const file=page(lang),old=doc(original.get(file)),d=doc(read(file));
  assert.equal(d.querySelectorAll(`[${marker}]`).length,6);assert.equal(d.querySelectorAll('.ts3-skill-number').length,0);
  M.assets.forEach((a,i)=>{
   const button=d.querySelector(`[data-skill-target="${a.panelId}"]`),summary=d.querySelector('#'+a.panelId+' summary');
   assert.equal(button.textContent.trim(),labels[lang][i]);assert.equal(summary.textContent.trim(),labels[lang][i]);
   for(const parent of [button,summary]){
    const imgs=parent.querySelectorAll('img');assert.equal(imgs.length,1);const img=imgs[0];
    assert.equal(img.getAttribute(marker),a.id);assert.equal(img.getAttribute('src'),a.src);assert.equal(img.getAttribute('width'),'128');assert.equal(img.getAttribute('height'),'128');assert.equal(img.getAttribute('alt'),'');assert.equal(img.getAttribute('aria-hidden'),'true');assert.equal(img.getAttribute('loading'),'lazy');assert.equal(img.getAttribute('decoding'),'async');
    img.remove();
   }
   const fallback=old.querySelector(`[data-skill-target="${a.panelId}"] .ts3-skill-number`);
   assert.equal(fallback.getAttribute('aria-hidden'),'true');assert.equal(fallback.textContent.trim(),labels[lang][i]);fallback.remove();
  });
  // Includes every skill value, original details state, condition, banner, SEO node and URL.
  assert.equal(d.documentElement.outerHTML,old.documentElement.outerHTML,file);
 }
});

test('other 105 skill panels preserve their markup with only the exact 94 reviewed icon replacements',()=>{
 const icons=new Set();let panels=0;
 for(const file of files.filter(f=>!f.includes('/knotty/'))){
  const old=doc(original.get(file)),d=doc(read(file));
  require('./foundation-40-test-allowances').reviewedHeroSkillImages(old,file);
  assert.equal(d.querySelectorAll(`[${marker}]`).length,0,file);
  const extract=p=>[...p.querySelectorAll('[data-character-skills] img')].map(i=>i.outerHTML);
  assert.deepEqual(extract(d),extract(old),file);
  if(file.startsWith('ko/'))for(const panel of d.querySelectorAll('[data-character-skills] .ts-skill')){panels++;const img=panel.querySelector('summary img');assert.ok(img,file);icons.add(img.getAttribute('src'));}
 }
 assert.equal(panels,105);assert.equal(icons.size,105);
});

test('the builder is byte-idempotent in memory and rejects mismatched labels or unrelated icons',()=>{
 for(const lang of langs){
  const d=doc(original.get(page(lang)));applyKnottySkillIcons(d);const first=d.documentElement.outerHTML;applyKnottySkillIcons(d);assert.equal(d.documentElement.outerHTML,first);
  assert.equal(first,doc(read(page(lang))).documentElement.outerHTML);
 }
 const badLabel=doc(original.get(page('ko')));badLabel.querySelector('.ts3-skill-number').textContent='different';assert.throws(()=>applyKnottySkillIcons(badLabel),/Unexpected decorative/);
 const badIcon=doc(read(page('ko')));badIcon.querySelector(`[${marker}]`).removeAttribute(marker);assert.throws(()=>applyKnottySkillIcons(badIcon),/Unexpected pre-existing/);
 const missing=doc(original.get(page('ko')));missing.querySelector('.ts-skill').remove();assert.throws(()=>applyKnottySkillIcons(missing),/Expected the three/);
});

test('the real character client keeps icon clicks, keyboard navigation and tab accessibility working in five languages',()=>{
 const client=read('js/characters-30.js');
 for(const lang of langs){
  const {document,window}=parseHTML(read(page(lang)));let focused=null;
  const buttons=[...document.querySelectorAll('[data-skill-target]')],panels=buttons.map(b=>document.getElementById(b.dataset.skillTarget));
  for(const b of buttons)b.focus=()=>{focused=b;};
  vm.runInNewContext(client,{document,window,location:{hash:''},URL,MutationObserver:window.MutationObserver});
  assert.equal(document.querySelector('.ts3-skill-selector').hidden,false);
  for(let i=0;i<3;i++){
   buttons[i].querySelector('img').dispatchEvent(new window.Event('click',{bubbles:true}));
   buttons.forEach((b,j)=>{assert.equal(b.getAttribute('role'),'tab');assert.equal(b.getAttribute('aria-selected'),String(i===j));assert.equal(b.getAttribute('aria-controls'),panels[j].id);assert.equal(panels[j].hidden,i!==j);assert.equal(panels[j].getAttribute('aria-labelledby'),b.id);assert.equal(b.textContent.trim(),labels[lang][j]);});
  }
  for(const [start,key,target] of [[2,'ArrowRight',0],[0,'ArrowLeft',2],[1,'Home',0],[0,'End',2]]){
   const event=new window.Event('keydown',{bubbles:true,cancelable:true});event.key=key;buttons[start].dispatchEvent(event);assert.equal(focused,buttons[target]);assert.equal(buttons[target].getAttribute('aria-selected'),'true');assert.equal(panels[target].hidden,false);assert.equal(event.defaultPrevented,true);
  }
 }
});

test('the overlay runs after localization and before indexing',()=>{
 const p=JSON.parse(read('package.json')),build=p.scripts.build.split(' && '),step='node scripts/build-knotty-skill-icons-41.js';
 assert.equal(build.filter(s=>s===step).length,1);assert.ok(build.indexOf(step)>build.indexOf('node scripts/build-official-locales-40.js'));assert.ok(build.indexOf(step)<build.indexOf('node scripts/build-search-index.js'));
 assert.ok(p.scripts['test:integration-41'].includes('node --test scripts/test-knotty-skill-icons-41.js'));
});
