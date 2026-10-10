'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {parseHTML}=require('linkedom'),B=require('./build-research-phase3'),R=require('../js/research-phase3');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('exact reviewed model retains 461 groups, 2524 totals, 5260 references and all unknown condition states',()=>{
 B.validate();for(const edit of [d=>d.powerMeaning='incremental',d=>d.runtimeProfile='current',d=>d.groups[0].levels[0].totalPower=null,d=>d.groups[0].levels[0].conditions.logic='AND',d=>d.groups[0].levels[0].conditions.profile='Original',d=>d.groups[0].levels[0].cost=0,d=>d.groups[0].names.ko='changed',d=>d.groups[0].icon.src='/unreviewed.png']){const d=structuredClone(B.model);edit(d);assert.throws(()=>B.validate(d));}
 for(const lang of B.langs)assert.deepEqual(Object.keys(B.copy[lang]).sort(),Object.keys(B.copy.en).sort());
});
test('all 15144 localized level displays use the selected total directly, without adding previous levels',()=>{
 let checks=0;for(const lang of B.langs){const data=R.localize(B.model,lang,B.copy[lang]),idx=R.index(data);for(const group of data.groups)for(const row of group.levels){const html=R.detail(data,{groupId:group.id,level:row.level},idx);assert(html.includes('<strong data-research-power>'+row.totalPower.toLocaleString(lang==='zh-tw'?'zh-TW':lang)+'</strong>'));assert(html.includes(R.esc(B.copy[lang].powerNote)));assert.equal((html.match(/data-research-condition>/g)||[]).length,row.conditions.references.length);assert.equal(html.includes('data-research-row-additional'),row.conditions.hasAdditionalConditions);checks++;}}
 assert.equal(checks,15144);
 const data=R.localize(B.model,'en',B.copy.en);data.groups[0].levels[0].totalPower=0;assert(R.detail(data,{groupId:data.groups[0].id,level:1}).includes('<strong data-research-power>0</strong>'));
});
test('reverse index is exact level-specific source references, not inferred unlocks or threshold eligibility',()=>{
 const data=R.localize(B.model,'en',B.copy.en),idx=R.index(data),expected=new Map();let refs=0;
 for(const g of B.model.groups)for(const row of g.levels)for(const ref of row.conditions.references)if(ref.kind==='research'){const key=ref.targetId+':'+ref.level;if(!expected.has(key))expected.set(key,new Set());expected.get(key).add(g.id+':'+row.level);refs++;}
 assert.equal(refs,2736);assert.equal(idx.reverse.size,expected.size);for(const [key,wanted]of expected)assert.deepEqual(new Set(idx.reverse.get(key).map(x=>x.id+':'+x.level)),wanted);
 for(const g of data.groups){assert.equal(R.stateFor(data,{groupId:g.id}).groupId,g.id);for(const row of g.levels){const href=R.researchURL(data,g.id,row.level),state=R.readLocation(data,href);assert.equal(state.groupId,g.id);assert.equal(state.level,row.level);}}
});
test('queries, hash links, tree and count filters keep identities separate and reject malformed state',()=>{
 const data=R.localize(B.model,'en',B.copy.en),idx=R.index(data);for(const group of data.groups){const selected=R.filterGroups(data,{q:group.id,tree:'',count:'all'});assert.equal(selected.length,1);assert.equal(selected[0].id,group.id);}
 const duplicateNames=data.trees.filter((t,i,a)=>a.some((x,z)=>z!==i&&x.name===t.name));assert(duplicateNames.length>=4);for(const tree of data.trees){const rows=R.filterGroups(data,{q:'',tree:tree.id,count:'all'});assert(rows.length);assert(rows.every(g=>g.treeId===tree.id));}
 assert.equal(new Set([...idx.labels.values()]).size,data.groups.length,'Every selector label disambiguates its group');
 const one=R.filterGroups(data,{q:'',tree:'',count:'single'}),many=R.filterGroups(data,{q:'',tree:'',count:'multiple'});assert.equal(one.length+many.length,461);assert(one.every(g=>g.levels.length===1));assert(many.every(g=>g.levels.length>1));
 const first=data.groups[0],last=data.groups.at(-1);assert.equal(R.readLocation(data,'/en/database/research/#group='+last.id+'&level='+last.levels.at(-1).level).groupId,last.id);
 assert.equal(R.readLocation(data,'/en/database/research/?group='+first.id+'#group='+last.id).groupId,first.id);
 for(const query of ['?group=not-a-group','?level=0','?level=1.5','?level=-1','?tree=not-a-tree','?count=invalid'])assert.equal(R.readLocation(data,'/en/database/research/'+query).invalidLink,true);
 const empty=R.stateFor(data,{q:'not-in-any-research-xyz'});assert.equal(empty.groupId,null);assert.equal(empty.level,null);assert(R.detail(data,empty,idx).includes(B.copy.en.empty));
 const unsafe=R.stateFor(data,{q:'<script>alert(1)</script>'});assert(!R.stateURL(unsafe,'/en/database/research/').includes('<script>'));
});
test('all six static pages provide meaningful default rows, all 461 directory entries, scoped SEO and reduced locale payloads',()=>{
 let directories=0;for(const lang of B.langs){const html=read(`${lang}/database/research/index.html`),d=parseHTML(html).document,data=JSON.parse(d.getElementById('research-phase3-data').textContent),expected=R.localize(B.model,lang,B.copy[lang]);assert.deepEqual(data,expected);assert(!JSON.stringify(data).includes('"names":'));assert(Buffer.byteLength(JSON.stringify(data))<1400000);assert(zlib.gzipSync(Buffer.from(html)).length<110000);
  assert.equal(d.querySelector('h1').textContent,B.copy[lang].title);assert.equal(d.querySelectorAll('h1').length,1);assert.equal(d.querySelector('[data-research-scope]').textContent,B.copy[lang].scope);assert(d.title.includes('2.6.200'));assert(d.querySelector('meta[name="description"]').content.includes(B.copy[lang].scope));assert.equal(d.querySelector('link[rel="canonical"]').href,`https://tilessurvive.net/${lang}/database/research/`);assert.equal(d.querySelectorAll('link[rel="alternate"]').length,7);
  assert.equal(d.querySelectorAll('[data-research-directory-row]').length,461);directories+=461;assert.equal(d.querySelectorAll('[data-research-level-row]').length,B.model.groups[0].levels.length);assert.equal(d.querySelector('[data-research-power]').textContent,B.model.groups[0].levels[0].totalPower.toLocaleString(lang==='zh-tw'?'zh-TW':lang));assert(d.querySelector('noscript').textContent.includes(B.copy[lang].directoryNote));
  const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);for(const input of d.querySelectorAll('[data-research-controls] input,[data-research-controls] select'))assert(d.querySelector('label[for="'+input.id+'"]'));for(const scroll of d.querySelectorAll('.r60-scroll')){assert.equal(scroll.getAttribute('tabindex'),'0');assert.equal(scroll.getAttribute('role'),'region');assert(scroll.getAttribute('aria-label'));}
  assert.equal(d.querySelectorAll('main img').length,1);assert.equal(d.querySelector('main img').getAttribute('loading'),'lazy');
  assert(!/sourceSha256|recordKey|tscfg:|InternalId|FunctionOpen|ResearchMain|IsOld|audit-results|[A-Z]:\\/.test(html));
  const treeOptions=[...d.querySelector('[name="tree"]').querySelectorAll('option')].map(n=>n.textContent);assert.equal(new Set(treeOptions).size,17);
 }
 assert.equal(directories,2766);
});
test('official icon files and related building routes exist for all six locales',()=>{
 const files=new Map();for(const g of B.model.groups){if(g.icon)files.set(g.icon.src,g.icon);for(const row of g.levels)for(const ref of row.conditions.references)if(ref.route)for(const lang of B.langs)assert(fs.existsSync(path.join(root,lang,ref.route,'index.html')));}
 assert.equal(files.size,151);for(const [src,img]of files){const b=fs.readFileSync(path.join(root,src));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),img.width);assert.equal(b.readUInt32BE(20),img.height);}
});
function browserFixture(){const {document,window}=parseHTML(read('en/database/research/index.html')),events={},history=[];const location={href:'https://tilessurvive.net/en/database/research/',pathname:'/en/database/research/'};const setURL=url=>{const next=new URL(url,location.href);location.href=next.href;location.pathname=next.pathname;};const environment={location,history:{pushState(_a,_b,url){history.push(['push',url]);setURL(url);},replaceState(_a,_b,url){history.push(['replace',url]);setURL(url);}},addEventListener(name,fn){events[name]=fn;}};
 // Linkedom provides a getter-only select.value; this test adapter supplies
 // browser-compatible value assignment without changing the real runtime.
 for(const select of document.querySelectorAll('select'))Object.defineProperty(select,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.getAttribute('value')??this.querySelector('option')?.getAttribute('value')??'';},set(value){for(const option of this.querySelectorAll('option')){if(option.getAttribute('value')===String(value))option.setAttribute('selected','');else option.removeAttribute('selected');}}});
 return {document,window,environment,events,history,setURL};}
