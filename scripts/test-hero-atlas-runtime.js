'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');
const source = fs.readFileSync(path.join(__dirname, '../js/hero-atlas.js'), 'utf8');
const copy = {results:'{forms} forms · {heroes} heroes',empty:'No matches. Enable held records to inspect unverified releases.',compareLimit:'Select up to 3 forms.',selected:'{count}/3 selected',remove:'Remove',compare:'Compare forms',fields:{name:'Name',faction:'Faction',rarity:'Rarity',role:'Role',form:'Form',status:'Release status'}};
const records = [
  {id:'alpha',identity:'alpha',name:'Alpha',faction:'1',rarity:'SR',role:'melee',form:'base',publication:'published',aliases:'Alpha 알파'},
  {id:'bravo',identity:'bravo',name:'Beta',faction:'2',rarity:'SSR',role:'ranged',form:'base',publication:'published',aliases:'Beta ベータ 비타 بِيتا'},
  {id:'charlie',identity:'charlie',name:'Éclair',faction:'1',rarity:'SSR',role:'mid',form:'base',publication:'published',aliases:'Éclair 에클레어'},
  {id:'delta',identity:'delta',name:'Zeta',faction:'1',rarity:'SSR',role:'ranged',form:'base',publication:'published',aliases:'Zeta'},
  {id:'echo',identity:'echo',name:'Aaron',faction:'1',rarity:'R',role:'melee',form:'base',publication:'published',aliases:'Aaron'},
  {id:'alpha-ssr',identity:'alpha',name:'Alpha',faction:'1',rarity:'SSR',role:'melee',form:'promoted',publication:'held',aliases:'Alpha 알파'}
];
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function card(r) {
  return `<article class="hero-atlas-card" data-atlas-id="${escape(r.id)}" data-identity="${escape(r.identity)}" data-faction="${r.faction}" data-rarity="${r.rarity}" data-role="${r.role}" data-form="${r.form}" data-publication="${r.publication}" data-search="${escape(r.aliases)}"><a data-atlas-detail href="/en/heroes/${r.identity}/#${r.form}"><h3 data-atlas-field="name">${escape(r.name)}</h3></a>${['faction','rarity','role','form'].map(k=>`<span data-atlas-field="${k}">${r[k]}</span>`).join('')}<span data-atlas-field="status">${r.publication==='held'?'Release unverified':'Published'}</span><label><input type="checkbox" data-atlas-compare value="${escape(r.id)}">Compare</label></article>`;
}
function setup({run=true,locale='en',rows=records,configCopy=copy,tableTag='div'}={}) {
  const choices={faction:['1','2','3','4'],rarity:['R','SR','SSR','X-SSR'],role:['melee','mid','ranged'],form:['base','promoted']};
  const html=`<html><body><main><section data-hero-atlas><script type="application/json" data-atlas-config>${JSON.stringify({locale,copy:configCopy})}</script><div data-atlas-controls hidden><label>Name<input data-atlas-query></label>${Object.entries(choices).map(([k,v])=>`<label>${k}<select data-atlas-filter="${k}"><option value="">All</option>${v.map(n=>`<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}<select data-atlas-sort><option value="original">Original</option><option value="name">Name</option></select><button data-atlas-reset>Reset</button><label><input type="checkbox" data-atlas-include-held>Include held records</label></div><p role="status" data-atlas-status></p><p data-atlas-empty hidden></p><section data-atlas-group id="existing-faction"><div data-atlas-grid>${rows.filter(r=>r.publication!=='held').map(card).join('')}</div></section><section data-atlas-group data-atlas-held-group id="held"><h2>Unverified release records</h2><div data-atlas-grid>${rows.filter(r=>r.publication==='held').map(card).join('')}</div></section><section data-atlas-comparison hidden><p role="status" data-atlas-selected></p><button data-atlas-clear-compare>Clear</button><${tableTag} data-atlas-comparison-table></${tableTag}></section><script type="application/json" id="unchanged-game-fixture">{"heroId":25300001,"costs":[5,10,20,25,30],"unverified":null}</script></section></main></body></html>`;
  const {document,Event}=parseHTML(html),host=document.querySelector('[data-hero-atlas]');
  for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:select.querySelector('option')?.getAttribute('value')||'',writable:true,configurable:true});
  let registrations=0,focusCount=0;
  for(const node of host.querySelectorAll('input,select,button')){const old=node.addEventListener.bind(node);node.addEventListener=(...args)=>{registrations++;return old(...args);};}
  const input=host.querySelector('[data-atlas-query]');input.value='';input.focus=()=>{focusCount++;};
  const forbidden=()=>{throw Error('The atlas must not use network, storage, analytics, popups or navigation');};
  const location=new URL('https://tilessurvive.net/en/heroes/?retained=value#existing-faction');
  const context=vm.createContext({document,window:{location},URL,Intl,Map,Set,console,fetch:forbidden,alert:forbidden,localStorage:{getItem:forbidden,setItem:forbidden},sessionStorage:{getItem:forbidden,setItem:forbidden}});
  const execute=()=>vm.runInContext(source,context);
  const event=(node,type)=>node.dispatchEvent(new Event(type,{bubbles:true}));
  const byId=id=>[...host.querySelectorAll('.hero-atlas-card')].find(n=>n.dataset.atlasId===id);
  const select=id=>{const box=byId(id).querySelector('[data-atlas-compare]');box.checked=true;event(box,'change');return box;};
  const filter=(key,value)=>{const node=host.querySelector('[data-atlas-filter="'+key+'"]');node.value=value;event(node,'change');};
  const search=value=>{input.value=value;event(input,'input');};
  const held=value=>{const node=host.querySelector('[data-atlas-include-held]');node.checked=value;event(node,'change');};
  const visible=()=>[...host.querySelectorAll('.hero-atlas-card')].filter(n=>!n.hidden).map(n=>n.dataset.atlasId);
  if(run)execute();
  return {document,host,event,byId,select,filter,search,held,visible,execute,location,get registrations(){return registrations;},get focusCount(){return focusCount;}};
}

