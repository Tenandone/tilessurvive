/* Fixed-release regression for the 3.0.1 editorial and hero banner patch.
 * No browser, purchase attribution or visual claims are made by this test.
 * --capture writes a read-only inventory outside the repository; when absent,
 * the exact same baseline is reconstructed from the fixed Git commit. */
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {parseHTML}=require('linkedom');
const {expectedSkillText}=require('./ux-301-test-allowances');
const delta=require('./foundation-40-test-allowances');
const root=path.resolve(__dirname,'..'),languages=['ko','en','ja','ru','zh-tw'];
const release='453953c6f6723c6332d19cc4d095995b31993527';
const heroMessages={ko:'할인 충전 가능 여부 확인',en:'Check for top-up discounts',ja:'チャージ割引の有無を確認',ru:'Проверить скидки на пополнение','zh-tw':'查看儲值優惠是否適用'};
const artifactDir=process.env.TS_UX_AUDIT_DIR||path.resolve(root,'../audit-results/ux-301');
const baselineFile=path.join(artifactDir,'baseline.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const txt=n=>norm(n?.textContent);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const parse=s=>parseHTML(s).document;
const rows=d=>[...d.querySelectorAll('main table tr')].filter(r=>r.querySelector('td')&&/\d/.test(txt(r))).map(r=>[...r.children].filter(c=>/^(TD|TH)$/.test(c.tagName)).map(txt));
const metadata=d=>({title:txt(d.querySelector('title')),description:d.querySelector('meta[name=description]')?.content||null,canonical:d.querySelector('link[rel=canonical]')?.href||null,robots:d.querySelector('meta[name=robots]')?.content||null,alternates:[...d.querySelectorAll('link[hreflang]')].map(n=>[n.getAttribute('hreflang'),n.href]).sort()});
const bannerInfo=n=>({slot:n.getAttribute('data-lootbar-slot'),url:n.querySelector('a[href]')?.href,images:[...n.querySelectorAll('img,source')].map(i=>i.getAttribute('src')||i.getAttribute('srcset')),text:txt(n)});
const forms=d=>[...d.querySelectorAll('[data-growth-form]')].map(n=>({key:n.getAttribute('data-growth-form'),rows:JSON.parse(n.querySelector('script[type="application/json"]').textContent).rows}));
const quantities=s=>[...String(s).normalize('NFKC').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'').matchAll(/[+−-]?\d+(?:\.\d+)?(?:\s*(?:%|[KMB](?![a-z])))?/gi)].map(m=>m[0].replace(/\s+/g,'').replace(/^\+/,'').toLowerCase());
function snapshot(base){
 const pages=languages.flatMap(l=>walk(path.join(base,l))).filter(f=>f.endsWith('.html')).map(file=>{
  const relative=path.relative(base,file).replaceAll('\\','/'),d=parse(fs.readFileSync(file,'utf8')),route='/'+relative.replace(/index\.html$/,'');
  const quantitative=[...d.querySelectorAll('main p,main li,main .value,main .v,main .equipment-power')].filter(n=>!n.closest('table,script,style,nav,.ts-source-note,.source-list,.ts-evidence-label')&&/\d(?:[\d.,]*)\s*(?:%|[KMB]\b)/i.test(txt(n)));
  return {relative,route,metadata:metadata(d),numericRows:rows(d),skills:[...d.querySelectorAll('main .ts-skill-body')].map(txt),stages:[...d.querySelectorAll('[data-stage-picker]')].map(txt),stats:[...d.querySelectorAll('main .stat-card,main .equipment-stat,main .ts-data-strip')].map(txt),identities:[...d.querySelectorAll('main .ts3-character-identity')].map(txt),quantities:[...new Set(quantitative.flatMap(n=>quantities(txt(n))))].sort(),growthForms:forms(d),
   images:[...new Set([...d.querySelectorAll('main img')].map(n=>n.getAttribute('src')))],mainLinks:[...new Set([...d.querySelectorAll('main a[href]')].map(n=>n.getAttribute('href')))],banners:[...d.querySelectorAll('[data-lootbar-slot]')].map(bannerInfo),couponApp:d.querySelector('script[data-coupon-app]')?hash(d.querySelector('script[data-coupon-app]').textContent):null,
   structure:[...d.querySelectorAll('main section')].map(n=>({id:n.id,label:n.getAttribute('aria-labelledby'),heading:txt(n.querySelector('h2')),skills:n.querySelectorAll('.ts-skill').length,equipment:n.querySelectorAll('.equipment-stat').length})),
   affiliate:[...d.querySelectorAll('main a[href*="lootbar.com"]')].map(a=>({url:a.href,placement:a.getAttribute('data-affiliate-placement'),text:txt(a),anchor:a.closest('section')?.getAttribute('aria-labelledby')}))};
 });
 const heroes=languages.flatMap(l=>{const d=parse(fs.readFileSync(path.join(base,l,'heroes/index.html'),'utf8'));return [...d.querySelectorAll('.ts3-roster-card')].map(n=>n.getAttribute('href')||n.querySelector('a[href]')?.getAttribute('href'));});
 const protectedPaths=['CNAME','robots.txt','sitemap.xml','config/affiliate.json','css/lootbar-banner.css','data/lootbar-banners.json','data/lootbar-banner-art.json',...walk(path.join(base,'img')).map(f=>path.relative(base,f).replaceAll('\\','/')),
  ...walk(path.join(base,'data')).filter(f=>f.endsWith('.json')&&!/search-index\.json$/.test(f)).map(f=>path.relative(base,f).replaceAll('\\','/')),
  ...['js/platform-math.js','js/database-22.js','js/tools-speedup-calculator.js']];
 const exports=walk(path.join(base,'components/banners')).filter(f=>f.endsWith('.html')).map(f=>path.relative(base,f).replaceAll('\\','/'));
 const protectedFiles=Object.fromEntries([...new Set([...protectedPaths,...exports])].map(f=>[f,hash(fs.readFileSync(path.join(base,f)))]));
 const heroPages=pages.filter(p=>heroes.includes(p.route));
 return {release,created:new Date().toISOString(),method:'Fixed Git archive; exact SEO, row/cell text, skill bodies and core formulas. No working-tree content is used to create the baseline.',heroes,pages,protectedFiles,originalBannerStyleBytes:fs.statSync(path.join(base,'css/lootbar-banner.css')).size,
  inventory:{pages:pages.length,canonicalHeroes:heroes.length,existingBannerSlots:pages.reduce((n,p)=>n+p.banners.length,0),heroBannerSlots:heroPages.reduce((n,p)=>n+p.banners.length,0),heroTextAffiliateSurfaces:heroPages.filter(p=>p.affiliate.length).map(p=>({route:p.route,links:p.affiliate})),exports,numericRows:pages.reduce((n,p)=>n+p.numericRows.length,0)}};
}
function capture(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'tiles-301-baseline-')),archive=path.join(tmp,'release.tar'),base=path.join(tmp,'release');fs.mkdirSync(base);
 execFileSync('git',['archive','--format=tar','--output='+archive,release,...languages,'img','data','config','js','css/lootbar-banner.css','components/banners','CNAME','robots.txt','sitemap.xml'],{cwd:root});
 execFileSync('tar',['-xf',archive,'-C',base]);const result=snapshot(base);fs.mkdirSync(artifactDir,{recursive:true});fs.writeFileSync(baselineFile,JSON.stringify(result,null,2)+'\n');
 fs.writeFileSync(path.join(artifactDir,'hero-placement-inventory.json'),JSON.stringify({release,heroes:result.pages.filter(p=>result.heroes.includes(p.route)).map(p=>({route:p.route,sections:p.structure,banners:p.banners,affiliate:p.affiliate}))},null,2)+'\n');
 // Delete only the verified temporary directory created by this invocation.
 if(path.dirname(tmp)===os.tmpdir()&&path.basename(tmp).startsWith('tiles-301-baseline-'))fs.rmSync(tmp,{recursive:true,force:true});
 return result;
}
const baseline=process.argv.includes('--capture')||!fs.existsSync(baselineFile)?capture():JSON.parse(fs.readFileSync(baselineFile,'utf8'));
if(process.argv.includes('--capture')){console.log(JSON.stringify({baselineFile,release,inventory:baseline.inventory},null,2));process.exit(0);}
let checks=0;const errors=[],counts={pages:0,numericRows:0,tableCells:0,skills:0,heroes:0,banners:0,legacyBanners:0,localResources:0,localLinks:0,localFragments:0,growthForms:0};
const check=(ok,message)=>{checks++;if(!ok)errors.push(message);};
check(baseline.release===release,'Fixed baseline commit');check(baseline.heroes.length===135,'135 canonical heroes in baseline');
check(baseline.inventory.existingBannerSlots===25,'25 existing contextual banners');check(baseline.inventory.heroTextAffiliateSurfaces.length===10,'10 legacy Shark/Lagnar text CTAs');
const docs=new Map(),load=file=>{if(!docs.has(file))docs.set(file,parse(fs.readFileSync(file,'utf8')));return docs.get(file);};
for(const old of baseline.pages){
 const file=path.join(root,old.relative);check(fs.existsSync(file),'URL removed '+old.route);if(!fs.existsSync(file))continue;counts.pages++;
 const d=load(file),baseURL=new URL(d.querySelector('base[href]')?.getAttribute('href')||old.route,'https://tilessurvive.net');
 const expectedMetadata=delta.metadata(old.metadata,old.relative);expectedMetadata.alternates=require('./product-50-test-allowances').alternates(expectedMetadata.alternates);
 const editorialHub=old.relative.match(/^(ko|en|ja|ru|zh-tw)\/(events|guides|seasons)\/index\.html$/);
 if(editorialHub){const [,lang,type]=editorialHub,copy=require('../data/product-50/editorial-copy').copy;expectedMetadata.title=copy[type][lang]+' | TilesSurvive.net';expectedMetadata.description=copy[type+'Intro'][lang];}
 check(JSON.stringify(metadata(d))===JSON.stringify(expectedMetadata),'SEO metadata changed beyond reviewed fields '+old.route);
 check(d.querySelectorAll('h1').length===1,'One H1 '+old.route);
 const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);check(ids.length===new Set(ids).size,'Duplicate IDs '+old.route);
 const currentRows=new Set(rows(d).map(JSON.stringify));for(const row of delta.expectedRows(old.numericRows,old.relative)){counts.numericRows++;counts.tableCells+=row.length;check(currentRows.has(JSON.stringify(row)),'Numeric row or unit changed '+old.route+' '+JSON.stringify(row).slice(0,200));}
 for(const [key,selector]of [['skills','main .ts-skill-body'],['stages','[data-stage-picker]'],['stats','main .stat-card,main .equipment-stat,main .ts-data-strip'],['identities','main .ts3-character-identity']]){const values=new Set([...d.querySelectorAll(selector)].map(txt)),identityExpected=key==='identities'?delta.identitiesFromGit(old[key],old.relative,release):null;for(const [i,value]of old[key].entries()){if(key==='skills')counts.skills++;const expected=identityExpected?identityExpected[i]:delta.text(key==='skills'?expectedSkillText(value,old.relative):value,old.relative,key);check(values.has(expected),'Game '+key+' block changed '+old.route+' '+value.slice(0,140));}}
 const main=d.querySelector('main')?.cloneNode(true);main?.querySelectorAll('script,style').forEach(n=>n.remove());const currentQuantities=new Set([...main?.querySelectorAll('*')||[]].flatMap(n=>quantities(txt(n))));for(const q of old.quantities)check(currentQuantities.has(q)||delta.quantity(q,old.relative,d),'Quantitative prose removed '+old.route+' '+q);
 const currentImages=new Set([...d.querySelectorAll('main img')].map(n=>n.getAttribute('src')));for(const src of old.images)check(currentImages.has(delta.image(old.relative,src)),'Original or exact approved game image missing '+old.route+' '+src);
 const currentMainLinks=new Set([...d.querySelectorAll('main a[href]')].map(n=>n.getAttribute('href')));for(const href of old.mainLinks)check(currentMainLinks.has(href),'Original unique content destination removed '+old.route+' '+href);
 check(JSON.stringify(forms(d))===JSON.stringify(delta.forms(old.growthForms,old.relative)),'Calculator data changed beyond reviewed Starhorn rows '+old.route);counts.growthForms+=old.growthForms.length;
 if(old.couponApp)check(hash(d.querySelector('script[data-coupon-app]')?.textContent||'')===old.couponApp,'Coupon logic changed '+old.route);
 const banners=[...d.querySelectorAll('[data-lootbar-slot]')];counts.banners+=banners.length;
 for(const b of old.banners){counts.legacyBanners++;const n=banners.find(n=>n.getAttribute('data-lootbar-slot')===b.slot);check(n&&JSON.stringify(bannerInfo(n))===JSON.stringify(b),'Existing banner changed '+old.route+' '+b.slot);}
 if(baseline.heroes.includes(old.route)){
  counts.heroes++;check(banners.length===1,'Exactly one hero banner '+old.route);const b=banners[0],a=b?.querySelector('a[href]');
  check(b?.getAttribute('data-lootbar-slot')==='hero_detail','Hero banner slot '+old.route);check(b?.classList.contains('ts-lootbar-slot--hero'),'Hero-specific modest layout '+old.route);
  const skill=[...d.querySelectorAll('main .ts-skill')].at(-1)?.closest('section');check(!!skill,'Hero skill section '+old.route);check(skill?.nextElementSibling===b,'Banner immediately follows last skill section '+old.route);
  const descendants=[...d.querySelectorAll('main *')],bi=descendants.indexOf(b);for(const n of d.querySelectorAll('.ts3-roster-neighbors,.equipment-stat,[data-growth-form]'))check(descendants.indexOf(n)>bi,'Banner precedes growth/equipment/related '+old.route);
  check(a?.href==='https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive','Hero referral exact '+old.route);
  check(a?.target==='_blank'&&['sponsored','nofollow','noopener','noreferrer'].every(r=>(a?.rel||'').split(/\s+/).includes(r)),'Affiliate disclosure/link safety '+old.route);
  check(a?.getAttribute('data-affiliate-placement')==='banner_hero_detail'&&a?.getAttribute('data-affiliate-page-type')==='hero_detail','Hero measurement dimensions '+old.route);
  check(txt(a).includes(heroMessages[old.relative.split('/')[0]]),'Localized availability CTA '+old.route);
  check(!/\d\s*%/.test(txt(a)),'No unconfirmed fixed discount '+old.route);
  check(a?.getAttribute('data-affiliate-variant')==='hero-context-301','Hero creative version '+old.route);
  check(!!txt(b?.querySelector('.ts-lootbar-note')),'Visible affiliate disclosure '+old.route);
  check(d.querySelectorAll('main a[href*="lootbar.com"]').length===1,'No repeated hero affiliate CTA '+old.route);
  for(const src of ['/img/banners/official-world.webp','/img/banners/official-hero.webp','/img/banners/official-logo.webp'])check(!!b?.querySelector('img[src="'+src+'"]'),'Original official banner asset '+old.route+' '+src);
  for(const oldCTA of old.affiliate)if(oldCTA.anchor)check(!!d.getElementById(oldCTA.anchor),'Existing CTA fragment preserved '+old.route+' '+oldCTA.anchor);
 }
 for(const n of d.querySelectorAll('img[src],script[src],link[rel=stylesheet][href],source[srcset]')){
  const attr=n.getAttribute('src')||n.getAttribute('href')||n.getAttribute('srcset');for(const v of attr.split(',').map(v=>v.trim().split(/\s+/)[0])){const u=new URL(v,baseURL);if(u.origin!=='https://tilessurvive.net')continue;counts.localResources++;check(fs.existsSync(path.join(root,decodeURIComponent(u.pathname))),'Resource missing '+old.route+' '+u.pathname);}
  if(n.tagName==='IMG'){check(n.hasAttribute('alt'),'Image alt '+old.route+' '+attr);check(Number(n.getAttribute('width'))>0&&Number(n.getAttribute('height'))>0,'Image dimensions '+old.route+' '+attr);}
 }
 for(const a of d.querySelectorAll('a[href]')){
  const raw=a.getAttribute('href');if(!raw||/^(mailto:|tel:|javascript:)/.test(raw))continue;let u;try{u=new URL(raw,baseURL);}catch{check(false,'Invalid href '+old.route+' '+raw);continue;}
  if(u.origin!=='https://tilessurvive.net')continue;counts.localLinks++;const f=path.join(root,decodeURIComponent(u.pathname),path.extname(u.pathname)?'':'index.html');check(fs.existsSync(f),'Local URL missing '+old.route+' '+u.pathname);
  if(u.hash&&fs.existsSync(f)&&/\.html$/.test(f)){counts.localFragments++;const id=decodeURIComponent(u.hash.slice(1));check(!!load(f).getElementById(id),'Local fragment missing '+old.route+' '+u.pathname+u.hash);}
 }
 for(const s of d.querySelectorAll('script[type="application/ld+json"]')){try{JSON.parse(s.textContent);check(true,'');}catch{check(false,'Invalid JSON-LD '+old.route);}}
}
for(const [relative,expected]of Object.entries(baseline.protectedFiles)){const file=path.join(root,relative);
 if(delta.deletedDrafts[relative]){check(!fs.existsSync(file)&&expected===delta.deletedDrafts[relative],'Only exact backed-up draft removed '+relative);continue;}
 check(fs.existsSync(file),'Protected file removed '+relative);if(fs.existsSync(file)){
 const bytes=fs.readFileSync(file);
 // New hero-only rules are appended after the complete original stylesheet.
 // Existing banner CSS, not merely selected declarations, remains protected.
 if(['data/companions.json','data/expansion-22/database.json','data/expansion-22/ledger.json','data/expansion-22/manifest.json'].includes(relative)){const before=JSON.parse(execFileSync('git',['show',release+':'+relative],{cwd:root,encoding:'utf8'}));check(require('util').isDeepStrictEqual(JSON.parse(bytes),delta.source(relative,before)),'Exact approved data/provenance fields '+relative);}
 else if(relative==='sitemap.xml'){const before=execFileSync('git',['show',release+':sitemap.xml'],{cwd:root,encoding:'utf8'}),nodes=s=>s.match(/<url>[\s\S]*?<\/url>/g)||[],oldNodes=nodes(before),current=nodes(bytes.toString());for(const node of oldNodes)check(current.filter(n=>n===node).length===1,'Exact old sitemap node');const extras=current.filter(n=>!oldNodes.includes(n)).map(n=>n.match(/<loc>(.*?)<\/loc>/)[1]).sort(),approved=require('./product-50-test-allowances').expectedSitemapURLs().filter(url=>!oldNodes.some(node=>node.includes('<loc>'+url+'</loc>')));check(JSON.stringify(extras)===JSON.stringify(approved),'Only exact approved 4.0 and six-language 5.0 sitemap additions');}
 else if(relative==='js/database-22.js')check(require('./product-50-test-allowances').databasePreserved(execFileSync('git',['show',release+':'+relative],{cwd:root,encoding:'utf8'}),bytes.toString('utf8')),'Exact database formatter-only change');
 else if(relative==='js/tools-speedup-calculator.js')check(require('./product-50-test-allowances').speedupPreserved(execFileSync('git',['show',release+':'+relative],{cwd:root,encoding:'utf8'}),bytes.toString('utf8')),'Exact speedup formula and old-language output');
 else check(hash(relative==='css/lootbar-banner.css'?bytes.subarray(0,baseline.originalBannerStyleBytes):bytes)===expected,'Protected data/formula/artwork/export changed '+relative);
}}
check(counts.pages===473,'473 preserved language pages');check(counts.heroes===135,'135 tested canonical heroes');check(counts.legacyBanners===25,'25 original banner placements');check(counts.banners===160,'160 total contextual banner placements');
const result={release,checks,counts,errors,scope:'Static fixed-release regression. Exact SEO, numerical table rows/cell units, skill and stat text, growth calculator rows, formula file hashes, artwork and old banner exports. All page resources, local links/fragments, duplicate IDs. Canonical hero banner count/order/referral/disclosure. Rendering, interaction timing and purchase attribution require separate evidence.'};
fs.mkdirSync(artifactDir,{recursive:true});fs.writeFileSync(path.join(artifactDir,'regression.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,errors:errors.slice(0,80),totalErrors:errors.length},null,2));if(errors.length)process.exitCode=1;
