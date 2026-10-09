const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process'),{parseHTML}=require('linkedom');
const db=require('../data/expansion-22/database.json'),manifest=require('../data/expansion-22/manifest.json'),ledger=require('../data/expansion-22/ledger.json'),{calculate}=require('../js/database-22');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw'];let checks=0;const check=(v,m)=>{checks++;assert.ok(v,m);};
for(const [key,data]of Object.entries(db.datasets)){
 check(data.rows.length===data.max-data.min,key+' complete transition coverage');
 check(new Set(data.rows.map(r=>r.from)).size===data.rows.length,key+' unique levels');
 data.rows.forEach((r,i)=>{check(r.from===data.min+i&&r.to===r.from+1,key+' sequential');check(r.cost===null||Number.isInteger(r.cost)&&r.cost>=0,key+' valid unit value');});
 for(let from=data.min;from<=data.max;from++)for(let to=from;to<=data.max;to++){
  const rows=data.rows.filter(r=>r.from>=from&&r.to<=to),expected=rows.some(r=>r.cost===null)?null:rows.reduce((a,r)=>a+r.cost,0),got=calculate(data.rows,from,to,20);
  check(expected===null?got.error==='missing':got.total===expected&&got.shortage===Math.max(0,expected-20),key+' range '+from+'-'+to);
 }
 for(const [a,b,h]of [[data.min-1,data.max,0],[data.min,data.max+1,0],[2,1,0],[1.5,2,0],[data.min,data.max,-1],[NaN,2,0]])check(calculate(data.rows,a,b,h).error==='invalid',key+' invalid input');
}
check(calculate(db.datasets.gear.rows,1,80).total===1585500,'Gear full sum');
let sourceSum=0;for(const row of db.datasets.gear.rows){sourceSum+=row.cost;check(sourceSum===row.sourceTotal,'Gear source cumulative '+row.to);}
check(calculate(db.datasets.skillBook.rows,1,40).total===23505,'Preserved books sum');
check(db.datasets.skillBook.rows.find(r=>r.to===30).cost===685,'Preserved disputed row');
check(calculate(db.datasets.petExp.rows,85,87).error==='missing','Pet missing guard');
check(calculate(db.datasets.petTraining.rows,0,4).total===1300,'Training total');
check(calculate(db.datasets.exclusive.rows,1,15).total===360,'Exclusive total');
db.reforge.forEach((r,i)=>check(Math.abs(r.values.reduce((a,b)=>a+b,0)-100)<1e-8,'Reforge distribution '+i));
for(const egg of ['rare','epic','legendary'])check(Math.abs(db.pets.reduce((a,p)=>a+(p.eggs[egg]||0),0)-100)<.02,'Egg rounding '+egg);
check(new Set(ledger.entries.map(e=>e.id)).size===ledger.entries.length,'Ledger IDs unique');
const cooldowns=require('../data/expansion-22/hero-cooldowns.json');check(cooldowns.length===27,'All existing heroes inspected');for(const h of cooldowns){check(h.skills.filter(s=>s.cooldownSeconds!==null).length===2,'Two sourced cooldowns '+h.id);for(const l of langs){const d=parseHTML(fs.readFileSync(path.join(root,l,'heroes',l==='en'&&h.id==='tarzan'?'tazan':h.id,'index.html'),'utf8')).document;check(d.getElementById(['shark','lagnar','undine','knotty'].includes(h.id)?'hero-data-22':'cooldowns-22'),'Hero enrichment '+l+'/'+h.id);}}
for(const e of ledger.entries){for(const field of ['id','category','gameName','originalName','value','unit','level','conditions','sourceURL','version','checked','pages','status'])check(Object.hasOwn(e,field),'Ledger field '+e.id+' '+field);check(e.sourceURL.startsWith('https://'),'Source URL');for(const route of e.pages)check(fs.existsSync(path.join(root,route,'index.html')),'Ledger page '+route);}
const map=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),search=fs.readFileSync(path.join(root,'data/search-index.json'),'utf8');
for(const route of manifest.changed){const d=parseHTML(fs.readFileSync(path.join(root,route,'index.html'),'utf8')).document;check(d.querySelectorAll('h1').length===1,'H1 '+route);check(d.querySelector('link[rel=canonical]').href==='https://tilessurvive.net/'+route.replace(/\/$/,'')+'/','Canonical '+route);check(d.querySelectorAll('link[hreflang]').length===6,'Hreflang '+route);check(map.includes('https://tilessurvive.net/'+route.replace(/\/$/,'')+'/'),'Sitemap '+route);check(search.includes('/'+route.replace(/\/$/,'')+'/'),'Search '+route);
 for(const a of d.querySelectorAll('a[href^="/"]')){let href=a.getAttribute('href').split(/[?#]/)[0];check(fs.existsSync(path.join(root,href,path.extname(href)?'':'index.html')),'Internal link '+route+' '+href);}
 for(const i of d.querySelectorAll('img[src^="/"]')){check(fs.existsSync(path.join(root,i.src)),'Image '+i.src);check(i.hasAttribute('alt'),'Alt '+i.src);}
 for(const f of d.querySelectorAll('[data-growth-form]')){const key=f.dataset.growthForm,cfg=JSON.parse(f.querySelector('script').textContent);check(JSON.stringify(cfg.rows)===JSON.stringify(db.datasets[key].rows),'Language numerical parity '+route+' '+key);}
}
// Existing images, referral settings, calculator formulas and banners are byte-preserved.
const protectedFiles=['config/affiliate.json','js/platform-math.js','js/tools-speedup-calculator.js','js/platform-affiliate.js','data/tilessurvive-coupons.json','CNAME',...fs.readdirSync(path.join(root,'img/banners')).map(f=>'img/banners/'+f)];
for(const f of protectedFiles){
 // Page-type measurement is the one authorized script change in 3.0.1.
 if(f==='js/platform-affiliate.js'){const tracking=JSON.parse(execFileSync(process.execPath,[path.join(__dirname,'test-affiliate-301.js')],{cwd:root,encoding:'utf8'}));check(tracking.checks>=72&&tracking.errors.length===0,'Affiliate measurement contract');continue;}
 const old=execFileSync('git',['show','ef10abd:'+f],{cwd:root,maxBuffer:16000000}),now=fs.readFileSync(path.join(root,f));check(crypto.createHash('sha256').update(old).digest('hex')===crypto.createHash('sha256').update(now).digest('hex'),'Protected bytes '+f);
}
const result={checks,changedPages:manifest.changed.length,newPages:manifest.newPages.length,ledgerEntries:ledger.entries.length,newCostRows:79+54+1,missingPetRows:1,errors:[]};console.log(JSON.stringify(result,null,2));if(process.env.TS_DATABASE_RESULT)fs.writeFileSync(process.env.TS_DATABASE_RESULT,JSON.stringify(result,null,2));