test('without JavaScript every source card and its release status remain readable, with dormant controls and unchanged JSON',()=>{
  const a=setup({run:false});assert.equal(a.visible().length,6);assert(a.host.querySelector('[data-atlas-controls]').hidden);assert(a.host.querySelector('[data-atlas-comparison]').hidden);
  assert.equal(a.byId('alpha-ssr').querySelector('[data-atlas-field="status"]').textContent,'Release unverified');
  const before=a.document.getElementById('unchanged-game-fixture').textContent,config=a.host.querySelector('[data-atlas-config]').textContent;a.execute();
  assert.equal(a.document.getElementById('unchanged-game-fixture').textContent,before);assert.equal(a.host.querySelector('[data-atlas-config]').textContent,config);
  assert(!a.host.querySelector('[data-atlas-controls]').hidden);assert(a.host.hasAttribute('data-atlas-ready'));
});

test('typed filters intersect rather than mixing faction, rarity, role and form labels',()=>{
  const a=setup();a.filter('faction','1');a.filter('rarity','SSR');a.filter('role','mid');assert.deepEqual(a.visible(),['charlie']);
  a.filter('role','ranged');assert.deepEqual(a.visible(),['delta']);a.filter('faction','2');assert.deepEqual(a.visible(),['bravo']);
  a.filter('form','promoted');assert.deepEqual(a.visible(),[]);assert(!a.host.querySelector('[data-atlas-empty]').hidden);
});

test('Unicode aliases support full-width text, composed accents, Korean, Japanese and Arabic marks',()=>{
  const a=setup();for(const [q,id]of [['ＡＬＰＨＡ','alpha'],['eclair','charlie'],['ÉCLAIR','charlie'],['에클레어','charlie'],['ベータ','bravo'],['بيتا','bravo'],['비타','bravo']]){a.search(q);assert.deepEqual(a.visible(),[id],q);}
  a.search('  alpha   알파  ');assert.deepEqual(a.visible(),['alpha']);
});

test('held release records require the separate toggle, do not auto-enable for promoted filter, and count identities distinctly',()=>{
  const a=setup();assert.equal(a.visible().length,5);assert(a.document.getElementById('held').hidden);
  a.filter('form','promoted');assert.deepEqual(a.visible(),[]);assert.equal(a.host.querySelector('[data-atlas-include-held]').checked,false);
  a.held(true);assert.deepEqual(a.visible(),['alpha-ssr']);assert(!a.document.getElementById('held').hidden);
  a.filter('form','');a.search('alpha');assert.equal(a.host.querySelector('[data-atlas-status]').textContent,'2 forms · 1 heroes');
  a.held(false);assert.deepEqual(a.visible(),['alpha']);
});

