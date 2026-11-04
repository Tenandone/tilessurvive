'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {parseHTML} = require('linkedom');
const locales = require('../js/site-locales');
const copy = require('../js/platform-i18n');
const workbench = require('../js/data-workbench-30');
const speedup = require('../js/tools-speedup-calculator');
const helper = require('../js/event-helper');
const root = path.resolve(__dirname,'..');
const baseline = 'edbac42bb41ba4289c24caa5635e388f1cd80e53';
const old = new Map();
function original(name) {
  if(!old.has(name))old.set(name,execFileSync('git',['show',baseline+':js/'+name],{cwd:root,encoding:'utf8',maxBuffer:10e6}));
  return old.get(name);
}
const read = name => fs.readFileSync(path.join(root,'js',name),'utf8');
const tagged = (value, locale) => typeof value==='string'?locale+':'+value:Array.isArray(value)?value.map(v=>tagged(v,locale)):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,tagged(v,locale)]));
const payload = (locale, featureCopies={}) => `<script id="ts-global-ui" type="application/json">${JSON.stringify({locale,copy:tagged(copy.en,locale),featureCopies})}</script>`;
function browser(locale, body, options={}) {
  const {window,document} = parseHTML(`<!doctype html><html lang="${locale}" data-lang="${locale}"><head></head><body>${body}</body></html>`);
  const location = new URL(`https://tilessurvive.net/${locale}/tools/speedup-calculator/`);
  window.location=location;
  const fetches=[];
  const fetch=async url=>{fetches.push(url);return {ok:true,json:async()=>url.includes('calculators')?options.calculators:{events:[]}};};
  const context=vm.createContext({window,document,location,URL,URLSearchParams,console,fetch,setTimeout,clearTimeout});
  const run=(name,source=read(name))=>vm.runInContext(source,context,{filename:name});
  if(options.runtime!==false){run('site-locales.js');run('platform-i18n.js');}
  return {window,document,run,fetches};
}
const speedBody=`<main data-speedup-calculator-page><input id="speedupDays"><input id="speedupHours"><input id="speedupMinutes"><button id="speedupCalculate"></button><button id="speedupReset"></button><output id="speedupTotalMinutes"></output><output id="speedupTotalHours"></output><output id="speedupBreakdown"></output><p id="speedupNotice"></p></main>`;
function calculateSpeed(b,values) {
  ['speedupDays','speedupHours','speedupMinutes'].forEach((id,i)=>{b.document.getElementById(id).value=String(values[i]);});
  b.document.getElementById('speedupCalculate').click();
  return ['speedupTotalMinutes','speedupTotalHours','speedupBreakdown','speedupNotice'].map(id=>b.document.getElementById(id).textContent);
}

