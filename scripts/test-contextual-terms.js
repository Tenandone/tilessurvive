'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const G=require('./build-global-locales'),L=require('./lib/global-localization');
const CN=require('./build-simplified-chinese');
const context=require('../data/i18n/contextual-terms.json').entries[0];
const terms=require('../data/i18n/client-terms.json').terms;
const locales=Object.keys(context.exact[0].translations);

test('Undine aliases are scoped to that page for every ordinary new locale',()=>{
  assert.equal(locales.length,14);
  for(const locale of locales){
    const base=L.createTranslator(locale,G.catalogFor(locale));
    const old=base.translate('Wild Hunt');
    const translate=G.contextualTranslator(locale,{id:'heroes/undine/'},base);
    assert.equal(translate(' Wild Hunt '),' '+context.names[locale].value+' ');
    assert.equal(translate(' Pelagic Resonance '),' '+context.names[locale].value+' ');
    assert.equal(translate('Pelagic Resonance · allied back-row ATK'),translate(context.exact[1].source));
    assert.equal(base.translate('Wild Hunt'),old,'global dictionary mutated: '+locale);
    const travis=G.contextualTranslator(locale,{id:'heroes/travis/'},base);
    assert.equal(travis('Wild Hunt'),old,'Travis alias changed: '+locale);
    const caption=translate(context.exact[1].source);
    assert.ok(caption.startsWith(context.names[locale].value),locale+' caption');
    const quoted=translate(context.exact[2].source);
    assert.ok(quoted.includes(context.names[locale].value),locale+' named skill');
    assert.ok(quoted.includes('Wild Hunt'),locale+' historical external label');
    assert.deepEqual(L.numberSignature(quoted),L.numberSignature(context.exact[2].source));
    assert.deepEqual(L.placeholders(quoted),L.placeholders(context.exact[2].source));
  }
});

test('existing source languages receive no contextual substitution',()=>{
  for(const locale of L.existing){
    const base={translate:value=>value,used:new Map()};
    assert.equal(G.contextualTranslator(locale,{id:'heroes/undine/'},base)('Wild Hunt'),'Wild Hunt');
  }
});

test('Undine visible headings and JSON names agree while model data and other languages stay unchanged',()=>{
  const model={names:{en:context.exact[1].source,ko:'기존 한국어 이름'},id:'undine-skill-2',values:[{level:1,value:'6.00'}],args:['20%'],unit:'percent-bonus'};
  const source='<html lang="en"><head><title>Undine</title><link rel="canonical" href="https://tilessurvive.net/en/heroes/undine/"></head><body><button><span>Wild Hunt</span></button><details><summary>Wild Hunt</summary><p>'+context.exact[2].source+'</p></details><script id="model" type="application/json">'+JSON.stringify(model)+'</script></body></html>';
  for(const locale of locales){
    const group={id:'heroes/undine/',file:'en/heroes/undine/index.html',routes:{en:'/en/heroes/undine/',[locale]:'/'+locale+'/heroes/undine/'}};
    const d=G.localizePage(source,locale,group,[group],L.createTranslator(locale,G.catalogFor(locale)));
    assert.equal(d.querySelector('button span').textContent,context.names[locale].value);
    assert.equal(d.querySelector('summary').textContent,context.names[locale].value);
    const output=JSON.parse(d.getElementById('model').textContent);
    assert.ok(output.names[locale].startsWith(context.names[locale].value));
    assert.equal(output.names.en,model.names.en);assert.equal(output.names.ko,model.names.ko);
    assert.equal(output.id,model.id);assert.equal(output.unit,model.unit);
    assert.deepEqual(output.values,model.values);assert.deepEqual(output.args,model.args);
    assert.equal(parseHTML(source).document.querySelector('summary').textContent,'Wild Hunt');
  }
});

test('Simplified Chinese handles the legacy Traditional and English labels only on Undine',()=>{
  const converter=CN.createConverter(),name=context.names['zh-cn'].value;
  assert.equal(converter.convert('Wild Hunt','/zh-tw/heroes/undine/:text'),name);
  assert.equal(converter.convert('狂獵天賦','/zh-tw/heroes/undine/:text'),name);
  assert.equal(converter.convert('狂猎天赋','/zh-tw/heroes/undine/:text'),name);
  assert.equal(converter.convert('遠洋共振','/zh-tw/heroes/undine/:text'),name);
  assert.equal(converter.convert('遠洋共振・友軍後排攻擊','/zh-tw/heroes/undine/:json'),name+'・友军后排攻击');
  assert.equal(converter.convert('Wild Hunt','/zh-tw/heroes/travis/:text'),terms.survivor_travis_skill_2_name_newse['zh-cn']);
  const old='外部詳細頁列出Azure Anthem 507.35% ATK與Wild Hunt 8.34% ATK，但未標示技能等級。';
  const output=converter.convert(old,'/zh-tw/heroes/undine/:text');
  assert.ok(output.includes(name+'（原文旧称“Wild Hunt”）'));
  assert.deepEqual(CN.numericSequence(output),CN.numericSequence(old));
});

