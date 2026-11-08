'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization'),{enhance}=require('./build-global-locales');
const RootHome = require('./build-root-home');
function rootDocument(_previous, available) {
  return RootHome.compile(L.ROOT,available).html;
}
function build({available=L.registry.locales.filter(l=>l.status==='published').map(l=>l.code),apply=false,preview=false}={}) {
  const stage=path.resolve(L.ROOT,'../global-language-delivery-20261104/staging');
  const groups=L.routeGroups(),plans=[],homes=new Map();
  for(const code of available) {
    if(!L.byCode.has(code))throw Error('Unknown locale: '+code);
    for(const group of groups) {
      const route=group.routes[code];if(!route)throw Error('Missing equivalent route: '+code+'/'+group.id);
      const staged=path.join(stage,route.slice(1),'index.html');
      const file=preview&&!L.existing.has(code)?staged:path.join(L.ROOT,route.slice(1),'index.html');
      if(!fs.existsSync(file))throw Error('Missing public page: '+route);
      const before=fs.readFileSync(file,'utf8'),document=parseHTML(before).document;
      if(!preview&&(document.documentElement.dataset.translationStatus==='preview-unpublished'||/noindex/i.test(document.querySelector('meta[name="robots"]')?.content||'')))throw Error('Unpublishable locale route: '+route);
      const ui=require('../data/i18n/ui/'+code+'.json');
      const body=enhance(document,code,group,available,ui,{preview});
      if(route==='/'+code+'/') homes.set(code,body);
      plans.push({file:preview?staged:file,before,body});
    }
  }
  const rootOutput=RootHome.compile(L.ROOT,available,{homes,preview}), destination=preview?stage:L.ROOT;
  for(const [relative,body] of [...rootOutput.files,['index.html',rootOutput.html]]) {
    const file=path.join(destination,relative);
    plans.push({file,before:fs.existsSync(file)?fs.readFileSync(file,'utf8'):null,body});
  }
  if(apply)for(const p of plans)L.safeWrite(p.file,p.body);
  const result={mode:preview?'private-preview':apply?'apply':'check',locales:available,routes:groups.length*available.length+1,payloads:rootOutput.files.size,changed:plans.filter(p=>p.before!==p.body).length};console.log(JSON.stringify(result));return result;
}
module.exports={rootDocument,build};
if(require.main===module){const add=process.argv.find(x=>x.startsWith('--include='));build({apply:process.argv.includes('--apply')||process.argv.includes('--preview'),preview:process.argv.includes('--preview'),available:add?[...L.existing,...add.slice(10).split(',')]:undefined});}
