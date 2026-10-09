'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const crypto=require('node:crypto'),{imageSize}=require('image-size');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/explorer.json'),C=require('../data/foundation-40/explorer-copy');
const langs=['ko','en','ja','ru','zh-tw'];
const oldIds=['hero-skill-book','arms-medal','food-10k','wood-10k','metal-10k','speedup-5m','food-100k','undine-gear-fragment'];
const newIds=['pet-eggs','reforge-hammer','advanced-recruitment-token','speedup-20h'];
const docs=langs.map(lang=>({lang,document:parseHTML(fs.readFileSync(path.join(root,lang,'database/items/index.html'),'utf8')).document}));

test('speedup uses preserve the exact five-minute description and render the twenty-hour model duration in all locales',()=>{
  const short=D.items.find(i=>i.id==='speedup-5m'),long=D.items.find(i=>i.id==='speedup-20h');
  assert.equal(short.minutes,5);assert.equal(long.minutes,1200);
  const expected={ko:'선택한 대기열의 남은 시간을 20시간 줄입니다.',en:'Reduces the selected queue countdown by 20 hours.',ja:'選択した待ち時間を20時間短縮。',ru:'Сокращает выбранную очередь на 20 часов.','zh-tw':'縮短所選佇列的倒數時間20小時。'};
  for(const {lang,document:d}of docs){
    const paragraphs=id=>[...d.getElementById(id).querySelectorAll('.ts40-item-body > div:last-child > p')].map(p=>p.textContent.trim());
    assert.deepEqual(paragraphs('speedup-5m'),[short.descriptions[lang]],lang+' original five-minute description');
    assert.deepEqual(paragraphs('speedup-20h'),[expected[lang]],lang+' twenty-hour duration');
    assert(!/\{(?:minutes|hours)\}/.test(d.querySelector('main').textContent),lang+' unresolved duration');
  }
});
test('twelve curated items preserve the eight existing stable anchors and valid localized routes',()=>{
  assert.deepEqual(D.items.map(i=>i.id),[...oldIds,...newIds]);
  assert.equal(new Set(D.items.map(i=>i.id)).size,12);
  for(const item of D.items){assert(['growth','resource','speedup','event'].includes(item.category));for(const lang of langs){assert(C[lang][item.id]);assert(C[lang][item.use]);if(item.route)assert(fs.existsSync(path.join(root,lang,item.route,'index.html')));}}
});
test('new source relations carry primary citations and retain unknown quantities instead of zero assumptions',()=>{
  const sources=new Map(D.officialSources.map(s=>[s.id,s]));assert.equal(sources.size,5);
  for(const source of sources.values()){const url=new URL(source.url);assert.equal(url.protocol,'https:');assert(['tilesurvivegame.com','funplus.com'].includes(url.hostname));assert.match(source.sha256,/^[a-f0-9]{64}$/);assert.equal(Object.hasOwn(source,'localPath'),false);}
  for(const relation of D.itemSources){assert(relation.sourceIds.length);for(const id of relation.sourceIds)assert(sources.has(id));assert.equal(Object.hasOwn(relation,'quantity'),false);for(const lang of langs)assert(C[lang][relation.copyKey]);}
  assert(D.items.find(i=>i.id==='speedup-5m').sources.includes('fiend-crate-speedup'));
  assert.equal(D.items.find(i=>i.id==='speedup-20h').minutes,20*60);
});
test('reforge and pass figures keep their documented units and conditions without adding purchase claims',()=>{
  assert.deepEqual(D.itemRules.reforge,{basicCost:1,advancedCost:25,currencyItemId:'reforge-hammer',advancedUnlockAfterTotalReforges:200,countScope:'all-gear',sourceIds:['probability-en']});
  assert.equal(D.itemRules.gearCrate.sameQualityRequired,true);assert.equal(D.itemRules.gearCrate.openingRequired,false);
  const benefit=D.packageBenefits[0];assert.equal(D.packageBenefits.length,1);assert.equal(benefit.dailyFreeHealLimitMultiplier,3);assert.equal(benefit.requires,'monthly-pass-active');assert.equal(benefit.baseLimit,null);assert.equal(benefit.price,null);
  assert.equal(D.packages.length,6);assert(D.packages.every(p=>p.currency==='exploration-coin'));
});
test('five rendered pages expose sixty unique item targets and retain compact headings and six-offer comparison',()=>{
  let anchors=0;
  for(const {lang,document:d}of docs){
    assert.deepEqual([...d.querySelectorAll('[data-item-entry]')].map(n=>n.id),[...oldIds,...newIds]);anchors+=d.querySelectorAll('[data-item-entry]').length;
    const all=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(all).size,all.length,lang+' duplicate ID');
    assert.deepEqual([...d.querySelectorAll('main h2')].map(n=>n.id),['items-heading','packages-heading']);
    assert.equal(d.querySelectorAll('[data-item-entry] h2').length,0);assert.equal(d.querySelectorAll('[data-item-entry] h3').length,24);
    assert.equal(d.querySelectorAll('[aria-labelledby="packages-heading"] tbody tr').length,6);
    assert.equal(d.querySelectorAll('[data-package-compare] option').length,12);
    assert.equal(d.querySelectorAll('[data-package-benefit="monthly-pass-free-heal"]').length,1);
    assert.equal(d.querySelectorAll('[data-gear-crate-tip]').length,1);
    assert(!/\{(?:basic|advanced|unlock|multiplier)\}|undefined|NaN/.test(d.querySelector('main').textContent));
  }
  assert.equal(anchors,60);
});
test('translated item labels retain English source identity and source/use links resolve',()=>{
  for(const {lang,document:d}of docs){
    for(const id of newIds){const item=D.items.find(i=>i.id===id),node=d.getElementById(id);if(lang!=='en')assert.equal(node.querySelector('summary [lang="en"]').textContent,item.nameOriginal);}
    for(const link of d.querySelectorAll('[data-explorer-official-source]')){const source=D.officialSources.find(s=>s.id===link.getAttribute('data-explorer-official-source'));assert(source);assert.equal(link.getAttribute('href'),source.url);}
    for(const link of d.querySelectorAll('[data-item-entry] a[href^="/"]')){const target=new URL(link.getAttribute('href'),'https://tilessurvive.net');assert(target.pathname.startsWith('/'+lang+'/'));assert(fs.existsSync(path.join(root,target.pathname,'index.html')));}
  }
});
test('eight approved item images are rendered with exact asset dimensions, hashes and accessible adjacent labels',()=>{
  const expected=oldIds;
  const manifest=require('../data/foundation-40/image-assets.json');
  for(const id of expected){
    const asset=manifest.assets.find(a=>a.id==='item:'+id),bytes=fs.readFileSync(path.join(root,asset.src)),size=imageSize(bytes);
    assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.equal(size.width,asset.width);assert.equal(size.height,asset.height);assert.equal(size.type,'webp');
    for(const {lang,document:d}of docs){const item=d.getElementById(id),image=item.querySelector('summary img');assert(image);assert.equal(image.getAttribute('src'),asset.src);assert.equal(Number(image.getAttribute('width')),asset.width);assert.equal(Number(image.getAttribute('height')),asset.height);assert.equal(image.getAttribute('alt'),'');assert.equal(image.getAttribute('loading'),'lazy');assert(item.querySelector('summary').textContent.includes(C[lang][id]));}
  }
  for(const {document:d}of docs){assert.equal(d.querySelectorAll('[data-item-entry] img').length,8);for(const item of D.items.filter(i=>!expected.includes(i.id)))assert.equal(d.getElementById(item.id).querySelectorAll('img').length,0);}
});
