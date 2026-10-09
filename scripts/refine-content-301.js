/* Narrow editorial patch. Game tables, formulas, skill bodies and metadata are untouched.
 * Exact before/after rules are reviewable in content-301-rules.json. Use --audit to
 * inspect without writing pages; --ledger=PATH exports the private audit ledger. */
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),languages=['ko','en','ja','ru','zh-tw'];
const rules=require('./content-301-rules.json');
const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.html')?[path.join(d,e.name)]:[]);
const copy={
 ko:{sources:'참고 자료',related:'관련 성장 데이터',screen:'스킬 화면',version:'게임 버전 미확인',growth:'성장 조건'},
 en:{sources:'References',related:'Related growth data',screen:'Skill screenshots',version:'Game version unknown',growth:'Growth conditions'},
 ja:{sources:'参考資料',related:'関連する育成データ',screen:'スキル画面',version:'ゲームのバージョン不明',growth:'育成条件'},
 ru:{sources:'Справочные материалы',related:'Данные для развития',screen:'Снимки навыков',version:'Версия игры неизвестна',growth:'Условия развития'},
 'zh-tw':{sources:'參考資料',related:'相關成長資料',screen:'技能畫面',version:'遊戲版本未確認',growth:'成長條件'}
};
const ledger=[],changed=[],audit=process.argv.includes('--audit');
function record(route,rule,before,after,extra={}){ledger.push({route,rule,before:clean(before),after:clean(after),...extra});}
function remove(n){if(n.id){const marker=n.ownerDocument.createElement('span');marker.id=n.id;marker.setAttribute('aria-hidden','true');n.replaceWith(marker);}else n.remove();}
for(const lang of languages)for(const file of walk(path.join(root,lang))){
 const route=path.relative(root,file).replaceAll('\\','/'),original=fs.readFileSync(file,'utf8'),d=parseHTML(original).document,main=d.querySelector('main');if(!main)continue;
 const t=copy[lang];let touched=false;
 for(const rule of rules.filter(r=>r.route===route))for(const n of [...d.querySelectorAll(rule.selector||'main p,main h2,main h3,main summary')]){
  if(clean(n.textContent)!==rule.before)continue;
  record(route,rule.rule,n.textContent,rule.after);
  if(/^H[23]$/.test(n.tagName)&&n.id)for(const a of main.querySelectorAll(`.ts3-character-sections a[href$="#${n.id}"]`))if(clean(a.textContent)===rule.before&&rule.after)a.textContent=rule.after;
  if(rule.after===null)remove(n);else n.textContent=rule.after;touched=true;
 }
 // Keep citations available without repeating collection/check dates after every table.
 const sourceNodes=[...main.querySelectorAll('.ts-source-note,.ts-source-line,.ts3-source-caption')].filter(n=>!n.closest('[data-content301-references]'));
 const oldDisclosure=main.querySelector('[data-content301-references]');
 if(sourceNodes.length){
  const links=new Map(),unknownVersion=[];
  for(const source of [...(oldDisclosure?[oldDisclosure]:[]),...sourceNodes])for(const a of source.querySelectorAll('a[href]')){
   const href=a.getAttribute('href');if(!/^https?:\/\//.test(href))continue;
   let label=clean(a.textContent).replace(/\s*·\s*\d{4}-\d{2}-\d{2}(?: observation)?/g,'').replace(/\s*·\s*(?:existing data; game version unknown|game screenshots; build unknown)/g,'');
   label=label.replace(/^(?:게임 화면|Game screenshot|ゲーム画面|Игровой снимок|遊戲畫面)\s*·\s*/,'');
   if(!links.has(href))links.set(href,{href,label:label||new URL(href).hostname});
  }
  for(const n of sourceNodes){
   if(/game version unknown|build unknown/.test(n.textContent)){const parent=n.closest('section')||main;if(!unknownVersion.includes(parent))unknownVersion.push(parent);}
   record(route,'compact-reference',n.textContent,t.sources,{links:[...n.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))});remove(n);touched=true;
  }
  for(const parent of unknownVersion)if(!parent.querySelector('[data-content301-version]')){const p=d.createElement('p');p.className='ts-evidence-label';p.setAttribute('data-content301-version','');p.textContent=t.version;parent.append(p);}
  oldDisclosure?.remove();
  if(links.size){const details=d.createElement('details');details.className='ts-source-details ts301-references';details.setAttribute('data-content301-references','');const summary=d.createElement('summary');summary.textContent=t.sources;details.append(summary);const list=d.createElement('ul');for(const {href,label}of links.values()){const li=d.createElement('li'),a=d.createElement('a');a.href=href;a.textContent=label;li.append(a);list.append(li);}details.append(list);main.append(details);}
 }
 // Source-only sections now have one disclosure. Remove their empty titles, retaining IDs.
 for(const section of [...main.querySelectorAll('section')]){
  const heads=[...section.querySelectorAll(':scope > h2')];
  if(!heads.length||section.querySelector('table,img,form,input,select,a,details,p,li,h3'))continue;
  if([...section.children].some(n=>!n.matches('h2,span[aria-hidden="true"]')))continue;
  for(const h of heads){record(route,'empty-reference-heading',h.textContent,'');if(h.id)for(const a of d.querySelectorAll(`.ts3-character-sections a[href$="#${h.id}"]`))a.remove();remove(h);touched=true;}
  if(!section.id&&!section.querySelector('[id]'))section.remove();
 }
 // Consolidate repeated growth destinations, retaining every unique original link.
 if(/^\w[\w-]*\/heroes\/[^/]+\/index\.html$/.test(route)&&d.documentElement.getAttribute('data-character-view')==='hero'){
  for(const summary of main.querySelectorAll('.ts3-character-stage .hero-summary')){
   const text=clean(summary.textContent),numeric=text.match(/[+-]?\d+(?:[.,]\d+)*(?:[KMBkmb%])?/g)||[];
   const grids=[...main.querySelectorAll('.stat-grid')];
   const matching=grids.find(grid=>{const cards=[...grid.querySelectorAll('.stat-card')];return cards.length>=4&&cards.every(card=>{const key=clean(card.querySelector('.k')?.textContent),value=clean(card.querySelector('.v,strong')?.textContent);return key&&value&&text.includes(key)&&text.includes(value);})&&numeric.every(value=>clean(grid.textContent).includes(value));});
   if(matching){record(route,'remove-duplicate-stat-summary',text,'',{preservedIn:'.stat-grid',values:numeric});remove(summary);touched=true;}
  }
  const navs=[...main.querySelectorAll('nav.ts-context-links,nav[data-platform-related]')].filter(n=>!n.closest('.ts3-character-stage'));
  if(navs.length>1){const links=new Map();for(const nav of navs)for(const a of nav.querySelectorAll('a[href]'))if(!links.has(a.getAttribute('href')))links.set(a.getAttribute('href'),a.cloneNode(true));
   // The illustrated faction rail already presents these same hero destinations.
   const rosterHrefs=new Set([...main.querySelectorAll('.ts3-roster-neighbors a[href]')].map(a=>a.getAttribute('href')));
   for(const href of rosterHrefs)links.delete(href);
   if(links.size){const nav=d.createElement('nav');nav.className='ts-context-links';nav.setAttribute('data-content301-related','');nav.setAttribute('aria-label',t.related);for(const a of links.values())nav.append(a);const reference=main.querySelector('.ts3-roster-neighbors')||main.querySelector('[data-content301-references]');if(reference)reference.before(nav);else main.append(nav);}
   for(const nav of navs){record(route,'deduplicate-related-links',nav.textContent,t.related,{links:[...nav.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))});remove(nav);}touched=true;
  }
  const mariner=main.querySelector('#mariner-connections');if(mariner&&!mariner.querySelector('nav,a')){const h=mariner.querySelector('h2');if(h&&clean(h.textContent)!==t.growth){record(route,'name-growth-condition-section',h.textContent,t.growth);h.textContent=t.growth;touched=true;}}
 }
 if(touched){const html='<!DOCTYPE html>\n'+d.documentElement.outerHTML.replace(/[ \t]+$/gm,'')+'\n';if(html!==original){changed.push(route);if(!audit)fs.writeFileSync(file,html);}}
}
const output={version:'3.0.1',auditedPages:languages.flatMap(lang=>walk(path.join(root,lang))).length,changedPages:changed.length,changes:ledger.length,rules:rules.length,routes:changed,entries:ledger};
const ledgerArg=process.argv.find(a=>a.startsWith('--ledger='));
const ledgerPath=ledgerArg?ledgerArg.slice(9):process.env.TS_CONTENT_LEDGER;
if(ledgerPath){const file=path.resolve(ledgerPath);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(output,null,2)+'\n');}
console.log(JSON.stringify({mode:audit?'audit':'write',auditedPages:output.auditedPages,changedPages:changed.length,changes:ledger.length,rules:rules.length}));
