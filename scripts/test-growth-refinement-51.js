'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseHTML } = require('linkedom');
const model = require('../data/growth-refinement-51.json');
const builder = require('./build-growth-refinement-51');
const root = path.resolve(__dirname, '..');
const baseline = '296cd9e6b61f444f54ed6b10d128ae8d4b21d5bb';
const documentAt = route => parseHTML(fs.readFileSync(path.join(root, route), 'utf8')).document;
const content = d => d.documentElement.outerHTML;

test('five existing material identities have exact per-item EXP and six official locale strings', () => {
  assert.equal(model.gameVersion, '2.6.200');
  assert.deepEqual(model.materials.map(row => [row.id, row.system, row.expPerItem]), [[208012, 'hero-gear', 100], [208013, 'hero-gear', 400], [208014, 'hero-gear', 2000], [206113, 'behemoth', 100], [206114, 'behemoth', 1000]]);
  for (const row of model.materials) for (const lang of builder.langs) {
    assert(row.name[lang].length > 1);
    assert(row.description[lang].replace(/[\s,\.\u00a0]/g, '').includes(String(row.expPerItem)));
    assert(!row.description[lang].includes('\ufffd'));
  }
  assert(!JSON.stringify(model).match(/tscfg:|rawValues|sourceSha256|\\Users\\|keyMaterial/));
  assert(!model.materials.some(row => row.id === 206115), 'Conflicting large serum is withheld');
});

test('new material renderer contains only per-item conversions and is localized', () => {
  for (const lang of builder.langs) {
    const d = parseHTML(builder.renderGear(lang)).document;
    assert.equal(d.querySelectorAll('tbody tr').length, 3);
    assert.equal(d.querySelectorAll('script,form,input,select,img').length, 0);
    for (const row of model.materials.filter(row => row.system === 'hero-gear')) {
      const tr = d.querySelector(`[data-growth-material-id="${row.id}"]`);
      assert.equal(tr.querySelector('th').textContent, row.name[lang]);
      assert.equal(Number(tr.querySelector('td').textContent.replace(/[^0-9]/g, '')), row.expPerItem);
    }
  }
});

test('all 18 pages keep complete previous DOM except the isolated added material content', () => {
  for (const lang of builder.langs) for (const suffix of ['database/gear-exp', 'behemoths/legend-griffin', 'behemoths/marine-drake']) {
    const route = `${lang}/${suffix}/index.html`;
    const old = parseHTML(execFileSync('git', ['show', `${baseline}:${route}`], { cwd: root, encoding: 'utf8', maxBuffer: 2e6 })).document;
    const current = documentAt(route);
    require('./client-truth-52-test-allowances').restore(current,route);
    const expected = suffix === 'database/gear-exp' ? 1 : 2;
    assert.equal(current.querySelectorAll('[data-growth-refinement-51]').length, expected, route);
    builder.strip(current);
    assert.equal(content(current), content(old), route);
  }
});

test('behemoth EXP stays attached to the existing correct serum image; star costs unchanged', () => {
  for (const lang of builder.langs) for (const species of model.behemothTargets) {
    const d = documentAt(`${lang}/behemoths/${species}/index.html`);
    for (const item of model.materials.filter(row => row.system === 'behemoth')) {
      const line = d.querySelector(`[data-growth-material-id="${item.id}"]`);
      assert(line);
      assert.equal(line.closest('.material-card').querySelector('img').getAttribute('src'), model.behemothMaterialImages[item.id]);
      assert(line.getAttribute('aria-label').startsWith(item.name[lang] + ':'));
      assert(line.textContent.includes(item.expPerItem.toLocaleString(lang === 'zh-tw' ? 'zh-TW' : lang)));
    }
  }
});

test('general gear dataset contains only the scoped client source corrections', () => {
  for (const file of ['data/expansion-22/database.json']) {
    require('./client-truth-52-test-allowances').assertSource(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),JSON.parse(execFileSync('git',['show',`${baseline}:${file}`],{cwd:root,encoding:'utf8'})),file);
  }
  const rows = require('../data/expansion-22/database.json').datasets.gear.rows;
  assert.equal(rows.length, 79);
  assert.equal(rows.reduce((sum, row) => sum + row.cost, 0), 1592200);
});
