/* Exact reviewed deltas shared by immutable-release regression suites. */
'use strict';
const assert=require('assert/strict'),growth=require('../data/foundation-40/starhorn-growth.json');
const roles={ko:['공격','지원'],en:['Attacker','Support'],ja:['攻撃','支援'],ru:['Атака','Поддержка'],'zh-tw':['攻擊','支援']};
const petChanges=[['snowball','role','Support','Attacker'],['dodo','role','Attacker','Support'],['snowball','rarity',null,'R'],['buckler','rarity',null,'R'],['hardhead','rarity',null,'SR'],['shadow','rarity',null,'SR']];
const arcadia={ko:['공성 시간 3시간 ·','공성은 v2.5.600부터 2시간입니다. 다음 점령·보상 수치는 2026-01-07 가이드 기준입니다:'],en:['The siege lasts 3 hours.','The contest lasts 2 hours from v2.5.600. The following occupation and reward values are from the guide dated 2026-01-07:'],ja:['攻城は3時間。','攻城期間はv2.5.600から2時間です。以下の占領・報酬の数値は2026-01-07のガイドに基づきます。'],ru:['Осада длится 3 часа.','Начиная с v2.5.600 осада длится 2 часа. Следующие значения удержания и наград приведены по руководству от 2026-01-07:'],'zh-tw':['攻城持續3小時；','攻城時間自v2.5.600起為2小時。以下佔領與獎勵數值依據2026-01-07指南：']};
const deletedDrafts={
 'data/event-helper-events-draft.json':'3b7b92c4289eee5413c8f8c7554f1625d6db464d304c7248a00521a5113393a5',
 'data/event-helper-events-grouped-draft.json':'cd6d2e8b45edebae272f73ad58261619a8abac9b78f12efcdbb8187d966979c5',
 'data/event-helper-events-operational-candidate.json':'ad3c9983d41758e22a7bc0162121020702d5346d7795d97b2059131464904da5',
 'data/event-helper-mapping-draft.json':'1a84f019f575f08ba76971d9be3c7cc112a83399f13387a59cf8a8727a1e12ad',
 'data/event-helper-source-extract.json':'3f4cd37746a84b180d38d4f9c7b7a68277fedda221bd9f05ad4292ecca849f6f'
};
const growthSource={url:'https://github.com/Tenandone/tilessurvive/blob/main/data/foundation-40/starhorn-growth.json',version:'Tiles Survive 2.6.200',kind:'game-resource-field-validated'};
const hatchSource={url:'https://github.com/Tenandone/tilessurvive/blob/main/data/foundation-40/pet-hatching.json',version:'Tiles Survive 2.6.200',kind:'game-screen'};
const clone=v=>JSON.parse(JSON.stringify(v)),norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
const petHub=file=>/^(ko|en|ja|ru|zh-tw)\/database\/pet-system\/index\.html$/.test(file);
function image(file,src){
 const pet=src.match(/^\/img\/pets\/(snowball|dodo|buckler|fluffy|hardhead|shadow|starhorn)\.webp$/);
 if(pet&&/^(ko|en|ja|ru|zh-tw)\/database\/pet-system\//.test(file))return '/img/game-40/pets/'+pet[1]+'.webp';
 if(/\/heroes\/undine\/index\.html$/.test(file)&&src==='/img/heroes/undine-game.webp')return '/img/game-40/heroes/undine.webp';
 if(/\/heroes\/lagnar\/index\.html$/.test(file)){
  if(src==='/img/heroes/lagnar.webp')return '/img/game-40/heroes/lagnar.webp';
  const skill=src.match(/^\/img\/heroes\/skills\/lagnar-skill-([1-4])\.webp$/);if(skill)return '/img/game-40/skills/lagnar-'+skill[1]+'.webp';
 }
 return src;
}
function metadata(value,file){
 const v=clone(value),lang=file.split('/')[0];
 if(file==='ko/heroes/undine/index.html')for(const key of ['title','ogTitle'])if(v[key])v[key]=v[key].replace('Undine','운디네 (Undine)');
 if(file==='ko/heroes/undine/index.html')for(const p of v.webPages||[])if(p.name)p.name=p.name.replace('Undine','운디네 (Undine)');
 let pair=null;if(file===`${lang}/database/pet-system/snowball/index.html`)pair=[roles[lang][1],roles[lang][0]];if(file===`${lang}/database/pet-system/dodo/index.html`)pair=roles[lang];
 if(pair)for(const key of ['description','ogDescription'])if(v[key])v[key]=v[key].replace(...pair);
 if(pair)for(const p of v.webPages||[])if(p.description)p.description=p.description.replace(...pair);
 if(file===`${lang}/events/arcadian-conquest/index.html`){for(const key of ['description','ogDescription'])if(v[key])v[key]=v[key].replace(...arcadia[lang]);for(const p of v.webPages||[])if(p.description)p.description=p.description.replace(...arcadia[lang]);}
 return v;
}
function text(value,file,kind){
 const lang=file.split('/')[0];let v=value;
 if(file==='ko/database/pet-system/starhorn/index.html')v=v.replaceAll('별의 축복','별빛의 축복');
 if(kind==='identities'){
  if(file==='ko/heroes/undine/index.html')v=v.replace('Undine','운디네 (Undine)');
  if(file===`${lang}/database/pet-system/snowball/index.html`)v=v.replace(roles[lang][1],roles[lang][0]);
  if(file===`${lang}/database/pet-system/dodo/index.html`)v=v.replace(roles[lang][0],roles[lang][1]);
  const rare=petChanges.find(c=>c[1]==='rarity'&&file===`${lang}/database/pet-system/${c[0]}/index.html`);
  // Identity strings contain the kicker before the H1, so attach rarity only there.
  if(rare){const name={snowball:lang==='ko'?'스노우볼':'Snowball',buckler:lang==='ko'?'버클러':'Buckler',hardhead:lang==='ko'?'철두':'Hardhead',shadow:lang==='ko'?'쉐도우':'Shadow'}[rare[0]];assert(v.endsWith(name),'Fixed pet identity suffix');const pos=v.length-name.length;v=v.slice(0,pos)+' · '+rare[3]+v.slice(pos);}
 }
 return v;
}
function forms(values,file){if(!petHub(file))return values;return values.map(f=>{const x=clone(f),model=x.key==='petExp'?growth.expRows:x.key==='petTraining'?growth.trainingRows:null;if(model){if(x.config)x.config.rows=model;else x.rows=model;}return x;});}
function expectedRows(values,file,complete=false){
 const detail=file.match(/^(ko|en|ja|ru|zh-tw)\/database\/pet-system\/(snowball|dodo|buckler|fluffy|hardhead|shadow|starhorn)\/index\.html$/);
 if(detail){const labels={ko:['희귀','에픽','전설'],en:['Rare','Epic','Legendary'],ja:['レア','エピック','レジェンド'],ru:['Редкое','Эпическое','Легендарное'],'zh-tw':['稀有','史詩','傳說']}[detail[1]],next=require('../data/foundation-40/pet-hatching-copy')[detail[1]].eggs;return values.map(r=>r.length===2&&labels.includes(r[0])?[next[labels.indexOf(r[0])],r[1]]:r);}
 if(!petHub(file))return values;
 const lang=file.split('/')[0],exp=new Set(),training=new Set();
 const cumulative=(model,to)=>model.filter(r=>r.to<=to).reduce((n,r)=>n+r.cost,0).toLocaleString('en-US');
 const result=values.map(row=>{
  const next=[...row];if(row.length===5){if(row[0]===(lang==='ko'?'스노우볼':'Snowball'))next[1]=roles[lang][0];if(row[0]===(lang==='ko'?'도도':'Dodo'))next[1]=roles[lang][1];}
  const range=row.length===3&&row[0].match(/^(\d+) → (\d+)$/);
  if(range){const from=Number(range[1]),to=Number(range[2]),model=from>=41?growth.expRows:growth.trainingRows,record=model.find(r=>r.from===from&&r.to===to);assert(record,'Unreviewed growth row');(from>=41?exp:training).add(from);if(/\d/.test(row[1]))assert.equal(Number(row[1].replaceAll(',','')),record.cost,'Existing non-null cost cannot change');return[row[0],record.cost.toLocaleString('en-US'),cumulative(model,to)];}
  if(row.length===2&&row[0]==='4'&&!/\d/.test(row[1]))return['4','85%'];
  return next;
 });
 if(complete){for(const [model,seen]of [[growth.expRows,exp],[growth.trainingRows,training]])for(const r of model)if(!seen.has(r.from))result.push([`${r.from} → ${r.to}`,r.cost.toLocaleString('en-US'),cumulative(model,r.to)]);result.push(['5','100%']);}
 return result;
}
function source(file,old){
 const expected=clone(old);
 if(['data/companions.json','data/expansion-22/database.json'].includes(file)){
  for(const[id,field,from,to]of petChanges){const p=expected.pets.find(p=>p.id===id);assert.equal(p[field],from,'Fixed pet baseline field');p[field]=to;}
  if(file==='data/expansion-22/database.json'){expected.sources.starhornGrowth=growthSource;expected.sources.petHatching=hatchSource;expected.datasets.petExp={source:'starhornGrowth',unit:'EXP',min:1,max:100,rows:growth.expRows};expected.datasets.petTraining={source:'starhornGrowth',unit:'marks',min:0,max:5,rows:growth.trainingRows};}
 }else if(file==='data/expansion-22/manifest.json'){expected.sources.starhornGrowth=growthSource;expected.sources.petHatching=hatchSource;}
 else if(file==='data/expansion-22/ledger.json'){
  const official=require('../data/foundation-40/official-sources-input.json'),duration=official.facts.find(f=>f.id==='arcadia-contest-duration-250600'),entry=expected.entries.find(e=>e.id==='arcadia-rules');
  entry.value=entry.value.replace(...arcadia.ko);entry.sourceURL=duration.sourceURL;entry.version=duration.gameVersion;entry.checked=official.checkedAt;entry.sourceKind='official';entry.factIds=[duration.id];
  entry.conditions='Contest duration: 2 hours from v2.5.600. Other occupation/scoring/reward quantities are historical values from the 2026-01-07 guide; the later patch does not reconfirm them. Check the current in-game event rules.';
  entry.sources=[{url:duration.sourceURL,version:'2.5.600',scope:'2-hour contest duration'},{url:'https://tilesurvivegame.com/en/blog/828',publishedDate:'2026-01-07',version:null,scope:'Historical occupation, scoring and reward rules; current applicability unconfirmed'}];
  for(const [key,model]of [['petExp',growth.expRows],['petTraining',growth.trainingRows]]){
   const old=expected.entries.filter(e=>new RegExp('^'+key+'-\\d+$').test(e.id)),template=old[0];assert(template,'Fixed growth provenance template');
   const updated=model.map(r=>({...clone(template),id:key+'-'+r.to,value:r.cost,level:`${r.from} → ${r.to}`,status:'published'}));let inserted=false;
   expected.entries=expected.entries.flatMap(e=>{if(!new RegExp('^'+key+'-\\d+$').test(e.id))return[e];if(inserted)return[];inserted=true;return updated;});
  }
  for(const e of expected.entries){
   if(/^petExp-\d+$|^petTraining-\d+$|^pet-training-steps$/.test(e.id)){Object.assign(e,{conditions:'Starhorn only; game 2.6.200 explicit rows; field alignment and legacy anchors; no interpolation or cross-pet reuse',sourceURL:growthSource.url,version:growthSource.version,sourceKind:growthSource.kind,checked:'2026-10-09'});if(e.id==='pet-training-steps')e.value=growth.trainingRows.map(r=>({stage:r.to,steps:20,costPerStep:r.stepCost,bonus:r.bonus}));}
   if(e.id==='starhorn-extra-skills')e.conditions='HP unlock unknown; pet stats at training stage 5; training costs scoped separately to Starhorn in game 2.6.200';
   if(/^pet-eggs-(snowball|dodo|buckler|fluffy|hardhead|shadow|starhorn)$/.test(e.id))Object.assign(e,{sourceURL:hatchSource.url,version:hatchSource.version,sourceKind:hatchSource.kind,checked:'2026-10-10',conditions:'Displayed egg probabilities; legacy rare/epic/legendary keys mean normal/rare/precious eggs; null means unlisted, not confirmed zero; preserve display rounding'});
  }
 }
 else return null;
 return expected;
}
function quantity(q,file,d){
 const lang=file.split('/')[0],main=norm(d.querySelector('main')?.textContent||'');
 // The old 100% rounding caveat is replaced by the observed 99.99%/100.01% limits.
 if(q==='100%'&&/\/database\/pet-system\/(snowball|dodo|buckler|fluffy|hardhead|shadow|starhorn)\/index\.html$/.test(file))return main.includes(norm(require('../data/foundation-40/pet-hatching-copy')[lang].note));
 // Arcadia's sole missing standalone3 is the specifically dated siege-duration correction.
 if(q==='3'&&file===`${lang}/events/arcadian-conquest/index.html`)return main.includes(norm(arcadia[lang][1]))&&!!d.querySelector('a[data-official-source="blog-1055"][href="https://tilesurvivegame.com/en/blog/1055"]');
 return false;
}
module.exports={image,metadata,text,forms,expectedRows,source,quantity,deletedDrafts,petHub,growthSource,arcadia,petChanges};
