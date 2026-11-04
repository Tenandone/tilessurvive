'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization'),{enhance}=require('./build-global-locales');
function rootDocument(source,available) {
  const d=parseHTML(source).document;
  for(const script of d.querySelectorAll('script:not([src])'))if(script.textContent.includes('window.TS_ROOT_LANG'))script.remove();
  for(const script of d.querySelectorAll('script[src^="/js/site-locales.js"],script[src^="/js/root-language.js"]'))script.remove();
  for(const link of d.querySelectorAll('link[rel="alternate"][hreflang]'))link.remove();
  const grid=d.querySelector('.lang-grid');grid.replaceChildren();const routes={};
  for(const code of available) {
    const locale=L.byCode.get(code);routes[code]='/'+code+'/';
    const link=d.createElement('link');link.rel='alternate';link.hreflang=locale.hreflang;link.href=L.publicOrigin+routes[code];d.head.append(link);
    const a=d.createElement('a');a.className='lang-btn';a.href=routes[code];a.lang=locale.htmlLang;a.setAttribute('hreflang',locale.hreflang);a.dataset.rootLocale=code;a.textContent=locale.nativeName;grid.append(a);
  }
  const fallback=d.createElement('link');fallback.rel='alternate';fallback.hreflang='x-default';fallback.href=L.publicOrigin+'/';d.head.append(fallback);
  L.jsonScript(d,'ts-root-routes',routes);
  for(const name of ['site-locales','root-language']) {
    const script=d.createElement('script');script.defer=true;script.src='/js/'+name+'.js?v='+L.digest(fs.readFileSync(path.join(L.ROOT,'js',name+'.js'))).slice(0,12);d.head.append(script);
  }
  return ('<!doctype html>\n'+d.documentElement.outerHTML+'\n').replace(/[\t ]+$/gm,'');
}
function build({available=L.registry.locales.filter(l=>l.status==='published').map(l=>l.code),apply=false,preview=false}={}) {
  const stage=path.resolve(L.ROOT,'../global-language-delivery-20261104/staging');
  const groups=L.routeGroups(),plans=[];
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
      plans.push({file:preview?staged:file,before,body});
    }
  }
  const file=path.join(L.ROOT,'index.html'),before=fs.readFileSync(file,'utf8');let body=rootDocument(before,available);
  if(preview)body=body.replace(/(<meta name="robots" content=")[^"]*/, '$1noindex,nofollow');
  plans.push({file:preview?path.join(stage,'index.html'):file,before,body});
  if(apply)for(const p of plans)L.safeWrite(p.file,p.body);
  const result={mode:preview?'private-preview':apply?'apply':'check',locales:available,routes:plans.length,changed:plans.filter(p=>p.before!==p.body).length};console.log(JSON.stringify(result));return result;
}
module.exports={rootDocument,build};
if(require.main===module){const add=process.argv.find(x=>x.startsWith('--include='));build({apply:process.argv.includes('--apply')||process.argv.includes('--preview'),preview:process.argv.includes('--preview'),available:add?[...L.existing,...add.slice(10).split(',')]:undefined});}