test('name sorting is stable within groups and reset restores the original order and default held gate',()=>{
  const a=setup(),sort=a.host.querySelector('[data-atlas-sort]');sort.value='name';a.event(sort,'change');assert.deepEqual(a.visible(),['echo','alpha','bravo','charlie','delta']);
  a.held(true);a.search('alpha');a.filter('rarity','SSR');a.event(a.host.querySelector('[data-atlas-reset]'),'click');
  assert.deepEqual(a.visible(),['alpha','bravo','charlie','delta','echo']);assert.equal(a.focusCount,1);assert.equal(a.host.querySelector('[data-atlas-include-held]').checked,false);
});

test('comparison caps at three forms, uses text metadata and detail links, and permits explicit removal or clear',()=>{
  const a=setup();a.select('alpha');a.select('bravo');a.select('charlie');const fourth=a.select('delta');assert.equal(fourth.checked,false);
  assert(a.host.querySelector('[data-atlas-selected]').textContent.includes(copy.compareLimit));
  const table=a.host.querySelector('.hero-atlas-comparison-table');assert.equal(table.querySelectorAll('thead a').length,3);assert.equal(table.querySelectorAll('tbody tr').length,5);assert.equal(table.querySelectorAll('img,input,.hero-atlas-card').length,0);
  assert.deepEqual([...table.querySelectorAll('thead a')].map(n=>n.getAttribute('href')),['/en/heroes/alpha/#base','/en/heroes/bravo/#base','/en/heroes/charlie/#base']);
  a.event(table.querySelector('[data-atlas-remove="bravo"]'),'click');assert.equal(a.byId('bravo').querySelector('[data-atlas-compare]').checked,false);assert.equal(a.host.querySelectorAll('thead a').length,2);
  a.select('delta');assert.equal(a.host.querySelectorAll('thead a').length,3);a.event(a.host.querySelector('[data-atlas-clear-compare]'),'click');assert(a.host.querySelector('[data-atlas-comparison]').hidden);assert([...a.host.querySelectorAll('[data-atlas-compare]')].every(n=>!n.checked));
});

test('selection survives ordinary filters, held records becoming hidden, zero results and reset',()=>{
  const a=setup();a.held(true);a.select('alpha');a.select('alpha-ssr');a.held(false);assert.equal(a.host.querySelectorAll('thead a').length,2);
  a.search('no matches');assert.deepEqual(a.visible(),[]);assert(a.document.getElementById('existing-faction').hidden);assert(!a.host.querySelector('[data-atlas-comparison]').hidden);
  a.event(a.host.querySelector('[data-atlas-reset]'),'click');assert.equal(a.host.querySelectorAll('thead a').length,2);assert(a.byId('alpha-ssr').querySelector('[data-atlas-compare]').checked);assert(a.byId('alpha-ssr').hidden);
});

test('comparison inserts hostile-looking names as text and never creates an unsafe detail destination',()=>{
  const rows=records.map(r=>({...r}));rows[0].name='<img src=x onerror=alert(1)>';const a=setup({rows});a.byId('alpha').querySelector('[data-atlas-detail]').setAttribute('href','javascript:alert(1)');a.select('alpha');
  const table=a.host.querySelector('.hero-atlas-comparison-table');assert.equal(table.querySelectorAll('img,a,[onerror]').length,0);assert(table.textContent.includes(rows[0].name));
});

test('malformed or incomplete configuration and duplicate form identities leave the static page intact',()=>{
  for(const a of [setup({configCopy:{...copy,compareLimit:''}}),setup({rows:[...records,records[0]]})]){assert(!a.host.hasAttribute('data-atlas-ready'));assert(a.host.querySelector('[data-atlas-controls]').hidden);assert(a.visible().length>=6);}
  const a=setup({run:false});a.host.querySelector('[data-atlas-config]').textContent='{invalid';assert.doesNotThrow(a.execute);assert(!a.host.hasAttribute('data-atlas-ready'));
});

