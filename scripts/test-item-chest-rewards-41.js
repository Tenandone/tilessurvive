const P50=require('./data-presentation-50-test-allowances');
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),{parseHTML}=require('linkedom');
const B=require('./build-item-chest-rewards-41'),D=require('../data/foundation-40/item-chest-rewards-41.json'),C=require('../data/foundation-40/item-chest-rewards-copy'),{assertSearchExtension}=require('./lib/item-chest-regression-41');
const root=path.resolve(__dirname,'..'),base='2f0765ccd86c16679c183c2f978ba26b5940d303',read=f=>fs.readFileSync(path.join(root,f)),lf=b=>String(b).replaceAll('\r\n','\n'),old=f=>execFileSync('git',['show',base+':'+f],{cwd:root,maxBuffer:10e6}),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('three reviewed chest identities contain only eight resource choices and three displayed percentages',()=>{
 B.validate(D);assert.equal(sha(lf(read('data/foundation-40/item-chest-rewards-41.json'))),'5f5737a4e5481f58b87efff287e90213cf4acd08a986742a95b5a9de440d3b86');
 assert.deepEqual(D.choices.map(c=>c.options.map(o=>o.amount)),[[10000,10000,2000,500],[100000,100000,20000,5000]]);
 assert.deepEqual(D.festival.outcomes,[{quantity:10,displayPercent:'10.00'},{quantity:3,displayPercent:'30.00'},{quantity:1,displayPercent:'60.00'}]);
 assert(!/tscfg:|InternalId|rawChance|DropMain|DropGroup|sourcePath|snapshotPath|audit-results|sourceRecord|runtimeIFix|donat|기부|寄付|捐獻|Пожертвуйте/i.test(JSON.stringify(D)),'No raw keys or unobserved cake donation effect');
 assert.deepEqual(D.assets.map(a=>a.id),['resource-choice','festive-chest','party-cake']);assert.equal(D.assets.reduce((n,a)=>n+a.bytes,0),40218);
 assert.deepEqual(fs.readdirSync(path.join(root,'img/game-41/item-chests')).sort(),D.assets.map(a=>path.basename(a.src)).sort());
});
test('five complete pages add exactly three accessible detail entries and otherwise retain baseline bytes',()=>{
 let rows=0,images=0;
 for(const lang of B.langs){
  const file=lang+'/database/items/index.html',before=lf(old(file)),after=lf(read(file)),d=parseHTML(after).document;
  assert.equal(P50.html(B.strip(after,lang),file),P50.html(before,file),'Exact remainder including all18 items, quantities, conditions, SEO, links, calculators and runtime payload');P50.equal(B.apply(before,lang),after,file);assert.equal(B.apply(after,lang),after);
  assert.equal(d.querySelectorAll('[data-item-entry]').length,21);assert.deepEqual([...d.querySelectorAll('main h2')].map(n=>n.id),['items-heading','vip-offers-heading','packages-heading']);
  assert.equal(new Set([...d.querySelectorAll('[id]')].map(n=>n.id)).size,d.querySelectorAll('[id]').length);
  for(const c of [...D.choices,D.festival]){const entry=d.getElementById(c.id);assert(entry.matches('details[data-item-entry][data-chest-rewards-41]'));assert.equal(entry.dataset.category,c.category);assert.equal(entry.querySelector('summary').textContent,c.names[lang]);assert.equal(entry.querySelector('.ts40-item-body > div > p').textContent,c.descriptions[lang]);assert.equal(entry.querySelectorAll('h3').length,2);assert.equal(entry.querySelectorAll('h2').length,0);for(const image of entry.querySelectorAll('img')){const a=D.assets.find(a=>a.src===image.getAttribute('src'));assert(a);for(const [k,v]of Object.entries({alt:'','aria-hidden':'true',width:'128',height:'128',loading:'lazy',decoding:'async'}))assert.equal(image.getAttribute(k),v);images++;}}
  for(const c of D.choices){const entry=d.getElementById(c.id),table=[...entry.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(n=>n.textContent));assert.deepEqual(table,c.options.map(o=>[C[lang].resources[o.resource],new Intl.NumberFormat(lang).format(o.amount)]));assert.equal(entry.querySelector('.ts40-item-body > div > p:last-child').textContent,C[lang].chooseOne);rows+=table.length;}
  const f=d.getElementById(D.festival.id);assert.equal(f.querySelector('.ts40-context').textContent,C[lang].scope.replace('{date}',D.observedAt));assert.equal(f.querySelector('.ts40-item-body > div:last-child h3').textContent,D.festival.rewardNames[lang]);assert.deepEqual([...f.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(n=>n.textContent)),D.festival.outcomes.map(o=>[new Intl.NumberFormat(lang).format(o.quantity),new Intl.NumberFormat(lang,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(o.displayPercent))+'%']));rows+=3;
 }
 assert.equal(rows,55);assert.equal(images,20);
});
test('all existing data, formulas, styles, SEO and item images stay exact; only fifteen searchable destinations are added',()=>{
 for(const f of ['data/foundation-40/explorer.json','data/foundation-40/explorer-copy.js','js/foundation-40.js','js/foundation-40-math.js','css/foundation-40.css','sitemap.xml','robots.txt'])P50.equal(lf(read(f)),lf(old(f)),f);
 for(const manifest of ['data/foundation-40/image-assets.json','data/foundation-40/item-icons-41.json']){assert.equal(lf(read(manifest)),lf(old(manifest)));const m=JSON.parse(read(manifest));for(const a of m.assets.filter(a=>a.kind==='item'||a.id.startsWith('item:')))assert.deepEqual(read(a.src),old(a.src.slice(1)),a.src);}
 assertSearchExtension(old('data/search-index.json'),read('data/search-index.json'));
 for(const entry of B.entries()){const [route,id]=entry.url.split('#'),d=parseHTML(read(route+'index.html').toString()).document;assert.equal(d.getElementById(id).querySelector('summary').textContent,entry.title);}
});
test('invalid reward arithmetic, percentages, identity, localization and private fields fail before rendering',()=>{
 const mutations=[m=>m.choices.pop(),m=>m.choices[0].id=m.choices[1].id,m=>m.choices[0].options[2].amount=1000,m=>m.choices[0].options[0].amount=null,m=>m.choices[0].options.reverse(),m=>m.choices[0].chooseAll=true,m=>delete m.choices[0].names.ja,m=>m.choices[0].names.ko='<script>',m=>m.festival.outcomes[0].displayPercent='0.10',m=>m.festival.outcomes[0].quantity=1,m=>m.festival.rawChance=1000,m=>m.festival.rewardDescription='donation',m=>m.assets[0].src='/private.png',m=>m.assets[0].width=64,m=>m.assets[0].sha256='0'.repeat(64),m=>m.assets.push(m.assets[0]),m=>m.sourcePath='private'];
 for(const mutate of mutations){const bad=structuredClone(D);mutate(bad);assert.throws(()=>B.render('ko',bad));}
 assert.throws(()=>B.render('unknown'));const baseline=lf(old('ko/database/items/index.html'));
 assert.throws(()=>B.apply(baseline.replace('id="items-heading"','id="'+B.ids[0]+'"'),'ko'),/collision/);
 assert.throws(()=>B.apply(baseline.replace('https://tilessurvive.net/ko/database/items/','https://tilessurvive.net/en/database/items/'),'ko'));
 const current=lf(read('ko/database/items/index.html'));assert.throws(()=>B.apply(current.replace('data-chest-rewards-41=""','data-unowned=""'),'ko'),/Incomplete/);
 const index=JSON.parse(read('data/search-index.json'));index.items.find(i=>i.url==='/ko/database/items/#hero-skill-book').title+=' changed';assert.throws(()=>assertSearchExtension(old('data/search-index.json'),index));
});