test('actual browser wiring supports zero results/reset, selection, replace/push history and back/hash restoration',()=>{
 const x=browserFixture(),app=R.mount(x.document,x.environment),form=x.document.querySelector('[data-research-controls]'),q=form.querySelector('[name="q"]'),group=form.querySelector('[name="group"]');assert(app);assert.equal(form.hidden,false);
 q.value='not-in-any-research-xyz';q.dispatchEvent(new x.window.Event('input'));assert.equal(app.getState().groupId,null);assert(group.disabled);assert(x.document.querySelector('[data-research-empty]'));assert.equal(x.history.at(-1)[0],'replace');
 form.dispatchEvent(new x.window.Event('reset',{cancelable:true}));assert.equal(app.getState().groupId,app.data.groups[0].id);assert.equal(group.disabled,false);assert.equal(x.history.at(-1)[0],'push');
 const target=app.data.groups.at(-1);group.value=target.id;group.dispatchEvent(new x.window.Event('change'));assert.equal(app.getState().groupId,target.id);assert.equal(x.document.querySelector('[data-research-group]').getAttribute('data-research-group'),target.id);
 const first=app.data.groups[0],lastLevel=first.levels.at(-1).level;x.setURL('/en/database/research/?group='+first.id+'&level='+lastLevel);x.events.popstate();assert.equal(app.getState().level,lastLevel);assert.equal(x.document.querySelector('[data-research-power]').textContent,first.levels.at(-1).totalPower.toLocaleString('en'));
 x.setURL('/en/database/research/#group='+target.id+'&level='+target.levels[0].level);x.events.hashchange();assert.equal(app.getState().groupId,target.id);
 const jump=x.document.querySelector('[data-research-directory-row] [data-research-jump]');jump.dispatchEvent(new x.window.Event('click',{bubbles:true,cancelable:true}));assert.equal(app.getState().groupId,first.id);assert.equal(app.getState().q,'');assert.equal(app.getState().tree,'');
 x.setURL('/en/database/research/?group=invalid&level=0');x.events.popstate();assert.equal(x.document.querySelector('[data-research-link-notice]').hidden,false);assert.equal(app.getState().level,1);
});
test('rendering is deterministic and generator writes only its six new routes',()=>{
 const before=new Map();for(const lang of B.langs){const rel=`${lang}/database/research/index.html`,html=read(rel),template=read(`${lang}/database/index.html`);assert.equal(B.renderPage(lang,template),html);before.set(rel,html);assert.equal(B.renderPage(lang,template),B.renderPage(lang,template));}
 const source=read('scripts/build-research-phase3.js');assert(source.includes("path.join(root,lang,'database/research/index.html')"));assert(!source.includes('writeFileSync(template'));assert.equal(before.size,6);
});
