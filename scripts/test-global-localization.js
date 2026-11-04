'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization');
const {localizePage,enhance,catalogFor}=require('./build-global-locales');
test('missing text and changed quantities fail the publication gate',()=>{
 const t=L.createTranslator('fr',{exact:{'Cost: 120':'Coût : 121','Build {count}':'Construire {n}'}});
 assert.equal(t.translate('Unknown prose','test'),'Unknown prose');
 t.translate('Cost: 120');t.translate('Build {count}');
 assert.equal(t.missing.size,1);assert.deepEqual(t.errors.map(e=>e.error),['numeric-signature','placeholder-signature']);
});
test('names and resource quantities use official terminology without changing amounts',()=>{
 const t=L.createTranslator('fr',catalogFor('fr'));
 assert.equal(t.translate('Food 14,009,000'),'Vivres 14,009,000');
 assert.equal(t.translate('14d 1h 50m 16s'),'14j 1h 50min 16s');
 assert.equal(t.translate('Base time 14d 1h 50m 16s (1,216,216 s)'),'Durée de base 14j 1h 50min 16s (1,216,216 s)');
 assert.equal(t.errors.length,0);assert.equal(t.missing.size,0);
});
test('localized official quantity notation is compared semantically',()=>{
 assert.deepEqual(L.numberSignature('10K Food'),L.numberSignature('10 000 Vivres','fr'));
 assert.deepEqual(L.numberSignature('100K Food'),L.numberSignature('10万食物','zh-cn'));
 assert.notDeepEqual(L.numberSignature('10K Food'),L.numberSignature('100 000 Vivres','fr'));
 assert.notDeepEqual(L.numberSignature('-10%'),L.numberSignature('+10%'));
  assert.deepEqual(L.numberSignature('level-1 skills; training-stage 2, 4 and 5'),L.numberSignature('compétences de niveau 1 ; étapes 2, 4 et 5'));
  assert.deepEqual(L.numberSignature('HP-10'),['-10']);
});
test('JSON localization changes presentation and exact routes, retaining model IDs and scalars',()=>{
 const groups=[{routes:{en:'/en/heroes/tazan/',fr:'/fr/heroes/tazan/',ko:'/ko/heroes/tarzan/'}}];
 const original={lang:'en',locale:'en-US',id:'health',cost:15000,ratio:0.125,pattern:{unit:'day',kind:'research',target:'research-1'},copy:{cost:'Cost',kind:'Reference type',target:'Reference target',source:'Source'},names:{en:'Ray',ko:'레이'},slug:'tazan',href:'/en/heroes/tazan/?level=2#gear'};
 const out=L.localizeJSON(original,'fr',s=>({Cost:'Coût','Reference type':'Type de référence','Reference target':'Cible de référence',Source:'Source'}[s]||s),groups);
 assert.equal(out.copy.kind,'Type de référence');assert.equal(out.copy.target,'Cible de référence');assert.deepEqual(out.pattern,original.pattern);
 assert.equal(out.lang,'fr');assert.equal(out.locale,'fr-FR');assert.equal(out.copy.cost,'Coût');assert.equal(out.names.fr,'Ray');
 assert.equal(out.id,original.id);assert.equal(out.cost,15000);assert.equal(out.ratio,0.125);assert.equal(out.slug,'tazan');
  assert.equal(out.pattern.unit,'day');
 assert.equal(out.href,'/fr/heroes/tazan/?level=2#gear');assert.equal(original.copy.cost,'Cost');
});
test('unknown URLs are not guessed and external links are unchanged',()=>{
 const g=[{routes:{en:'/en/heroes/tazan/',ko:'/ko/heroes/tarzan/'}}];
 assert.equal(L.routeURL('/en/heroes/tazan/','ko',g),'/ko/heroes/tarzan/');
 assert.equal(L.routeURL('/en/unknown/','ko',g),'/en/unknown/');
 assert.equal(L.routeURL('https://example.org/en/heroes/tazan/','ko',g),'https://example.org/en/heroes/tazan/');
 const aliases=[{routes:{en:'/en/tools/event-helper/',fr:'/fr/tools/event-helper/'}},{routes:{en:'/en/behemoths/marine-drake/',fr:'/fr/behemoths/marine-drake/'}}];
 assert.equal(L.routeURL('/en/event-helper/?x=1#details','fr',aliases),'/fr/tools/event-helper/?x=1#details');
 assert.equal(L.routeURL('/en/behemoths/tidal-drake/','fr',aliases),'/fr/behemoths/marine-drake/');
});

