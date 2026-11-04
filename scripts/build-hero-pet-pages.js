'use strict';
// One shared relation model; existing URLs and calculator payloads are retained.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom'),M=require('../data/hero-pet-relations.json'),cards=require('./hero-guide-pet-cards');
const ROOT=path.resolve(__dirname,'..'),locales=require('../data/i18n/locales.json').locales.map(x=>x.code);
const C=require('../data/hero-pet-copy.json');
function validate(data=M){
 require('./build-hero-pet-relations').validate(data);
 const reference=C.locales.en;assert(reference,'Missing English relation copy');
 for(const l of locales){assert(C.locales[l],'Missing relation copy '+l);for(const group of ['ui','reasons','conditions','cautions']){
  assert.deepEqual(Object.keys(C.locales[l][group]).sort(),Object.keys(reference[group]).sort(),l+' '+group+' keys');
  for(const [k,v]of Object.entries(reference[group])){const translated=C.locales[l][group][k];assert(typeof translated==='string'&&translated.trim(),l+':'+k);if(group!=='ui')assert.deepEqual(translated.match(/\d+%?/g)||[],v.match(/\d+%?/g)||[],l+':'+k+' numeric conditions');}
 }
 for(const r of data.rules){assert(C.locales[l].reasons[r.reasonKey],r.reasonKey);for(const k of r.conditionKeys)assert(C.locales[l].conditions[k],k);for(const k of r.cautionKeys)assert(C.locales[l].cautions[k],k);}
 }
 cards.validate();for(const l of locales)assert(cards.copy(l),'Missing guide copy '+l);return true;
}
const renderHero=cards.renderHero,renderPets=cards.renderPets;
function strip(html){return html.replace(/<!-- TS_HERO_PET_BEGIN -->[\s\S]*?<!-- TS_HERO_PET_END -->/g,'').replace(/<!-- TS_HERO_PET_ASSETS_BEGIN -->[\s\S]*?<!-- TS_HERO_PET_ASSETS_END -->/g,'');}
function asset(){const bytes=fs.readFileSync(path.join(ROOT,'css/hero-pet.css'));return `<link data-hero-pet-owned="assets" rel="stylesheet" href="/css/hero-pet.css?v=${crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)}">`;}
function project(html,l,heroId){
 assert(locales.includes(l));const d=parseHTML(strip(html)).document;
 if(heroId){const panel=d.querySelector('[data-hero-atlas-owned="profile"]');assert(panel,'Missing hero profile');panel.querySelectorAll('[data-hero-pet-owned="hero"]').forEach(n=>n.remove());panel.insertAdjacentHTML('beforeend',renderHero(heroId,l));}
 else{const route=new URL(d.querySelector('link[rel="canonical"]').href).pathname,match=route.match(/^\/[^/]+\/database\/pet-system\/(?:([^/]+)\/)?$/);if(!match)return html;const main=d.querySelector('main');assert(main);main.insertAdjacentHTML('beforeend','<!-- TS_HERO_PET_BEGIN -->'+renderPets(l,match[1])+'<!-- TS_HERO_PET_END -->');}
 if(!d.querySelector('link[href^="/css/hero-pet.css"]'))d.head.insertAdjacentHTML('beforeend','<!-- TS_HERO_PET_ASSETS_BEGIN -->'+asset()+'<!-- TS_HERO_PET_ASSETS_END -->');
 return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
}
function build(){validate();let changed=0;const outputs=[];for(const l of locales){for(const id of [null,...M.pets.map(p=>p.id)]){const file=path.join(ROOT,l,'database/pet-system',id||'','index.html'),before=fs.readFileSync(file,'utf8'),after=project(before,l);assert.equal(project(after,l),after,'Non-idempotent pet projection');outputs.push({file,before,after});}}
 for(const x of outputs)if(x.before!==x.after){fs.writeFileSync(x.file,x.after);changed++;}const result={locales:locales.length,petPages:outputs.length,changed,heroPages:'owned by build-hero-atlas'};console.log(JSON.stringify(result));return result;}
function validateOwnership(html,l){const d=parseHTML(html).document,owners=[...d.querySelectorAll('[data-hero-pet-owned="pets"]')];if(!owners.length){assert(!html.includes('<!-- TS_HERO_PET_BEGIN -->'),'Missing reviewed pet content '+l);return;}assert.equal(owners.length,1,'Expected exactly one reviewed pet content block '+l);assert(locales.includes(l),'Unsupported pet content locale');const canonical=[...d.querySelectorAll('link[rel="canonical"]')];assert.equal(canonical.length,1,'Expected one pet canonical');const url=new URL(canonical[0].getAttribute('href')),match=url.pathname.match(/^\/([^/]+)\/database\/pet-system\/(?:([^/]+)\/)?$/);assert(match&&match[1]===l,'Pet owner on unsupported route '+url.pathname);const expected=parseHTML(renderPets(l,match[2])).document.querySelector('[data-hero-pet-owned="pets"]');assert(expected);assert.equal(owners[0].outerHTML,expected.outerHTML,'Unreviewed pet content '+l);}
module.exports={validate,project,renderHero,renderPets,strip,asset,build,validateOwnership};if(require.main===module)build();
