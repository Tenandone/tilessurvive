'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),registry=require('../data/i18n/locales.json'),planner=require('./v3-planner-content'),pc=require('../data/v3-planner-copy').locales,events=require('./build-v3-events');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,12),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8'),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const owned=['NAV','TRUST','PLANNER','AFFILIATE','PRIVACY','ASSETS'];
function strip(html){for(const key of owned)html=html.replace(new RegExp('<!-- TS_V3_'+key+'_BEGIN -->[\\s\\S]*?<!-- TS_V3_'+key+'_END -->','g'),'');return events.strip(html).replace(/\sdata-v3-(?:platform|affiliate)=""/g,'');}
function block(key,body){return '<!-- TS_V3_'+key+'_BEGIN -->'+body+'<!-- TS_V3_'+key+'_END -->';}
function fileAsset(file){const stamp=digest(fs.readFileSync(path.join(ROOT,file)));return file.endsWith('.css')?`<link data-v3-owned="assets" rel="stylesheet" href="/${file}?v=${stamp}">`:`<script data-v3-owned="assets" defer src="/${file}?v=${stamp}"></script>`;}
function project(input,locale,route){
 if(!registry.locales.some(l=>l.code===locale))throw Error('Unsupported V3 locale '+locale);
 let html=strip(input);const d=parseHTML(html).document;
 route=route||new URL(d.querySelector('link[rel="canonical"]')?.href||'https://tilessurvive.net/').pathname;
 if(!d.querySelector('main')||!route.startsWith('/'+locale+'/')||/noindex/i.test(d.querySelector('meta[name="robots"]')?.content||''))return html;
 const rel=route.slice(locale.length+2),isPower=rel==='buildings/power-plant/',isCalendar=rel==='events/calendar/',isTopup=rel==='top-up/',isHub=['','tools/','events/','tools/event-helper/'].includes(rel),isSearch=rel==='search/';
 // A saved consent choice must apply when a reader follows a link to any detail page.
 const affine=true;
 const af=require('./v3-affiliate-content');
 const title=pc[locale].title,ec=require('../data/v3-events-copy.json').copy[locale];
 if(isHub||isPower||isCalendar||isTopup){const payload=JSON.parse(d.getElementById('ts-global-ui')?.textContent||'{}'),search=payload.copy?.search||d.querySelector('input[name="q"]')?.getAttribute('aria-label');if(!search)throw Error('Missing navigation copy '+locale);const nav=block('NAV',`<nav class="v3-nav" data-v3-owned="navigation" aria-label="${esc(title)}"><a href="/${locale}/buildings/power-plant/#growth-plan">${esc(title)}</a><a href="/${locale}/events/calendar/#v3-events">${esc(ec.title)}</a><a href="/${locale}/search/">${esc(search)}</a></nav>`);html=html.replace(/(<main\b[^>]*>)/,m=>m+nav);}
 if(isPower)html=planner.project(html,locale);
 if(isCalendar||rel==='tools/event-helper/'||rel==='events/')html=events.project(html,locale);
 if(isTopup){
  const old=parseHTML(html).document,section=old.querySelector('[data-topup-step="2"] p');
  if(section){const before=section.outerHTML;af.projectLegacyTopup(old,locale);section.setAttribute('data-v3-owned','topup-step');const after=section.outerHTML;if(before!==after)html=html.replace(before,after);}
  for(const change of require('./ten-benefits-content').projectBookmark(old,locale)){if(!html.includes(change.before))throw Error('Missing exact bookmark replacement '+locale);html=html.replace(change.before,change.after);}
  for(const change of require('./ten-benefits-content').projectLegacyBenefitCopy(old,locale)){if(!html.includes(change.before))throw Error('Missing exact benefit policy replacement '+locale);html=html.replace(change.before,change.after);}
  const h1=html.indexOf('</h1>'),heroEnd=html.indexOf('</section>',h1);
  if(h1<0||heroEnd<0)throw Error('Missing topup introduction owner '+locale);
  const guide=block('AFFILIATE',`<div data-v3-owned="affiliate">${af.renderGuide(locale)}</div>`);
  html=html.slice(0,heroEnd+10)+guide+html.slice(heroEnd+10);
 }
 if(d.querySelector('[data-building-system]')||rel==='database/research/'){
  const record={status:isPower?'analysis':'retained',version:'2.6.200',verifiedAt:null,liveScheduleStatus:'unverified',scopeKind:'data'};
  const trust=block('TRUST',`<div data-v3-owned="trust">${events.renderTrust(record,locale)}</div>`);html=html.replace(/(<\/h1>)/,m=>m+trust);
 }
 const assets=['css/v3-platform.css','js/v3-search-core.js'];
 if(isTopup)assets.push('css/ten-benefits.css');
 if(isPower)assets.push('js/v3-planner.js');
 if(affine){html=af.transformAnalytics(html);html=html.replace(/<html\b/, '<html data-v3-affiliate=""');html=html.replace(/<\/main>/,block('PRIVACY',`<div data-v3-owned="privacy">${af.renderPrivacyNotice(locale)}</div>`)+ '</main>');assets.push('js/v3-affiliate.js');}
 html=html.replace(/<html\b/,'<html data-v3-platform=""').replace(/(data-v3-platform=""\s*){2,}/g,'data-v3-platform="" ').replace(/(data-v3-affiliate=""\s*){2,}/g,'data-v3-affiliate="" ');
 const head=block('ASSETS',assets.map(fileAsset).join(''));
 // Head placement ensures the shared search ranker executes before both existing consumers.
 html=html.replace(/<\/head>/,head+'</head>');
 for(const file of ['js/building-system.js','js/platform-search.js','js/product-30.js','js/platform-affiliate.js','js/affiliate-tracking.js']){const hash=digest(fs.readFileSync(path.join(ROOT,file)));html=html.replace(new RegExp('(/'+file.replaceAll('.','\\.')+'\\?v=)[a-f0-9]+','g'),'$1'+hash);}
 return html;
}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name==='index.html'?[path.join(dir,e.name)]:[]);}
function build(){
 const report={locales:21,pages:0,changed:0,counts:{},compatibilityAnalytics:0,deployed:false},outputs=[],seen=new Set();
 for(const l of registry.locales){let count=0;for(const file of walk(path.join(ROOT,l.code))){const before=fs.readFileSync(file,'utf8'),route='/'+path.relative(ROOT,file).replaceAll('\\','/').replace(/index\.html$/,'');let after=project(before,l.code,route);if(!after.includes('data-v3-platform')&&/G-Z2MJ6TXZHK/.test(after))after=require('./v3-affiliate-content').transformAnalytics(after);outputs.push({file,before,after});seen.add(file);count++;}report.counts[l.code]=count;report.pages+=count;}
 // Language-entry and redirect pages do not need a second statistics owner.
 // Remove only their eager GA bootstrap; the destination offers the shared choice.
 const tracked=require('node:child_process').execFileSync('git',['ls-files','*.html'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n');
 for(const rel of tracked){if(rel.startsWith('node_modules/'))continue;const file=path.join(ROOT,rel);if(seen.has(file)||!fs.existsSync(file))continue;const before=fs.readFileSync(file,'utf8');if(!/G-Z2MJ6TXZHK/.test(before)||!/<head\b/.test(before))continue;const after=require('./v3-affiliate-content').transformAnalytics(before);outputs.push({file,before,after});report.compatibilityAnalytics++;}
 for(const {file,before,after}of outputs)if(before!==after){fs.writeFileSync(file,after);report.changed++;}console.log(JSON.stringify(report));return report;
}
function validateOwnership(html,locale,route){const a=parseHTML(html).document;if(!a.documentElement.hasAttribute('data-v3-platform'))return;const b=parseHTML(project(html,locale,route)).document;const snapshot=d=>[...d.querySelectorAll('[data-v3-owned]')].filter(n=>n.getAttribute('data-v3-owned')!=='assets').map(n=>n.outerHTML);if(JSON.stringify(snapshot(a))!==JSON.stringify(snapshot(b)))throw Error('V3 renderer ownership mismatch: regenerate the reviewed V3 blocks before translating '+route);}
module.exports={project,strip,build,fileAsset,validateOwnership};if(require.main===module)build();
