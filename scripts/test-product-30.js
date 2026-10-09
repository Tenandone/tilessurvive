/* Semantic regression against the deployed 2.2 release. This checks static facts,
 * not rendered pixels or browser event behavior; those require the browser matrix.
 * Capture is explicit and reads an archive of the fixed Git commit, never HEAD. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {parseHTML}=require('linkedom');
const delta=require('./foundation-40-test-allowances');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw'];
const release='247d48164aa35df74d5a7baffbac5aa8f0feb995';
const baselineFile=path.join(root,'data/product-30-baseline.json');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const text=n=>(n?.textContent||'').normalize('NFKC').replace(/\s+/g,' ').trim();
// Thousands separators and Unicode presentation punctuation may change without
// changing a fact. Percentages, signs, decimal precision and suffix units survive.
const normalized=s=>String(s).normalize('NFKC').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'').replace(/[–—]/g,'-').replace(/\s+/g,'').toLowerCase();
function signature(cell){
 const value=normalized(text(cell));
 const nums=value.match(/[+−-]?\d+(?:\.\d+)?(?:%|[kmb](?![a-z]))?/g)||[];
 if(!nums.length)return 'text:'+value;
 // Keep units and nonnumeric cell labels, too: 5 seconds is not 5 hours.
 return 'fact:'+value;
}
function tableRows(doc){return [...doc.querySelectorAll('main table')].flatMap((table,tableIndex)=>{
 const rows=[...table.querySelectorAll('tr')].map(r=>[...r.children].filter(n=>/^(TD|TH)$/.test(n.tagName)));
 return rows.filter(cells=>cells.some(c=>c.tagName==='TD')&&cells.some(c=>/\d/.test(text(c)))).map(cells=>({table:tableIndex,cells:cells.map(signature)}));
});}
function transposedRows(doc){return [...doc.querySelectorAll('main table')].flatMap(t=>{
 const matrix=[...t.querySelectorAll('tr')].map(r=>[...r.children].filter(n=>/^(TD|TH)$/.test(n.tagName)).map(signature));
 const width=Math.max(0,...matrix.map(r=>r.length));
 return Array.from({length:width},(_,i)=>matrix.map(row=>row[i]).filter(v=>v!==undefined));
});}
function quantities(value){return [...String(value).normalize('NFKC').replace(/(?<=\d),(?=\d{3}(?:\D|$))/g,'').matchAll(/[+−-]?\d+(?:\.\d+)?(?:\s*(?:%|[KMB](?![a-z])))?/gi)].map(m=>m[0].replace(/\s+/g,'').replace(/^\+/,'').toLowerCase());}
function quantitativeProse(doc){
 const nodes=[...doc.querySelectorAll('main p,main li,main .value,main .v,main .equipment-power')].filter(n=>!n.closest('table,script,style,nav,.ts-source-note,.source-list,.ts-evidence-label')&&/\d(?:[\d.,]*)\s*(?:%|[KMB]\b)/i.test(text(n)));
 return [...new Set(nodes.flatMap(n=>quantities(text(n))))].sort();
}
function inspect(file,base){
 const doc=parseHTML(fs.readFileSync(file,'utf8')).document;
 const relative=path.relative(base,file).replaceAll('\\','/');
 const main=doc.querySelector('main');
 const clone=main?.cloneNode(true);clone?.querySelectorAll('script,style,nav').forEach(n=>n.remove());
 const visible=text(clone);
 return {relative,route:'/'+relative.replace(/index\.html$/,''),canonical:doc.querySelector('link[rel=canonical]')?.href||null,
  alternates:[...doc.querySelectorAll('link[hreflang]')].map(n=>[n.getAttribute('hreflang'),n.href]).sort(),
  noindex:/noindex/.test(doc.querySelector('meta[name=robots]')?.content||''),
  tableRows:tableRows(doc),quantitativeProse:/\/(heroes|buildings|behemoths|database)\//.test(relative)?quantitativeProse(doc):[],
  banners:[...doc.querySelectorAll('[data-lootbar-slot]')].map(n=>({slot:n.getAttribute('data-lootbar-slot'),link:n.querySelector('a[href]')?.href,images:[...n.querySelectorAll('img,source')].map(i=>i.getAttribute('src')||i.getAttribute('srcset'))})),
  growthForms:[...doc.querySelectorAll('[data-growth-form]')].map(n=>({key:n.getAttribute('data-growth-form'),rows:JSON.parse(n.querySelector('script[type="application/json"]').textContent).rows})),
  couponApp:doc.querySelector('script[data-coupon-app]')?hash(doc.querySelector('script[data-coupon-app]').textContent):null,
  audit:{visibleCharacters:visible.length,headings:[...main?.querySelectorAll('h2,h3')||[]].map(text),images:main?.querySelectorAll('img').length||0,tableCount:main?.querySelectorAll('table').length||0,
   processPhrases:visible.match(/.{0,30}(?:검증 상태|AI 분석|이번 작업에서|기능 개선 예정|추가하면 됩니다|순차적으로 확장|VERIFIED|Verified|미정 상태).{0,60}/g)||[]}
 };
}
if(process.argv.includes('--capture')){
 const os=require('os'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'tiles-30-baseline-')),tar=path.join(temp,'release.tar'),base=path.join(temp,'release');fs.mkdirSync(base);
 execFileSync('git',['archive','--format=tar','--output='+tar,release,...langs,'img','data','config','js','CNAME','robots.txt','sitemap.xml'],{cwd:root});
 execFileSync('tar',['-xf',tar,'-C',base]);
 const files=langs.flatMap(l=>walk(path.join(base,l))).filter(f=>f.endsWith('.html'));
 const protectedPaths=['CNAME','robots.txt','config/affiliate.json','js/platform-affiliate.js','data/tilessurvive-coupons.json','data/expansion-22/database.json','data/expansion-22/hero-cooldowns.json',...walk(path.join(base,'img')).map(f=>path.relative(base,f).replaceAll('\\','/'))];
 const result={release,created:'2026-10-09',method:'HTML table cells retain row association, exact textual units and values; row order and table wrappers may change. A full matrix transpose is also accepted. Separate corpus and browser checks cover prose/behavior.',
  pages:files.map(f=>inspect(f,base)),protectedFiles:Object.fromEntries(protectedPaths.map(f=>[f,hash(fs.readFileSync(path.join(base,f)))])),
  sitemap:[...fs.readFileSync(path.join(base,'sitemap.xml'),'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]),
  formulaSources:Object.fromEntries(['js/platform-math.js','js/database-22.js','js/tools-speedup-calculator.js'].map(f=>[f,hash(fs.readFileSync(path.join(base,f)))]))};
 fs.writeFileSync(baselineFile,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({captured:result.pages.length,tables:result.pages.reduce((n,p)=>n+p.audit.tableCount,0),numericRows:result.pages.reduce((n,p)=>n+p.tableRows.length,0),protectedFiles:protectedPaths.length,baseline:release},null,2));
 process.exit(0);
}
const baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'));let checks=0;const errors=[];const check=(ok,message)=>{checks++;if(!ok)errors.push(message);};
check(baseline.release===release,'Baseline release identifier');
const pageDocs=new Map(),counts={pages:0,numericRows:0,tableCells:0,banners:0,growthForms:0,localResources:0,localLinks:0};
for(const old of baseline.pages){
 const file=path.join(root,old.relative);check(fs.existsSync(file),'URL removed '+old.route);if(!fs.existsSync(file))continue;
 counts.pages++;const doc=parseHTML(fs.readFileSync(file,'utf8')).document;pageDocs.set(old.route,doc);const baseURL=new URL(doc.querySelector('base[href]')?.getAttribute('href')||old.route,'https://tilessurvive.net');
 check(doc.querySelector('link[rel=canonical]')?.href===old.canonical,'Canonical changed '+old.route);
 check(JSON.stringify([...doc.querySelectorAll('link[hreflang]')].map(n=>[n.getAttribute('hreflang'),n.href]).sort())===JSON.stringify(old.alternates),'Hreflang changed '+old.route);
 check(/noindex/.test(doc.querySelector('meta[name=robots]')?.content||'')===old.noindex,'Indexability changed '+old.route);
 check(doc.querySelectorAll('h1').length===1,'One H1 '+old.route);
 check(text(doc.querySelector('title')).length>0,'Title '+old.route);
 check(old.noindex||!!doc.querySelector('meta[name=description]')?.content,'Description '+old.route);
 const nowRows=tableRows(doc),nowKeys=new Set(nowRows.map(r=>JSON.stringify(r.cells))),transposed=new Set(transposedRows(doc).map(r=>JSON.stringify(r)));
 const reviewedRows=/\/database\/pet-system\//.test('/'+old.relative)?delta.expectedRows([...parseHTML(execFileSync('git',['show',release+':'+old.relative],{cwd:root,encoding:'utf8'})).document.querySelectorAll('main table tr')].filter(r=>r.querySelector('td')&&/\d/.test(text(r))).map(r=>[...r.children].filter(c=>/^(TD|TH)$/.test(c.tagName)).map(text)),old.relative).map(cells=>({table:'reviewed-pet-fields',cells:cells.map(value=>signature({textContent:value}))})):old.tableRows;
 for(const row of reviewedRows){counts.numericRows++;counts.tableCells+=row.cells.length;check(nowKeys.has(JSON.stringify(row.cells))||transposed.has(JSON.stringify(row.cells)),'Data row/context changed '+old.route+' table '+row.table+' '+JSON.stringify(row.cells).slice(0,220));}
 // This extra check catches lost skill coefficients/stat amounts outside tables.
 // It intentionally does not claim to prove prose relationships or game meaning.
 const mainCopy=doc.querySelector('main')?.cloneNode(true);mainCopy?.querySelectorAll('script,style').forEach(n=>n.remove());const currentQuantities=new Set([...mainCopy?.querySelectorAll('*')||[]].flatMap(n=>quantities(text(n))));
 for(const value of old.quantitativeProse||[])check(currentQuantities.has(value)||delta.quantity(value,old.relative,doc),'Quantitative prose value removed '+old.route+' '+value);
 for(const b of old.banners){counts.banners++;const slot=[...doc.querySelectorAll('[data-lootbar-slot]')].find(n=>n.getAttribute('data-lootbar-slot')===b.slot);check(!!slot,'Banner placement '+old.route);if(!slot)continue;
  check(slot.querySelector('a[href]')?.href===b.link,'Banner referral '+old.route);
  check(JSON.stringify([...slot.querySelectorAll('img,source')].map(i=>i.getAttribute('src')||i.getAttribute('srcset')))===JSON.stringify(b.images),'Banner imagery '+old.route);
 }
 for(const form of delta.forms(old.growthForms,old.relative)){counts.growthForms++;const now=[...doc.querySelectorAll('[data-growth-form]')].find(n=>n.getAttribute('data-growth-form')===form.key);check(!!now,'Growth calculator removed '+old.route+' '+form.key);if(now){try{check(JSON.stringify(JSON.parse(now.querySelector('script[type="application/json"]').textContent).rows)===JSON.stringify(form.rows),'Calculator rows '+old.route+' '+form.key);}catch{check(false,'Invalid calculator JSON '+old.route);}}}
 if(old.couponApp)check(hash(doc.querySelector('script[data-coupon-app]')?.textContent||'')===old.couponApp,'Coupon application changed '+old.route);
 for(const n of doc.querySelectorAll('img[src],script[src],link[rel=stylesheet][href],source[srcset]')){
  const attribute=n.getAttribute('src')||n.getAttribute('href')||n.getAttribute('srcset');
  for(const value of attribute.split(',').map(v=>v.trim().split(/\s+/)[0])){
   const url=new URL(value,baseURL);if(url.origin!=='https://tilessurvive.net')continue;
   counts.localResources++;check(fs.existsSync(path.join(root,decodeURIComponent(url.pathname))),'Local resource missing '+old.route+' '+url.pathname);
  }
  if(n.tagName==='IMG'){
   check(n.hasAttribute('alt'),'Image alt '+old.route+' '+attribute);
   check(Number(n.getAttribute('width'))>0&&Number(n.getAttribute('height'))>0,'Intrinsic image dimensions '+old.route+' '+attribute);
  }
 }
 for(const a of doc.querySelectorAll('main a[href]')){
  const raw=a.getAttribute('href');if(!raw||/^(mailto:|tel:|javascript:)/.test(raw))continue;
  const u=new URL(raw,baseURL);if(u.origin!=='https://tilessurvive.net')continue;
  counts.localLinks++;const f=path.join(root,decodeURIComponent(u.pathname),path.extname(u.pathname)?'':'index.html');check(fs.existsSync(f),'Internal link missing '+old.route+' '+u.pathname);
 }
 for(const s of doc.querySelectorAll('script[type="application/ld+json"]'))try{JSON.parse(s.textContent);check(true,'');}catch{check(false,'Invalid JSON-LD '+old.route);}
}
// Canonical aliases deliberately share metadata. Unique canonical pages should
// describe their own entity/purpose in every language, rather than role-only copy.
const metadata={title:new Map(),description:new Map()};
for(const [route,doc]of pageDocs){
 if(/noindex/.test(doc.querySelector('meta[name=robots]')?.content||'')||doc.querySelector('link[rel=canonical]')?.href!=='https://tilessurvive.net'+route)continue;
 for(const [key,value]of [['title',text(doc.querySelector('title'))],['description',doc.querySelector('meta[name=description]')?.content?.trim()]]){
  check(!metadata[key].has(value),'Duplicate canonical '+key+' '+route+' '+metadata[key].get(value));metadata[key].set(value,route);
 }
}
for(const [file,sha]of Object.entries(baseline.protectedFiles)){check(fs.existsSync(path.join(root,file)),'Protected asset removed '+file);if(fs.existsSync(path.join(root,file))){
 // 3.0.1 adds page/creative dimensions to the existing tracking contract.
 // Exercise that actual module; referral config, formulas and artwork stay byte protected.
 if(file==='js/platform-affiliate.js'){const tracking=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'test-affiliate-301.js')],{cwd:root,encoding:'utf8'}));check(tracking.checks>=72&&tracking.errors.length===0,'Affiliate measurement contract');}
 else if(file==='data/expansion-22/database.json'){const before=JSON.parse(execFileSync('git',['show',release+':'+file],{cwd:root,encoding:'utf8'}));check(JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')))===JSON.stringify(delta.source(file,before)),'Exact approved pet fields and Starhorn source/model only');}
 else check(hash(fs.readFileSync(path.join(root,file)))===sha,'Protected data/artwork changed '+file);
}}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');for(const url of baseline.sitemap)check(sitemap.includes('<loc>'+url+'</loc>'),'Sitemap removed '+url);
// Differential math checks against the deployed implementation; UI code is allowed
// to change, while outputs and failure guards must remain equivalent.
const vm=require('vm');function loadBaseline(file){const code=execFileSync('git',['show',release+':'+file],{cwd:root,encoding:'utf8'}),sandbox={module:{exports:{}},console};vm.runInNewContext(code,sandbox);return sandbox.module.exports;}
const currentMath=require('../js/platform-math'),oldMath=loadBaseline('js/platform-math.js');
for(const value of ['0','100','1,234','12.5K','3.2M','1B','—','unknown','-2','1,2','',null])check(currentMath.amount(value)===oldMath.amount(value),'Amount parser '+value);
for(const value of ['1d 2h 3m','1일 2시간 3분','1天 2小時 3分鐘','1日2時間3分','1д. 2ч. 3мин.','2 hours','0m','-','unknown','1d unknown'])check(currentMath.minutes(value)===oldMath.minutes(value),'Time parser '+value);
function outcome(fn){try{return JSON.stringify(fn());}catch(e){return 'error:'+e.message;}}
const sampleRows=Array.from({length:30},(_,i)=>({level:i+1,cells:[String(i+1),String((i+1)*125),((i+1)/2)+'K',(i+1)+'h 30m']}));
for(let from=0;from<=30;from++)for(let to=from;to<=30;to++)check(outcome(()=>currentMath.sumRange(sampleRows,from,to,[1,2],3))===outcome(()=>oldMath.sumRange(sampleRows,from,to,[1,2],3)),'Building math range '+from+'-'+to);
for(const [rows,a,b]of [[sampleRows,5,3],[sampleRows,1.5,3],[sampleRows,0,31],[sampleRows.filter(r=>r.level!==5),1,10],[sampleRows.map(r=>r.level===2?{...r,cells:['2','unknown','1K','1h']}:r),1,2]])check(outcome(()=>currentMath.sumRange(rows,a,b,[1,2],3))===outcome(()=>oldMath.sumRange(rows,a,b,[1,2],3)),'Building math invalid/missing guard');
const currentGrowth=require('../js/database-22').calculate,oldGrowth=loadBaseline('js/database-22.js').calculate,database=require('../data/expansion-22/database.json');let rangeCases=0;
for(const [name,data]of Object.entries(database.datasets)){
 for(let from=data.min;from<=data.max;from++)for(let to=from;to<=data.max;to++)for(const held of [0,100,1e9]){rangeCases++;check(JSON.stringify(currentGrowth(data.rows,from,to,held))===JSON.stringify(oldGrowth(data.rows,from,to,held)),'Growth math '+name+' '+from+'-'+to+' held '+held);}
 for(const [from,to,held]of [[data.min-1,data.max,0],[data.min,data.max+1,0],[2,1,0],[1.5,3,0],[NaN,3,0],[data.min,data.max,-1],[data.min,data.max,Infinity]])check(JSON.stringify(currentGrowth(data.rows,from,to,held))===JSON.stringify(oldGrowth(data.rows,from,to,held)),'Growth error guard '+name);
}
const formulaChanges=Object.entries(baseline.formulaSources).filter(([f,sha])=>hash(fs.readFileSync(path.join(root,f)))!==sha).map(([f])=>f);
check(hash(fs.readFileSync(path.join(root,'js/tools-speedup-calculator.js')))===baseline.formulaSources['js/tools-speedup-calculator.js'],'Legacy speedup formula bytes');
const result={baseline:release,checks,counts,rangeCases,formulaChanges,errors,scope:'Static URLs, canonical/hreflang/indexability, numeric table rows with units and row context, local assets/links, fixed artwork/data, banner placement/referral, calculator input rows and exhaustive growth math. Browser rendering/interactions, performance and prose completeness are separate checks.'};
if(process.env.TS_PRODUCT_RESULT)fs.writeFileSync(process.env.TS_PRODUCT_RESULT,JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,errors:errors.slice(0,60),totalErrors:errors.length},null,2));if(errors.length)process.exitCode=1;
