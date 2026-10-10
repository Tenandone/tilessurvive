'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const data=require('../data/foundation-40/arms-race-hero-rules-41.json'),copy=require('../data/foundation-40/arms-race-hero-rules-copy');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw'];
const marker='data-arms-hero-rules-41',anchor='hero-growth-points-heading';
const expected=[['legendary-fragment',9000],['epic-fragment',1000],['rare-fragment',150],['skill-manual',857],['package-diamonds',60]];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll('\u00a0','&#160;');
function keys(value,names){assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),[...names].sort());}
function validate(model){
 keys(model,['schemaVersion','gameVersion','observedAt','competitionBracket','rules']);
 assert.equal(model.schemaVersion,1);assert.equal(model.gameVersion,'2.6.200');assert.equal(model.observedAt,'2026-10-10');
 keys(model.competitionBracket,['min','max']);assert.deepEqual(model.competitionBracket,{min:30,max:30});
 assert(Array.isArray(model.rules));assert.equal(model.rules.length,5);
 for(const [i,row]of model.rules.entries()){
  keys(row,['id','points','action']);assert.deepEqual([row.id,row.points],expected[i]);keys(row.action,langs);
  for(const value of Object.values(row.action))assert(typeof value==='string'&&value.trim()===value&&value.length>0&&!/[<>\r\n{}]/.test(value),'Invalid localized action');
 }
 return model;
}
function section(lang,model=data){
 assert(langs.includes(lang),'Unsupported language');validate(model);
 const t=copy[lang],scope=t.condition.replace('{version}',model.gameVersion).replace('{min}',model.competitionBracket.min).replace('{max}',model.competitionBracket.max).replace('{date}',model.observedAt);
 const rows=model.rules.map(r=>`<tr data-hero-rule="${r.id}"><th scope="row">${esc(r.action[lang])}</th><td>${esc(new Intl.NumberFormat(lang).format(r.points))}</td></tr>`).join('');
 return `<section class="ts40-panel" ${marker}="" aria-labelledby="${anchor}"><h2 id="${anchor}">${esc(t.title)}</h2><p class="ts40-context">${esc(scope)}</p><div class="ts40-scroll" tabindex="0"><table class="ts40-table"><thead><tr><th scope="col">${esc(t.action)}</th><th scope="col">${esc(t.points)}</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function apply(html,lang,model=data){
 assert(langs.includes(lang),'Unsupported language');validate(model);
 const d=parseHTML(html).document,route=`https://tilessurvive.net/${lang}/events/arms-race/`;
 assert.equal(d.querySelector('link[rel="canonical"]')?.getAttribute('href'),route,'Wrong page');
 const owned=[...d.querySelectorAll(`[${marker}]`)];assert(owned.length<=1,'Duplicate owned section');
 const matches=html.match(/<section\b[^>]*\bdata-arms-hero-rules-41(?:="[^"]*")?[^>]*>[\s\S]*?<\/section>/g)||[];
 assert.equal(matches.length,owned.length,'Unexpected owned section syntax');
 if(matches.length)html=html.replace(matches[0],'');
 const clean=parseHTML(html).document;assert(!clean.getElementById(anchor),'Unowned heading collision');
 const target='<section class="ts40-panel" aria-labelledby="rules-heading">';
 assert.equal(html.split(target).length,2,'Missing or duplicate rules anchor');
 assert(clean.querySelector('#rules-heading')?.parentElement.matches('section.ts40-panel'),'Wrong rules section');
 return html.replace(target,section(lang,model)+target);
}
function build(){
 const planned=langs.map(lang=>{const file=path.join(root,lang,'events/arms-race/index.html'),before=fs.readFileSync(file,'utf8');return{file,before,after:apply(before,lang)};});
 let changes=0;for(const p of planned)if(p.before!==p.after){fs.writeFileSync(p.file,p.after);changes++;}
 return{pages:5,rulesPerPage:5,changes};
}
module.exports={langs,marker,anchor,validate,section,apply,build};
if(require.main===module)console.log(JSON.stringify(build()));
