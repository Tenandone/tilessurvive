'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {parseHTML} = require('linkedom');
const G = require('./answer-guides/building');
const registry = require('./building-data-registry');
const calculator = require('../js/building-system');
const C = require('../data/answer-guide-building-copy.json');
const locales = require('../data/i18n/locales.json').locales;
const ROOT = path.resolve(__dirname, '..');
const sourceFiles = ['data/client-buildings-52.json', 'data/content-60/buildings.json', 'data/content-60/buildings-phase2.json', 'data/building-system-evidence.json', 'data/power-plant-unified.json'];
const hashes = () => sourceFiles.map(file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex'));
const before = hashes();
const byLocale = new Map();
const guides = locale => { if (!byLocale.has(locale)) byLocale.set(locale, G.guides(locale)); return byLocale.get(locale); };
const answerModels = locale => guides(locale).map(g => ({route: g.route.replace(/^\/[^/]+\//, '/'), kind: g.kind, targetId: g.targetId,
  answers: g.answers.map(a => ({id: a.id, model: a.model}))}));

test('21 locales cover all 22 routes and 29 buildings with identical numeric models', () => {
  const expectedIds = registry.slugs.flatMap(s => registry.publicBuildings(s).map(b => b.id)).sort((a,b)=>a-b);
  const base = answerModels('en');
  for (const {code} of locales) {
    const gs = guides(code);
    assert.equal(gs.length, 22);
    assert.equal(gs.reduce((n,g)=>n+g.answers.length,0), 32);
    assert.deepEqual(gs.map(g=>g.route), registry.slugs.map(s=>`/${code}/buildings/${s}/`));
    assert.deepEqual([...new Set(gs.flatMap(g=>g.answers.map(a=>a.model.targetId)))].sort((a,b)=>a-b), expectedIds);
    assert.deepEqual(answerModels(code), base, 'Language-specific numeric drift: '+code);
    for (const g of gs) {
      assert.equal(new Set(g.answers.map(a=>a.id)).size,g.answers.length);
      for (const a of g.answers) {
        assert(a.question.trim() && a.paragraphs.length >= 2);
        assert.doesNotMatch(JSON.stringify([a.question,a.paragraphs,a.table,a.links,g.example,g.basis]), /\{[a-zA-Z]+\}|\bNaN\b|\bundefined\b/);
        assert.equal(a.model.source.version, '2.6.200');
        assert.equal(a.model.source.build, 1512);
        assert(sourceFiles.includes(a.model.source.file), 'Missing exact source file for ' + a.model.targetId);
        assert(!Object.hasOwn(a.model.source,'verifiedAt'),'Do not turn build time into a source verification date');
      }
    }
  }
});

test('Power Plant 29→30 and 1→30 are exact calculator results with normal-level scope', () => {
  const pp = guides('en').find(g=>g.route.includes('/power-plant/'));
  const single = pp.answers[0].model, total = pp.answers[1].model;
  assert.deepEqual(single.start,{level:29,rank:0});
  assert.deepEqual(single.target,{level:30,rank:1});
  assert.deepEqual(single.resources.map(r=>r.quantity),[255937500,255937500,51187500,12796900]);
  assert.equal(single.seconds,5084300);
  assert.deepEqual(single.prerequisites,[{level:30,rank:1,requirements:[{buildingId:800012,level:29,rank:0},{buildingId:800007,level:29,rank:0},{buildingId:800147,level:26,rank:0}]}]);
  assert.deepEqual(total.resources.map(r=>r.quantity),[1391940600,1391940600,276945000,68745600]);
  assert.equal(total.seconds,31143082);
  assert.equal(total.method,'cumulative');
  assert.equal(total.source.recordIds.length,58);
  assert(total.source.recordIds.every(id=>!id.endsWith(':1:0')),'Level 1 construction excluded');
  assert.equal(single.scope.model,'normal-building');
  assert.equal(single.scope.prerequisiteCostsIncluded,false);
  assert.equal(single.scope.bonusesIncluded,false);
  assert.match(pp.answers[0].paragraphs[0],/58d 20h 18m 20s/);
  assert.match(pp.example.paragraphs.join(' '),/255,937,500/);
  assert(pp.answers[0].links.some(l=>l.href==='/en/eras/nuclear-age/'));
});

test('every confirmed answer reuses the exact public range function and item identities', () => {
  const buildings = new Map(registry.slugs.flatMap(s=>registry.publicBuildings(s)).map(b=>[b.id,b]));
  for (const a of guides('en').flatMap(g=>g.answers)) {
    const m=a.model,b=buildings.get(m.targetId);
    if(m.status==='partial')continue;
    const calculated=calculator.sumRange(b.profiles[0].rows,m.start.level,m.target.level);
    assert.deepEqual(m.resources.map(r=>r.quantity),calculated.resources);
    assert.equal(m.seconds,calculated.seconds);
    assert.deepEqual(m.constructionItems.map(i=>[i.id,i.quantity]),calculated.constructionItems.map(i=>[i.id??i.itemId,i.quantity]));
    assert.deepEqual(m.resources.map(r=>r.id),registry.model.resources.map(r=>r.id));
  }
});

test('unknown construction stays partial while independently known zero time remains zero', () => {
  const all=guides('en').flatMap(g=>g.answers);
  const refinery=all.find(a=>a.id==='building-800004-0-to-1-requirements');
  const lab=all.find(a=>a.id==='building-800168-0-to-1-requirements');
  assert.equal(refinery.model.status,'partial');assert.equal(refinery.model.resources,null);assert.equal(refinery.model.seconds,0);
  assert.equal(lab.model.status,'partial');assert.equal(lab.model.resources,null);assert.equal(lab.model.seconds,100);
  assert.deepEqual(lab.model.constructionItems,[{id:208590,quantity:1,unit:'count'}]);
  assert.match(refinery.paragraphs[0],/not counted as zero/);
  assert.deepEqual(refinery.table.rows,[['Base time','0s']]);
  const enlistment=all.find(a=>a.model.targetId===800032);
  assert.equal(enlistment.model.status,'confirmed');assert.equal(enlistment.model.seconds,0);
  assert.deepEqual(enlistment.model.resources.map(r=>r.quantity),[1000,1000,0,0]);
  const b=structuredClone(registry.publicBuildings('refinery')[0]);
  assert.equal(G.rangeModel(b,0,2).resources,null);
  assert.equal(G.rangeModel(b,0,2).seconds,null,'No partial time sum across incomplete ranges');
  const zero=structuredClone(registry.publicBuildings('enlistment-office')[0]);
  Object.assign(zero.profiles[0].rows[0],{resources:[0,0,0,0],seconds:0,constructionItems:[]});
  assert.equal(G.rangeModel(zero,0,1).status,'confirmed-zero');
  assert.throws(()=>G.rangeModel(b,-1,1),/invalid/);
  assert.throws(()=>G.rangeModel(b,2,1),/invalid/);
  assert.throws(()=>G.rangeModel(b,0,NaN),/invalid/);
});

test('localized resource/item/prerequisite names and existing anchors are retained', () => {
  const docs=new Map();
  for (const {code} of locales) for(const guide of guides(code)) for(const a of guide.answers) {
    for(const link of a.links||[]) {
      const url=new URL(link.href,'https://tilessurvive.net');
      assert.equal(url.origin,'https://tilessurvive.net');assert(url.pathname.startsWith('/'+code+'/'));
      const file=path.join(ROOT,url.pathname,'index.html');
      assert(fs.existsSync(file),'Missing related route '+link.href);
      if(url.hash) {
        if(!docs.has(file))docs.set(file,parseHTML(fs.readFileSync(file,'utf8')).document);
        assert(docs.get(file).getElementById(url.hash.slice(1)),'Missing related anchor '+link.href);
      }
    }
  }
  const ko=guides('ko').flatMap(g=>g.answers);
  assert(ko.find(a=>a.model.targetId===800005).paragraphs.some(p=>p.includes('1번 실험실')&&p.includes('전장의 신 기념비')));
  const lab=ko.find(a=>a.id==='building-800168-0-to-1-requirements');
  assert(lab.table.rows.some(r=>r[0]==='연구 제2 대기열'));
});

test('copy schema and placeholder sets match all 21 languages; source files remain unchanged', () => {
  assert.deepEqual(Object.keys(C.locales).sort(),locales.map(l=>l.code).sort());
  const keys=Object.keys(C.locales.en).sort();
  const tokens=s=>[...s.matchAll(/\{[a-zA-Z]+\}/g)].map(m=>m[0]).sort();
  for(const [locale,values]of Object.entries(C.locales)) {
    assert.deepEqual(Object.keys(values).sort(),keys);
    for(const key of keys){assert(values[key].trim());assert.deepEqual(tokens(values[key]),tokens(C.locales.en[key]),locale+'.'+key);if(locale!=='ko')assert.doesNotMatch(values[key],/[가-힣]/);}
  }
  assert.deepEqual(hashes(),before);
  assert.throws(()=>G.guides('missing'),/Unknown building answer locale/);
});
