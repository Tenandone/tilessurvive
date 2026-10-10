'use strict';
// Canonical source corrections run before legacy generators and after all page owners.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..');
const names=['growth','heroes','buildings'];
const owners=()=>names.map(name=>require('./build-client-'+name+'-52'));
function updateDatabase(database){let result=structuredClone(database);for(const name of ['growth','heroes'])result=require('./build-client-'+name+'-52').updateDatasets(result);return result;}
function sourceProjection(file,input){
 if(file==='data/expansion-22/database.json')return updateDatabase(input);
 const out=structuredClone(input),db=updateDatabase(require('../data/expansion-22/database.json'));
 if(file==='data/expansion-22/manifest.json'){
  for(const key of ['gear','exclusive','skillBook']){const sourceId=db.datasets[key].source;out.sources[sourceId]=structuredClone(db.sources[sourceId]);}return out;
 }
 if(file==='data/expansion-22/ledger.json'){
  out.conflicts=structuredClone(db.conflicts);
  for(const entry of out.entries){const match=entry.id.match(/^(gear|exclusive|skillBook)-(\d+)$/);if(!match&&entry.id!=='scrap-exp')continue;
   const key=match?match[1]:'gear',dataset=db.datasets[key],source=db.sources[dataset.source];
   if(match){const row=dataset.rows.find(r=>r.to===Number(match[2]));assert(row);entry.value=row.cost;entry.unit=dataset.unit;entry.level=`${row.from} → ${row.to}`;entry.status='published';entry.conditions=key==='gear'?'Client 2.6.200; current-level EXP for the next level; 18 retained equipment profiles share this curve; Lv.1–80.':'Client 2.6.200 / build1512; destination-level fragment cost; 19 identified exclusive gears; Lv.1–15; activation10 is separate.';}
   if(match&&key==='skillBook')entry.conditions='Client 2.6.200 / build1512; destination-level skill-book cost; 82 identified published hero skill profiles; Lv.1–40; item201725.';
   if(Array.isArray(entry.pages)){const en=entry.pages.find(p=>p.includes('/en/'));if(en&&!entry.pages.includes(en.replace('/en/','/de/')))entry.pages.push(en.replace('/en/','/de/'));}
   Object.assign(entry,{sourceURL:source.url,version:source.version,sourceKind:source.kind,checked:'2026-10-10'});
  }return out;
 }return out;
}
function writeJSON(file,value){const full=path.join(root,file),next=JSON.stringify(value,null,2)+'\n';if(fs.readFileSync(full,'utf8')!==next)fs.writeFileSync(full,next);}
function updateSources(){for(const file of ['data/expansion-22/database.json','data/expansion-22/manifest.json','data/expansion-22/ledger.json'])writeJSON(file,sourceProjection(file,JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))));return{canonicalClientSources:3};}
function pages(){return [...new Set([...owners().flatMap(owner=>owner.pages),'ru/tools/index.html'])];}
function project(html,file){let after=html;for(const owner of owners())if(owner.pages.includes(file))after=owner.project(after,file);const d=parseHTML(after).document;if(file==='ru/tools/index.html'){const links=[...d.querySelectorAll('.ts3-catalog-data a')].filter(a=>a.getAttribute('href')==='/ru/database/skill-book/#ts3-data-table-0');assert(links.length>0);for(const a of links){const n=a.nextElementSibling;assert(['39 строк','40 строк'].includes(n.textContent));n.textContent='40 строк';}}d.documentElement.setAttribute('data-client-truth-52','2.6.200');return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';}
function build(){updateSources();let changed=0;const files=pages();for(const file of files){const full=path.join(root,file),before=fs.readFileSync(full,'utf8'),after=project(before,file);assert.equal(project(after,file),after,'Client source projection is idempotent: '+file);if(after!==before){fs.writeFileSync(full,after);changed++;}}const result={clientSourceVersion:'2.6.200',pages:files.length,changed};console.log(JSON.stringify(result));return result;}
module.exports={updateDatabase,sourceProjection,updateSources,pages,project,build};
if(require.main===module){if(process.argv.includes('--sources'))console.log(JSON.stringify(updateSources()));else build();}
