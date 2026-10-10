'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{parseHTML}=require('linkedom');
const data=require('../data/foundation-40/item-chest-rewards-41.json'),copy=require('../data/foundation-40/item-chest-rewards-copy'),catalogCopy=require('../data/foundation-40/explorer-copy');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw'],marker='data-chest-rewards-41';
const ids=['resource-choice-level-1','resource-choice-level-2','festive-chest-party-cake'],assetIds=['resource-choice','festive-chest','party-cake'];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll('\u00a0','&#160;');
function keys(value,names){assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),[...names].sort());}
function localized(value){keys(value,langs);for(const text of Object.values(value))assert(typeof text==='string'&&text.trim().length&&!/[<>\r\n{}]/.test(text),'Invalid localized text');}
function validate(model){
 keys(model,['schemaVersion','observedAt','assets','choices','festival']);assert.equal(model.schemaVersion,1);assert.equal(model.observedAt,'2026-10-10');
 assert.equal(model.assets.length,3);assert.deepEqual(model.assets.map(a=>a.id),assetIds);
 for(const a of model.assets){keys(a,['id','src','width','height','bytes','sha256']);assert.equal(a.src,`/img/game-41/item-chests/${a.id}.webp`);assert.equal(a.width,128);assert.equal(a.height,128);assert(Number.isSafeInteger(a.bytes)&&a.bytes>0);assert.match(a.sha256,/^[a-f0-9]{64}$/);const b=fs.readFileSync(path.join(root,a.src));assert.equal(b.length,a.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),a.sha256);assert.equal(b.toString('ascii',8,16),'WEBPVP8L');}
 assert.equal(model.choices.length,2);
 model.choices.forEach((c,i)=>{keys(c,['id','category','level','names','descriptions','icon','options']);assert.equal(c.id,ids[i]);assert.equal(c.category,'resource');assert.equal(c.level,i+1);assert.equal(c.icon,'resource-choice');localized(c.names);localized(c.descriptions);assert.equal(c.options.length,4);c.options.forEach((o,j)=>{keys(o,['resource','amount']);assert.equal(o.resource,['food','wood','metal','fuel'][j]);assert.equal(o.amount,[[10000,10000,2000,500],[100000,100000,20000,5000]][i][j]);});});
 const f=model.festival;keys(f,['id','category','names','descriptions','icon','rewardNames','rewardIcon','outcomes']);assert.equal(f.id,ids[2]);assert.equal(f.category,'event');assert.equal(f.icon,'festive-chest');assert.equal(f.rewardIcon,'party-cake');for(const k of ['names','descriptions','rewardNames'])localized(f[k]);assert.equal(f.outcomes.length,3);f.outcomes.forEach((o,i)=>{keys(o,['quantity','displayPercent']);assert.equal(o.quantity,[10,3,1][i]);assert.equal(o.displayPercent,['10.00','30.00','60.00'][i]);});
 return model;
}
function render(lang,model=data){
 assert(langs.includes(lang));validate(model);const t=copy[lang],num=n=>new Intl.NumberFormat(lang).format(n);
 const icon=id=>{const a=model.assets.find(a=>a.id===id);return `<img class="ts40-item-icon" src="${a.src}" width="128" height="128" alt="" aria-hidden="true" loading="lazy" decoding="async">`;};
 const table=(head,rows)=>`<div class="ts40-scroll" tabindex="0"><table class="ts40-table"><thead><tr>${head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>`;
 const wrap=(row,body)=>`<details class="ts40-item" data-item-entry="" ${marker}="" data-category="${row.category}" id="${row.id}"><summary><span class="ts40-item-label">${icon(row.icon)}<span>${esc(row.names[lang])}</span></span></summary><div class="ts40-item-body">${body}</div></details>`;
 const choices=model.choices.map(c=>wrap(c,`<div><h3>${esc(t.contents)}</h3><p>${esc(c.descriptions[lang])}</p><p>${esc(t.chooseOne)}</p></div><div><h3>${esc(t.choices)}</h3>${table([t.resource,t.amount],c.options.map(o=>[t.resources[o.resource],num(o.amount)]))}</div>`)).join('');
 const f=model.festival,percent=s=>new Intl.NumberFormat(lang,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(s))+'%';
 const festival=wrap(f,`<div><h3>${esc(t.contents)}</h3><p>${esc(f.descriptions[lang])}</p><p class="ts40-context">${esc(t.scope.replace('{date}',model.observedAt))}</p></div><div><h3><span class="ts40-item-label">${icon(f.rewardIcon)}<span>${esc(f.rewardNames[lang])}</span></span></h3>${table([t.quantity,t.probability],f.outcomes.map(o=>[num(o.quantity),percent(o.displayPercent)]))}</div>`);
 return choices+festival;
}
function strip(html,lang){
 assert(langs.includes(lang));const d=parseHTML(html).document;assert.equal(d.querySelector('link[rel="canonical"]')?.href,`https://tilessurvive.net/${lang}/database/items/`);
 const nodes=[...d.querySelectorAll(`[${marker}]`)];assert(nodes.length===0||nodes.length===3,'Incomplete owned items');if(nodes.length)assert.deepEqual(nodes.map(n=>n.id),ids);
 const re=/<details\b[^>]*\bdata-chest-rewards-41=""[^>]*>[\s\S]*?<\/details>/g,matches=html.match(re)||[];assert.equal(matches.length,nodes.length,'Unexpected owned syntax');return html.replace(re,'');
}
function apply(html,lang,model=data){
 validate(model);html=strip(html,lang);const d=parseHTML(html).document;for(const id of ids)assert(!d.getElementById(id),'Unowned anchor collision');
 const t=catalogCopy[lang],target=`\n <p class="ts40-context">${t.itemRewardScope} ${t.condition}</p>`;assert.equal(html.split(target).length,2,'Missing or duplicate catalog insertion anchor');
 return html.replace(target,render(lang,model)+target);
}
function entries(model=data){validate(model);return langs.flatMap(language=>[...model.choices,model.festival].map(c=>({language,type:'database',title:c.names[language],description:c.descriptions[language]+(c===model.festival?' '+copy[language].scope.replace('{date}',model.observedAt):''),url:`/${language}/database/items/#${c.id}`})));}
function build(){const work=langs.map(lang=>{const file=path.join(root,lang,'database/items/index.html'),before=fs.readFileSync(file,'utf8');return{file,before,after:apply(before,lang)};});let changes=0;for(const p of work)if(p.before!==p.after){fs.writeFileSync(p.file,p.after);changes++;}return{pages:5,items:3,changes};}
module.exports={langs,marker,ids,validate,render,strip,apply,entries,build};
if(require.main===module)console.log(JSON.stringify(build()));
