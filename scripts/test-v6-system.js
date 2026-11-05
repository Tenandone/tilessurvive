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
 dimensions(node);let clicked=0;button.addEventListener('click',()=>clicked++);const mounted=R.mount(document,host);mounted.refresh();
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
 dimensions(document.querySelector('.v4-table-wrap'));dimensions(document.querySelector('.r60-scroll'),500,300);const mounted=R.mount(document,host);mounted.refresh();assert.equal(document.querySelectorAll('[tabindex]').length,0);assert.equal(document.querySelector('#unowned').getAttribute('data-v6-scroll'),null);mounted.destroy();
});

test('whole-card presentation uses original native links and preserves comparison, secondary links and expandable content',()=>{
 const {document,host}=fixture('<article class="hero-atlas-card"><img src="/lava.png"><div class="hero-atlas-card-body"><h3>라바</h3><p>설명</p><div><a href="/ko/heroes/lava/">영웅 상세</a><label><input type="checkbox" value="lava">비교</label></div></div></article><article class="hp-card"><a class="hp-card-head" href="/ko/database/pet-system/fluffy/"><h4>솜솜</h4></a><details><summary>자세히 보기</summary><p>설명</p></details><a href="/ko/database/pet-system/hopper/">호퍼</a></article>');
 const before=document.toString(),link=document.querySelector('.hero-atlas-card a'),checkbox=document.querySelector('input'),summary=document.querySelector('summary'),secondary=document.querySelector('.hp-card>a:last-child');let changes=0,opened=0;checkbox.addEventListener('change',()=>changes++);summary.addEventListener('click',()=>opened++);
 const api=R.mount(document,host);assert.equal(document.querySelectorAll('[data-v61-card]').length,2);assert.equal(document.querySelector('.hero-atlas-card [data-v61-link]'),link);assert.equal(link.getAttribute('href'),'/ko/heroes/lava/');assert.equal(link.getAttribute('aria-label'),'라바 · 영웅 상세');assert(!document.querySelector('a a'));
 assert(checkbox.closest('[data-v61-control]'));assert(summary.hasAttribute('data-v61-control'));assert(secondary.hasAttribute('data-v61-control'));assert.equal(secondary.getAttribute('href'),'/ko/database/pet-system/hopper/');checkbox.dispatchEvent(new document.defaultView.Event('change'));summary.click();assert.equal(changes,1);assert.equal(opened,1);
 const enhanced=document.toString();api.refresh();assert.equal(document.toString(),enhanced);api.destroy();assert.equal(document.toString(),before);
});

test('card enhancement excludes home, calculation rows, skills and action-only cards while recognizing inserted catalog cards',()=>{
 const {document,host}=fixture('<div data-v5-home><article class="content-card"><h3><a href="/ko/guides/">Home</a></h3></article></div><article class="level-card"><a href="/ko/buildings/">Requirement</a><button>1,000</button></article><article class="xssr-skill-card"><select><option>1</option></select></article><article class="content-card"><button>Copy</button></article>');const api=R.mount(document,host);assert.equal(document.querySelectorAll('[data-v61-card]').length,0);
 document.querySelector('section').insertAdjacentHTML('beforeend','<article class="building-card"><img src="/building.webp"><h3>Building</h3><a class="building-link" href="/ko/buildings/lab/">Details</a><a href="/ko/buildings/lab/#upgrade-sheet">Calculator</a></article>');api.refresh();assert.equal(document.querySelectorAll('[data-v61-card]').length,1);assert.equal(document.querySelector('[data-v61-link]').getAttribute('href'),'/ko/buildings/lab/');assert.equal(document.querySelector('[data-v61-control]').getAttribute('href'),'/ko/buildings/lab/#upgrade-sheet');api.destroy();
});

