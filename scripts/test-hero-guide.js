'use strict';
// Independent read-only publication regressions against the last deployed release.
// Never invokes a publisher, rewrites fixtures, downloads assets or uses a browser.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom'),imageModule=require('image-size'),imageSize=imageModule.imageSize||imageModule.default||imageModule;
const ROOT=path.resolve(__dirname,'..'),BASE='ac669cba',read=f=>fs.readFileSync(path.join(ROOT,f),'utf8'),json=f=>JSON.parse(read(f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),doc=s=>parseHTML(s.replace(/<!--[\s\S]*?-->/g,'')).document;
const registry=json('data/i18n/locales.json').locales,codes=registry.map(l=>l.code),routes=json('data/hero-atlas-routes.json').heroes,M=json('data/v4-formation.json'),A=json('data/hero-atlas-client.json'),copy=json('data/hero-guide-copy.json'),presentation=json('data/hero-guide-presentation.json');
const heroPages=routes.flatMap(h=>codes.map(l=>({kind:'hero',id:h.id,locale:l,route:h.routes[l],file:h.routes[l].slice(1)+'index.html'}))),hubs=codes.map(l=>({kind:'hub',locale:l,route:`/${l}/heroes/`,file:`${l}/heroes/index.html`})),petPages=codes.flatMap(l=>[null,...M.pets.map(p=>p.id)].map(id=>({kind:'pet',id,locale:l,route:`/${l}/database/pet-system/${id?id+'/':''}`,file:`${l}/database/pet-system/${id?id+'/':''}index.html`}))),tools=codes.map(l=>({kind:'tools',locale:l,route:`/${l}/tools/`,file:`${l}/tools/index.html`})),pages=[...heroPages,...hubs,...petPages,...tools];
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64e6}),old=new Map();
function loadBefore(files){const needed=[...new Set(files)].filter(f=>!old.has(f));if(!needed.length)return;const b=cp.execFileSync('git',['cat-file','--batch'],{cwd:ROOT,input:needed.map(f=>BASE+':'+f).join('\n')+'\n',maxBuffer:512e6});let at=0;for(const f of needed){const end=b.indexOf(10,at),m=/^[a-f0-9]+ blob (\d+)$/.exec(b.subarray(at,end).toString());assert(m,'Missing immutable baseline '+f);at=end+1;old.set(f,b.subarray(at,at+Number(m[1])).toString('utf8'));at+=Number(m[1])+1;}}
const before=f=>{loadBefore([f]);return old.get(f);},norm=s=>String(s).replace(/\s+/g,' ').trim(),attrs=n=>[...n.attributes].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0]));
const newIconHashes={
 'img/game-41/hero-skills/lava-1.png':'65c9147b71737b0a033b3c4da29da0f5cd43212403187091ad5a76def923053c',
 'img/game-41/hero-skills/lava-2.png':'e6d64516a7246a2e7dd60bce8ea0acc8afa2e3d039b7d10e6fa82218d0dedbb4',
 'img/game-41/hero-skills/lava-3.png':'e3078ad98ca15409cb173311883f3399982f6f023aedc2c9723e50df55fb0499',
 'img/game-41/hero-skills/lava-4.png':'0763e7b5085d84c9730be4859e551cd8a462f707e0e4a184bc84de20b4f693ed'};
