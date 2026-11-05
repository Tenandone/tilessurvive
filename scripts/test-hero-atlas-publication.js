'use strict';
// Read-only publication checks. No builder, network, fixture regeneration or source writes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),BASELINE='c0cd3a3aea12e5e16550c36e0f77b63846d13948';
const GUIDE=require('../data/hero-guide-copy.json'),X=require('./lib/xssr-catalog'),catalogById=new Map(X.heroes().map(h=>[h.id,h]));
const DETAILS=require('../data/xssr-details.json'),MEDIA=require('../data/xssr-presentation.json'),verifiedImages=new Set(Object.values(MEDIA.byNativeKey).map(x=>x.src));
const D=require('../data/hero-atlas-client.json'),P=require('../data/hero-atlas-publication.json'),R=require('../data/hero-atlas-routes.json'),C=require('../data/hero-atlas-copy.json'),B=require('./build-hero-atlas');
const registry=require('../data/i18n/locales.json').locales,allLocales=registry.map(x=>x.code);
const locales=process.env.HERO_ATLAS_TEST_LOCALES?process.env.HERO_ATLAS_TEST_LOCALES.split(','):allLocales;
assert(locales.length&&locales.every(l=>allLocales.includes(l)),'Invalid diagnostic locale list');
const complete=locales.length===allLocales.length;
const ids={lucky:25300010,'lucky-promoted':25300231,tony:25300027,maddy:25300015,rosie:25300138,nikola:25300009,ray:25300008,beka:25300041,laila:25300137,candy:25300038,sarge:25300016,'sarge-promoted':25300232,mike:25300013,'chef-ken':25300007,'chef-ken-promoted':25300234,freya:25300139,'freya-promoted':25300233,travis:25300019,'travis-promoted':25300235,eva:25300012,'eva-promoted':25300236,rusty:25300014,ghost:25300005,light:25300220,kiki:25300221,tara:25300222,jacob:25300223,tarzan:25300224,kiron:25300225,shark:25300237,lagnar:25300238,knotty:25300239,undine:25300240,dave:25300241,lava:25300242};
const promotionIds={'chef-ken':[25300007,25300234],freya:[25300139,25300233],eva:[25300012,25300236],travis:[25300019,25300235],lucky:[25300010,25300231],sarge:[25300016,25300232]};
const byId=new Map(D.heroes.map(x=>[x.id,x])),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),doc=s=>parseHTML(s).document;
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
const fileFor=r=>r.replace(/^\//,'')+'index.html',routeFor=(id,l)=>R.heroes.find(h=>h.id===id).routes[l];
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
// V6 may add only its reviewed presentation assets/root flags. Validate the
// exact current owner before stripping it; keep all content, models and ads.
// Consent-aware landing events also update this one shared runtime's hash.
const normalizeSharedHash=(html,sourceFile)=>{
 if(/data-v6-system|TS_V6_SYSTEM_BEGIN/.test(html)){const d=doc(html),canonical=new URL(d.querySelector('link[rel="canonical"]').href);assert.equal(canonical.origin,'https://tilessurvive.net');const route=sourceFile?'/'+sourceFile.replace(/index\.html$/,''):canonical.pathname,locale=route.split('/')[1];html=require('./v4-release-gate').stripReviewedPresentation(html,locale,route,ROOT);}
 return html.replace(/(\/js\/v3-affiliate\.js\?v=)[a-f0-9]{12}/g,'$1REVIEWED-HASH');
};
const oldRoutes=R.heroes.filter(x=>x.id!=='lava'&&byId.has(x.id)).flatMap(x=>locales.map(l=>({id:x.id,locale:l,route:x.routes[l],file:fileFor(x.routes[l])})));
const hubs=locales.map(l=>({locale:l,route:`/${l}/heroes/`,file:`${l}/heroes/index.html`}));
const baseline=new Map();
function loadBaseline(files){
 const needed=[...new Set(files)].filter(f=>!baseline.has(f));if(!needed.length)return;
 const bytes=cp.execFileSync('git',['cat-file','--batch'],{cwd:ROOT,input:needed.map(f=>BASELINE+':'+f+'\n').join(''),maxBuffer:256*1024*1024});let at=0;
 for(const f of needed){const end=bytes.indexOf(10,at),header=bytes.subarray(at,end).toString('utf8'),match=header.match(/^\w+ blob (\d+)$/);assert(match,'Missing baseline blob '+f);const length=Number(match[1]);at=end+1;baseline.set(f,bytes.subarray(at,at+length).toString('utf8'));at+=length+1;}
}
function before(f){loadBaseline([f]);return baseline.get(f);}
function flat(o,p=''){return Object.fromEntries(Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'?Object.entries(flat(v,p+k+'.')):[[p+k,v]]));}
function numbers(s){return String(s).match(/\d+(?:[.,]\d+)*(?:%|[KMB])?/g)||[];}
function attrs(n){return [...n.attributes].map(a=>[a.name,a.value]).sort((a,b)=>a[0].localeCompare(b[0]));}
function programs(d){return [...d.querySelectorAll('script')].filter(n=>!n.getAttribute('type')||/javascript|module/.test(n.getAttribute('type'))).map(n=>({attrs:attrs(n),text:n.textContent}));}
function jsonPayloads(d){return [...d.querySelectorAll('script[type="application/json"]')].map(n=>({attrs:attrs(n),text:n.textContent}));}
function anchors(d){return [...d.querySelectorAll('[id]')].map(n=>n.id);}
function protectedCommerce(d){return [...d.querySelectorAll('a[href],script,ins,iframe')].filter(n=>/lootbar|googlesyndication|adsbygoogle|google-analytics|googletagmanager|data-ten-|data-v3-analytics|data-v3-consent/i.test(n.outerHTML)).map(n=>n.outerHTML);}
function elementPath(n){const result=[];while(n.parentElement){result.unshift([...n.parentElement.children].indexOf(n));n=n.parentElement;}return result;}
function atPath(d,p){let n=d.documentElement;for(const i of p)n=n?.children[i];return n;}
function allowedIdentity(n,id){
 if(n.closest('.ts3-roster-neighbors')&&n.matches('a strong,a small'))return true;
 if(!n.closest('.ts3-character-stage'))return false;
 if(n.matches('h1,.role-badge,.rarity-badge,.ts3-character-kicker span,.summary-card .value'))return true;
 if(n.matches('.summary-card .label')&&['lucky','sarge'].includes(id))return true;
 if(n.matches('.hero-sub')&&['kiron','lucky','sarge'].includes(id))return true;
 return id==='dave'&&n.matches('.ts-overline,.ts3-character-copy > p');
}
let preservation;
function preserveOldDetails(){
 if(preservation)return preservation;loadBaseline(oldRoutes.map(x=>x.file));const result={pages:0,tables:0,payloads:0,programs:0,anchors:0,controls:0};
 for(const entry of oldRoutes){const a=doc(normalizeSharedHash(before(entry.file))),b=doc(normalizeSharedHash(B.strip(read(entry.file)))),label=entry.file;
  assert.deepEqual(programs(b),programs(a),label+' executable scripts changed');
  assert.deepEqual(jsonPayloads(b),jsonPayloads(a),label+' JSON calculator/data payload changed');
  const ta=[...a.querySelectorAll('table')].map(n=>n.outerHTML),tb=[...b.querySelectorAll('table')].map(n=>n.outerHTML);assert.deepEqual(tb,ta,label+' table changed');
  const controls=d=>[...d.querySelectorAll('input,select,button,textarea')].map(n=>n.outerHTML);assert.deepEqual(controls(b),controls(a),label+' original controls changed');
  assert.deepEqual(protectedCommerce(b),protectedCommerce(a),label+' TEN/ad/analytics changed');
  const previousIds=anchors(a),currentIds=anchors(doc(read(entry.file)));for(const id of previousIds)assert(currentIds.includes(id),label+' lost #'+id);for(const id of new Set(currentIds))assert.equal(currentIds.filter(x=>x===id).length,1,label+' duplicate #'+id);
  for(const n of [...b.querySelectorAll('[data-hero-atlas-owned="identity"]')].reverse()){assert(allowedIdentity(n,entry.id),label+' identity owner outside approved metadata');const old=atPath(a,elementPath(n));assert(old&&old.tagName===n.tagName,label+' identity structure changed');assert.deepEqual(numbers(n.textContent),numbers(old.textContent),label+' numeric value inside identity correction changed');n.innerHTML=old.innerHTML;n.removeAttribute('data-hero-atlas-owned');}
  assert.equal(sha(b.querySelector('main').outerHTML),sha(a.querySelector('main').outerHTML),label+' inherited body changed outside approved identity labels');
  result.pages++;result.tables+=ta.length;result.payloads+=jsonPayloads(a).length;result.programs+=programs(a).length;result.anchors+=previousIds.length;result.controls+=controls(a).length;
 }
 preservation=result;return result;
}
test('35 pinned client forms represent 29 identities and six exact bidirectional promotion links',()=>{
 assert.equal(D.heroes.length,35);assert.equal(new Set(D.heroes.map(x=>x.identityId)).size,29);assert.equal(new Set(D.heroes.map(x=>x.clientId)).size,35);
 assert.deepEqual(Object.fromEntries(D.heroes.map(h=>[h.id,h.clientId])),ids);
 for(const [id,[base,promoted]]of Object.entries(promotionIds)){const a=byId.get(id),b=byId.get(id+'-promoted');assert.equal(a.clientId,base);assert.equal(b.clientId,promoted);assert.equal(a.promotion.to,promoted);assert.equal(b.promotion.from,base);assert.equal(a.identityId,b.identityId);assert.equal(b.baseClientId,base);assert.equal(a.variant,'base');assert.equal(b.variant,'promoted');}
 assert.equal(byId.get('eva-promoted').clientConditions.ClientVersion,'2.6.800');assert.equal(byId.get('lava').clientConditions.ClientVersion,'2.6.200');assert.equal(byId.get('lava').rarityRaw,4);
 // The original 2.6.200 capture remains intact; current rows are an explicit,
 // independently versioned supplement rather than invented historical records.
 for(const [id,clientId] of [['furiosa',25300243],['alita',25300244]]){assert(!byId.has(id));assert(R.heroes.some(x=>x.id===id));assert.equal(X.record(id).clientId,clientId);assert.equal(DETAILS.heroes[id].clientId,clientId);assert(D.unavailable.some(x=>x.id===id));assert(X.verifiedHeroes().some(x=>x.id===id&&x.clientSupplement));}
 for(const id of ['kiron','dave']){assert.equal(byId.get(id).typeRaw,3);assert.equal(byId.get(id).roles.classTags[0].clientId,27500028);assert.equal(byId.get(id).roles.classTags[0].nameKey,'lable_se_gunner_kt');}
});
test('historical publication and current client rows remain separate from live release decisions',()=>{
 assert.deepEqual(P.newPublished.map(x=>x.id),['lava']);assert.equal(P.newPublished[0].clientId,25300242);assert.equal(P.newPublished[0].rarity,'X-SSR');assert.deepEqual([...P.heldForms].sort(),Object.keys(promotionIds).map(x=>x+'-promoted').sort());
 assert(P.newPublished[0].releaseEvidence.includes('https://tilesurvivegame.com/en/blog/1198'));assert(P.pending.find(x=>x.id==='alita').status.includes('upcoming-as-of-2026-11-03'));assert(!P.pending.find(x=>x.id==='furiosa').status.includes('numeric-client-record-pending'));assert(!P.pending.find(x=>x.id==='alita').status.includes('core-record-pending'));assert.equal(X.record('alita').release.status,'upcoming');assert.equal(X.record('furiosa').release.status,'released');
 assert.deepEqual(X.counts(),{total:31,released:30,development:1,xssr:3});assert.equal(DETAILS.version.game,'2.6.300');assert.equal(DETAILS.version.build,1531);for(const h of Object.values(DETAILS.heroes))assert.equal(h.clientAvailability.provesLiveRelease,false);
 for(const h of D.heroes)assert(!Object.hasOwn(h,'releaseEvidence'),'Web release facts must not masquerade as client values');
 for(const url of [...P.newPublished.flatMap(x=>x.releaseEvidence),...P.pending.flatMap(x=>x.sources)]){const source=new URL(url);assert(source.hostname==='tilesurvivegame.com'||source.hostname==='x.com'&&/^\/TilesSurvive\/status\/\d+/.test(source.pathname));}
 assert.equal(D.version.game,'2.6.200');assert.equal(D.version.build,1512);assert.equal(D.localePolicy.fallbackIsOfficialTranslation,false);
});
test('all 21 locales have full names with 18 retained official translations and three explicit English fallbacks',()=>{
 assert.equal(allLocales.length,21);assert.equal(D.localePolicy.retainedIngameLocales.length,18);assert.deepEqual([...D.localePolicy.englishFallbackLocales].sort(),['ar','nb','vi']);
 for(const h of D.heroes)for(const l of allLocales){const n=h.names[l];assert(n?.value,h.id+':'+l);assert.equal(n.status,['ar','vi','nb'].includes(l)?'english-fallback':'client-official');if(n.status==='english-fallback')assert.equal(n.value,h.names.en.value);}
 const english=flat(C.locales.en);for(const l of locales){assert(C.locales[l],'Missing UI '+l);const own=flat(C.locales[l]);assert.deepEqual(Object.keys(own).sort(),Object.keys(english).sort(),l+' copy keys');for(const k of Object.keys(english)){assert(typeof own[k]==='string'&&own[k].trim(),l+'.'+k);assert.deepEqual((own[k].match(/\{\w+\}/g)||[]).sort(),(english[k].match(/\{\w+\}/g)||[]).sort(),l+'.'+k+' placeholders');}}
});
test('published hubs contain 35 retained forms plus two current client supplements and consistent release labels',()=>{
 let first;for(const {locale:l,file}of hubs){const d=doc(read(file)),cards=[...d.querySelectorAll('.hero-atlas-card')];assert.equal(cards.length,37,l);const signature=[];
  for(const n of cards){const h=catalogById.get(n.dataset.atlasId);assert(h,l+' unexpected form');assert.equal(n.dataset.identity,h.identityId);assert.equal(n.dataset.clientHeroId,h.clientId===null?undefined:String(h.clientId));assert.equal(n.dataset.faction,String(h.factionRaw));assert.equal(n.dataset.rarity,B.rarity(h));assert.equal(n.dataset.role,({1:'melee',2:'ranged',3:'mid'}[h.typeRaw]||'unknown'));assert.equal(n.dataset.form,h.variant);assert.equal(n.dataset.publication,h.variant==='promoted'?'held':'published');assert.equal(n.querySelector('[data-atlas-field="name"]').textContent,h.names[l].value);const nameFallback=h.names[l].status==='english-fallback';assert.equal(n.textContent.includes(GUIDE.locales[l].ui.originalName),nameFallback,l+':'+h.id+' fallback label');assert.equal(n.querySelector('[data-atlas-field="status"]').textContent,X.record(h.id)?X.copy(l)[X.record(h.id).release.status]:h.variant==='promoted'?C.locales[l].held:C.locales[l].published);assert.equal(n.querySelector('[data-atlas-detail]').getAttribute('href'),routeFor(h.identityId,l)+(h.variant==='promoted'?'#atlas-form-'+h.id:''));signature.push([h.id,n.dataset.clientHeroId,n.dataset.identity,n.dataset.faction,n.dataset.rarity,n.dataset.role,n.dataset.form,n.dataset.publication]);}
  signature.sort((a,b)=>a[0].localeCompare(b[0]));if(first)assert.deepEqual(signature,first,l+' typed facts differ');else first=signature;
  assert.equal(cards.filter(n=>n.dataset.publication==='published').length,31);assert.equal(cards.filter(n=>n.dataset.publication==='held').length,6);assert(!d.querySelector('[data-atlas-include-held]').hasAttribute('checked'));assert.equal(d.querySelectorAll('[data-atlas-held-group] .hero-atlas-card').length,6);
 }
});
test('actual published runtime defaults to 31 catalog identities and explicitly reveals 37 forms without double counting',()=>{
 const source=read('js/hero-atlas.js');for(const {locale:l,file}of hubs){const {document,Event}=parseHTML(read(file)),host=document.querySelector('[data-hero-atlas]');for(const n of host.querySelectorAll('select'))Object.defineProperty(n,'value',{value:n.querySelector('option').getAttribute('value'),writable:true,configurable:true});host.querySelector('[data-atlas-query]').value='';const deny=()=>{throw Error('Unexpected side effect');};vm.runInNewContext(source,{document,window:{location:new URL('https://tilessurvive.net/'+l+'/heroes/')},URL,Intl,Map,Set,console,fetch:deny,localStorage:{getItem:deny,setItem:deny}});assert(host.hasAttribute('data-atlas-ready'),l+' runtime did not initialize');let visible=()=>[...host.querySelectorAll('.hero-atlas-card')].filter(n=>!n.hidden);assert.equal(visible().length,31);assert.equal(new Set(visible().map(n=>n.dataset.identity)).size,31);assert(host.querySelector('[data-atlas-held-group]').hidden);const toggle=host.querySelector('[data-atlas-include-held]');toggle.checked=true;toggle.dispatchEvent(new Event('change'));assert.equal(visible().length,37);assert.equal(new Set(visible().map(n=>n.dataset.identity)).size,31);}
});
test('Lava routes have one canonical, complete 21-language alternatives, correct language and current-page switch mapping',()=>{
 assert.equal(R.heroes.length,31);const lava=R.heroes.find(h=>h.id==='lava');assert.equal(Object.keys(lava.routes).length,21);
 if(complete){const added=git('diff','--diff-filter=A','--name-only',BASELINE,'--','*.html').trim().split(/\r?\n/).filter(Boolean),untracked=git('ls-files','--others','--exclude-standard').trim().split(/\r?\n/).filter(f=>f.endsWith('.html'));assert.deepEqual([...new Set([...added,...untracked])].sort(),allLocales.flatMap(l=>['lava','furiosa','alita'].map(id=>fileFor(routeFor(id,l)))).sort(),'Unexpected new HTML routes');}
 for(const l of locales){const route=routeFor('lava',l),d=doc(read(fileFor(route))),info=registry.find(x=>x.code===l);assert.equal(d.documentElement.lang,info.htmlLang);assert.equal(d.querySelectorAll('link[rel="canonical"]').length,1);assert.equal(d.querySelector('link[rel="canonical"]').getAttribute('href'),'https://tilessurvive.net'+route);const alts=[...d.querySelectorAll('link[rel="alternate"][hreflang]')];assert.equal(alts.length,22);for(const other of registry)assert.equal(alts.find(n=>n.getAttribute('hreflang').toLowerCase()===other.hreflang.toLowerCase())?.getAttribute('href'),'https://tilessurvive.net'+routeFor('lava',other.code));assert.equal(alts.find(n=>n.getAttribute('hreflang')==='x-default')?.getAttribute('href'),'https://tilessurvive.net'+routeFor('lava','en'));assert.deepEqual(JSON.parse(d.getElementById('ts-locale-routes').textContent),Object.fromEntries(allLocales.map(x=>[x,routeFor('lava',x)])));assert.equal(d.querySelectorAll('h1').length,1);assert.equal(d.querySelector('h1').textContent,byId.get('lava').names[l].value);assert.equal(d.querySelectorAll('[data-hero-atlas-owned="xssr"] .hero-atlas-portrait').length,1);assert(d.querySelector('[data-xssr-detail="lava"] [data-xssr-table="rank"]'));assert(d.querySelector('[data-xssr-detail="lava"] [data-xssr-table="gear"]'));for(const n of d.querySelectorAll('.ts3-language a[href]')){const code=n.getAttribute('href').split('/')[1];if(allLocales.includes(code))assert.equal(n.getAttribute('href'),routeFor('lava',code));}}
});
test('retained portraits and source-bound current native media preserve exact image identity',()=>{
 const originalImages=new Set(git('ls-tree','-r','--name-only',BASELINE,'--','img').trim().split(/\r?\n/));
 const lava=require('../data/client-image-evidence.json').assets.find(x=>x.entity==='lava');
 assert.equal(lava.heroId,25300242);assert.equal(lava.resourceName,'sp_avatar_survivor_full_lava');assert.equal(lava.sourceField,'Survivor.CharacterImage');
 assert.equal(lava.pixelSHA256,'a0b176d74deb87af2ad65ff1cc7f3abef3f5c82bc4c9ee40ef2271722fb1336f');assert.equal(lava.spritePathId,'-1185611860183176785');
 const bytes=fs.readFileSync(path.join(ROOT,lava.src.slice(1)));assert.equal(sha(bytes),lava.sha256);assert.equal(bytes.readUInt32BE(16),840);assert.equal(bytes.readUInt32BE(20),712);
 for(const r of R.heroes)for(const l of locales){const image=r.images[l];assert(image?.src,r.id+':'+l);const p=image.src.replace(/^\//,'').split('?')[0];if(r.id==='lava')assert.equal(image.src,lava.src);else assert(originalImages.has(p)||verifiedImages.has('/'+p),p+' was not a retained or verified native image');assert(fs.existsSync(path.join(ROOT,p)),p+' missing');}
 for(const {file}of hubs){const d=doc(normalizeSharedHash(read(file),file));for(const n of d.querySelectorAll('.hero-atlas-card img')){const p=n.getAttribute('src').replace(/^\//,'').split('?')[0];assert(originalImages.has(p)||'/'+p===lava.src||verifiedImages.has('/'+p));assert(fs.existsSync(path.join(ROOT,p)));}assert.equal(d.querySelector('[data-atlas-id="lava"] img').getAttribute('src'),lava.src);}
});
test('three native portraits, twelve skill icons and three gear icons are bound to verified client keys',()=>{
 assert.deepEqual(MEDIA.version,{game:'2.6.300',build:1531,assetManifest:'2.6.300.1547'});
 const assets=Object.values(MEDIA.byNativeKey);assert.equal(assets.length,21);assert.equal(new Set(assets.map(x=>x.src)).size,21);assert.equal(assets.filter(x=>x.retainedExisting).length,5);
 for(const [key,a] of Object.entries(MEDIA.byNativeKey)){
  assert.equal(a.nativeKey,key);assert.match(a.src,/^\/img\/(?:game-41|game-26300)\/(?:heroes|hero-skills)\/[a-z0-9-]+\.png$/);assert.match(a.extractedSourceSHA256,/^[a-f0-9]{64}$/);
  const bytes=fs.readFileSync(path.join(ROOT,a.src.slice(1)));assert.equal(sha(bytes),a.sha256,key+' public image hash');assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),a.width);assert.equal(bytes.readUInt32BE(20),a.height);
  if(!a.retainedExisting)assert.equal(a.sha256,a.extractedSourceSHA256,key+' extracted PNG changed');else assert(key.endsWith('_lava')||/_lava_[1-4]$/.test(key));
 }
 for(const h of Object.values(DETAILS.heroes)){
  const media=MEDIA.heroes[h.id],portrait=MEDIA.byNativeKey[h.imageKeys.full];assert.deepEqual(media.portrait,portrait);assert.deepEqual(media.squadPortrait,MEDIA.byNativeKey[h.imageKeys.portrait]);assert.equal(X.record(h.id).portrait.src,portrait.src);assert.equal(h.skills.length,4);
  for(const skill of h.skills){assert.deepEqual(skill.icon,MEDIA.byNativeKey[skill.iconKey]);assert.deepEqual(media.skills[skill.clientId],skill.icon);}
  assert.deepEqual(media.gearSkillIcon,h.exclusiveGear.skillIcon);assert.deepEqual(h.exclusiveGear.skillIcon,MEDIA.byNativeKey[h.exclusiveGear.skillIcon.nativeKey]);
  for(const l of locales){assert.equal(R.heroes.find(r=>r.id===h.id).images[l].src,portrait.src);const file=fileFor(routeFor(h.id,l)),d=doc(normalizeSharedHash(read(file),file));assert.equal(d.querySelector('[data-hero-atlas-owned="xssr"] .hero-atlas-portrait')?.getAttribute('src'),portrait.src);for(const skill of h.skills)assert.equal(d.querySelector('[data-xssr-skill="'+skill.clientId+'"] img')?.getAttribute('src'),skill.icon.src);assert.equal(d.querySelector('#'+h.id+'-gear img')?.getAttribute('src'),h.exclusiveGear.skillIcon.src);}
 }
});
test('every Lava skip link and breadcrumb target the current hero page',()=>{
 for(const l of locales){const route=routeFor('lava',l),d=doc(read(fileFor(route)));assert.equal(d.querySelector('.ts-skip')?.getAttribute('href'),route+'#main',l+' skip link leaves the current hero');assert(d.getElementById('main'));const trail=[...d.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)).find(x=>x['@type']==='BreadcrumbList');assert(trail,l+' breadcrumb missing');const last=trail.itemListElement.at(-1);assert.equal(last.name,byId.get('lava').names[l].value);assert.equal(last.item,'https://tilessurvive.net'+route);assert(trail.itemListElement.some(x=>x.item==='https://tilessurvive.net/'+l+'/heroes/'),l+' missing hero-directory breadcrumb');}
});
test('existing hero numeric data, calculator payloads, programs, tables, anchors, controls and TEN/GA/ads are preserved',t=>{
 const result=preserveOldDetails();assert.equal(result.pages,28*locales.length);t.diagnostic(JSON.stringify(result));
});
test('hub replacement preserves old anchors and executable/commerce integrations; added IDs are unique',()=>{
 loadBaseline(hubs.map(x=>x.file));for(const {file}of hubs){const a=doc(normalizeSharedHash(before(file))),b=doc(read(file)),clean=doc(normalizeSharedHash(B.strip(read(file))));assert.deepEqual(programs(clean),programs(a),file+' hub program changed');assert.deepEqual(protectedCommerce(clean),protectedCommerce(a),file+' hub commerce changed');const current=anchors(b);for(const id of anchors(a))assert(current.includes(id),file+' lost old anchor '+id);for(const id of new Set(current))assert.equal(current.filter(x=>x===id).length,1,file+' duplicate '+id);}
});
test('Lucky and Sarge explicitly scope their preserved legacy skill and stat tables to the promoted SSR form',()=>{
 for(const l of locales){const note=GUIDE.locales[l].ui.promotionStats;assert(typeof note==='string'&&note.includes('SSR'),l+' promoted-table notice missing');for(const id of ['lucky','sarge']){const d=doc(read(fileFor(routeFor(id,l)))),profile=d.getElementById('hero-atlas-profile');assert(profile.textContent.includes(note),l+':'+id+' retained SSR table scope absent');assert.equal(profile.textContent.split(note).length-1,1,l+':'+id+' duplicated notice');}const chef=doc(read(fileFor(routeFor('chef-ken',l))));assert(!chef.getElementById('hero-atlas-profile').textContent.includes(note),l+' notice incorrectly applied to base SR tables');}
});
test('representative projector calls are pure, idempotent and reject forged managed content',()=>{
 const V4=require('./v4-workbench-content'),V6=require('./build-v6-system'),project=(html,l,r)=>V6.project(V4.project(B.project(html,l,r),l,r),l,r);
 for(const l of locales){for(const r of [`/${l}/heroes/`,routeFor('lucky',l),routeFor('kiron',l),routeFor('lava',l)]){const original=read(fileFor(r));V4.validateOwnership(original,l,r);const projected=project(original,l,r);assert.equal(sha(projected),sha(original),r+' generated output stale');assert.equal(sha(project(projected,l,r)),sha(projected),r+' not idempotent');assert.doesNotThrow(()=>B.validateOwnership(projected,l,r));assert.doesNotThrow(()=>V4.validateOwnership(projected,l,r));assert.equal(doc(projected).querySelectorAll('[data-v4-owned="navigation"]').length,r===`/${l}/heroes/`?1:0);}}
 const l=locales[0],r=`/${l}/heroes/`,original=read(fileFor(r)),bad=original.replace('data-client-hero-id="25300242"','data-client-hero-id="99999999"');assert.notEqual(bad,original);assert.throws(()=>B.validateOwnership(bad,l,r));assert.equal(B.project('<html>unrelated</html>',l,`/${l}/buildings/`),'<html>unrelated</html>');
});
test('unrelated tracked HTML and existing non-search game data remain unchanged across the atlas and relation updates',()=>{
 const permitted=new Set(allLocales.flatMap(l=>[`${l}/index.html`,`${l}/heroes/index.html`,...R.heroes.map(h=>fileFor(h.routes[l])),`${l}/database/pet-system/index.html`,...require('../data/hero-pet-relations.json').pets.map(p=>`${l}/database/pet-system/${p.id}/index.html`)]));
 for(const locale of allLocales)for(const route of Object.keys(require('./v4-workbench-content').routes))permitted.add(locale+'/'+route+'index.html');
 const changedHtml=git('diff','--name-only',BASELINE,'--','*.html').trim().split(/\r?\n/).filter(Boolean),sharedRefresh=changedHtml.filter(f=>!permitted.has(f)),V3=require('./build-v3-platform');loadBaseline(sharedRefresh);
 const affiliateHash=sha(fs.readFileSync(path.join(ROOT,'js/v3-affiliate.js'))).slice(0,12);
 for(const file of sharedRefresh){const html=read(file),locale=file.split('/')[0],route='/'+file.replace(/index\.html$/,'');assert(allLocales.includes(locale),file+' unreviewed route');
  if(route===`/${locale}/codes/`||route===`/${locale}/top-up/`){
   const Gift=require('./build-gift-codes');let expected=V3.project(before(file),locale,route);if(route===`/${locale}/codes/`){expected=Gift.project(expected,locale);Gift.validateOwnership(html,locale);}else V3.validateOwnership(html,locale,route);
   require('./client-release-gate').verifyPreserved(before(file),html,file);
   assert.equal(doc(normalizeSharedHash(html,file)).documentElement.outerHTML,doc(normalizeSharedHash(expected,file)).documentElement.outerHTML,file+' exact reviewed gift/TEN projection');continue;
  }
  // Most global refreshes change only this one hash. Byte equality after that
  // exact substitution is stronger and much faster than reparsing every page.
  if(normalizeSharedHash(html,file)===normalizeSharedHash(before(file),file)){for(const m of html.matchAll(/\/js\/v3-affiliate\.js\?v=([a-f0-9]{12})/g))assert.equal(m[1],affiliateHash,file+' stale affiliate hash');continue;}
  V3.validateOwnership(html,locale,route);assert.equal(doc(normalizeSharedHash(V3.strip(html),file)).documentElement.outerHTML,doc(normalizeSharedHash(V3.strip(before(file)),file)).documentElement.outerHTML,file+' unowned HTML changed');for(const n of doc(html).querySelectorAll('[data-v3-owned="assets"]')){const url=new URL(n.getAttribute('src')||n.getAttribute('href'),'https://tilessurvive.net');assert.equal(url.searchParams.get('v'),sha(fs.readFileSync(path.join(ROOT,url.pathname.slice(1)))).slice(0,12),file+' stale shared asset');}}
 const newModels=new Set(['data/hero-growth-profiles.json','data/v5-landing-copy.json','data/xssr-detail-copy.json','data/xssr-details.json','data/xssr-presentation.json','data/xssr-skill-values.json','data/xssr-heroes.json','data/xssr-copy.json','data/xssr-lava-growth.json','data/hero-guide-copy.json','data/hero-guide-presentation.json','data/hero-atlas-client.json','data/hero-atlas-copy.json','data/hero-atlas-publication.json','data/hero-atlas-routes.json','data/hero-atlas-search-legacy.json','data/client-image-evidence.json','data/hero-pet-relations.json','data/hero-pet-copy.json','data/v4-formation.json','data/v4-formation-copy.json','data/v4-economy.json','data/v4-economy-copy.json','data/v4-workbench-copy.json','data/v4-provenance.json']);
 // Share the exact V6.1 operator-policy exception with the dedicated TEN
 // suites. Every other affiliate field and the complete payout record remain
 // equal to the deployed source; no whole-file policy bypass is allowed.
 const tenPrior=JSON.parse(git('show','5bd9065aa00e773895cf41ba3f6625452c0e401f:data/v3-affiliate-copy.json')),tenCurrent=JSON.parse(read('data/v3-affiliate-copy.json'));
 require('./ten-benefits-test-contract').assertCopyTransition(tenPrior,tenCurrent);
 require('./ten-benefits-test-contract').assertPolicyTransition(JSON.parse(before('data/ten-benefits-policy.json')),JSON.parse(read('data/ten-benefits-policy.json')));
 newModels.add('data/v3-affiliate-copy.json');newModels.add('data/ten-benefits-policy.json');newModels.add('data/ten-benefits-copy.json');
 // Later V6 source files remain exact. The sole common-event change moves its
 // already verified code into the shared gift-code model, preserving all facts.
 for(const f of ['data/v51-event-copy.json','data/v6-assets.json']){assert.deepEqual(JSON.parse(read(f)),JSON.parse(git('show','5bd9065aa00e773895cf41ba3f6625452c0e401f:'+f)),f+' retained V6 data');newModels.add(f);}
 const oldEvents=JSON.parse(git('show','5bd9065aa00e773895cf41ba3f6625452c0e401f:data/common-events.json')),oldCodes=JSON.parse(git('show','5bd9065aa00e773895cf41ba3f6625452c0e401f:data/tilessurvive-coupons.json')).coupons,currentCodes=require('./gift-codes-content').facts.coupons,expectedEvents=structuredClone(oldEvents);delete expectedEvents.codes;assert.deepEqual(JSON.parse(read('data/common-events.json')),expectedEvents,'Only the duplicate code store moves out of event facts');
 assert.deepEqual(currentCodes.map(x=>x.code).sort(),[...oldCodes,...oldEvents.codes].map(x=>x.code).sort());
 for(const row of oldCodes){const current=currentCodes.find(x=>x.code===row.code);for(const [k,v]of Object.entries(row))assert.deepEqual(current[k],v,row.code+' retained original '+k);}
 for(const {endsAt,...row}of oldEvents.codes){const current=currentCodes.find(x=>x.code===row.code);assert.equal(current.expiresAt,endsAt);for(const [k,v]of Object.entries(row))assert.deepEqual(current[k],v,row.code+' retained verified '+k);}
 require('./gift-codes-content').validate();newModels.add('data/common-events.json');newModels.add('data/tilessurvive-coupons.json');
 // Staged V6.1 presentation/copy owners are new files, not exceptions for
 // changing any pre-existing game table. Validate their exact bounded scope.
 const newOwnerFiles=['data/gift-codes-copy.json','data/v61-assets.json','data/v61-image-assets.json','data/v61-visual-system.json','data/v61-font-subsets.json'];assert.equal(git('ls-tree','-r','--name-only',BASELINE,'--',...newOwnerFiles).trim(),'','V6.1 owners must be new relative to the retained baseline');
 const giftCopy=JSON.parse(read(newOwnerFiles[0]));assert.equal(giftCopy.schemaVersion,1);assert.deepEqual(Object.keys(giftCopy.locales).sort(),allLocales.slice().sort());for(const l of allLocales)assert.deepEqual(giftCopy.locales[l],require('./gift-codes-content').copy(l));
 const artwork=JSON.parse(read(newOwnerFiles[1])),normalized=JSON.parse(read(newOwnerFiles[2]));assert.equal(artwork.images.length,5);assert.equal(normalized.images.length,86);assert.equal(normalized.normalization,'alpha-nonzero-contain-v1');assert.equal(normalized.sourcePixelsRemoved,'transparent-only');assert.equal(normalized.originalsModified,false);
 for(const a of artwork.images){assert.equal(a.sourceType,'original-generated-illustration');assert.equal(a.generator,'built-in-imagegen');assert(a.src.startsWith('/img/v61/'));}for(const a of normalized.images)assert(a.src.startsWith('/img/v61-normalized/'));
 for(const a of [...artwork.images,...normalized.images]){assert(!a.src.includes('..'));const bytes=fs.readFileSync(path.join(ROOT,a.src.slice(1)));assert.equal(sha(bytes),a.sha256,a.src+' exact manifest hash');assert.equal(bytes.length,a.bytes,a.src+' exact manifest size');}
 const system=JSON.parse(read(newOwnerFiles[3]));assert.deepEqual(system,{schemaVersion:1,imageRatios:{hero:'3 / 4',pet:'1 / 1',building:'1 / 1',faction:'1 / 1',guide:'4 / 3'},displayFont:{family:'TilesSurvive Sword',enabled:true,status:'authorized-local-files',referenceFamily:'StrongSword_New',faces:[{path:'fonts/blackdesert/strongsword-regular.woff2',weight:400,format:'woff2'},{path:'fonts/blackdesert/strongsword-semibold.woff2',weight:600,format:'woff2'}],authorization:'operator-confirmed-2026-11-05',delivery:{mode:'unicode-range-subsets',manifest:'data/v61-font-subsets.json',stylesheet:'css/v61-fonts.css'}}});require('./v61-font-delivery').validateManifest(ROOT);require('./v61-font-delivery').stylesheet(ROOT);
 for(const [file,hash]of [['fonts/blackdesert/strongsword-regular.woff2','e856eaf4ad7969f0d4552be77e3218ea41ca6389b2ccea42ccc598d45cb420c8'],['fonts/blackdesert/strongsword-semibold.woff2','6518d82afecdb1bd422cd413d73b7465d7fe9b297cc89b2f5d7b483b032e5534']])assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,file+' authorized original font');
 newOwnerFiles.forEach(f=>newModels.add(f));
 const changedData=git('diff','--name-only',BASELINE,'--','data').trim().split(/\r?\n/).filter(Boolean);assert.deepEqual(changedData.filter(f=>!newModels.has(f)&&!/^data\/(?:search\/[a-z-]+\.json|v3-search\/[a-z-]+\.json|search-index\.json)$/.test(f)),[],'Existing source/game data changed');
 const newFiles=git('ls-files','--others','--exclude-standard').trim().split(/\r?\n/).filter(Boolean);assert.deepEqual(newFiles.filter(f=>/normalized-complete-v1|authorized-decryption|decoded-language|ingame-apk-|full-client-evidence|\.(?:apk|aab|bundle|bytes|jsonl)$/i.test(f)),[],'Full retained client material entered public worktree');
 for(const file of newModels){const model=read(file);assert(!/(?:[A-Z]:[\\/]|\\\\Users\\|\/Users\/)/.test(model),file+' private absolute path leaked');}
});
test('sitemap adds exactly 63 reviewed X-SSR canonical URLs and removes none',{skip:!complete?'Diagnostic subset; final 21-locale run required':false},()=>{
 const extract=s=>[...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]),old=extract(before('sitemap.xml')),now=extract(read('sitemap.xml')),oldSet=new Set(old),nowSet=new Set(now);assert.equal(now.length,nowSet.size);assert.deepEqual(old.filter(u=>!nowSet.has(u)),[]);assert.deepEqual(now.filter(u=>!oldSet.has(u)).sort(),allLocales.flatMap(l=>['lava','furiosa','alita'].map(id=>'https://tilessurvive.net'+routeFor(id,l))).sort());
});
test('targeted search retains old URLs and aliases, permits reviewed hero/home/hub metadata, and adds only reviewed anchors',{skip:!complete?'Diagnostic subset; final 21-locale run required':false},()=>{
 const permittedMainUrls=new Set(R.heroes.filter(h=>h.id!=='lava').flatMap(h=>Object.values(h.routes)));
 const files=[...allLocales.flatMap(l=>[`data/search/${l}.json`,`data/v3-search/${l}.json`]),'data/search-index.json'];loadBaseline(files);const projectedV3=require('./build-v3-search').collect().shards;
 for(const f of files){const old=JSON.parse(before(f)),now=JSON.parse(read(f)),isV3=f.startsWith('data/v3-search/');assert.equal(now.itemCount,now.items.length,f);const oldMap=new Map(old.items.map(x=>[x.url,x])),nowMap=new Map(now.items.map(x=>[x.url,x]));assert.equal(nowMap.size,now.items.length,f+' duplicate URL');
  for(const [url,item]of oldMap){assert(nowMap.has(url),f+' removed '+url);const updated=nowMap.get(url);
   if(isV3){const aliases=new Set(updated.search.aliases.map(x=>x.value)),contexts=new Set(updated.search.contextNames);if(!allLocales.some(l=>url===`/${l}/`||url===`/${l}/codes/`))for(const alias of item.search.aliases)assert(aliases.has(alias.value),f+' lost search alias '+alias.value+' at '+url);for(const name of item.search.contextNames)assert(contexts.has(name),f+' lost context '+name+' at '+url);}
   if(permittedMainUrls.has(url))continue;
   // Approved exception: the 21 hub H1s changed to the local atlas title. Their
   // V3 primary name and alias expansion may follow it; no other field changes.
   const homeLocale=allLocales.find(l=>url===`/${l}/`);
   if(homeLocale){const a=structuredClone(item),b=structuredClone(updated);for(const k of ['title','description']){delete a[k];delete b[k];}if(isV3){delete a.search.primaryName;delete b.search.primaryName;delete a.search.aliases;delete b.search.aliases;assert.deepEqual(updated,projectedV3[homeLocale].items.find(x=>x.url===url),f+' homepage must match current canonical H1 alias projection');}assert.deepEqual(b,a,f+' homepage changed beyond reviewed SEO metadata');const page=doc(read(homeLocale+'/index.html'));assert(page.querySelector('[data-v5-home]'),f+' homepage lacks reviewed V5 owner');assert.equal(updated.title,page.querySelector('title').textContent.trim());assert.equal(updated.description,page.querySelector('meta[name="description"]').getAttribute('content').trim());continue;}
   const ownerLocale=allLocales.find(l=>url===`/${l}/codes/`||url===`/${l}/top-up/`);
   if(ownerLocale){const a=structuredClone(item),b=structuredClone(updated);if(isV3){delete a.search;delete b.search;assert.deepEqual(updated,projectedV3[ownerLocale].items.find(x=>x.url===url),f+' gift/TEN search must match canonical derived aliases');}assert.deepEqual(b,require('./v4-release-gate').projectOriginalSearchRow(a,ownerLocale),f+' gift/TEN changed beyond exact shared metadata');continue;}
   const hubLocale=isV3&&allLocales.find(l=>url===`/${l}/heroes/`);
   if(hubLocale){const a=structuredClone(item),b=structuredClone(updated);delete a.search.primaryName;delete b.search.primaryName;delete a.search.aliases;delete b.search.aliases;assert.deepEqual(b,a,f+' hub changed beyond name/aliases');assert.equal(updated.search.primaryName,C.locales[hubLocale].title);}
   else assert.deepEqual(updated,item,f+' unchanged-scope record changed '+url);
  }
  const langs=f==='data/search-index.json'?allLocales:[path.basename(f,'.json')],expected=langs.flatMap(l=>[routeFor('furiosa',l),routeFor('alita',l),routeFor('lava',l),routeFor('lava',l)+'#lava-skills',routeFor('lava',l)+'#lava-growth',...require('./build-v4-search').records(l).map(r=>r.url)]);assert.deepEqual([...nowMap.keys()].filter(u=>!oldMap.has(u)).sort(),expected.sort(),f+' unexpected added URLs');
 }
});
test('new atlas assets have current content hashes and baseline public tracking files are unchanged',()=>{
 for(const entry of [...hubs,...oldRoutes.slice(0,3),...locales.map(l=>({file:fileFor(routeFor('lava',l))}))]){const d=doc(read(entry.file));for(const n of d.querySelectorAll('[data-hero-atlas-owned="assets"]')){const value=n.getAttribute('src')||n.getAttribute('href'),url=new URL(value,'https://tilessurvive.net'),p=url.pathname.slice(1);assert(['js/hero-atlas.js','css/hero-atlas.css','css/hero-pet.css','css/xssr-detail.css','js/xssr-growth-calculator.js'].includes(p));assert.equal(url.searchParams.get('v'),sha(fs.readFileSync(path.join(ROOT,p))).slice(0,12));}}
 const paths=['robots.txt','ads.txt','data/ten-benefits-policy.json','js/v3-affiliate.js','js/platform-affiliate.js'],present=new Set(git('ls-tree','-r','--name-only',BASELINE,'--',...paths).trim().split(/\r?\n/).filter(Boolean));loadBaseline(paths.filter(p=>present.has(p)));for(const p of paths){if(present.has(p)){
  // robots.txt has no eol attribute: core.autocrlf checks it out as CRLF on
  // Windows. Compare its Git clean-filter blob, not an OS checkout newline.
  if(p==='robots.txt')assert.equal(git('hash-object','--path',p,p).trim(),git('rev-parse',BASELINE+':'+p).trim(),p+' repository content changed');
  else if(p==='js/v3-affiliate.js'){
   const old=before(p).replace(/\r\n/g,'\n'),now=read(p).replace(/\r\n/g,'\n'),constant=(s,name)=>s.match(new RegExp('  var '+name+' = [^\\n]+'))?.[0],fn=(s,name)=>s.match(new RegExp('^  function '+name+'\\([^\\n]*\\}\\n','m'))?.[0].trimEnd()||s.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'))?.[0];
   for(const name of ['TEN','KEY','GA_ID','APPROVED_IDS','requestedIds','idsValid','gaIds','LOCALES','FEATURES','ACTIONS']){assert(constant(old,name),name);assert.equal(constant(now,name),constant(old,name),name+' tracking invariant changed');}
   for(const name of ['language','pageType','safePath','sourceCategory','production','base','startGA','send','kind','stop','updateControls','setConsent']){assert(fn(old,name),name);assert.equal(fn(now,name),fn(old,name),name+' consent/tracking behavior changed');}
   // start/scan additionally observe the approved TEN banner. Their privacy,
   // 60%/1000ms/once behavior is executed in test-v61-ten and test-v3-affiliate.
   assert.match(fn(now,'start'),/\(ratios\.get\(anchor\) \|\| 0\) < 0\.6/);assert.match(fn(now,'start'),/\}, 1000\)/);assert.match(fn(now,'start'),/!consent/);assert.match(fn(now,'scan'),/!anchor\.closest\('\[data-ten-view\]'\)/);
   for(const event of ['page_view','topup_guide_view','affiliate_viewable','v3_feature_use','lootbar_outbound_click','free_progress_open','topup_guide_open'])assert(now.includes("'"+event+"'"),event+' base event removed');assert(now.includes("measurement_version: 'v3.1'"));assert(now.includes("document.querySelector('[data-v5-home]')"));
  }else if(p==='data/ten-benefits-policy.json')require('./ten-benefits-test-contract').assertPolicyTransition(JSON.parse(before(p)),JSON.parse(read(p)));else assert.equal(read(p),before(p),p+' changed');
 }else assert(!fs.existsSync(path.join(ROOT,p)),p+' was absent in the baseline');}
});
