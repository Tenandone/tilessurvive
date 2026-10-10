'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const crypto=require('node:crypto'),{imageSize}=require('image-size');
const root=path.resolve(__dirname,'..'),D=require('../data/foundation-40/explorer.json'),C=require('../data/foundation-40/explorer-copy');
const langs=['ko','en','ja','ru','zh-tw'];
const oldIds=['hero-skill-book','arms-medal','food-10k','wood-10k','metal-10k','speedup-5m','food-100k','undine-gear-fragment'];
const newIds=['pet-eggs','reforge-hammer','advanced-recruitment-token','speedup-20h'];
const vipIds=['stamina-10','arena-ticket','normal-recruitment-coin','wood-100k','epic-hero-fragment','hero-exp-10k'];
const docs=langs.map(lang=>({lang,document:parseHTML(require('./build-item-chest-rewards-41').strip(fs.readFileSync(path.join(root,lang,'database/items/index.html'),'utf8'),lang)).document}));

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
test('eighteen curated items preserve the twelve existing stable anchors and valid localized routes',()=>{
  assert.deepEqual(D.items.map(i=>i.id),[...oldIds,...newIds,...vipIds]);
  assert.equal(new Set(D.items.map(i=>i.id)).size,18);
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
test('five rendered pages expose ninety unique item targets and retain compact headings and six-offer comparison',()=>{
  let anchors=0;
  for(const {lang,document:d}of docs){
    assert.deepEqual([...d.querySelectorAll('[data-item-entry]')].map(n=>n.id),[...oldIds,...newIds,...vipIds]);anchors+=d.querySelectorAll('[data-item-entry]').length;
    const all=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(all).size,all.length,lang+' duplicate ID');
    assert.deepEqual([...d.querySelectorAll('main h2')].map(n=>n.id),['items-heading','vip-offers-heading','packages-heading']);
    assert.equal(d.querySelectorAll('[data-item-entry] h2').length,0);assert.equal(d.querySelectorAll('[data-item-entry] h3').length,36);
    assert.equal(d.querySelectorAll('[aria-labelledby="packages-heading"] tbody tr').length,6);
    assert.equal(d.querySelectorAll('[data-package-compare] option').length,12);
    assert.equal(d.querySelectorAll('[data-package-benefit="monthly-pass-free-heal"]').length,1);
    assert.equal(d.querySelectorAll('[data-gear-crate-tip]').length,1);
    assert(!/\{(?:basic|advanced|unlock|multiplier)\}|undefined|NaN/.test(d.querySelector('main').textContent));
  }
  assert.equal(anchors,90);
});

test('VIP catalog preserves nine observed price pairs, both old offers, and unknown purchase conditions',()=>{
  const expected=[['vip-stamina-free','stamina-10',0],['vip-arena-ticket','arena-ticket',250],['vip-stamina-paid','stamina-10',240],['vip-normal-recruit','normal-recruitment-coin',250],['vip-food','food-100k',20],['vip-speedup','speedup-5m',60],['vip-wood','wood-100k',20],['vip-epic-fragment','epic-hero-fragment',225],['vip-hero-exp','hero-exp-10k',30]];
  assert.deepEqual(D.vipCatalog,{offerIds:expected.map(x=>x[0]),gameVersion:'2.6.200',observedAt:'2026-10-09',scope:'observed-session-only'});
  assert.equal(D.offers.length,9);
  assert.deepEqual(D.offers.slice(0,2),[
    {id:'vip-food',shop:'vip',item:'food-100k',quantity:1,cost:20,currency:'diamonds',conditions:{accountLimit:null},evidenceIds:['ui-023','ui-024']},
    {id:'vip-speedup',shop:'vip',item:'speedup-5m',quantity:1,cost:60,currency:'diamonds',conditions:{accountLimit:null},evidenceIds:['ui-023','ui-025']}
  ]);
  for(const [id,item,price]of expected){const offer=D.offers.find(o=>o.id===id);assert.equal(offer.item,item);assert.equal(offer.cost,price);assert.equal(offer.currency,'diamonds');assert.deepEqual(offer.conditions,{accountLimit:null});assert(offer.evidenceIds.includes('ui-023'));}
  for(const offer of D.offers.slice(2)){assert.equal(offer.quantity,null);for(const key of ['remaining','reset','minimumVipLevel','discount','sourceCandidateRecordKeys','sourceItemInternalId'])assert(!Object.hasOwn(offer,key));}
  for(const {lang,document:d}of docs){
    const rows=[...d.querySelectorAll('[aria-labelledby="vip-offers-heading"] tbody tr')];assert.equal(rows.length,9);
    expected.forEach(([,item,price],i)=>{const a=rows[i].querySelector('a');assert.equal(a.getAttribute('href'),'#'+item);assert.equal(a.textContent,C[lang][item]);assert.equal(rows[i].querySelector('td').textContent,price===0?C[lang].vipFree:new Intl.NumberFormat(lang).format(price)+' '+C[lang].diamonds);});
    assert.equal(d.querySelector('[aria-labelledby="vip-offers-heading"] .ts40-context').textContent,C[lang].shopCondition);
    assert(C[lang].shopCondition.includes('2026-10-09'));assert(C[lang].shopCondition.includes('2.6.200'));
    for(const id of vipIds){const item=D.items.find(i=>i.id===id),entry=d.getElementById(id);assert.equal(entry.querySelector('.ts40-item-body > div:last-child > p').textContent,item.descriptions[lang]);assert(!/\/ (?:0|null|undefined)\b/.test(entry.textContent));}
  }
});
test('translated item labels retain English source identity and source/use links resolve',()=>{
  for(const {lang,document:d}of docs){
    for(const id of newIds){const item=D.items.find(i=>i.id===id),node=d.getElementById(id);if(lang!=='en')assert.equal(node.querySelector('summary [lang="en"]').textContent,item.nameOriginal);}
    for(const link of d.querySelectorAll('[data-explorer-official-source]')){const source=D.officialSources.find(s=>s.id===link.getAttribute('data-explorer-official-source'));assert(source);assert.equal(link.getAttribute('href'),source.url);}
    for(const link of d.querySelectorAll('[data-item-entry] a[href^="/"]')){const target=new URL(link.getAttribute('href'),'https://tilessurvive.net');assert(target.pathname.startsWith('/'+lang+'/'));assert(fs.existsSync(path.join(root,target.pathname,'index.html')));}
  }
});
test('sixteen approved item images preserve all eight original assets and leave both unbound entries image-free',()=>{
  const added=require('../data/foundation-40/item-icons-41.json').assets;
  const expected=[...oldIds,...added.map(a=>a.entity)];
  assert.deepEqual(added.map(a=>a.entity),['reforge-hammer','advanced-recruitment-token','stamina-10','arena-ticket','normal-recruitment-coin','wood-100k','epic-hero-fragment','hero-exp-10k']);
  const manifest={assets:[...require('../data/foundation-40/image-assets.json').assets,...added]};
  for(const id of expected){
    const asset=manifest.assets.find(a=>a.id==='item:'+id),bytes=fs.readFileSync(path.join(root,asset.src)),size=imageSize(bytes);
    assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);
    assert.equal(size.width,asset.width);assert.equal(size.height,asset.height);assert.equal(size.type,'webp');
    for(const {lang,document:d}of docs){const item=d.getElementById(id),image=item.querySelector('summary img');assert(image);assert.equal(image.getAttribute('src'),asset.src);assert.equal(Number(image.getAttribute('width')),asset.width);assert.equal(Number(image.getAttribute('height')),asset.height);assert.equal(image.getAttribute('alt'),'');assert.equal(image.getAttribute('loading'),'lazy');assert(item.querySelector('summary').textContent.includes(C[lang][id]));}
  }
  for(const {document:d}of docs){assert.equal(d.querySelectorAll('[data-item-entry] img').length,16);for(const item of D.items.filter(i=>!expected.includes(i.id)))assert.equal(d.getElementById(item.id).querySelectorAll('img').length,0);}
});
