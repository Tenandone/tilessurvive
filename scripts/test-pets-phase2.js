'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const {parseHTML}=require('linkedom'),B=require('./build-pets-phase2'),R=require('../js/pets-phase2');
const root=path.resolve(__dirname,'..'),baseline='bbe712d5242a65fa1fff7aaf8e53f17bdb492ed6';
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=p=>cp.execFileSync('git',['show',baseline+':'+p],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
test('reviewed allowlist, version, availability and copy coverage',()=>{
 B.validate();for(const l of B.langs){assert.deepEqual(Object.keys(B.copy[l]).sort(),Object.keys(B.copy.en).sort());Object.values(B.copy[l]).forEach(v=>assert(v.length));}
 for(const alter of [m=>m.availability='released',m=>m.pets[0].expRows[0].exp=null,m=>m.pets[0].expRows[0].exp=0,m=>m.pets[0].trainingRows[0].quantity=null,m=>m.pets[0].rawSource='secret',m=>m.pets[0].skills[0].levels[0].description.en+='?',m=>m.pets[2].skills[2].status='verified-tooltip']){const x=structuredClone(B.model);alter(x);assert.throws(()=>B.validate(x));}
 assert.equal(digest(JSON.stringify(JSON.parse(JSON.stringify(B.model,null,2).replaceAll('\n','\r\n')))),B.MODEL_DIGEST);
});
test('15150 valid EXP ranges independently match prefix sums, including 300 equal-level ranges',()=>{
 let ranges=0;for(const p of B.model.pets){const prefix=[0];for(const r of p.expRows)prefix.push(prefix.at(-1)+r.exp);for(let from=1;from<=100;from++)for(let to=from;to<=100;to++){assert.equal(R.sumExp(p.expRows,from,to),prefix[to-1]-prefix[from-1]);ranges++;}}
 assert.equal(ranges,15150);
});
test('invalid input, missing/zero/null rows and reversed ranges remain unknown',()=>{
 const rows=B.model.pets[0].expRows;for(const [a,b]of [[null,2],[1,null],['',2],[' ',2],[undefined,2],[true,2],[1,101],[0,2],[5,4],[1.2,2],['1e1',20],['1.0',2],['0x10',20],[NaN,3],[1,Infinity]])assert.equal(R.sumExp(rows,a,b),null);
 for(const field of ['exp','fromLevel','toLevel']){const x=structuredClone(rows);x[0][field]=null;assert.equal(R.sumExp(x,1,1),null);}
 for(const bad of [[],rows.slice(1),null])assert.equal(R.sumExp(bad,1,2),null);
 assert.equal(R.sumExp(rows,' 1 ','2'),rows[0].exp);assert.equal(R.sumExp(rows,100,100),0);
});
test('18 pages contain exact numeric tables, six-language descriptions, SEO scope, images and accessibility hooks',()=>{
 let pages=0,exp=0,training=0,descriptions=0;
 for(const lang of B.langs)for(const p of B.model.pets){const html=read(`${lang}/database/pet-system/${p.id}/index.html`),d=parseHTML(html).document,t=B.copy[lang];pages++;
  assert.equal(d.querySelectorAll('h1').length,1);assert.equal(d.querySelector('h1').textContent,p.names[lang]);assert.equal(d.querySelector('[data-pets-phase2-availability]').textContent,t.scope);
  assert(d.title.includes(t.title)&&d.title.includes('2.6.200'));assert(d.querySelector('meta[name="description"]').content.includes(t.scope));assert.equal(d.querySelectorAll('link[rel="alternate"]').length,7);
  assert.equal(d.querySelectorAll('[data-pets-phase2-exp-row]').length,99);assert.equal(d.querySelectorAll('[data-pets-phase2-training-row]').length,5);exp+=99;training+=5;
  const expData=JSON.parse(d.querySelector('[data-pets-phase2-data]').textContent);assert.deepEqual(expData.expRows,p.expRows);
  const fmt=n=>n.toLocaleString(lang==='zh-tw'?'zh-TW':lang);
  [...d.querySelectorAll('[data-pets-phase2-exp-row]')].forEach((row,i)=>assert.equal(row.querySelector('td').textContent,fmt(p.expRows[i].exp)));
  [...d.querySelectorAll('[data-pets-phase2-training-row]')].forEach((row,i)=>{assert.equal(row.querySelectorAll('td')[0].textContent,p.trainingRows[i].material[lang]);assert.equal(row.querySelectorAll('td')[1].textContent,fmt(p.trainingRows[i].quantity));});
  for(const s of p.skills){const card=d.querySelector(`[data-pets-phase2-skill="${s.slot}"]`);assert.equal(card.querySelector('h3').textContent,s.names[lang]);assert.equal(card.querySelector('img').getAttribute('alt'),s.names[lang]);const rows=[...card.querySelectorAll('[data-pets-phase2-skill-level]')];assert.equal(rows.length,s.levels.length);rows.forEach((r,i)=>{assert.equal(r.querySelectorAll('td')[0].textContent,String(s.levels[i].trainingStage));assert.equal(r.querySelectorAll('td')[1].textContent,s.levels[i].description[lang]);descriptions++;});if(s.status==='numeric-description-held')assert.equal(card.querySelector('[data-pets-phase2-held]').textContent,t.held);}
  for(const region of d.querySelectorAll('.c60-scroll')){assert.equal(region.getAttribute('tabindex'),'0');assert(region.getAttribute('aria-label'));}
  for(const img of d.querySelectorAll('main img')){const rel=img.getAttribute('src');assert(rel.startsWith('/img/content-60/pets/'));const b=fs.readFileSync(path.join(root,rel));assert.equal(b.subarray(1,4).toString(),'PNG');assert(img.getAttribute('alt'));}
  assert(!/tscfg:|sourceSha256|InternalId|fake_text|ServerOpenWeeks/.test(html));assert.equal(d.querySelectorAll('[data-pet-skill-levels],[data-pet-exp-profiles-40]').length,0);
 }
 assert.deepEqual({pages,exp,training,descriptions},{pages:18,exp:1782,training:90,descriptions:156});
});
test('hub projection is idempotent and preserves every baseline node outside exact additions',()=>{
 for(const l of B.langs){const rel=`${l}/database/pet-system/index.html`,before=source(rel),after=B.projectHub(before,l);assert.equal(B.projectHub(after,l),after);const d=parseHTML(after).document;assert.equal(d.querySelectorAll('[data-pets-phase2-entry]').length,1);assert.equal(d.querySelectorAll('[data-pets-phase2-card]').length,3);d.querySelectorAll('[data-pets-phase2-entry],[data-pets-phase2-hub-style]').forEach(n=>n.remove());assert.equal(d.documentElement.outerHTML,parseHTML(before).document.documentElement.outerHTML);const actual=parseHTML(read(rel)).document;assert.equal(actual.querySelector('[data-pets-phase2-entry]').outerHTML,parseHTML(after).document.querySelector('[data-pets-phase2-entry]').outerHTML);}
});
test('the seven existing pet data and calculator modules remain exactly the deployed version',()=>{
 const files=['data/pet-skill-levels.json','data/foundation-40/pet-exp-profiles.json','data/foundation-40/pet-training-profiles-41.json','data/foundation-40/pet-observations.json','data/foundation-40/pet-skills-41.json','data/foundation-40/starhorn-growth.json','js/pet-exp-profiles-40.js','js/pet-training-profiles-41.js','js/pet-skill-levels.js'];
 for(const rel of files)assert.equal(read(rel).replaceAll('\r\n','\n'),source(rel).replaceAll('\r\n','\n'),rel);
});
test('EXP browser wiring renders valid/invalid/equal targets using exact data',()=>{
 const html=read('en/database/pet-system/hopper/index.html'),{document,Event}=parseHTML(html);R.mount(document);const f=document.querySelector('[data-pets-phase2-exp]'),a=f.querySelector('[name="from"]'),b=f.querySelector('[name="to"]'),o=f.querySelector('output');
 a.value='1';b.value='100';b.dispatchEvent(new Event('input'));assert.equal(o.textContent,R.sumExp(B.model.pets[0].expRows,1,100).toLocaleString('en')+' EXP');a.value='100';a.dispatchEvent(new Event('input'));assert.equal(o.textContent,'0 EXP');b.value='99';f.dispatchEvent(new Event('submit',{cancelable:true}));assert.equal(o.textContent,B.copy.en.invalid);
});
