const P50=require('./data-presentation-50-test-allowances');
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{parseHTML}=require('linkedom');
const renderer=require('./build-arms-race-hero-rules-41'),model=require('../data/foundation-40/arms-race-hero-rules-41.json');
const root=path.resolve(__dirname,'..'),baseline='10690d239aac56f5496dbe65d951f10c94ea11a4',langs=['ko','en','ja','ru','zh-tw'];
const pages=langs.map(l=>`${l}/events/arms-race/index.html`),lf=s=>s.toString().replaceAll('\r\n','\n');
const read=f=>fs.readFileSync(path.join(root,f)),old=f=>execFileSync('git',['show',baseline+':'+f],{cwd:root,maxBuffer:20e6});
const strip=html=>html.replace(/<section\b[^>]*\bdata-arms-hero-rules-41(?:="[^"]*")?[^>]*>[\s\S]*?<\/section>/g,'');
test('the public projection contains exactly five scoped rules with faithful localized actions',()=>{
 assert.equal(crypto.createHash('sha256').update(lf(read('data/foundation-40/arms-race-hero-rules-41.json'))).digest('hex'),'11c8c2e583c945bfa70638658addcab87eae3c2d2b9d3d0452820e5f2064e476');
 assert.deepEqual(model.rules.map(r=>r.points),[9000,1000,150,857,60]);
 assert.deepEqual(model.rules.map(r=>r.action.ko),['전설 영웅 조각 1개 소모','에픽 영웅 조각 1개 소모','레어 영웅 조각 1개 소모','영웅 스킬 업그레이드 시 영웅 스킬북 1개 소모','패키지 구매 시 다이아 1개 획득']);
 assert.deepEqual(model.competitionBracket,{min:30,max:30});assert.equal(model.observedAt,'2026-10-10');
 assert.equal(model.rules[3].action.en,'Use 1 Hero Skill Manual to upgrade a hero skill');
 assert.equal(model.rules[3].action.ja,'英雄スキルの強化に英雄スキルブックを1個消費する');
 assert.equal(model.rules[3].action.ru,'Потратить 1 руководство навыков для улучшения навыка героя');
 assert.equal(model.rules[4].action.en,'Obtain 1 Diamond from a bundle purchase');
 assert.equal(model.rules[4].action.ru,'Получить 1 алмаз при покупке набора');
 assert(!/tscfg:|InternalId|sourcePath|audit-results|C:\\|Requirement|ParamString/.test(JSON.stringify(model)));
 renderer.validate(model);
});
test('all five documents preserve every baseline byte outside the new section',()=>{
 for(const [index,file]of pages.entries()){
  const before=lf(old(file)),after=lf(read(file)),d=parseHTML(after).document;
  const owned=d.querySelectorAll('[data-arms-hero-rules-41]');assert.equal(owned.length,1);const section=owned[0];
  assert.equal(P50.html(strip(after),file),P50.html(before,file),file+' complete baseline preservation: formulas, embedded data, links, SEO and existing tables');
  assert.equal(section.previousElementSibling.getAttribute('aria-labelledby'),'rewards-heading');
  assert.equal(section.nextElementSibling.getAttribute('aria-labelledby'),'rules-heading');
  assert.equal(section.querySelector('h2').id,'hero-growth-points-heading');assert.equal(d.querySelectorAll('#hero-growth-points-heading').length,1);
  assert.match(section.querySelector('.ts40-context').textContent,/2\.6\.200/);assert.match(section.querySelector('.ts40-context').textContent,/30–30/);assert.match(section.querySelector('.ts40-context').textContent,/2026-10-10/);
  assert.equal(section.querySelectorAll('thead th[scope="col"]').length,2);
  const rows=section.querySelectorAll('tbody tr');assert.equal(rows.length,5);
  rows.forEach((row,i)=>{assert.equal(row.getAttribute('data-hero-rule'),model.rules[i].id);assert.equal(row.querySelector('th[scope="row"]').textContent,model.rules[i].action[langs[index]]);assert.equal(row.querySelector('td').textContent,new Intl.NumberFormat(langs[index]).format(model.rules[i].points));});
  assert.equal(section.querySelectorAll('a,form,input,script,img').length,0,'Static information only; no purchase path or new calculator');
 }
});
test('all preexisting public data, scripts, styles, search, sitemap and other routes remain unchanged',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.html')||/^(data|js|css)\//.test(f)||['sitemap.xml','robots.txt'].includes(f));
 const batch=execFileSync('git',['cat-file','--batch'],{cwd:root,input:files.map(f=>baseline+':'+f).join('\n')+'\n',maxBuffer:200e6});let cursor=0;
 for(const file of files){const end=batch.indexOf(10,cursor),header=batch.subarray(cursor,end).toString();assert.match(header,/^[a-f0-9]{40} blob \d+$/);const size=Number(header.split(' ')[2]);cursor=end+1;const bytes=batch.subarray(cursor,cursor+size);cursor+=size+1;if(!pages.includes(file)){if(file==='data/search-index.json')require('./lib/item-chest-regression-41').assertSearchExtension(bytes,read(file));else {const chests=require('./build-item-chest-rewards-41');const expected=chests.langs.some(l=>file===`${l}/database/items/index.html`)?chests.apply(lf(bytes),file.split('/')[0]):lf(bytes);P50.equal(lf(read(file)),expected,file);}}}
 assert.equal(cursor,batch.length);
});
test('the builder is idempotent and rejects wrong routes, damaged insertion boundaries and expanded scope',()=>{
 for(const [i,file]of pages.entries()){
  const before=lf(old(file)),once=renderer.apply(before,langs[i]);assert.equal(renderer.apply(once,langs[i]),once);assert.equal(strip(once),before);
  assert.equal(renderer.apply(lf(read(file)),langs[i]),lf(read(file)));
  assert.throws(()=>renderer.apply(before.replace('id="rules-heading"','id="wrong-heading"'),langs[i]));
  assert.throws(()=>renderer.apply(once.replace('</main>',renderer.section(langs[i])+'</main>'),langs[i]));
  assert.throws(()=>renderer.apply(before.replace('</main>','<h2 id="hero-growth-points-heading">collision</h2></main>'),langs[i]));
 }
 const base=lf(old(pages[0]));assert.throws(()=>renderer.apply(base,'en'));assert.throws(()=>renderer.section('fr'));
 for(const mutate of [m=>m.rules.pop(),m=>m.rules[0].points++,m=>m.rules[0].points='9000',m=>m.rules[0].id='unobserved',m=>delete m.rules[0].action.ja,m=>m.rules[0].action.en='{0}',m=>m.competitionBracket.max=31,m=>m.rawID=123]){const bad=structuredClone(model);mutate(bad);assert.throws(()=>renderer.apply(base,'ko',bad));}
});