// Exact pre-existing format mismatches observed on the 882 baseline pages.
// Never permits a new/managed use or a changed byte; decoded file validity remains mandatory.
const legacyImageSignatures={
  "img/heroes/maddy.webp": {
    "sha256": "44e6b34ef750f9ab0340d44987bd52ad11c6fdabecee5c28d4851ee56115e369",
    "actualType": "png"
  },
  "img/heroes/mike.webp": {
    "sha256": "405a8648a1bd8138d774e7f93966a35cb30735a6b0aadd7530de09e6fda3db00",
    "actualType": "png"
  },
  "img/heroes/light.webp": {
    "sha256": "2728df1ffdd7fbb3ab7f35573d78de01cef60d6b94decb8d462d29fcf827c457",
    "actualType": "png"
  },
  "img/heroes/kiki.webp": {
    "sha256": "005d2191397486a145f306ce36293f022b81981685d388294ee6a2dc86b10b02",
    "actualType": "png"
  },
  "img/heroes/tony.webp": {
    "sha256": "1af184d464f9ac4a376fd1c9f56c302ed294266dad13d247ad47f3498a7ca39e",
    "actualType": "png"
  },
  "img/heroes/sarge.webp": {
    "sha256": "046d0e894fa8dc4c65650aedca98bd20240fceb49b0247bd5b56ecad2945751d",
    "actualType": "png"
  },
  "img/heroes/lucky.webp": {
    "sha256": "f67f96085e7f81ba51cb3ca7b6dfd510c1b374b7d21e4b0e8155687be78cb68b",
    "actualType": "png"
  },
  "img/heroes/nikola.webp": {
    "sha256": "9a6f5874d23e112402d208b2dd900e4aab25a221065852a27e601a98f5168646",
    "actualType": "png"
  },
  "img/heroes/ray.webp": {
    "sha256": "60583f1d4a60fc6812a8b846d9a5f794687e8ec6b790447dc2fa7f2d55c85312",
    "actualType": "png"
  },
  "img/heroes/tarzan.webp": {
    "sha256": "c9550560b52cee3c30e0f61f168804f9479882e8f6563c5e5c1cdc87e81bf052",
    "actualType": "png"
  },
  "img/heroes/tara.webp": {
    "sha256": "2a7ede45dca602e9a24b85d6f61ac5d0015e92e8a30405e324b261051ddd98c1",
    "actualType": "png"
  },
  "img/heroes/chef-ken.webp": {
    "sha256": "74198b05d05ce7e64fed16553b75113dfd6d50eff876d8ff33cffd31a3ee8516",
    "actualType": "png"
  },
  "img/heroes/freya.webp": {
    "sha256": "3449cf96fb5895844050ae75a53d0b94b38563e83990776a9cab048eb9a1e155",
    "actualType": "png"
  },
  "img/heroes/rusty.webp": {
    "sha256": "79593de011234ee465f3e4084d06c0ee97f961846e294063897206331edeb526",
    "actualType": "png"
  },
  "img/heroes/rosie.webp": {
    "sha256": "f5c4ed07b53e1dd9c281f8c9acad51af463029c1b0fab8fc4b0b276650204f8c",
    "actualType": "png"
  },
  "img/heroes/equipment/beka-rifle.webp": {
    "sha256": "9230da11734bb5e47c24edec7dab89eca4419bcaf27b9721724b5bb5a9d4cb48",
    "actualType": "png"
  },
  "img/heroes/equipment/beka-exclusive-skill.webp": {
    "sha256": "780d0bd437782e6cb7dffb87fa2f9b9f20a1c4d6daa962711ac68b51dd83d2fc",
    "actualType": "png"
  },
  "img/heroes/laila.webp": {
    "sha256": "7b325096919dd25faa3540bb078cc16627e5e3db7d8895ffbefbc4f56324b30b",
    "actualType": "png"
  },
  "img/heroes/kiron.webp": {
    "sha256": "cb4e8f042bd6107629b7a87e32b57910debb5ddad77ce1b1f5ba5bcfb5ec64cb",
    "actualType": "png"
  },
  "img/heroes/jacob.webp": {
    "sha256": "97dcc8f1495255ac4562f34203d1ccd2faa6ed0ee801519c8e6961b0815900fc",
    "actualType": "png"
  },
  "img/heroes/candy.webp": {
    "sha256": "3a2e32cdf4a44bea3f1e90070a2ae66a1160485a97c39c8f1483f56ffc102307",
    "actualType": "png"
  },
  "img/heroes/eva.webp": {
    "sha256": "b2bbce212c9ede31b2f4cb6d5adba8d73384f90cce17ac4aba0c59987c0bf95d",
    "actualType": "png"
  },
  "img/heroes/travis.webp": {
    "sha256": "f7339d87451c43d7307a2f4118387964f16d42e577f6a62cf85711285963c0e0",
    "actualType": "png"
  },
  "img/heroes/ghost.webp": {
    "sha256": "39b9a0a1fd6f31bb703af4087e7ec12c7bdf163f637b22abf42562b4df354ecf",
    "actualType": "png"
  },
  "img/heroes/beka.webp": {
    "sha256": "4688be21a9f4ea878d645fbc6eeabe5bdaa929eff00fdb9db7a1d807b510eb4a",
    "actualType": "png"
  },
  "img/database/alliance-duel-guide.webp": {
    "sha256": "7c3ab90cfb8a4d84cb4baf51a9d3d37e9e9b7222bfcfb96ebd6f6ab80b70e31d",
    "actualType": "png"
  },
  "img/guides/gift-code-how-to-use.png": {
    "sha256": "1c55917e00ace8245d84b89c529efbf1e9fae2e341046c7e854c5733f0fbe732",
    "actualType": "webp"
  },
  "img/database/legend-gear-star-guide.webp": {
    "sha256": "3883140e67ff5d3bd1cc604db94d739f9150970761aefae035777fb734900758",
    "actualType": "png"
  },
  "img/database/skill-book-guide.webp": {
    "sha256": "c9033c63851de7f8f60149662e0ccae259754913b1934f73d73af9f0080eff94",
    "actualType": "png"
  },
  "img/database/hero-exp-guide.webp": {
    "sha256": "ad32926d06da68b685cdab11e52d0e541d47e82c8527e376d7da30b81f8d07ac",
    "actualType": "png"
  },
  "img/database/hero-star-guide.webp": {
    "sha256": "f0b89fc31256328270f28ba3d97246364be569345b234aee6b2437d54117b3aa",
    "actualType": "png"
  },
  "img/database/exclusive-gear-guide.webp": {
    "sha256": "abeb4f31c654a9c31832c03b93af36e3709e68070cf4382c4a593cb5e97ed484",
    "actualType": "png"
  },
  "img/database/vip-point-guide.webp": {
    "sha256": "0eac967791ea780fdbf872388ba3daa66d83a0e58b5c3b15a4fe7ca3c8a6921c",
    "actualType": "png"
  }
};
const checkedLegacyImageBaseline=new Set();
function image(src,{allowLegacy=false}={}){assert(src&&src.startsWith('/img/')&&!src.includes('..'),'Local reviewed image expected: '+src);const f=src.split(/[?#]/)[0].slice(1),b=fs.readFileSync(path.join(ROOT,f)),s=imageSize(b);assert(s.width>0&&s.height>0,'Invalid image '+f);const extension=path.extname(f).slice(1).toLowerCase();const formatMatches=extension===s.type||extension==='jpg'&&s.type==='jpeg'||extension==='jpeg'&&s.type==='jpg';if(!formatMatches){const pin=legacyImageSignatures[f];assert(allowLegacy&&pin,'Image format differs from extension '+f);assert.equal(s.type,pin.actualType,f+' unreviewed legacy signature');assert.equal(sha(b),pin.sha256,f+' legacy image bytes changed');if(!checkedLegacyImageBaseline.has(f)){const original=cp.execFileSync('git',['show',BASE+':'+f],{cwd:ROOT,maxBuffer:16e6});assert.equal(sha(original),pin.sha256,f+' exception is not pinned baseline content');checkedLegacyImageBaseline.add(f);}}return s;}
function seo(d){return {lang:d.documentElement.lang,dir:d.documentElement.getAttribute('dir'),title:d.querySelector('title')?.textContent,canonical:[...d.querySelectorAll('link[rel="canonical"]')].map(n=>n.href),hreflang:[...d.querySelectorAll('link[hreflang]')].map(n=>attrs(n)),meta:[...d.querySelectorAll('meta[name="description"],meta[name="robots"],meta[property^="og:"],meta[name^="twitter:"]')].map(n=>attrs(n)),jsonld:[...d.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent))};}
function commerce(d){return [...d.querySelectorAll('a[href],script,ins,iframe')].filter(n=>/lootbar|googlesyndication|adsbygoogle|google-analytics|googletagmanager|data-ten-|data-v3-analytics|data-v3-consent/i.test(n.outerHTML)).map(n=>n.outerHTML);}
function models(d){return [...d.querySelectorAll('script[type="application/json"]')].filter(n=>!n.hasAttribute('data-atlas-config')&&!n.hasAttribute('data-v4-config')).map(n=>({attributes:attrs(n),text:n.textContent}));}
function visibleText(node){const n=node.cloneNode(true);n.querySelectorAll('script,style,[hidden],[aria-hidden="true"],template').forEach(x=>x.remove());return norm(n.textContent);}
function stripManagedMain(d,entry,phase){const n=d.querySelector('main')?.cloneNode(true);assert(n,'main missing');
 // Exactly two legacy promoted-form summaries may replace the old availability
 // paragraph with the reviewed presentation label. No other node is exempt.
 if(entry.kind==='hero'&&['lucky','sarge'].includes(entry.id)){
  assert(['before','after'].includes(phase));const priorCopy=JSON.parse(before('data/hero-atlas-copy.json')).locales[entry.locale],currentCopy=json('data/hero-atlas-copy.json').locales[entry.locale],nodes=[...n.querySelectorAll('.hero-sub')];assert.equal(nodes.length,1,entry.route+' legacy summary count');const node=nodes[0],baselineNode=doc(before(entry.file)).querySelector('.hero-sub');
  assert.equal(currentCopy.sameHero,priorCopy.sameHero,entry.route+' identity explanation changed');assert.equal(node.textContent,priorCopy.sameHero+' '+(phase==='before'?priorCopy.promotionNote:copy.locales[entry.locale].ui.promotionStats),entry.route+' unreviewed legacy summary text');assert.equal(node.children.length,0,entry.route+' unreviewed summary markup');assert.equal(node.tagName,baselineNode.tagName);assert.deepEqual(attrs(node),attrs(baselineNode),entry.route+' summary attributes changed');node.remove();
 }
 n.querySelectorAll('[data-hero-atlas-owned="profile"],[data-hero-atlas-owned="hub"],[data-hero-atlas-owned="lava"],[data-hero-pet-owned="pets"],[data-v4-owned="workspace"],[data-v4-owned="navigation"]').forEach(x=>x.remove());return n.outerHTML.replace(/>\s+</g,'><').trim();}
function allLeaf(o,p=''){return Object.fromEntries(Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?Object.entries(allLeaf(v,p+k+'.')):[[p+k,v]]));}
function numbers(s){return String(s).match(/\d+(?:[.,]\d+)*%?/g)||[];}
function placeholders(s){return (String(s).match(/\{\{?[^{}]+\}?\}/g)||[]).sort();}

test('guide scope is exactly 609 hero, 21 hub, 231 pet and 21 tool URLs without invented identities',()=>{
 assert.equal(codes.length,21);assert.equal(heroPages.length,609);assert.equal(hubs.length,21);assert.equal(petPages.length,231);assert.equal(tools.length,21);assert.equal(pages.length,882);assert.equal(new Set(pages.map(p=>p.route)).size,882);assert.deepEqual(routes.map(h=>h.id).sort(),M.heroes.map(h=>h.id).sort());assert.equal(M.heroes.length,29);assert.equal(M.pets.length,10);for(const p of pages)assert(fs.existsSync(path.join(ROOT,p.file)),p.route);
});
test('retained gameplay models and all original images are byte-preserved; only four pinned Lava icons are added',()=>{
 const files=['data/hero-atlas-client.json','data/hero-atlas-publication.json','data/hero-atlas-routes.json','data/hero-pet-relations.json','data/v4-formation.json','data/v4-economy.json','data/client-heroes-52.json','data/hero-refinement-51.json','data/power-plant-unified.json','data/pet-skill-levels.json'];loadBefore(files);for(const f of files)assert.equal(sha(Buffer.from(read(f))),sha(Buffer.from(before(f))),f+' core data changed');
 const original=new Set(git('ls-tree','-r','--name-only',BASE,'--','img').trim().split(/\r?\n/).filter(Boolean)),changed=git('diff','--name-only',BASE,'--','img').trim().split(/\r?\n/).filter(Boolean),untracked=git('ls-files','--others','--exclude-standard','--','img').trim().split(/\r?\n/).filter(Boolean);for(const f of changed)assert(!original.has(f)&&newIconHashes[f],'Original or unreviewed image changed '+f);for(const f of untracked)assert(newIconHashes[f],'Unexpected untracked image '+f);for(const f of original)assert(fs.existsSync(path.join(ROOT,f)),'Original image removed '+f);
 for(const [f,expected]of Object.entries(newIconHashes)){assert(!original.has(f));assert.equal(sha(fs.readFileSync(path.join(ROOT,f))),expected,f+' differs from visually inspected retained Sprite PNG');const dimensions=image('/'+f);assert.equal(dimensions.width,128);assert.equal(dimensions.height,128);}
});
test('all 882 existing URLs preserve exact SEO, canonical/hreflang, advertising, TEN and calculator data payloads',()=>{
 loadBefore(pages.map(p=>p.file));for(const p of pages){const a=doc(before(p.file)),b=doc(read(p.file));assert.deepEqual(seo(b),seo(a),p.route+' SEO changed');assert.equal(b.querySelector('link[rel="canonical"]')?.href,'https://tilessurvive.net'+p.route,p.route+' canonical');assert.deepEqual(commerce(b),commerce(a),p.route+' commerce/consent changed');assert.deepEqual(models(b),models(a),p.route+' pre-existing data payload changed');const v4=d=>{const n=d.querySelector('script[data-v4-config]');if(!n)return null;const x=JSON.parse(n.textContent);if(x.formationCopy)delete x.formationCopy.guide;return x;};assert.deepEqual(v4(b),v4(a),p.route+' V4 numeric/model/config changed outside additive guide copy');const tables=d=>[...d.querySelectorAll('table')].filter(n=>!n.closest('[data-hero-atlas-owned],[data-hero-pet-owned]')).map(n=>n.outerHTML);assert.deepEqual(tables(b),tables(a),p.route+' original numeric tables changed');}
});
test('content outside explicitly managed presentation owners remains unchanged on all 882 pages',()=>{loadBefore(pages.map(p=>p.file));let exactSummaryExceptions=0;for(const p of pages){assert.equal(stripManagedMain(doc(read(p.file)),p,'after'),stripManagedMain(doc(before(p.file)),p,'before'),p.route+' inherited main body changed');if(p.kind==='hero'&&['lucky','sarge'].includes(p.id))exactSummaryExceptions++;}assert.equal(exactSummaryExceptions,2*21);});
test('all 108 existing skill panels per language retain exact descriptions, level labels and icons',()=>{
 let panels=0;for(const p of heroPages.filter(p=>p.id!=='lava')){const take=d=>[...d.querySelectorAll('details.ts-skill')].map(n=>({id:n.id,summary:n.querySelector('summary')?.outerHTML,body:n.querySelector('.ts-skill-body')?.outerHTML})),a=take(doc(before(p.file))),b=take(doc(read(p.file)));assert(a.length,p.route+' baseline skills absent');assert.deepEqual(b,a,p.route+' inherited skill content changed');panels+=b.length;}assert.equal(panels,108*21);
});
test('every locale renders 69 supported hero-pet pairs and 70 exact grounds with source IDs and conditions intact',()=>{
 const expectedPairs=new Set(M.rules.map(r=>r.heroId+'|'+r.petId));assert.equal(expectedPairs.size,69);assert.equal(M.rules.length,70);let pairs=0,grounds=0;
 for(const p of heroPages){const d=doc(read(p.file)),host=d.querySelector('[data-hero-pet-owned="hero"]');assert(host,p.route);assert.equal(host.dataset.hpHero,p.id);const expected=M.rules.filter(r=>r.heroId===p.id),unique=[...new Set(expected.map(r=>p.id+'|'+r.petId))];assert.deepEqual([...host.querySelectorAll('[data-hp-pair]')].map(n=>n.dataset.hpPair),unique,p.route+' pair set');assert.deepEqual([...host.querySelectorAll('[data-hp-rule]')].map(n=>n.dataset.hpRule).sort(),expected.map(r=>r.id).sort(),p.route+' grounds');
  for(const r of expected){const n=host.querySelector('[data-hp-rule="'+r.id+'"]');assert.deepEqual([...n.querySelectorAll('[data-hp-condition]')].map(x=>x.dataset.hpCondition),r.conditionKeys,p.route+' conditions');assert.deepEqual([...n.querySelectorAll('[data-hp-skill-id]')].map(x=>Number(x.dataset.hpSkillId)),[...r.heroSkillIds,...r.petSkillIds],p.route+' skill IDs');const pet=M.pets.find(x=>x.id===r.petId),stage=Math.max(...r.petSkillIds.map(id=>pet.skills.find(s=>s.clientId===id).unlockStage));assert(n.querySelector('.hp-use')?.textContent.includes(new Intl.NumberFormat(p.locale).format(stage)),p.route+' stage');assert.equal(n.querySelector('.hp-reason')?.textContent,copy.locales[p.locale].reasons[r.reasonKey]);}
  assert.equal(!!host.querySelector('[data-hp-no-evidence]'),!expected.length);assert(!host.querySelector('meter,progress,[data-score],[data-rank]'));pairs+=unique.length;grounds+=expected.length;
 }assert.equal(pairs,69*21);assert.equal(grounds,70*21);
});
test('all ten pet routes and directory cards use exact current IDs, names and their forty skills',()=>{
 for(const p of petPages){const d=doc(read(p.file)),host=d.querySelector('[data-hero-pet-owned="pets"]');assert(host,p.route);const expected=p.id?M.pets.filter(x=>x.id===p.id):M.pets,rows=[...host.querySelectorAll('article.hp-pet')];assert.deepEqual(rows.map(n=>Number(n.dataset.hpPet)),expected.map(x=>x.clientId),p.route);for(const pet of expected){const n=rows.find(x=>Number(x.dataset.hpPet)===pet.clientId);assert.equal(n.querySelector('h3').textContent,pet.names[p.locale].value);assert.deepEqual([...n.querySelectorAll('.hp-skill-details [data-hp-skill-id]')].map(x=>Number(x.dataset.hpSkillId)),pet.skills.map(x=>x.clientId));for(const link of n.querySelectorAll('a[href]'))assert(!/\/ironhead\//.test(link.href),'hardhead is the actual site slug');}}
});
test('21 guide dictionaries have identical keys, original numeric tokens and placeholders without invented game values',()=>{
 assert.deepEqual(Object.keys(copy.locales).sort(),codes.slice().sort());const en=allLeaf(copy.locales.en),keys=Object.keys(en).sort();for(const l of codes){const d=allLeaf(copy.locales[l]);assert.deepEqual(Object.keys(d).sort(),keys,l+' keys');for(const[k,v]of Object.entries(d)){assert(typeof v==='string'&&v.trim()&&!v.includes('\uFFFD'),l+' '+k);assert.deepEqual(numbers(v),numbers(en[k]),l+' '+k+' numeric tokens');assert.deepEqual(placeholders(v),placeholders(en[k]),l+' '+k+' placeholders');}}
 for(const l of codes)for(const [id,text]of Object.entries(copy.locales[l].lavaSkills)){assert(['25401384','25401385','25401386','25401387'].includes(id));assert(!/\{\d+\}/.test(text),'Unresolved raw substitution shown');}
});
test('Lava has four exact named skills, inspected icons and authored summaries in all locales',()=>{
 const h=A.heroes.find(x=>x.id==='lava');assert.deepEqual(h.skills.map(s=>s.clientId),[25401384,25401385,25401386,25401387]);for(const p of heroPages.filter(p=>p.id==='lava')){const d=doc(read(p.file)),cards=[...d.querySelectorAll('#lava-skills .hero-guide-skill')];assert.deepEqual(cards.map(n=>Number(n.dataset.clientSkillId)),h.skills.map(s=>s.clientId));for(const s of h.skills){const n=cards.find(n=>Number(n.dataset.clientSkillId)===s.clientId),icon=presentation.lavaSkills[s.clientId].icon;assert.equal(n.querySelector('h3')?.textContent,s.names[p.locale].value);assert.equal(n.querySelector('p')?.textContent,copy.locales[p.locale].lavaSkills[s.clientId]);assert.equal(n.querySelector('img')?.getAttribute('src'),icon.src);assert.equal(n.querySelector('img')?.getAttribute('width'),String(icon.width));assert.equal(n.querySelector('img')?.getAttribute('height'),String(icon.height));}}
});
test('all local displayed image paths resolve to valid files and the presentation map retains correct hero/pet slugs',()=>{
 assert.throws(()=>image('/img/heroes/maddy.webp'),/Image format differs/,'Even a pinned legacy image is rejected in strict new/managed mode');const inspected=new Set();for(const p of pages){const d=doc(read(p.file));for(const n of d.querySelectorAll('img[src]')){const src=n.getAttribute('src');if(!src.startsWith('/img/'))continue;const managed=!!n.closest('[data-hero-atlas-owned],[data-hero-pet-owned],[data-v4-owned]'),checkKey=src+'|'+(managed?'managed':'legacy');if(!inspected.has(checkKey)){image(src,{allowLegacy:!managed});inspected.add(checkKey);}}}
 assert.deepEqual(Object.keys(presentation.heroes).sort(),M.heroes.map(x=>x.id).sort());assert.deepEqual(Object.keys(presentation.pets).sort(),M.pets.map(x=>x.id).sort());for(const [id,{portrait:p}]of Object.entries(presentation.heroes)){assert.equal(p.src,routes.find(h=>h.id===id).images.en.src);const d=image(p.src);assert.equal(d.width,p.width);assert.equal(d.height,p.height);}for(const [id,p]of Object.entries(presentation.pets)){assert(id!=='ironhead');image(p.portrait.src);}assert(inspected.size>100,'Image coverage unexpectedly small');
});
test('managed recommendation/profile text excludes old audit prose while hidden compatibility status remains allowed',()=>{
 const ca=json('data/hero-atlas-copy.json').locales,cp=json('data/hero-pet-copy.json').locales;for(const p of [...heroPages,...petPages]){const d=doc(read(p.file));for(const n of d.querySelectorAll('[data-hero-atlas-owned="profile"],[data-hero-atlas-owned="lava"],[data-hero-pet-owned="pets"]')){const text=visibleText(n),forbidden=[...['heldIntro','promotionNote','effectPending','pendingLanguageFinding','legacyPromotedNote'].map(k=>ca[p.locale][k]),...['intro','scope','configured','source','dataBased','practical','version'].map(k=>cp[p.locale].ui[k])].filter(x=>x&&x.length>=18);for(const value of forbidden)assert(!text.includes(norm(value)),p.route+' old audit prose rendered: '+value);assert(!/sourceSHA256|valuesSHA256|recordKey|C:\\Users|tscfg:|raw-template-and-bindings/i.test(text),p.route+' private metadata displayed');}}
});
test('every new managed navigation uses an existing same-language URL and a real fragment',()=>{
 const targets=new Map();for(const p of pages){const d=doc(read(p.file));for(const n of d.querySelectorAll('[data-hero-atlas-owned="profile"] a[href],[data-hero-atlas-owned="lava"] a[href],[data-hero-pet-owned] a[href]')){const href=n.getAttribute('href');if(!href.startsWith('/')&&!href.startsWith('#'))continue;const u=new URL(href,'https://tilessurvive.net'+p.route);assert(u.pathname.startsWith('/'+p.locale+'/'),p.route+' cross-language link '+href);const f=u.pathname.slice(1)+(u.pathname.endsWith('/')?'index.html':'');assert(fs.existsSync(path.join(ROOT,f)),href+' missing page');if(u.hash){if(!targets.has(f))targets.set(f,new Set([...doc(read(f)).querySelectorAll('[id]')].map(n=>n.id)));assert(targets.get(f).has(decodeURIComponent(u.hash.slice(1))),p.route+' missing fragment '+href);}}}
});
test('managed owners are idempotent and reject unauthorised edits before future regeneration',()=>{
 const B=require('./build-hero-atlas'),P=require('./build-hero-pet-pages'),V=require('./v4-workbench-content');for(const p of [...heroPages,...hubs])B.validateOwnership(read(p.file),p.locale,p.route);for(const p of petPages)P.validateOwnership(read(p.file),p.locale);for(const p of tools)V.validateOwnership(read(p.file),p.locale,p.route);
 for(const [route,selector,validate]of [['en/heroes/lava/index.html','.hero-guide-skill p',s=>B.validateOwnership(s,'en','/en/heroes/lava/')],['en/database/pet-system/index.html','.hp-reason',s=>P.validateOwnership(s,'en')]]){const d=doc(read(route)),n=d.querySelector(selector);assert(n,route);n.textContent='Invented guaranteed victory';assert.throws(()=>validate(d.toString()),/ownership|Unreviewed|mismatch/i,route+' tampered owner accepted');}
});