test('speedup input normalization and all six legacy outputs match immutable production JS',()=>{
  for(const locale of Object.keys(speedup.UI)) {
    const a=browser(locale,speedBody,{runtime:false}),b=browser(locale,speedBody);
    a.run('tools-speedup-calculator.js',original('tools-speedup-calculator.js'));b.run('tools-speedup-calculator.js');
    for(const values of [[0,0,0],[1,2,3],[1000,500,59],['','',''],[-3,-1,-2],[1.9,2.8,3.2],['abc','Infinity','NaN']]) {
      assert.deepEqual(calculateSpeed(b,values),calculateSpeed(a,values),locale+' '+values.join(','));
    }
    b.document.getElementById('speedupReset').click();a.document.getElementById('speedupReset').click();
    assert.equal(b.document.getElementById('speedupBreakdown').textContent,a.document.getElementById('speedupBreakdown').textContent);
  }
});
test('all 15 added speedup locales retain the same arithmetic with complete local UI',()=>{
  for(const row of locales.locales.filter(row=>!speedup.UI[row.code])) {
    const locale=row.code,ui={notice:locale+':notice',d:locale+':d',h:locale+':h',m:locale+':m'};
    const b=browser(locale,payload(locale,{speedup:ui})+speedBody);
    b.run('tools-speedup-calculator.js');
    const result=calculateSpeed(b,[1,2,3]);
    assert.deepEqual(result,[1563 .toLocaleString(row.numberLocale),(26.05).toLocaleString(row.numberLocale,{maximumFractionDigits:2}),`1${ui.d} 2${ui.h} 3${ui.m}`,ui.notice]);
  }
  const missing=browser('fr',payload('fr')+speedBody);
  assert.throws(()=>missing.run('tools-speedup-calculator.js'),/Incomplete feature translation: fr.speedup/);
});
test('workbench feature copy renders localized counts while preserving original numeric cells',()=>{
  const table='<section class="ts3-data-workbench"><div class="ts3-table-controls"><input data-table-query value=""><button data-table-reset></button></div><p class="ts3-table-status"></p><table data-workbench><thead><tr><th>Level</th><th>Cost</th></tr></thead><tbody><tr><td>1</td><td data-ts-original-value="1234.5">1,234.5</td></tr><tr><td>2</td><td>0</td></tr></tbody></table></section>';
  for(const locale of ['fr','ar','zh-cn','ms','nb']) {
    const ui=tagged(workbench.copy.en,locale),b=browser(locale,payload(locale,{dataWorkbench:ui})+table);
    const before=[...b.document.querySelectorAll('td')].map(cell=>cell.outerHTML);
    b.run('data-workbench-30.js');
    b.document.dispatchEvent(new b.window.Event('DOMContentLoaded'));
    assert.ok(b.document.querySelector('.ts3-table-status').textContent.endsWith(ui.count));
    assert.deepEqual([...b.document.querySelectorAll('td')].map(cell=>cell.outerHTML),before);
    const query=b.document.querySelector('[data-table-query]');query.value='no-match';query.dispatchEvent(new b.window.Event('input'));
    assert.equal(b.document.querySelector('.ts3-table-status').textContent,ui.empty);
  }
});
function calculators(locale) {
  const labels={powerScore:{title:'Power',amount:'Amount',rate:'Rate',button:'Calculate'},speedupSum:{title:'Speed',days:'Days',hours:'Hours',minutes:'Minutes',button:'Calculate'}};
  return {calculators:Object.entries(labels).map(([type,value])=>({id:type,type,labels:{[locale]:tagged(value,locale)}}))};
}
function calculateEvents(b) {
  const field=(selector,value)=>{b.document.querySelector(selector).value=String(value);};
  field('[data-power-amount]',12345);field('[data-power-rate]',2.5);b.document.querySelector('[data-power-button]').click();
  field('[data-speed-days]',1);field('[data-speed-hours]',2);field('[data-speed-minutes]',3);b.document.querySelector('[data-speed-button]').click();
  return ['[data-power-result]','[data-speed-result]'].map(s=>b.document.querySelector(s).textContent);
}
test('event helper preserves six legacy calculator results against production JS',async()=>{
  for(const locale of Object.keys(helper.UI)) {
    const data=calculators(locale),body='<main><div id="ehCalculators"></div><ul id="ehChecklist"></ul></main>';
    const a=browser(locale,body,{runtime:false,calculators:data}),b=browser(locale,body,{calculators:data});
    a.run('event-helper.js',original('event-helper.js'));b.run('event-helper.js');
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(calculateEvents(b),calculateEvents(a),locale);
    assert.equal(b.document.getElementById('ehChecklist').textContent,a.document.getElementById('ehChecklist').textContent);
    assert.deepEqual(b.fetches,a.fetches);
  }
});
test('new event locales use only embedded localized data and preserve calculator values',()=>{
  for(const row of locales.locales.filter(row=>!helper.UI[row.code])) {
    const locale=row.code,ui=tagged(helper.UI.en,locale),feature={ui,dayLabels:tagged(helper.DAY_LABELS.en,locale)};
    const data=calculators(locale);
    const body=payload(locale,{eventHelper:feature})+'<div id="ehCalculators"></div>'+`<script id="event-helper-events-data" type="application/json">{"events":[]}</script><script id="event-helper-calculators-data" type="application/json">${JSON.stringify(data)}</script>`;
    const b=browser(locale,body);b.run('event-helper.js');
    assert.deepEqual(calculateEvents(b),[ui.result+': '+Math.round(12345*2.5).toLocaleString(row.numberLocale)+' '+ui.points,ui.totalTime+': '+(26).toLocaleString(row.numberLocale)+'h 3m']);
    assert.equal(b.fetches.length,0);
    assert.equal(b.document.querySelector('h3').textContent,locale+':Power');
  }
});
test('a new event locale without its data displays a localized error instead of fetching English data',()=>{
  const locale='fr',feature={ui:tagged(helper.UI.en,locale),dayLabels:tagged(helper.DAY_LABELS.en,locale)};
  const b=browser(locale,payload(locale,{eventHelper:feature})+'<div id="ehCalculators"></div>');
  b.run('event-helper.js');
  assert.equal(b.fetches.length,0);
  assert.equal(b.document.getElementById('ehCalculators').textContent,feature.ui.error);
});
test('growth calculation numeric values remain identical to the immutable production implementation',()=>{
  const context=vm.createContext({module:{exports:{}}});
  vm.runInContext(original('database-22.js'),context);
  const before=context.module.exports.calculate,after=require('../js/database-22').calculate;
  const rows=[{from:1,to:2,cost:10},{from:2,to:3,cost:30},{from:3,to:4,cost:0}];
  for(const args of [[1,4,5],[1,1,0],[2,4,100],[4,1,0],[0,1,0],[1,4,-1],[1,4,0.5]]) {
    assert.deepEqual(JSON.parse(JSON.stringify(after(rows,...args))),JSON.parse(JSON.stringify(before(rows,...args))));
  }
  assert.deepEqual(after(rows.slice(1),1,4,0),{error:'invalid'});
});
test('building sheet carries live profile, range, exact mode and fragment to all 21 actual alternate routes',()=>{
  const B=require('./build-building-system');
  const links=locales.locales.map(row=>`<a hreflang="${row.hreflang}" href="/${row.code}/buildings/power-plant/">${row.nativeName}</a>`).join('');
  const b=browser('ko',`<header class="ts-header"><nav class="ts3-language">${links}</nav></header>`+B.sheet('ko','power-plant'));
  for(const row of locales.locales) {
    const link=b.document.createElement('link');link.rel='alternate';link.setAttribute('hreflang',row.hreflang);link.href=`https://tilessurvive.net/${row.code}/buildings/power-plant/`;b.document.head.append(link);
  }
  for(const [selector,initial] of [['[data-bs-choice]',''],['[data-bs-level]','all']]) {
    let value=initial;Object.defineProperty(b.document.querySelector(selector),'value',{get:()=>value,set:next=>{value=String(next);}});
  }
  b.window.location={href:'https://tilessurvive.net/ko/buildings/power-plant/?capture=1&range=26-30&exact=1#upgrade-sheet',origin:'https://tilessurvive.net',pathname:'/ko/buildings/power-plant/',search:'?capture=1&range=26-30&exact=1',hash:'#upgrade-sheet'};
  b.run('building-system.js');
  for(const link of b.document.querySelectorAll('a[hreflang]')) {
    const url=new URL(link.getAttribute('href'),'https://tilessurvive.net');
    assert.equal(url.pathname,`/${locales.normalize(link.getAttribute('hreflang'))}/buildings/power-plant/`);
    assert.equal(url.searchParams.get('level'),'26-30');assert.equal(url.searchParams.get('exact'),'1');assert.equal(url.searchParams.get('capture'),'1');assert.ok(url.searchParams.get('profile'));
    assert.equal(url.hash,'#upgrade-sheet');assert.equal((link.getAttribute('href').match(/\?/g)||[]).length,1);
  }
});
