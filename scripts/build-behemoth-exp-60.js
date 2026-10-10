'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {parseHTML} = require('linkedom');
const model = require('../data/content-60/behemoth-exp.json'), copy = require('../data/content-60/behemoth-exp-copy');
const root = path.resolve(__dirname, '..'), langs = ['ko','en','ja','ru','zh-tw','de'];
const ids = ['legend-griffin','marine-drake'];
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function keys(value, expected) { assert.deepEqual(Object.keys(value).sort(), [...expected].sort()); }
function validate(data = model) {
  keys(data, ['schemaVersion','gameVersion','unit','scope','displayedLevelRange','profiles']);
  assert.equal(data.schemaVersion, 1); assert.equal(data.gameVersion, '2.6.200');
  assert.equal(data.unit, 'EXP'); assert.equal(data.scope, 'base-level-transition');
  assert.deepEqual(data.displayedLevelRange, [1,150]); assert.deepEqual(data.profiles.map(p=>p.id), ids);
  for (const profile of data.profiles) {
    keys(profile, ['id','name','levels']); keys(profile.name, langs);
    for (const lang of langs) assert.equal(typeof profile.name[lang], 'string');
    assert(profile.name.ko && profile.name.en); assert.equal(profile.levels.length, 149);
    profile.levels.forEach((row, i) => {
      keys(row, ['fromLevel','toLevel','baseExp']);
      assert.equal(row.fromLevel, i+1); assert.equal(row.toLevel, i+2);
      assert(Number.isSafeInteger(row.baseExp) && row.baseExp > 0);
    });
  }
  return data;
}
function render(lang, profile) {
  const t = copy[lang]; assert(t && ids.includes(profile.id));
  const fmt = value => value.toLocaleString(lang === 'zh-tw' ? 'zh-TW' : lang);
  return `<section id="behemoth-exp-60" class="c60-panel" data-behemoth-exp-60 data-search-entry><h2 class="c60-heading">${esc(t.title)}</h2><p>${esc(profile.name[lang])} · ${esc(t.intro)}</p><p class="c60-note">${esc(t.condition)}</p><details><summary>${esc(t.all)}</summary><div class="c60-scroll" tabindex="0" role="region" aria-label="${esc(t.title)}"><table class="c60-table"><thead><tr><th scope="col">${esc(t.from)}</th><th scope="col">${esc(t.to)}</th><th scope="col">${esc(t.exp)}</th></tr></thead><tbody>${profile.levels.map(row=>`<tr data-exp-transition><th scope="row">${row.fromLevel}</th><td>${row.toLevel}</td><td class="c60-value">${fmt(row.baseExp)}</td></tr>`).join('')}</tbody></table></div></details><p class="c60-note">${esc(t.note)}</p></section>`;
}
function build() {
  validate(); let changed=0, pages=0;
  for (const lang of langs) for (const profile of model.profiles) {
    const rel=`${lang}/behemoths/${profile.id}/index.html`, file=path.join(root,rel);
    const before=fs.readFileSync(file,'utf8'), document=parseHTML(before).document;
    document.querySelectorAll('[data-behemoth-exp-60],link[data-content-60-style]').forEach(x=>x.remove());
    const baseline=document.documentElement.outerHTML;
    const host=document.querySelector('main > .container') || document.querySelector('main'); assert(host,rel);
    const template=document.createElement('template'); template.innerHTML=render(lang,profile);
    const starSection=host.querySelector('.star-grid')?.closest('section');
    if(starSection) starSection.before(template.content); else host.append(template.content);
    const style=document.createElement('link'); style.rel='stylesheet'; style.href='/css/content-60.css?v=1'; style.setAttribute('data-content-60-style',''); document.head.append(style);
    const after='<!DOCTYPE html>\n'+document.documentElement.outerHTML+'\n';
    const check=parseHTML(after).document; check.querySelectorAll('[data-behemoth-exp-60],link[data-content-60-style]').forEach(x=>x.remove());
    assert.equal(check.documentElement.outerHTML,baseline,'Unexpected existing-content edit '+rel);
    if(after!==before){fs.writeFileSync(file,after);changed++;} pages++;
  }
  const result={builder:'behemoth-exp-60',profiles:2,transitions:298,pages,changed}; console.log(JSON.stringify(result)); return result;
}
module.exports={build,render,validate,model,copy,langs,ids}; if(require.main===module)build();
