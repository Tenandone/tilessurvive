'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {parseHTML} = require('linkedom');
const {data, copy, languages, render, transform} = require('./build-item-synthesis-60.js');
const root = path.resolve(__dirname, '..');
const expected = {
  'obsidian-gear-crate':[100,1], 'alloy-gear-crate':[20,1],
  'turbo-turtle-decoration':[10,1], 'lil-blazer-decoration':[10,1],
  'evolution-core':[100,1], 'astral-expanse-unbuilt':[500,1],
  'signature-gear-tokens':[5,10]
};

test('public projection has exactly seven recipes and fourteen integer count cells', () => {
  assert.deepEqual(Object.keys(data).sort(), ['gameVersion','quantityBasis','recipes','schemaVersion']);
  assert.equal(data.gameVersion, '2.6.200');
  assert.equal(data.quantityBasis, 'per-synthesis');
  assert.deepEqual(data.recipes.map(row => row.slug), Object.keys(expected));
  for (const row of data.recipes) {
    assert.deepEqual(Object.keys(row).sort(), ['input','output','slug']);
    assert.deepEqual([row.input.quantity, row.output.quantity], expected[row.slug]);
    for (const entry of [row.input,row.output]) {
      assert.deepEqual(Object.keys(entry).sort(), ['names','quantity']);
      assert.deepEqual(Object.keys(entry.names).sort(), [...languages].sort());
      assert.ok(Number.isSafeInteger(entry.quantity) && entry.quantity > 0);
      for (const name of Object.values(entry.names)) assert.ok(typeof name === 'string' && name.trim().length > 0);
    }
  }
});

for (const language of languages) {
  test(`${language}: seven rows, official names and all counts are rendered without script`, () => {
    const file = path.join(root, language, 'database/items/index.html');
    const html = fs.readFileSync(file, 'utf8');
    const {document} = parseHTML(html);
    const section = document.querySelector('#item-synthesis');
    assert.ok(section);
    assert.equal(document.querySelectorAll('#item-synthesis').length, 1);
    assert.equal(section.querySelectorAll('tbody tr').length, 7);
    assert.equal(section.querySelectorAll('[data-synthesis-quantity]').length, 14);
    assert.equal(section.querySelectorAll('script').length, 0);
    data.recipes.forEach((row, index) => {
      const tr = section.querySelector(`[data-synthesis-recipe="${row.slug}"]`);
      assert.equal(tr.querySelector('th').textContent, copy[language].labels[index]);
      for (const role of ['input','output']) {
        const cell = tr.querySelector(`[data-synthesis-${role}]`);
        assert.equal(cell.querySelector('[data-synthesis-name]').textContent, row[role].names[language]);
        assert.equal(cell.querySelector('[data-synthesis-quantity]').textContent, String(row[role].quantity));
      }
    });
    assert.equal(section.querySelector('#item-synthesis-scope').textContent, copy[language].note);
    assert.equal(section.querySelector('#item-synthesis-domain-note').textContent, copy[language].domainNote);
    assert.equal(section.querySelector('.c60-scroll').getAttribute('tabindex'),'0');
    assert.ok(section.querySelector('table[aria-describedby]'));
    assert.equal(document.querySelectorAll('link[data-content-60-style]').length,1);
    assert.equal(document.querySelector('link[data-content-60-style]').getAttribute('href'),'/css/content-60.css');
    assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'),`https://tilessurvive.net/${language}/database/items/`);
    assert.equal(document.querySelectorAll('link[hreflang]').length, 7);
    assert.ok(document.querySelector('[data-gear-crate-tip]'));
    assert.ok(document.querySelector('[data-affiliate-placement="package_comparison"][rel*="sponsored"]'));
    assert.ok(document.querySelector('#items-heading'));
    assert.ok(document.querySelector('#vip-offers-heading'));
    assert.ok(document.querySelector('#packages-heading'));
    assert.equal(transform(html,language),html,'repeat build must be byte-stable');
    assert.equal(document.querySelectorAll('a[href="#item-synthesis"]').length,1);
  });
}

test('new public payload and generated sections exclude private provenance', () => {
  const forbidden = /\d{6,}|\.sqlite\b|[A-Za-z]:\\/;
  assert.doesNotMatch(JSON.stringify(data),forbidden);
  for (const language of languages) assert.doesNotMatch(render(language),forbidden);
});

test('builder refuses unexpected target structures instead of replacing unrelated content', () => {
  assert.throws(() => transform('<html><head></head><body></body></html>','en'),/Missing existing VIP section/);
  assert.throws(() => transform('<!-- c60-item-synthesis:start -->','en'),/Unclosed/);
});
