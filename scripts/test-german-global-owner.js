'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const G=require('./build-german-50');
const english=require('../data/i18n/ui/en.json'),german=require('../data/i18n/ui/de.json');
const registry=require('../data/i18n/locales.json');
const ui=()=>({locale:'en',copy:structuredClone(english.copy),affiliate:english.affiliate.slice(),featureCopies:{}});

test('German inherited renderer uses all reviewed global UI labels and keeps exact locale routes',()=>{
  const routes=Object.fromEntries(registry.locales.map(entry=>[entry.code,'/'+entry.code+'/heroes/tazan/']));
  routes.ko='/ko/heroes/tarzan/';routes.de='/de/heroes/distinct-german-slug/';
  const source='<html lang="en"><head><script id="ts-global-ui" type="application/json">'+JSON.stringify(ui())+'</script><script id="ts-locale-routes" type="application/json">'+JSON.stringify(routes)+'</script></head><body><p>Unknown inherited body text still needs a translation</p></body></html>';
  const translator=G.createTranslator({exact:{}});
  const d=parseHTML(G.render(source,translator.translate,'about/index.html')).document;
  const projected=JSON.parse(d.getElementById('ts-global-ui').textContent);
  assert.equal(projected.locale,'de');assert.equal(Object.keys(projected.copy).length,44);
  assert.deepEqual(projected.copy,german.copy);assert.deepEqual(projected.affiliate,german.affiliate);
  assert.deepEqual(JSON.parse(d.getElementById('ts-locale-routes').textContent),routes);
  assert.equal(Object.keys(routes).length,21);
  assert.deepEqual([...translator.missing.keys()],['Unknown inherited body text still needs a translation']);
});

test('German global UI preserves each existing feature owner and source numeric shapes',()=>{
  const workbench=require('../js/data-workbench-30'),speedup=require('../js/tools-speedup-calculator'),events=require('../js/event-helper');
  const input=ui();input.featureCopies={dataWorkbench:workbench.copy.en,speedup:speedup.UI.en,eventHelper:{ui:events.UI.en,dayLabels:events.DAY_LABELS.en}};
  const before=JSON.stringify(input),output=G.projectGlobalUI(input);
  assert.deepEqual(output.featureCopies,{dataWorkbench:workbench.copy.de,speedup:speedup.UI.de,eventHelper:{ui:events.UI.de,dayLabels:events.DAY_LABELS.de}});
  assert.equal(JSON.stringify(input),before);
});

test('German global UI rejects unreviewed fields instead of suppressing missing coverage',()=>{
  const changed=ui();changed.copy.search='An unreviewed replacement search label';
  assert.throws(()=>G.projectGlobalUI(changed),/Unreviewed shared UI source/);
  const extra=ui();extra.copy.unreviewed='A new unreviewed label';
  assert.throws(()=>G.projectGlobalUI(extra),/Shared UI key mismatch/);
  const feature=ui();feature.featureCopies.unreviewed={title:'Unknown feature'};
  assert.throws(()=>G.projectGlobalUI(feature),/Unknown shared UI feature/);
});