test('retained-client and authored terminology have distinct provenance',()=>{
  assert.equal(context.clientKey,'survivor_undine_skill_2_name_newse');
  for(const locale of ['ar','vi','nb']){
    assert.equal(context.names[locale].provenance,'authored');
    assert.equal(context.names[locale].officialClientLocaleVerified,false);
    assert.equal(context.names[locale].nativeSpeakerReview,false);
  }
  for(const locale of [...locales.filter(x=>!['ar','vi','nb'].includes(x)),...L.existing,'zh-cn']){
    assert.equal(context.names[locale].provenance,'retained-client');
    assert.match(context.names[locale].sourceSha256,/^[a-f0-9]{64}$/);
    assert.match(context.names[locale].sourceArtifact,/^ingame-apk-[\w-]+\.json$/);
  }
});

test('existing Undine correction changes exactly two labels and one current-locale prefix, with idempotence',()=>{
  const fs=require('node:fs'),path=require('node:path');
  for(const locale of L.existing){
    const document=parseHTML(fs.readFileSync(path.join(L.ROOT,locale,'heroes/undine/index.html'),'utf8')).document;
    const button=document.querySelector('button[data-skill-target="character-skill-0-2"] span'),summary=document.querySelector('details#character-skill-0-2 summary span');
    const node=document.getElementById('hero-skill-levels-data'),model=JSON.parse(node.textContent),row=model.hero.skills.find(s=>s.id==='undine-wild-hunt-10-11');
    button.textContent=summary.textContent=context.existingDisplayNames[locale];
    row.name[locale]=row.name[locale].replace(/^.*?(?=\s*[·・])/,context.existingDisplayNames[locale]);
    node.textContent=JSON.stringify(model);
    const before=document.documentElement.outerHTML,oldName=row.name[locale];
    assert.equal(G.repairContextualHeroNames(document,locale,{id:'heroes/undine/'}).length,3);
    const fixed=document.documentElement.outerHTML;
    assert.equal(button.textContent,context.names[locale].value);assert.equal(summary.textContent,context.names[locale].value);
    assert.deepEqual(G.repairContextualHeroNames(document,locale,{id:'heroes/undine/'}),[]);
    assert.equal(document.documentElement.outerHTML,fixed,'second pass is unchanged');
    button.textContent=summary.textContent=context.existingDisplayNames[locale];
    const corrected=JSON.parse(node.textContent);corrected.hero.skills.find(s=>s.id==='undine-wild-hunt-10-11').name[locale]=oldName;node.textContent=JSON.stringify(corrected);
    assert.equal(document.documentElement.outerHTML,before,'all other DOM and JSON bytes preserved: '+locale);
    assert.deepEqual(G.repairContextualHeroNames(document,locale,{id:'heroes/travis/'}),[]);
    button.textContent='Unreviewed skill';
    const invalid=document.documentElement.outerHTML;
    assert.throws(()=>G.repairContextualHeroNames(document,locale,{id:'heroes/undine/'}),/Unreviewed Undine/);
    assert.equal(document.documentElement.outerHTML,invalid,'invalid identity leaves DOM unchanged');
  }
});

test('German rebuild recognizes corrected Undine source without weakening unrelated missing-copy detection',()=>{
  const german=require('./build-german-50');
  const translator=german.createTranslator({exact:{}},[]);
  const source='<html lang="en"><head></head><body><h2>Pelagic Resonance</h2><p>Pelagic Resonance · allied back-row ATK</p><p>Unregistered body phrase</p></body></html>';
  const document=parseHTML(german.render(source,translator.translate,'heroes/undine/index.html')).document;
  assert.equal(document.querySelector('h2').textContent,context.names.de.value);
  assert.equal(document.querySelector('p').textContent,context.names.de.value+' · Allied Backrow ATK');
  assert.deepEqual([...translator.missing.keys()],['Unregistered body phrase']);
  const unrelated=german.createTranslator({exact:{}},[]);
  german.render(source,unrelated.translate,'heroes/travis/index.html');
  assert.ok(unrelated.missing.has('Pelagic Resonance'));
});

test('exact Undine search entries use verified names and preserve historical aliases and every other field',()=>{
  const {correctSearchEntry}=require('./lib/contextual-search');
  for(const locale of L.existing){
    const original={language:locale,title:context.existingDisplayNames[locale],description:'Unchanged 8.34%',url:'/'+locale+'/heroes/undine/#character-skill-0-2',aliases:'Retained alias'};
    const corrected=correctSearchEntry(original);
    assert.equal(corrected.title,context.names[locale].value);
    assert.ok(corrected.aliases.includes(original.aliases));assert.ok(corrected.aliases.includes(original.title));
    assert.deepEqual({...corrected,title:original.title,aliases:original.aliases},original);
    assert.deepEqual(correctSearchEntry(corrected),corrected);
    const travis={...original,url:original.url.replace('/undine/','/travis/')};assert.equal(correctSearchEntry(travis),travis);
  }
});
