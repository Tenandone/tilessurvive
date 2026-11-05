'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {parseHTML}=require('linkedom'),B=require('./build-v6-system'),R=require('../js/v6-system');

test('all 21 locale pages retain exact unowned HTML bytes and rebuild deterministically',()=>{
 const assets=B.assets();let count=0;const types=new Set();
 for(const locale of B.locales){let local=0;for(const file of B.walk(path.join(B.ROOT,locale))){
  const before=fs.readFileSync(file,'utf8'),route='/'+path.relative(B.ROOT,file).replaceAll('\\','/').replace(/index\.html$/,''),after=B.project(before,locale,route,{assets});
  assert.equal(B.strip(after),B.strip(before),file+' mutated unowned content (includes JSON, SEO, IDs, ads and TEN links)');
  assert.equal(B.project(after,locale,route,{assets}),after,file+' is not deterministic');
  if(after.includes('data-v6-system=""')){assert.equal((after.match(/TS_V6_SYSTEM_BEGIN/g)||[]).length,1);assert.equal((after.match(/data-v6-system=""/g)||[]).length,1);assert.equal((after.match(/\/css\/v6-system\.css\?v=/g)||[]).length,1);assert.equal((after.match(/\/js\/v6-system\.js\?v=/g)||[]).length,1);types.add(B.pageKind(route,locale));local++;}
  count++;
 }assert(local>100,'Missing locale coverage '+locale);}
 assert(count>2500);for(const type of ['home','hero-atlas','hero-detail','pet-atlas','pet-detail','tools','buildings','building-detail','research','database','codes','topup'])assert(types.has(type),type);
});

test('project requires a real locale content page and preserves redirects and language entry',()=>{
 const template='<html lang="en"><head><title>A</title></head><body><main>Text</main></body></html>';
 assert.equal(B.project(template,'en','/'),template);
 assert.equal(B.project(template.replace('<main>Text</main>',''),'en','/en/'),template.replace('<main>Text</main>',''));
 const redirect=template.replace('</head>','<meta http-equiv="refresh" content="0;url=/en/"></head>');assert.equal(B.project(redirect,'en','/en/old/'),redirect);
 assert.throws(()=>B.project(template,'invalid'),/Unsupported V6 locale/);
 const ar=B.project(template.replace('lang="en"','lang="ar" dir="rtl"'),'ar','/ar/heroes/lava/');assert.match(ar,/lang="ar" dir="rtl"/);assert.match(ar,/data-v6-page="hero-detail"/);
});

test('file build applies only locale index pages, supports dry run and has a zero-change second pass',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ts-v6-test-'));
 try{for(const asset of B.ASSETS){const target=path.join(temp,asset);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(B.ROOT,asset),target);}
  const input='<html lang="en"><head><title>A</title><script type="application/json">{"cost":3049}</script></head><body><main id="main">A</main></body></html>';
  for(const code of B.locales){fs.mkdirSync(path.join(temp,code),{recursive:true});fs.writeFileSync(path.join(temp,code,'index.html'),input);}
  fs.writeFileSync(path.join(temp,'index.html'),input);fs.mkdirSync(path.join(temp,'components'));fs.writeFileSync(path.join(temp,'components','index.html'),input);
  const first=B.build({root:temp,apply:false});assert.equal(first.changed,21);assert.equal(fs.readFileSync(path.join(temp,'en/index.html'),'utf8'),input);
  const applied=B.build({root:temp});assert.equal(applied.changed,21);assert.equal(B.build({root:temp}).changed,0);assert.equal(fs.readFileSync(path.join(temp,'index.html'),'utf8'),input);assert.equal(fs.readFileSync(path.join(temp,'components/index.html'),'utf8'),input);
 }finally{assert(temp.startsWith(path.join(os.tmpdir(),'ts-v6-test-')));fs.rmSync(temp,{recursive:true,force:true});}
});

function fixture(inner,dir='ltr'){
 const {document}=parseHTML('<html data-v6-system="" lang="ar" dir="'+dir+'"><body><main><h1>دليل الأبطال</h1><section><h2>المهارات</h2>'+inner+'</section></main></body></html>');
 const host={addEventListener(){},removeEventListener(){},setTimeout,clearTimeout};return {document,host};
}
function dimensions(node,width=300,scroll=600){for(const [key,value]of Object.entries({clientWidth:width,scrollWidth:scroll,clientHeight:200,scrollHeight:200}))Object.defineProperty(node,key,{value,writable:true,configurable:true});}