test('table host, Arabic display numbers, accessibility labels and repeated initialization retain one controller',()=>{
  const a=setup({locale:'ar',tableTag:'table'});const registrations=a.registrations;a.execute();assert.equal(a.registrations,registrations);
  a.select('alpha');assert.equal(a.host.querySelectorAll('[data-atlas-comparison-table]').length,1);assert.equal(a.host.querySelectorAll('table table').length,0);
  assert.equal(a.host.querySelector('[data-atlas-status]').getAttribute('aria-live'),'polite');assert(a.host.querySelector('[data-atlas-remove]').getAttribute('aria-label').includes('Alpha'));
  assert.equal(a.host.querySelector('[data-atlas-selected]').textContent,new Intl.NumberFormat('ar').format(1)+'/3 selected');
  assert.equal(a.location.href,'https://tilessurvive.net/en/heroes/?retained=value#existing-faction');
});

test('all 21 real locale renderers satisfy the runtime contract with 31 catalog identities and six held forms',()=>{
  const atlas=require('./build-hero-atlas');
  const locales=require('../data/i18n/locales.json').locales.map(row=>row.code);assert.equal(locales.length,21);
  for(const locale of locales){
    const {document,Event}=parseHTML('<html><body>'+atlas.renderHub(locale)+'</body></html>');
    for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{value:select.querySelector('option')?.getAttribute('value')||'',writable:true});
    const host=document.querySelector('[data-hero-atlas]');
    vm.runInNewContext(source,{document,window:{location:new URL('https://tilessurvive.net/'+locale+'/heroes/')},URL,Intl,Map,Set});
    assert(host.hasAttribute('data-atlas-ready'),locale+' renderer/runtime initialization');
    const cards=[...host.querySelectorAll('.hero-atlas-card')];assert.equal(cards.length,37);assert.equal(cards.filter(c=>!c.hidden).length,31);
    assert.equal(new Set(cards.filter(c=>!c.hidden).map(c=>c.dataset.identity)).size,31);
    const promoted=host.querySelector('[data-atlas-filter="form"]');promoted.value='promoted';promoted.dispatchEvent(new Event('change'));
    assert.equal(cards.filter(c=>!c.hidden).length,0);
    const include=host.querySelector('[data-atlas-include-held]');include.checked=true;include.dispatchEvent(new Event('change'));
    assert.equal(cards.filter(c=>!c.hidden).length,6);assert(cards.filter(c=>!c.hidden).every(c=>c.dataset.publication==='held'));
    promoted.value='';promoted.dispatchEvent(new Event('change'));
    const query=host.querySelector('[data-atlas-query]');query.value='Sage';query.dispatchEvent(new Event('input'));
    const matches=cards.filter(c=>!c.hidden);assert.equal(matches.length,2,locale+' Sage alias includes both retained Sarge forms');
    assert.deepEqual([...new Set(matches.map(c=>c.dataset.identity))],['sarge'],locale+' aliases never create a second hero identity');
    promoted.value='promoted';promoted.dispatchEvent(new Event('change'));
    assert.equal(cards.filter(c=>!c.hidden).length,1,locale+' promoted AND Sage alias');
    assert.equal(cards.find(c=>!c.hidden).dataset.publication,'held');
  }
});

test('a compact comparison jump appears once selections exist and retains the current path and query',()=>{
  const a=setup(),jump=a.host.querySelector('[data-atlas-compare-jump]');assert(jump.hidden);
  assert.equal(jump.getAttribute('href'),'/en/heroes/?retained=value#hero-atlas-comparison');
  assert.equal(a.host.querySelector('[data-atlas-comparison]').id,'hero-atlas-comparison');
  a.select('alpha');assert(!jump.hidden);assert.equal(jump.textContent,'Compare forms · 1/3 selected');
  a.search('zero results');assert(!jump.hidden);assert.equal(a.host.querySelectorAll('[data-atlas-compare-jump]').length,1);
  a.execute();assert.equal(a.host.querySelectorAll('[data-atlas-compare-jump]').length,1);
  a.event(a.host.querySelector('[data-atlas-clear-compare]'),'click');assert(jump.hidden);
  assert.equal(a.location.href,'https://tilessurvive.net/en/heroes/?retained=value#existing-faction','navigation waits for the user to follow the native link');
});
