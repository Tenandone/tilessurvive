'use strict';
// Test-only allowances for exact additive 5.0 content and display localisation.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm'),cp=require('child_process');
const {parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),baseline='5c5958b3d1a9c42d1ed33abe79e3fbd25b976cbe';
function alternates(old){
 if(old.length===0)return [];// Legacy noindex aliases intentionally have no language graph.
 const en=old.find(([lang])=>lang==='en');assert(en,'Baseline English alternate required');
 return [...old.filter(([lang])=>lang!=='de'),['de',en[1].replace('/en/','/de/')]].sort();
}
function speedupPreserved(before,after){
 // The complete implementation from numberValue onwards must remain byte-equal,
 // apart from the three specifically reviewed Number.toLocaleString arguments.
 const normal=s=>s.replace(/\r\n/g,'\n').replaceAll(".toLocaleString(getLang()==='de'?'de-DE':undefined)",'.toLocaleString()').replaceAll(".toLocaleString(getLang()==='de'?'de-DE':undefined,{maximumFractionDigits:2})",'.toLocaleString(undefined,{maximumFractionDigits:2})');
 const tail=s=>normal(s).slice(normal(s).indexOf('function numberValue'));
 assert(before.includes('function numberValue')&&after.includes('function numberValue'));
 assert.equal(tail(after),tail(before),'Only explicit locale display may differ in speedup arithmetic/init/reset');
 function run(code,lang,values){const nodes={};for(const id of ['speedupDays','speedupHours','speedupMinutes','speedupTotalMinutes','speedupTotalHours','speedupBreakdown','speedupNotice','speedupCalculate','speedupReset'])nodes[id]={value:'',textContent:'',addEventListener(){}};
  ['speedupDays','speedupHours','speedupMinutes'].forEach((id,i)=>nodes[id].value=String(values[i]));
  const document={readyState:'complete',documentElement:{lang,getAttribute:()=>lang},getElementById:id=>nodes[id],querySelector:()=>({})};
  vm.runInNewContext(code,{document},{timeout:1000});return Object.fromEntries(['speedupTotalMinutes','speedupTotalHours','speedupBreakdown','speedupNotice'].map(id=>[id,nodes[id].textContent]));}
 const cases=[[0,0,0],[1,2,3],[2,25,90],['','',''],[-1,-5,-2],['bad',0,3],[1.9,2.8,3.7],[99999,12,59],[Infinity,NaN,5]];
 for(const lang of ['ko','en','ja','ru','zh-tw'])for(const values of cases)assert.deepEqual(run(after,lang,values),run(before,lang,values),'Original speedup output '+lang+' '+values);
 const de=run(after,'de',[1,2,3]);assert.equal(de.speedupTotalMinutes,'1.563');assert.equal(de.speedupTotalHours,'26,05');assert.equal(de.speedupBreakdown,'1T 2Std. 3Min.');return true;
}
function databasePreserved(before,after){
 const display="   const displayLocale=document.documentElement.lang==='de'?'de':undefined;\n";
 const a=after.replaceAll('\r\n','\n');assert.equal(a.split(display).length-1,1);assert.equal(a.split('.toLocaleString(displayLocale)').length-1,2);
 assert.equal(a.replace(display,'').replaceAll('.toLocaleString(displayLocale)','.toLocaleString()'),before.replaceAll('\r\n','\n'),'Only two German display formatters added; all arithmetic and guards byte-identical');return true;
}
function expectedSitemapURLs(){
 const before=cp.execFileSync('git',['show',baseline+':sitemap.xml'],{cwd:root,encoding:'utf8'}),urls=[...before.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
 const de=urls.filter(u=>u.startsWith('https://tilessurvive.net/en/')).map(u=>u.replace('/en/','/de/'));
 const guides=require('./build-editorial-50').guides.flatMap(g=>['ko','en','ja','ru','zh-tw','de'].map(l=>`https://tilessurvive.net/${l}/guides/${g.id}/`));
 const calendars=['ko','en','ja','ru','zh-tw','de'].map(l=>`https://tilessurvive.net/${l}/events/calendar/`);
 return [...new Set([...urls,...de,...guides,...calendars])].sort();
}
function reviewedTables(doc,lang,route){
 const G=require('./build-growth-50'),model=require('../data/product-50/growth-gear.json'),set=new Set();
 function exact(selector,expected){const nodes=[...doc.querySelectorAll(selector)];assert.equal(nodes.length,1,route+' exact new block count');const e=parseHTML(expected).document.querySelector(selector);assert(e);assert.equal(nodes[0].outerHTML,e.outerHTML,route+' exact added block');nodes[0].querySelectorAll('table').forEach(t=>set.add(t));}
 if(doc.querySelector('[data-pet-skill-levels]')){
  const data=require('../data/pet-skill-levels.json'),pet=data.pets.find(p=>route===`/${lang}/database/pet-system/${p.id}/`);assert(pet,'Unapproved pet skill table route');
  exact('[data-pet-skill-levels]',require('./build-pet-skill-levels').renderSection(pet,lang,data));
 }
 if(doc.querySelector('[data-growth-50]')){const hero=model.heroes.find(h=>'/'+G.heroRoute(lang,h.id).replace(/index\.html$/,'')===route);assert(hero||route===`/${lang}/database/exclusive-gear/`,'Unapproved growth route');exact('[data-growth-50]',G.render(lang,hero));}
 if(doc.querySelector('[data-growth-research-50]')){assert.equal(route,`/${lang}/buildings/lab/`);exact('[data-growth-research-50]',G.renderResearch(lang));}
 if(doc.querySelector('[data-editorial-50="events"]')){
  assert.equal(route,`/${lang}/events/`);assert.notEqual(lang,'de','German has no historical table baseline');
  const source=cp.execFileSync('git',['show',baseline+':'+lang+'/events/index.html'],{cwd:root,encoding:'utf8'});
  exact('[data-editorial-50="events"]',require('./build-editorial-50').applyHub(source,lang,'events'));
 }
 return set;
}
module.exports={alternates,speedupPreserved,databasePreserved,expectedSitemapURLs,reviewedTables};
