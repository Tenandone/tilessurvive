'use strict';
// Preserve legacy redirect documents while invalidating changed shared JS.
const fs=require('node:fs'),path=require('node:path');
const L=require('./lib/global-localization');
function refresh(source){
 return source.replace(/(<script\b[^>]*\bsrc=["'])(\/js\/[^"']+)(["'])/gi,(_,prefix,raw,quote)=>{
   const url=new URL(raw,L.publicOrigin),file=path.join(L.ROOT,url.pathname);
   if(!url.pathname.endsWith('.js')||!fs.existsSync(file))return prefix+raw+quote;
   url.searchParams.set('v',L.digest(fs.readFileSync(file)).slice(0,12));
   return prefix+url.pathname+url.search+url.hash+quote;
 });
}
function legacyPlans(excluded=new Set()){
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isSymbolicLink()?[]:e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);
 const plans=[];
 for(const code of L.existing)for(const file of walk(path.join(L.ROOT,code))){
   if(excluded.has(file))continue;
   const before=fs.readFileSync(file,'utf8'),body=refresh(before);
   if(body!==before)plans.push({file,body});
 }
 return plans;
}
module.exports={refresh,legacyPlans};
if(require.main===module){const plans=legacyPlans();if(process.argv.includes('--apply'))for(const p of plans)L.safeWrite(p.file,p.body);console.log(JSON.stringify({mode:process.argv.includes('--apply')?'local-apply':'check',changed:plans.length,files:plans.map(p=>path.relative(L.ROOT,p.file))}));}
