'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{parseHTML}=require('linkedom');
const D=require('./xssr-details-data'),R=require('./xssr-detail-content'),Calc=require('../js/xssr-growth-calculator');
test('All three heroes render all localized data and real image paths without raw source text',()=>{
 assert(R.validate());
 for(const locale of Object.keys(require('../data/xssr-detail-copy.json').locales))for(const h of D.heroes()){
  const html=R.render(h,locale),doc=parseHTML(html).document;
  assert.equal(doc.querySelectorAll('[data-xssr-skill]').length,4);
  assert.equal(doc.querySelectorAll('[data-xssr-skill-level]').length,4);
  assert.equal(doc.querySelectorAll('[data-xssr-table="rank"] tbody tr').length,10);
  assert.equal(doc.querySelectorAll('[data-xssr-table="gear"] tbody tr').length,20);
  assert.equal(doc.querySelectorAll('[data-hp-pair]').length,h.id==='lava'?4:2);
  assert.equal(doc.querySelectorAll('#hero-pet-connections').length,1);assert(doc.getElementById(h.id+'-pets'));
  assert(doc.querySelector('[data-xssr-universal]'));
  assert(!doc.querySelector('[data-xssr-table="rank"]').textContent.includes('not displayed star'));
  assert.equal(doc.querySelectorAll('[data-xssr-skill] > img').length,4);
  for(const img of doc.querySelectorAll('img'))assert(fs.existsSync(path.join(__dirname,'..',img.getAttribute('src'))));
  assert(!/\{\d+\}|<color|C:\\Users|Documents\\New project|undefined/.test(html));
 }
});
test('Growth ranges exclude recruitment and already-completed stages',()=>{
 for(const h of D.heroes()){
  const rank=R.calculatorConfig(h,'rank','en'),gear=R.calculatorConfig(h,'gear','en');
  assert.equal(Calc.calculate(rank.rows,0,10),3049);
  assert.equal(Calc.calculate(rank.rows,0,1),24);
  assert.equal(Calc.calculate(rank.rows,2,3),165);
  assert.equal(Calc.calculate(rank.rows,10,10),0);
  assert.equal(Calc.calculate(gear.rows,0,20),650);
  assert.equal(Calc.calculate(gear.rows,1,2),5);
  assert.equal(Calc.calculate(gear.rows,0,1),10);
  assert.throws(()=>Calc.calculate(rank.rows,8,7));
  assert.throws(()=>Calc.calculate(rank.rows,-1,1));
  assert.throws(()=>Calc.calculate(rank.rows,0,11));
  assert.throws(()=>Calc.calculate(rank.rows,0.5,1));
 }
});
test('Browser controls update selected skill values and reject reversed growth ranges',()=>{
 const doc=parseHTML(R.render('alita','en')).document;Calc.init(doc);Calc.init(doc);
 const panel=doc.querySelector('[data-xssr-calculator]'),from=panel.querySelector('[data-xssr-from]'),to=panel.querySelector('[data-xssr-to]');
 Object.defineProperty(from,'value',{value:'2',writable:true});Object.defineProperty(to,'value',{value:'3',writable:true});
 panel.querySelector('[data-xssr-calculate]').dispatchEvent(new doc.defaultView.Event('click'));
 assert.match(panel.querySelector('output').textContent,/165/);
 from.value='4';from.dispatchEvent(new doc.defaultView.Event('change'));assert.equal(panel.querySelector('output').getAttribute('data-error'),'true');
 const skill=doc.querySelector('[data-xssr-skill="25401407"]'),selector=skill.querySelector('select');Object.defineProperty(selector,'value',{value:'50'});selector.dispatchEvent(new doc.defaultView.Event('change'));
 assert.match(skill.querySelector('[data-xssr-skill-text]').textContent,/22\.35/);assert(!/22\.35%/.test(skill.textContent));
});
test('Native and authored skill texts retain independently verified numeric units',()=>{
 const alita=D.record('alita'),furiosa=D.record('furiosa'),lava=D.record('lava');
 assert.match(R.skillText(furiosa,furiosa.skills[1],50,'en'),/521\.5%/);
 assert.match(R.skillText(furiosa,furiosa.skills[1],50,'ko'),/968\.5%/);
 assert.match(R.skillText(alita,alita.skills[0],50,'fr'),/149%/);
 assert.match(R.skillText(alita,alita.skills[2],50,'en'),/22\.35(?!%)/);
 assert.match(R.skillText(lava,lava.skills[1],50,'vi'),/1192%/);
 assert.match(R.skillText(lava,lava.skills[2],50,'nb'),/11\.175%/);
});

test('Only authored English skill-name fallbacks are labeled and reveal their Korean originals',()=>{
 const c=require('../data/xssr-detail-copy.json'),alita=D.record('alita');
 for(const locale of Object.keys(c.locales)){
  const doc=parseHTML(R.render(alita,locale)).document,notes=[...doc.querySelectorAll('[data-xssr-authored-name]')];assert.equal(notes.length,locale==='ko'?0:4);
  for(const [index,note]of notes.entries()){assert.equal(note.querySelector('summary').textContent,c.locales[locale].ui.englishReferenceName);assert.equal(note.querySelector('[lang="ko"]').textContent,alita.skills[index].names.ko);assert(!note.hasAttribute('open'));}
  for(const id of ['lava','furiosa'])assert.equal(parseHTML(R.render(id,locale)).document.querySelectorAll('[data-xssr-authored-name]').length,0);
 }
});
