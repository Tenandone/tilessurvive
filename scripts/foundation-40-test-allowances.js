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
const heroSkillAssets=require('../data/foundation-40/hero-skill-assets-41.json').assets;
const heroSkillRoute=(file,a)=>['ko','en','ja','ru','zh-tw'].some(l=>file===`${l}/heroes/${l==='en'&&a.entity==='tarzan'?'tazan':a.entity}/index.html`);
function reviewedHeroSkillImages(document,file){
 for(const a of heroSkillAssets.filter(a=>heroSkillRoute(file,a))){
  for(const selector of [`#${a.panelId} summary > img`,`[data-skill-target="${a.panelId}"] > img`]){
   const nodes=document.querySelectorAll(selector);assert.equal(nodes.length,1,'Exact reviewed skill image target');const img=nodes[0];
   assert.equal(img.getAttribute('src'),a.previousSrc,'Immutable pre-overlay skill source');
   for(const [k,v]of Object.entries({src:a.src,width:'128',height:'128',loading:'lazy',decoding:'async','data-game-41-skill-art':a.id}))img.setAttribute(k,v);
  }
 }
 return document;
}
function image(file,src){
 const behemoth=require('./build-behemoth-assets-41'),art=require('../data/foundation-40/behemoth-assets-41.json');
 if(behemoth.langs.some(l=>behemoth.routes.some(r=>file===l+'/'+r))){const a=art.assets.find(a=>a.previousSrc===src);if(a)return a.src;}
 const skill=heroSkillAssets.find(a=>heroSkillRoute(file,a)&&a.previousSrc===src);if(skill)return skill.src;
 const portrait=require('../data/foundation-40/hero-portrait-assets-41.json').assets.find(a=>new RegExp('/heroes/'+(file.startsWith('en/')&&a.entity==='tarzan'?'tazan':a.entity)+'/index\\.html$').test(file));
 if(portrait&&src===(portrait.entity==='knotty'?'/img/heroes/knotty-game.webp':'/img/heroes/'+portrait.entity+'.webp'))return portrait.src;
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
 return require('./build-client-truth-52').sourceProjection(file,expected);
}
function quantity(q,file,d){
 const lang=file.split('/')[0],main=norm(d.querySelector('main')?.textContent||'');
 // The old 100% rounding caveat is replaced by the observed 99.99%/100.01% limits.
 if(q==='100%'&&/\/database\/pet-system\/(snowball|dodo|buckler|fluffy|hardhead|shadow|starhorn)\/index\.html$/.test(file))return main.includes(norm(require('../data/foundation-40/pet-hatching-copy')[lang].note));
 // Arcadia's sole missing standalone3 is the specifically dated siege-duration correction.
 if(q==='3'&&file===`${lang}/events/arcadian-conquest/index.html`)return main.includes(norm(arcadia[lang][1]))&&!!d.querySelector('a[data-official-source="blog-1055"][href="https://tilesurvivegame.com/en/blog/1055"]');
 return false;
}
const officialLabels=require('./lib/official-locales-40');
function identity(node,file){
 const copy=node.cloneNode(true),lang=file.split('/')[0],match=file.match(/\/database\/pet-system\/([^/]+)\/index\.html$/),kicker=copy.querySelector('.ts3-character-kicker span');
 if(match&&kicker){const id=match[1];if(id==='snowball')kicker.textContent=kicker.textContent.replace(roles[lang][1],roles[lang][0]);if(id==='dodo')kicker.textContent=kicker.textContent.replace(roles[lang][0],roles[lang][1]);const rarity=petChanges.find(c=>c[0]===id&&c[1]==='rarity');if(rarity&&!kicker.textContent.endsWith(' · '+rarity[3]))kicker.textContent+=' · '+rarity[3];}
 const entry=officialLabels.entries(lang).find(e=>e.route==='/'+file.replace(/index\.html$/,''));
 if(entry){
  const visit=n=>{if(n.nodeType===3){n.textContent=officialLabels.replaceLabels(n.textContent,entry.pairs);return;}if(n.nodeType!==1||n.matches('.ts3-character-kicker'))return;n.normalize();for(const child of n.childNodes)visit(child);};visit(copy);
  const h1=copy.querySelector('h1');if(h1)h1.textContent=entry.entity.names[lang];
 }
 return norm(copy.textContent);
}
const identityCache=new Map();
function identitiesFromGit(values,file,release){
 if(!values.length)return[];const key=release+':'+file;
 if(!identityCache.has(key)){
  const {execFileSync}=require('child_process'),path=require('path'),{parseHTML}=require('linkedom');
  const d=parseHTML(execFileSync('git',['show',key],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',maxBuffer:5e6})).document;
  const nodes=[...d.querySelectorAll('main .ts3-character-identity')];assert.deepEqual(nodes.map(n=>norm(n.textContent)),values,'Identity snapshot must still match immutable Git HTML');identityCache.set(key,nodes.map(n=>identity(n,file)));
 }
 return identityCache.get(key);
}
function petExpScope(file){
 const lang=file.split('/')[0],name=officialLabels.data.pets.find(p=>p.id==='starhorn').names[lang];
 return {ko:`게임 2.6.200 · 1→100레벨. 기본 선택은 ${name}입니다. 선택한 펫의 경험치를 현재 레벨부터 목표 레벨까지 합산합니다. 아래 훈련 비용은 ${name} 전용입니다.`,en:`Game 2.6.200 · Levels 1→100. ${name} is selected by default. Adds the selected pet’s EXP from the current level to the target. Training costs below apply only to ${name}.`,ja:`ゲーム2.6.200・レベル1→100。初期選択は${name}です。選択したペットの現在レベルから目標レベルまでの経験値を合算します。下の訓練費用は${name}専用です。`,ru:`Версия игры 2.6.200 · Уровни 1→100. По умолчанию выбран ${name}. Сумма опыта выбранного питомца от текущего до целевого уровня. Стоимость тренировки ниже относится только к ${name}.`,'zh-tw':`遊戲2.6.200・1→100級。預設選擇${name}。加總所選寵物從目前等級到目標等級所需的經驗。下方訓練費用僅適用於${name}。`}[lang];
}
function petExpRows(file){if(!petHub(file))return[];const pets=require('../data/foundation-40/pet-exp-profiles.json').pets,groups=[];for(const pet of pets)if(!groups.some(g=>JSON.stringify(g.expRows)===JSON.stringify(pet.expRows)))groups.push(pet);assert.equal(groups.length,3);return Array.from({length:99},(_,i)=>[`${i+1} → ${i+2}`,...groups.map(g=>g.expRows[i].cost.toLocaleString('en-US'))]);}
function localized(value,file,linked=false){
 const lang=file.split('/')[0];
 const pairs=[...officialLabels.pagePairs(file),...(linked?officialLabels.entries(lang).flatMap(e=>e.namePairs):[])];
 if(typeof value==='string')return officialLabels.replaceLabels(value,pairs);
 if(Array.isArray(value))return value.map(v=>localized(v,file,linked));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,localized(v,file,linked)]));
 return value;
}
function reviewedRows(values,file,complete){
 const rows=localized(expectedRows(values,file,complete),file);
 if(!petHub(file))return rows;
 // Only the seven linked pet names in the existing acquisition table are global labels.
 // Unlinked names in unrelated prose (for example Season 1 promotion conditions) stay byte-exact.
 const lang=file.split('/')[0],pairs=officialLabels.entries(lang).filter(e=>e.route.includes('/database/pet-system/')).flatMap(e=>e.namePairs);
 return rows.map(row=>row.length===5?[officialLabels.replaceLabels(row[0],pairs),...row.slice(1)]:row);
}
function reviewedScript(file,baseline){
 if(file==='js/data-workbench-30.js'){
  // The deployed table-condition patch changed only the localized copy prefix.
  const fixed=require('child_process').execFileSync('git',['show','eff8b08fcc9d111f7ce6beae4de488156111ca6f:'+file],{cwd:require('path').resolve(__dirname,'..'),encoding:'utf8'});
  const start='  function numeric(raw) {';
  assert(baseline.includes(start)&&fixed.includes(start),'Immutable calculator boundary');
  assert.equal(fixed.slice(fixed.indexOf(start)),baseline.slice(baseline.indexOf(start)),'All original calculator logic is unchanged');
  return fixed;
 }
 const edits={
  'js/platform-search.js':[['i.title + " " + i.description + " " + i.type + " " + i.url','i.title + " " + i.description + " " + (i.aliases || \'\') + " " + i.type + " " + i.url'],['fetch("/data/search-index.json")','fetch("/data/search-index.json", { cache: "no-cache" })']],
  'js/platform.js':[['i.textContent.normalize("NFKC").toLocaleLowerCase(lang).includes(q)','(i.textContent + \' \' + (i.dataset.searchAliases || \'\')).normalize("NFKC").toLocaleLowerCase(lang).includes(q)']],
  'js/site-search.js':[['${item.title} ${item.description} ${item.type} ${item.url}','${item.title} ${item.description} ${item.aliases || \'\'} ${item.type} ${item.url}']],
  'js/product-30.js':[["fetch('/data/search-index.json')","fetch('/data/search-index.json',{cache:'no-cache'})"],["i.title+' '+i.description+' '+i.url","i.title+' '+i.description+' '+(i.aliases||'')+' '+i.url"]]
 };
 const pairs=edits[file];if(!pairs)return null;
 for(const pair of pairs){assert.equal(baseline.split(pair[0]).length-1,1,'Exact immutable search expression: '+file);baseline=baseline.replace(...pair);}
 return baseline;
}
module.exports={image,reviewedHeroSkillImages,metadata:(v,f)=>localized(metadata(v,f),f),text:(v,f,k)=>localized(text(v,f,k),f),forms,expectedRows:reviewedRows,source,quantity,deletedDrafts,petHub,growthSource,arcadia,petChanges,localized,identity,identitiesFromGit,petExpScope,petExpRows,reviewedScript};