test('building runtime display units and number locale follow the selected language without changing model units',()=>{
 const model={lang:'en',locale:{numberLocale:'en',units:{seconds:' s',duration:['d','h','m','s']}},rows:[{cost:37400,time:7,unit:'day'}]};
 const source='<html><head></head><body><script type="application/json" data-building-system-model>'+JSON.stringify(model)+'</script></body></html>';
 const group={file:'en/buildings/power-plant/index.html',routes:{en:'/en/buildings/power-plant/',id:'/id/buildings/power-plant/'}};
 const d=localizePage(source,'id',group,[group],L.createTranslator('id',catalogFor('id')));
 const out=JSON.parse(d.querySelector('[data-building-system-model]').textContent);
 assert.equal(out.locale.numberLocale,'id-ID');
 assert.deepEqual(out.locale.units.duration,['h','j','mnt','dtk']);
 assert.equal(out.locale.units.seconds,' dtk');
 assert.deepEqual(out.rows,model.rows);
});
test('visible faction and promotion captions are not mistaken for URLs',()=>{
 const t=L.createTranslator('fr',{exact:{' / Sea · SSR · Melee':' / Mer · SSR · Corps à corps','#s4qU Exclusive Benefits':'#s4qU Avantages exclusifs'}});
 assert.equal(t.translate(' / Sea · SSR · Melee'),' / Mer · SSR · Corps à corps');
 assert.equal(t.translate('#s4qU Exclusive Benefits'),'#s4qU Avantages exclusifs');
 assert.equal(t.translate('/fr/heroes/shark/'),'/fr/heroes/shark/');assert.equal(t.translate('#skills'),'#skills');assert.equal(t.missing.size,0);
});
test('nested calendar locale, runtime copy and no-script fallback use the target language',()=>{
 const source='<html lang="en"><head><title>Cost</title></head><body><div id="event-calendar" data-lang="en"><noscript>Cost</noscript></div><script id="event-calendar-copy" type="application/json">{"target":"Target points","intro":"Cost"}</script></body></html>';
 const t=L.createTranslator('fr',{exact:{Cost:'Coût','Target points':'Points visés'}});
 const d=localizePage(source,'fr',{file:'en/events/calendar/index.html',routes:{en:'/en/events/calendar/',fr:'/fr/events/calendar/'}},[],t);
 assert.equal(d.getElementById('event-calendar').dataset.lang,'fr');assert.equal(d.querySelector('noscript').textContent,'Coût');
 assert.equal(JSON.parse(d.getElementById('event-calendar-copy').textContent).target,'Points visés');assert.equal(t.missing.size,0);
});
test('rendering preserves numeric form state, data payload, advertisements and formula scripts',()=>{
 const source='<!doctype html><html lang="en"><head><title>Cost</title><link rel="canonical" href="https://tilessurvive.net/en/tools/"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9189957764761115" crossorigin="anonymous"></script></head><body><h1>Cost</h1><input type="number" id="level" value="3" min="1" max="80"><script type="application/json" id="model">{"cost":15000,"ratio":0.25,"copy":{"cost":"Cost"}}</script><script>const cost=15000;function total(n){return n*cost;}</script></body></html>';
 const group={file:'en/tools/index.html',routes:{en:'/en/tools/',fr:'/fr/tools/'}};
 const t=L.createTranslator('fr',{exact:{Cost:'Coût'}}),d=localizePage(source,'fr',group,[group],t);
 assert.equal(d.querySelector('h1').textContent,'Coût');assert.equal(d.documentElement.lang,'fr');
 assert.equal(d.querySelector('#level').outerHTML,parseHTML(source).document.querySelector('#level').outerHTML);
 assert.equal(JSON.parse(d.querySelector('#model').textContent).cost,15000);
 assert.match(d.toString(),/function total\(n\)\{return n\*cost;\}/);
 assert.match(d.toString(),/ca-pub-9189957764761115/);assert.equal(t.errors.length,0);
});
test('preview never advertises itself as indexable and uses available reciprocal routes',()=>{
 const d=parseHTML('<html><head><script defer src="/js/platform-i18n.js"></script></head><body><details class="ts3-language"><summary>EN</summary><nav></nav></details></body></html>').document;
 const group={routes:{en:'/en/',fr:'/fr/',ar:'/ar/'}};
 const out=enhance(d,'fr',group,['en','fr'],require('../data/i18n/ui/fr.json'),{preview:true});
 const result=parseHTML(out).document;
 assert.equal(result.querySelector('meta[name="robots"]').content,'noindex,nofollow');
 assert.equal(result.querySelectorAll('.ts3-language nav a').length,2);
  assert.equal(result.querySelector('.ts3-language nav a[hreflang="fr"]').href,'/fr/');
 assert.equal(result.querySelector('.ts3-language summary').textContent,'FR');
 assert.equal(result.querySelector('script[src]').src.split('?')[0],'/js/site-locales.js');
  assert.deepEqual([...result.head.querySelectorAll('script[src]')].slice(0,2).map(s=>s.src.split('?')[0]),['/js/site-locales.js','/js/platform-i18n.js']);
 assert.deepEqual(JSON.parse(result.getElementById('ts-locale-routes').textContent),{en:'/en/',fr:'/fr/'});
 assert.equal(result.querySelector('link[hreflang="ar"]'),null);
});
