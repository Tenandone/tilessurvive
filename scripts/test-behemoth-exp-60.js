'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const {parseHTML}=require('linkedom'), B=require('./build-behemoth-exp-60');
const root=path.resolve(__dirname,'..');
test('allowlisted EXP model retains 298 explicit transitions in the displayed range',()=>{
  B.validate(); assert.equal(B.model.profiles.reduce((n,p)=>n+p.levels.length,0),298);
  assert.deepEqual(B.model.profiles[0].levels,B.model.profiles[1].levels);
  for(const p of B.model.profiles){assert.deepEqual([p.levels[0].baseExp,p.levels[48].baseExp,p.levels[98].baseExp,p.levels[148].baseExp],[1000,8000,23000,52000]);}
  assert(!/sourceSha|recordKey|InternalId|rawHex|sqlite|C:\\|api.?key/i.test(JSON.stringify(B.model)));
});
test('damaged, extended and non-allowlisted data fail closed',()=>{
  for(const mutate of [m=>m.sourceSha256='private',m=>m.displayedLevelRange=[1,151],m=>m.profiles.reverse(),m=>m.profiles[0].levels.pop(),m=>m.profiles[0].levels[0].toLevel=3,m=>m.profiles[0].levels[0].baseExp=null,m=>m.profiles[0].levels[0].baseExp=0,m=>m.profiles[0].levels[0].baseExp=1.5,m=>m.profiles[0].levels[0].serum=1]){
    const m=structuredClone(B.model); mutate(m); assert.throws(()=>B.validate(m));
  }
});
test('all twelve pages contain exact EXP rows and preserve existing stars, images and metadata',()=>{
  let rows=0;
  for(const lang of B.langs) for(const p of B.model.profiles){
    const file=path.join(root,lang,'behemoths',p.id,'index.html'),d=parseHTML(fs.readFileSync(file,'utf8')).document;
    assert.equal(d.querySelectorAll('[data-behemoth-exp-60]').length,1);
    const block=d.querySelector('[data-behemoth-exp-60]');
    assert.equal(block.outerHTML,parseHTML(B.render(lang,p)).document.querySelector('[data-behemoth-exp-60]').outerHTML);
    assert.equal(block.querySelectorAll('[data-exp-transition]').length,149);
    assert.equal(block.querySelectorAll('form,input,select,script').length,0);
    assert(block.querySelector('.c60-scroll[tabindex="0"][role="region"][aria-label]'));
    for(const row of block.querySelectorAll('[data-exp-transition]')){
      const values=[...row.children].map(c=>Number(c.textContent.replace(/[^0-9]/g,'')));
      assert.deepEqual(values,[p.levels[values[0]-1].fromLevel,p.levels[values[0]-1].toLevel,p.levels[values[0]-1].baseExp]);rows++;
    }
    assert(d.querySelector('[data-client-growth-52="behemoth-card"]'));
    assert(d.querySelector(`img[src="/img/game-41/behemoths/${p.id}.webp"]`));
    assert(d.querySelector('link[rel="canonical"]'));
    assert.equal(d.querySelectorAll('link[data-content-60-style]').length,1);
  }
  assert.equal(rows,1788);
});
test('six-language scope copy distinguishes displayed range and base EXP',()=>{
  for(const lang of B.langs){const c=B.copy[lang];for(const key of ['title','intro','condition','all','from','to','exp','note'])assert(typeof c[key]==='string' && c[key]);assert(c.condition.includes('2.6.200'));assert(c.condition.includes('150'));assert(c.all.includes('149'));}
});