test('font scaffold makes no missing or external request and only registers explicitly authorized verified local faces',()=>{
 const F=require('./v61-font-delivery'),manifest=F.validateManifest(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ts-v61-font-test-'));assert.match(B.fontFaces(),/^<link .*\/css\/v61-fonts\.css\?v=[a-f0-9]{12}/);
 try{fs.mkdirSync(path.join(temp,'data'));const config=structuredClone(require('../data/v61-visual-system.json')),write=()=>fs.writeFileSync(path.join(temp,'data/v61-visual-system.json'),JSON.stringify(config));config.displayFont.enabled=false;config.displayFont.status='awaiting-authorized-font-files';write();assert.equal(B.fontFaces(temp),'');config.displayFont.enabled=true;write();assert.throws(()=>B.fontFaces(temp),/authorized local files/);config.displayFont.status='authorized-local-files';write();assert.throws(()=>B.fontFaces(temp),/ENOENT/);
 for(const file of [F.MANIFEST,F.STYLESHEET,...manifest.faces.flatMap(f=>[f.source.path,...f.subsets.map(s=>s.path)])]){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.copyFileSync(path.join(B.ROOT,file),path.join(temp,file));}
 assert.equal(B.fontFaces(temp),F.stylesheet(temp));const css=F.cssText(temp);assert.equal((css.match(/@font-face/g)||[]).length,12);assert.equal((css.match(/font-weight:400/g)||[]).length,6);assert.equal((css.match(/font-weight:600/g)||[]).length,6);assert(!/font-weight:700|https:|preload|src:url\("\/fonts\/blackdesert\/strongsword-/.test(css));assert.equal((css.match(/font-display:swap/g)||[]).length,12);
 const inventory=manifest.groups.flatMap(g=>F.codepoints(g.unicodeRange));assert.equal(inventory.length,13131);assert.equal(new Set(inventory).size,13131);assert.equal(F.sha(inventory.sort((a,b)=>a-b).join(',')),F.CMAP_SHA);
 const homeGlyphs=new Set(F.codepoints(manifest.groups.find(g=>g.id==='home-base').unicodeRange));for(const cp of [...Array.from({length:95},(_,i)=>i+0x20),0xa0])assert(homeGlyphs.has(cp),'Dynamic ASCII/NBSP stays in the first font partition');
 const manifestFile=path.join(temp,F.MANIFEST),save=m=>fs.writeFileSync(manifestFile,JSON.stringify(m)),reject=(mutate,pattern)=>{const m=structuredClone(manifest);mutate(m);save(m);assert.throws(()=>F.validateManifest(temp),pattern);save(manifest);};
 reject(m=>m.faces[0].source.sha256='0'.repeat(64),/Unreviewed original/);reject(m=>m.faces[0].subsets[0].path='fonts/elsewhere.woff2',/outside owned directory/);
 const range=(group,values)=>{group.unicodeRange=values.map(v=>'U+'+v.toString(16).toUpperCase()).join(',');group.codepointCount=values.length;group.inventorySHA256=F.sha(values.join(','));};
 reject(m=>{range(m.groups[0],F.codepoints(m.groups[0].unicodeRange).filter(cp=>cp!==0x35));range(m.groups[1],[...F.codepoints(m.groups[1].unicodeRange),0x35].sort((a,b)=>a-b));},/Dynamic ASCII\/NBSP must be in home font partition/);
 reject(m=>{const values=F.codepoints(m.groups[0].unicodeRange);values.splice(values.findIndex(cp=>cp>0xa0),1);range(m.groups[0],values);},/coverage must remain complete/);
 reject(m=>range(m.groups[1],[...F.codepoints(m.groups[1].unicodeRange),F.codepoints(m.groups[0].unicodeRange)[0]].sort((a,b)=>a-b)),/Overlapping/);
 const subset=path.join(temp,manifest.faces[0].subsets[0].path),bytes=fs.readFileSync(subset),changed=Buffer.from(bytes);changed[changed.length-1]^=1;fs.writeFileSync(subset,changed);assert.throws(()=>F.validateManifest(temp),/Font hash changed/);fs.writeFileSync(subset,bytes);
 fs.appendFileSync(path.join(temp,F.STYLESHEET),'/* unreviewed */');assert.throws(()=>B.fontFaces(temp),/Stale generated font stylesheet/);fs.copyFileSync(path.join(B.ROOT,F.STYLESHEET),path.join(temp,F.STYLESHEET));
 config.displayFont.faces[0].path='../outside.woff2';write();assert.throws(()=>B.fontFaces(temp),/Original font registration changed/);
 }finally{assert(temp.startsWith(path.join(os.tmpdir(),'ts-v61-font-test-')));fs.rmSync(temp,{recursive:true,force:true});}
});

test('static card anchors work without JavaScript and exact source tags are restored for all upstream owners',()=>{
 const input='<html lang="ko"><head><title>원본</title></head><body><main><article class="hero-atlas-card" title="a > b"><img src="/img/game-41/heroes/lava.png" width="840" height="712" alt="라바"><div><h3>라바</h3><p>설명</p><a href="/ko/heroes/lava/">영웅 상세</a><label><input type="checkbox" value="lava">비교</label></div></article><div data-v61-ten><article class="content-card"><h3><a href="/ko/top-up/">TEN</a></h3><button>Copy</button></article></div></main></body></html>';
 const output=B.project(input,'ko','/ko/heroes/'),d=parseHTML(output).document;assert.equal(d.querySelectorAll('[data-v61-card]').length,1);assert.equal(d.querySelector('[data-v61-link]').getAttribute('href'),'/ko/heroes/lava/');assert(d.querySelector('label[data-v61-control]'));assert(!d.querySelector('a a'));assert.equal(d.querySelector('img').getAttribute('data-v61-source'),'/img/game-41/heroes/lava.png');assert(d.querySelector('img').getAttribute('src').startsWith('/img/v61-normalized/hero/'));assert.equal(B.strip(output),input);assert.equal(B.project(output,'ko','/ko/heroes/'),output);
 assert.throws(()=>B.validateOwnership(output.replace('data-v61-link=""','data-v61-link="forged"'),'ko','/ko/heroes/'),/Invalid presentation marker/);
 for(const [from,to]of [['class="hero-atlas-card"','class="invented-card"'],['href="/ko/heroes/lava/"','href="/ko/heroes/alita/"'],['value="lava"','value="alita"'],['title="a > b"','title="Changed"']])assert.throws(()=>B.strip(output.replace(from,to)),/Unowned presentation attributes changed/);
 const home='<html><head></head><body><main><div data-v5-home><article data-v61-card><a data-v61-link href="/ko/guides/">공략</a></article></div></main></body></html>';assert.equal(B.strip(B.project(home,'ko','/ko/')),home,'Home-authored shared markers are not removed');
});

test('upstream hero, pet and V4 owners accept stale asset hashes but reject protected tag mutations',()=>{
 const Atlas=require('./build-hero-atlas'),Pets=require('./build-hero-pet-pages'),V4=require('./v4-workbench-content');
 for(const [owner,route,args]of [[Atlas,'/ko/heroes/', ['ko','/ko/heroes/']],[Pets,'/ko/database/pet-system/',['ko']],[V4,'/ko/tools/',['ko','/ko/tools/']]]){
  const original=fs.readFileSync(path.join(B.ROOT,route,'index.html'),'utf8'),raw=owner.project(original,...args),presented=B.project(raw,'ko',route).replace(/(v6-system\.css\?v=)[a-f0-9]+/,'$1000000000000');owner.validateOwnership(presented,...args);assert.equal(owner.project(presented,...args),owner.project(raw,...args));
 }
});

test('Fluffy legacy uncertainty is removed only when all four verified skill ranges and the actual skill link exist',()=>{
 const P=require('./build-pet-skill-levels'),source=fs.readFileSync(path.join(B.ROOT,'ko/database/pet-system/index.html'),'utf8'),d=parseHTML(source).document;if(!d.querySelector('#pet-fluffy .ts-evidence-label'))d.querySelector('#pet-fluffy').insertAdjacentHTML('beforeend','<span class="ts-evidence-label">스킬과 효과 · 미확인</span>');const fixture=d.toString(),original=d.querySelector('#pet-fluffy').outerHTML;assert(P.removeVerifiedFluffyNote(d));const current=d.querySelector('#pet-fluffy');assert.equal(current.querySelector('.ts-evidence-label'),null);assert(current.querySelector('[data-pet-skill-roster-levels="fluffy"]'));const incomplete=structuredClone(require('../data/pet-skill-levels.json'));incomplete.pets.find(p=>p.id==='fluffy').skills[0].levels.pop();const other=parseHTML(fixture).document;assert.equal(P.removeVerifiedFluffyNote(other,incomplete),false);assert.equal(other.querySelector('#pet-fluffy').outerHTML,original);
});

test('dynamic catalog replacement reuses the static normalized image mapping without requests or new navigation handlers',()=>{
 const {document,host}=fixture('<article class="hero-atlas-card"><img data-v61-source="/source.png" data-v61-image="hero" src="/normalized.webp" width="480" height="640"><h3>Lava</h3><a href="/ko/heroes/lava/">Details</a></article>'),api=R.mount(document,host);document.querySelector('section').insertAdjacentHTML('beforeend','<article class="hero-atlas-card"><img src="/source.png" width="840" height="712"><h3>Lava</h3><a href="/ko/heroes/lava/">Details</a></article>');const img=document.querySelectorAll('.hero-atlas-card img')[1];api.refresh();assert.equal(img.getAttribute('src'),'/normalized.webp');assert.equal(img.getAttribute('width'),'480');api.destroy();assert.equal(img.getAttribute('src'),'/source.png');assert.equal(img.getAttribute('width'),'840');
});

function observedHost(){
 const queue=new Map();let sequence=0,mutation,resize;
 const host={addEventListener(){},removeEventListener(){},requestAnimationFrame(fn){queue.set(++sequence,fn);return sequence;},cancelAnimationFrame(id){queue.delete(id);},MutationObserver:class{constructor(fn){mutation=fn;}observe(){}disconnect(){}},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}unobserve(){}disconnect(){}}};
 return {host,mutate:records=>mutation(records),resize:targets=>resize(targets.map(target=>({target}))),pending:()=>queue.size,flush(){const current=[...queue.values()];queue.clear();for(const fn of current)fn();}};
}

test('static cards stay untouched and countdown text or unrelated leaf replacements schedule no DOM refresh',()=>{
 const staticCard='<article class="hero-atlas-card" data-v61-card><h3>Lava</h3><a href="/en/heroes/lava/" data-v61-link>Details</a><label data-v61-control><input type="checkbox">Compare</label></article>';
 const {document}=fixture('<div data-v5-home><time id="clock">00:00</time></div>'+staticCard.repeat(100)),events=observedHost(),main=document.querySelector('main'),clock=document.getElementById('clock'),before=document.toString();let scans=0,writes=0,cardQueries=0;
 const query=main.querySelectorAll.bind(main);main.querySelectorAll=s=>{scans++;return query(s);};
 for(const card of document.querySelectorAll('.hero-atlas-card')){for(const method of ['querySelector','querySelectorAll']){const original=card[method].bind(card);card[method]=s=>{cardQueries++;return original(s);};}for(const node of [card,...card.querySelectorAll('*')]){const set=node.setAttribute.bind(node);node.setAttribute=(...args)=>{writes++;return set(...args);};}}
 cardQueries=0;const api=R.mount(document,events.host);assert.equal(document.toString(),before);assert.equal(writes,0);assert.equal(cardQueries,0,'Build-time native links require no runtime card traversal');const initialScans=scans;
 for(let i=0;i<60;i++){const old=clock.firstChild;clock.textContent=String(i);events.mutate([{target:clock,addedNodes:[clock.firstChild],removedNodes:[old]}]);}
 const span=document.createElement('span');span.textContent='next minute';clock.append(span);events.mutate([{target:clock,addedNodes:[span],removedNodes:[]}]);
 assert.equal(events.pending(),0,'Clock updates must not enqueue a full-page frame');assert.equal(scans,initialScans);assert.equal(writes,0);assert.equal(cardQueries,0);api.destroy();
});

test('observed catalog additions normalize only the new subtree and retain independent native controls',()=>{
 const {document}=fixture('<article class="hero-atlas-card" data-v61-card><img data-v61-source="/source.png" data-v61-image="hero" src="/normalized.webp" width="480" height="640"><h3>Static</h3><a data-v61-link href="/en/heroes/lava/">Details</a></article>'),events=observedHost(),main=document.querySelector('main'),section=document.querySelector('section');let scans=0;
 const query=main.querySelectorAll.bind(main);main.querySelectorAll=s=>{scans++;return query(s);};const api=R.mount(document,events.host),initialScans=scans,staticCard=document.querySelector('article'),original=staticCard.outerHTML;
 staticCard.querySelector=staticCard.querySelectorAll=()=>{throw Error('Unrelated static card was rescanned');};
 section.insertAdjacentHTML('beforeend','<article class="hero-atlas-card"><img src="/source.png" width="840" height="712"><h3>Lava</h3><a href="/en/heroes/lava/">Details</a><label><input type="checkbox">Compare</label></article>');const card=section.lastElementChild,img=card.querySelector('img'),input=card.querySelector('input'),link=card.querySelector('a');let changes=0;input.addEventListener('change',()=>changes++);
 events.mutate([{target:section,addedNodes:[card],removedNodes:[]}]);assert.equal(events.pending(),1);events.flush();assert.equal(scans,initialScans);assert.equal(staticCard.outerHTML,original);assert.equal(img.getAttribute('src'),'/normalized.webp');assert.equal(img.getAttribute('width'),'480');assert.equal(card.querySelector('[data-v61-link]'),link);assert(input.closest('[data-v61-control]'));input.dispatchEvent(new document.defaultView.Event('change'));assert.equal(changes,1);
 card.remove();events.mutate([{target:section,addedNodes:[],removedNodes:[card]}]);events.flush();assert.equal(img.getAttribute('src'),'/source.png');assert.equal(img.getAttribute('width'),'840');assert(!card.hasAttribute('data-v61-card'));api.destroy();
});

test('table layout reads are batched before ARIA writes and content updates measure only their own scroll region',()=>{
 const {document}=fixture('<div class="r60-scroll"><table><tr><td>1</td></tr></table></div><div class="v4-table-wrap"><table><tr><td>2</td></tr></table></div>'),events=observedHost(),nodes=[...document.querySelectorAll('.r60-scroll,.v4-table-wrap')],operations=[];
 for(const [id,node]of nodes.entries()){for(const [key,value]of Object.entries({clientWidth:300,scrollWidth:600,clientHeight:200,scrollHeight:200}))Object.defineProperty(node,key,{get(){operations.push(['read',id,key]);return value;}});const set=node.setAttribute.bind(node);node.setAttribute=(...args)=>{operations.push(['write',id,args[0]]);return set(...args);};}
 const api=R.mount(document,events.host);assert.equal(operations.length,0,'Mount must not read geometry or write table ARIA');events.resize(nodes);const firstWrite=operations.findIndex(x=>x[0]==='write');assert(firstWrite>0);assert(operations.slice(firstWrite).every(x=>x[0]!=='read'),'All table layout must be read before attribute writes');
 operations.length=0;const cell=nodes[0].querySelector('td'),old=cell.firstChild;cell.textContent='123456789';events.mutate([{target:cell,addedNodes:[cell.firstChild],removedNodes:[old]}]);events.flush();assert(operations.some(x=>x[0]==='read'));assert(operations.every(x=>x[1]===0),'A table update cannot measure an unrelated table');assert.equal(nodes[0].getAttribute('tabindex'),'0');
 operations.length=0;events.resize([nodes[1]]);events.flush();assert(operations.some(x=>x[0]==='read'));assert(operations.every(x=>x[1]===1));api.destroy();
});

test('an observed initially empty table wrapper becomes accessible and nested replacements retain one scroll stop',()=>{
 const {document}=fixture('<div class="ts-table-wrap"></div>'),events=observedHost(),outer=document.querySelector('.ts-table-wrap');dimensions(outer);const api=R.mount(document,events.host);outer.innerHTML='<table><tr><td>1</td></tr></table>';events.mutate([{target:outer,addedNodes:[outer.firstElementChild],removedNodes:[]}]);events.flush();assert.equal(outer.getAttribute('tabindex'),null);events.resize([outer]);assert.equal(outer.getAttribute('tabindex'),'0');
 const old=outer.firstElementChild;outer.innerHTML='<div class="r60-scroll"><table><tr><td>2</td></tr></table></div>';const inner=outer.firstElementChild;dimensions(inner);events.mutate([{target:outer,addedNodes:[inner],removedNodes:[old]}]);events.flush();assert.equal(outer.getAttribute('tabindex'),null);assert.equal(inner.getAttribute('tabindex'),'0');assert.equal(document.querySelectorAll('[tabindex="0"]').length,1);api.destroy();
});

test('mount and automatic updates never read initial geometry before the first ResizeObserver layout result',()=>{
 const {document}=fixture('<article class="hero-atlas-card"><h3>Lava</h3><a href="/en/heroes/lava/">Details</a></article><div class="r60-scroll"><table><caption>Growth</caption><tr><td>10</td></tr></table></div>'),events=observedHost(),node=document.querySelector('.r60-scroll');let layoutDelivered=false,reads=0;
 for(const [key,value]of Object.entries({clientWidth:300,scrollWidth:600,clientHeight:200,scrollHeight:200}))Object.defineProperty(node,key,{get(){assert(layoutDelivered,'Geometry forced before natural initial layout');reads++;return value;}});
 const api=R.mount(document,events.host);assert.equal(reads,0);assert.equal(node.getAttribute('tabindex'),null);assert(document.querySelector('.hero-atlas-card[data-v61-card] a[data-v61-link]'),'Native card enhancement is immediate');
 const cell=node.querySelector('td'),old=cell.firstChild;cell.textContent='123456';events.mutate([{target:cell,addedNodes:[cell.firstChild],removedNodes:[old]}]);document.dispatchEvent(new document.defaultView.Event('change'));document.dispatchEvent(new document.defaultView.Event('toggle'));events.flush();assert.equal(reads,0,'Pending mutation/change/toggle cannot pull initial reads forward');
 layoutDelivered=true;events.resize([node]);assert(reads>0);assert.equal(node.getAttribute('tabindex'),'0');assert.equal(node.getAttribute('role'),'region');assert.equal(node.getAttribute('aria-label'),'Growth');api.destroy();assert.equal(node.getAttribute('tabindex'),null);const before=reads;events.resize([node]);events.flush();assert.equal(reads,before,'Destroyed observers cannot read layout');
});

test('without ResizeObserver initial table reads wait for a paint opportunity and pending fallback is cancellable',()=>{
 for(const cancel of [false,true]){const {document}=fixture('<div class="r60-scroll"><table><tr><td>1</td></tr></table></div>'),events=observedHost(),node=document.querySelector('.r60-scroll');delete events.host.ResizeObserver;let reads=0;
  for(const [key,value]of Object.entries({clientWidth:300,scrollWidth:600,clientHeight:200,scrollHeight:200}))Object.defineProperty(node,key,{get(){reads++;return value;}});
  const api=R.mount(document,events.host);assert.equal(reads,0);assert.equal(events.pending(),1);events.flush();assert.equal(reads,0,'The first animation frame must not force initial layout');assert.equal(events.pending(),1);
  if(cancel){api.destroy();assert.equal(events.pending(),0);events.flush();assert.equal(reads,0);}else{events.flush();assert(reads>0);assert.equal(node.getAttribute('tabindex'),'0');api.destroy();}
 }
});

test('normalized artwork binds each untouched authentic source to an existing deterministic artboard',()=>{
 const crypto=require('node:crypto'),{imageSize}=require('image-size'),manifest=require('../data/v61-image-assets.json');assert.equal(manifest.originalsModified,false);assert.equal(manifest.sourcePixelsRemoved,'transparent-only');assert(manifest.images.length>=80);const seen=new Set();for(const image of manifest.images){assert(!seen.has(image.source));seen.add(image.source);for(const [file,hash]of [[image.source,image.sourceSHA256],[image.src,image.sha256]])assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(B.ROOT,file))).digest('hex'),hash,file);const size=imageSize(fs.readFileSync(path.join(B.ROOT,image.src)));assert.deepEqual([size.width,size.height],[image.width,image.height]);assert.equal(image.width/image.height,image.kind==='hero'?.75:1);assert(image.visibleBounds[0]>=0&&image.visibleBounds[1]>=0&&image.visibleBounds[2]<=image.width&&image.visibleBounds[3]<=image.height);}
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
 assert(!/@import|url\(https?:|display\s*:\s*contents/.test(css));assert(Buffer.byteLength(css)<50000);
 // Incremental mutation/resize queues replace repeated full-page work. Bound
 // both source complexity and its actual transfer cost (under 3 KB gzip).
 const runtime=fs.readFileSync(path.join(B.ROOT,'js/v6-system.js'));assert(runtime.length<8000);assert(require('node:zlib').gzipSync(runtime).length<3000);
});