test('overflowing tables gain a native keyboard stop and localized name without touching data or handlers',()=>{
 const {document,host}=fixture('<div class="xssr-table-wrap"><table><caption>تكلفة النمو</caption><tbody><tr><td>3049</td><td><button id="calc">حساب</button></td></tr></tbody></table></div>','rtl'),node=document.querySelector('.xssr-table-wrap'),button=document.querySelector('#calc'),table=node.querySelector('table'),original=table.outerHTML;
 dimensions(node);let clicked=0;button.addEventListener('click',()=>clicked++);const mounted=R.mount(document,host);
 assert.equal(node.getAttribute('tabindex'),'0');assert.equal(node.getAttribute('role'),'region');assert.equal(node.getAttribute('aria-label'),'تكلفة النمو');assert.equal(table.outerHTML,original);assert.equal(document.querySelector('#calc'),button);button.click();assert.equal(clicked,1);
 node.scrollWidth=250;mounted.refresh();assert.equal(node.getAttribute('tabindex'),null);assert.equal(node.getAttribute('role'),null);assert.equal(node.getAttribute('aria-label'),null);
 node.scrollWidth=700;mounted.refresh();assert.equal(node.getAttribute('tabindex'),'0');mounted.destroy();assert.equal(node.getAttribute('data-v6-scroll'),null);assert.equal(table.outerHTML,original);
});

test('dynamic results and nested tables have one scroll stop, and existing semantics remain exact',()=>{
 const {document,host}=fixture('<div class="ts-table-wrap"><div class="r60-scroll" tabindex="-1" role="group" aria-labelledby="old" aria-label="Existing"><table><tr><td>10</td></tr></table></div></div>'),outer=document.querySelector('.ts-table-wrap'),inner=document.querySelector('.r60-scroll');dimensions(outer);dimensions(inner);
 const mounted=R.mount(document,host);assert.equal(outer.getAttribute('tabindex'),null);assert.equal(inner.getAttribute('tabindex'),'-1');assert.equal(inner.getAttribute('role'),'group');assert.equal(inner.getAttribute('aria-label'),'Existing');assert.equal(inner.getAttribute('aria-labelledby'),'old');
 const section=document.querySelector('section');section.insertAdjacentHTML('beforeend','<div class="v4-table-wrap"><table><tr><td>20</td></tr></table></div>');const dynamic=section.querySelector('.v4-table-wrap');dimensions(dynamic);mounted.refresh();assert.equal(dynamic.getAttribute('tabindex'),'0');assert.equal(dynamic.getAttribute('aria-label'),'المهارات');
 dynamic.remove();mounted.refresh();assert.equal(dynamic.getAttribute('tabindex'),null);mounted.destroy();assert.equal(inner.getAttribute('tabindex'),'-1');assert.equal(inner.getAttribute('role'),'group');
});

test('hidden, non-scrolling and unrelated tables do not add focus noise',()=>{
 const {document,host}=fixture('<div hidden><div class="v4-table-wrap"><table><tr><td>1</td></tr></table></div></div><div class="r60-scroll"><table><tr><td>2</td></tr></table></div><div id="unowned"><table><tr><td>3</td></tr></table></div>');
 dimensions(document.querySelector('.v4-table-wrap'));dimensions(document.querySelector('.r60-scroll'),500,300);const mounted=R.mount(document,host);assert.equal(document.querySelectorAll('[tabindex]').length,0);assert.equal(document.querySelector('#unowned').getAttribute('data-v6-scroll'),null);mounted.destroy();
});

test('design tokens meet text contrast and stylesheet covers actual component selectors, RTL and motion preferences',()=>{
 const css=fs.readFileSync(path.join(B.ROOT,'css/v6-system.css'),'utf8'),tokens=Object.fromEntries([...css.matchAll(/--v6-([a-z-]+):#([a-f0-9]{6});/g)].map(m=>[m[1],m[2]]));
 const luminance=hex=>{const c=hex.match(/../g).map(n=>parseInt(n,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
 for(const [fg,bg]of [['text','surface'],['muted','background'],['on-dark','secondary'],['secondary','accent'],['dark-muted','secondary'],['footer-muted','secondary'],['warning','surface'],['error','surface']]){const a=luminance(tokens[fg]),b=luminance(tokens[bg]);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,fg+'/'+bg);}
 assert(css.includes('.ts-footer>small{color:var(--v6-footer-muted)}'));
 for(const selector of ['.hero-atlas-card','.hero-guide-hero','.ts3-pet-gallery','.ts3-pet-stage','.v4-workbench','.building-system','.r60-controls','.codeCard','.topup-hero','.ten-benefit-flow'])assert(css.includes(selector),selector);
 assert(css.includes('[dir=rtl]'));assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('forced-colors:active'));assert(css.includes(':focus-visible'));assert(css.includes('font-variant-numeric:tabular-nums'));
 // Homepage hierarchy and controls belong to v6-landing.css, including mobile.
 assert(!/html\[data-v6-system\] main h[123]\s*\{/.test(css));
 assert(!/html\[data-v6-system\] main :is\(input/.test(css));
 for(const heading of ['h1','h2','h3'])assert(css.includes('main:not(:has([data-v5-home])) '+heading+'{'));
 assert(css.includes('main:not(:has([data-v5-home])) :is(h1,h2,h3,h4)'));
 assert(!/@import|url\(https?:|display\s*:\s*contents/.test(css));assert(Buffer.byteLength(css)<50000);assert(fs.statSync(path.join(B.ROOT,'js/v6-system.js')).size<6000);
});
