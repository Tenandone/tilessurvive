'use strict';
// Compare every retained canonical page with the fixed production commit.
// This is read-only; translation inputs and game data are never rewritten.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const L=require('./lib/global-localization'),{inspectPair}=require('./build-global-release');
const baseline='edbac42bb41ba4289c24caa5635e388f1cd80e53';
const delivery=path.resolve(L.ROOT,'../global-language-delivery-20261104');
const preview=process.argv.includes('--preview'),target=preview?path.join(delivery,'staging'):L.ROOT;
const report={baseline,environment:preview?'private-preview':'local-release',checkedAt:new Date().toISOString(),locales:{},errors:[]};
for(const code of L.existing){
 const counts={pages:0,immutableNumericBooleanNullValues:0,executablePrograms:0};
 for(const group of L.routeGroups()){
  const route=group.routes[code],file=route.slice(1)+'index.html';
  try {
   const source=cp.execFileSync('git',['show',baseline+':'+file],{cwd:L.ROOT,encoding:'utf8',maxBuffer:10e6});
   const current=fs.readFileSync(path.join(target,file),'utf8');
   const stats=inspectPair(source,current,{locale:code,route,sourceLocale:code});
   counts.pages++;counts.immutableNumericBooleanNullValues+=stats.scalars;counts.executablePrograms+=stats.programs;
  } catch(error){report.errors.push({route,error:error.message});}
 }
 report.locales[code]=counts;
}
report.pass=report.errors.length===0;
fs.writeFileSync(path.join(delivery,'existing-preservation-'+(preview?'preview':'release')+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,locales:report.locales,errors:report.errors}));
if(!report.pass)process.exitCode=1;
