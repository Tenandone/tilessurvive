'use strict';
// Search is a derived presentation index. Original records and game models are
// never edited; only explicit canonical route/anchor identities join languages.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization'),S=require('../js/v3-search-core');
const {atlasRoutes}=require('./build-hero-atlas-search');
const ROOT=path.resolve(__dirname,'..');
function collect({root=ROOT}={}){
  const locales=JSON.parse(fs.readFileSync(path.join(root,'data/i18n/locales.json'),'utf8')).locales.map(l=>l.code);
  const groups=L.routeGroups(root),routes=new Map(groups.flatMap(g=>Object.values(g.routes).map(route=>[route,g])));
  const terms=JSON.parse(fs.readFileSync(path.join(root,'data/i18n/client-terms.json'),'utf8'));
  const contextual=JSON.parse(fs.readFileSync(path.join(root,'data/i18n/contextual-terms.json'),'utf8')).entries;
  const inputs={},entities=new Map(),records=[];
  const atlas=atlasRoutes(root);
  const legacyFile=path.join(root,'data/hero-atlas-search-legacy.json');
  const legacy=fs.existsSync(legacyFile)?JSON.parse(fs.readFileSync(legacyFile,'utf8')).groups:{};
  const plain=html=>parseHTML('<div>'+html+'</div>').document.querySelector('div').textContent.replace(/\s+/gu,' ').trim();
  for(const lang of locales){
    const file=path.join(root,'data/search',lang+'.json'),input=JSON.parse(fs.readFileSync(file,'utf8'));inputs[lang]=input;
    assert.equal(input.itemCount,input.items.length,'Source search count '+lang);
    assert.equal(new Set(input.items.map(item=>item.url)).size,input.items.length,'Duplicate source search URL '+lang);
    const pageRows=new Map();
    for(const item of input.items){assert.equal(item.language,lang,'Source locale');assert(!item.search,'Original index must remain independent');const url=new URL(item.url,L.publicOrigin);assert.equal(url.origin,L.publicOrigin);assert(url.pathname.startsWith('/'+lang+'/'));assert(!url.search,'Unexpected indexed query');if(!pageRows.has(url.pathname))pageRows.set(url.pathname,[]);pageRows.get(url.pathname).push({item,url});}
    for(const [route,rows] of pageRows){
      const file=path.resolve(root,'.'+route,'index.html');assert(file.startsWith(path.resolve(root)+path.sep),'Unsafe search route');assert(fs.existsSync(file),'Missing search page '+route);
      const html=fs.readFileSync(file,'utf8'),head=parseHTML((html.match(/<head\b[^>]*>[\s\S]*?<\/head>/i)||[''])[0]).document;
      const canonical=head.querySelector('link[rel="canonical"]')?.getAttribute('href');
      const canonicalPath=canonical?new URL(canonical,L.publicOrigin).pathname:route;
      const group=routes.get(route)||routes.get(canonicalPath);assert(group,'Unmapped canonical search route '+route);
      const h1=plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
      const payload=html.match(/<script\b[^>]*\bdata-building-system-model(?:=[^>]*)?[^>]*>([\s\S]*?)<\/script>/)?.[1];
      const buildings=payload?JSON.parse(payload).buildings:[];
      for(const {item,url} of rows){
        const anchor=decodeURIComponent(url.hash.slice(1));
        if(anchor)assert(new RegExp('\\bid=["\\\']'+anchor.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\\\']').test(html),'Missing search anchor '+item.url);
        const entityId='page:'+group.id+(anchor?'#'+anchor:'');
        const hero=!anchor?atlas.get(canonicalPath)?.hero:null;
        const buildingAnchor=anchor.match(/^building-(\d+)$/),clientIds=hero?(Number.isSafeInteger(hero.clientId)?[{kind:'hero',id:hero.clientId}]:[]):buildingAnchor?buildings.filter(b=>b.id===Number(buildingAnchor[1])).map(b=>({kind:'building',id:b.id})):!anchor&&buildings.length===1?[{kind:'building',id:buildings[0].id}]:[];
        const primaryName=anchor?item.title:(h1||item.title);
        const row={item,lang,entityId,groupId:group.id,primaryName,ownerName:anchor?h1:'',clientIds,hero};records.push(row);
        if(!entities.has(entityId))entities.set(entityId,[]);entities.get(entityId).push(row);
      }
    }
  }
  const aliasesByEntity=new Map();let officialLinks=0;
  function applies(key,rows){
    if(rows.some(r=>r.hero))return false; // Explicit route/client-ID join owns main hero names.
    const refs=terms.provenance[key]?.clientReferences||[],group=rows[0].groupId,id=rows[0].entityId;
    const buildingIds=rows.flatMap(r=>r.clientIds).filter(r=>r.kind==='building').map(r=>r.id);
    if(buildingIds.length)return refs.some(r=>r.table==='building_type'&&buildingIds.includes(Number(r.recordKey.split(':').at(-1))));
    if(/^heroes\/[^/]+\/$/.test(group))return refs.some(r=>id.includes('#character-skill-')?r.table==='survivor_skill_type'&&r.sourceId?.startsWith('survivor_'):!id.includes('#')&&r.table==='survivor');
    if(/^database\/pet-system\/[^/]+\/$/.test(group))return refs.some(r=>id.includes('#')?r.table==='survivor_skill_type'&&r.sourceId?.startsWith('pet_'):['pet_base','pet_shape'].includes(r.table));
    if(/^behemoths\/[^/]+\/$/.test(group))return refs.some(r=>r.table==='behemoth_base');
    return terms.provenance[key]?.publicReferences?.includes('en/'+group+'index.html')||false;
  }
  for(const [id,rows] of entities){
    const aliases=new Map();
    function add(value,language,source,termKey){if(typeof value!=='string'||!value.trim())return;value=value.trim();const key=language+'|'+S.normalize(value),prior=aliases.get(key),rank={'retained-client':4,'official-announcement':3,'retained-english-fallback':2,'official-english-fallback':2};if(!prior||(rank[source]||0)>(rank[prior.source]||0)||source==='retained-client')aliases.set(key,{value,language,source,...(termKey?{termKey}:{})});}
    for(const row of rows){add(row.primaryName,row.lang,'site-label');add(row.item.aliases,row.lang,'site-alias');}
    // Preserve historical site spellings by explicit route. They remain site
    // aliases, even when the new client layer intentionally falls back to English.
    if(!id.includes('#'))for(const alias of legacy[rows[0].groupId]?.mainAliases||[])add(alias.value,alias.language,'site-alias');
    const hero=rows.find(r=>r.hero)?.hero;
    if(hero){
      assert(rows.every(r=>r.hero?.id===hero.id&&r.hero?.clientId===hero.clientId),'Atlas route group must identify one reviewed identity');
      for(const [language,name]of Object.entries(hero.names))if(name.value){const source=hero.catalogKind==='official-introduction'?(name.status==='client-official'?'retained-client':name.status==='english-fallback'?'official-english-fallback':'official-announcement'):(name.status==='client-official'?'retained-client':'retained-english-fallback');add(name.value,language,source,hero.nameKey);}
      officialLinks++;
    }
    // Names alone never merge entities. Two retained language labels must agree
    // before official synonyms are attached to this existing route/anchor group.
    for(const [key,names] of Object.entries(terms.terms)){
      if(!applies(key,rows))continue;
      const matches=new Set(rows.filter(r=>typeof names[r.lang]==='string'&&S.normalize(names[r.lang])===S.normalize(r.primaryName)).map(r=>r.lang));
      if(matches.size<2||(!matches.has('en')&&!matches.has('ko')))continue;
      for(const [language,value] of Object.entries(names))if(value&&terms.locales[language]?.cohort)add(value,language,'retained-client',key);
      officialLinks++;
    }
    // Explicit page-scoped repairs carry their own retained/authored provenance.
    // They must never turn an old shared skill alias into another hero's name.
    for(const entry of contextual){
      if(hero||entry.groupId!==rows[0].groupId||!rows.some(r=>entry.names[r.lang]?.value===r.primaryName))continue;
      for(const [language,name] of Object.entries(entry.names))if(name.provenance==='retained-client'&&terms.locales[language]?.cohort)add(name.value,language,'retained-client',entry.clientKey);
      officialLinks++;
    }
    aliasesByEntity.set(id,[...aliases.values()].sort((a,b)=>a.language.localeCompare(b.language)||a.value.localeCompare(b.value)));
  }
  const shards={};
  for(const lang of locales){const byUrl=new Map(records.filter(r=>r.lang===lang).map(r=>[r.item.url,r]));const items=inputs[lang].items.map(item=>{const row=byUrl.get(item.url);assert(row);return {...item,search:{entityId:row.entityId,category:S.category(item.type),primaryName:row.primaryName,aliases:aliasesByEntity.get(row.entityId),contextNames:[...new Set([...(row.ownerName?(legacy[row.groupId]?.contextByEntity?.[row.entityId]||legacy[row.groupId]?.contextNames||[]):[]),...entities.get(row.entityId).map(r=>r.ownerName).filter(Boolean)])],clientIds:row.clientIds,...(row.hero?{hero:{identityId:row.hero.identityId,formId:row.hero.id,clientId:row.hero.clientId,nameKey:row.hero.nameKey,nameStatus:row.hero.names[lang]?.status||'unavailable'}}:{})}};});shards[lang]={schemaVersion:3,language:lang,itemCount:items.length,items};assert.deepEqual(items.map(({search,...original})=>original),inputs[lang].items,'All original records and order preserved '+lang);}
  return {shards,summary:{locales:locales.length,originalRecords:records.length,outputRecords:Object.values(shards).reduce((n,s)=>n+s.items.length,0),entities:entities.size,officialTermAssociations:officialLinks,sourceGameVersion:terms.gameVersion,sourceGameBuild:terms.gameBuild,sourceObservedDate:terms.observedDate,counts:Object.fromEntries(locales.map(l=>[l,shards[l].itemCount]))}};
}
function build(options={}){const result=collect(options),root=options.root||ROOT;for(const [lang,shard] of Object.entries(result.shards)){const file=path.join(root,'data/v3-search',lang+'.json'),text=JSON.stringify(shard)+'\n';fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==text)fs.writeFileSync(file,text);}console.log(JSON.stringify(result.summary));return result;}
module.exports={collect,build};if(require.main===module)build();
