'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const {copy}=require('./answer-guides/copy');
const ROOT=path.resolve(__dirname,'..'),ORIGIN='https://tilessurvive.net';
const adapters=['nuclear','hero','building','pet','event'];
const cache=new Map();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex').slice(0,12);
function guides(locale){
 if(cache.has(locale))return cache.get(locale);
 const plans=adapters.flatMap(name=>{const file=path.join(__dirname,'answer-guides',name+'.js');assert(fs.existsSync(file),'Missing answer adapter '+name);return require(file).guides(locale);});
 const byRoute=new Map();
 for(const guide of plans){
  assert(guide.route.startsWith('/'+locale+'/')&&guide.route.endsWith('/'),'Invalid answer route');
  assert(guide.answers.length,'Empty guide');
  for(const a of guide.answers){assert(/^[a-z][a-z0-9-]+$/.test(a.id),'Invalid answer anchor');assert(a.question&&a.paragraphs?.length,'Missing readable answer');assert(a.model?.targetId!==undefined&&a.model.source?.file&&Array.isArray(a.model.source.recordIds),'Missing answer provenance');assert(['confirmed','confirmed-zero','partial'].includes(a.model.status),'Invalid answer state');if(a.model.status==='confirmed-zero')assert.equal(a.model.value,0);for(const s of [a.question,...a.paragraphs])assert(!/\{[a-z]+\}/i.test(s),'Unfilled answer');}
  if(byRoute.has(guide.route)){const prior=byRoute.get(guide.route);prior.answers.push(...guide.answers);if(guide.example&&!prior.example)prior.example=guide.example;}
  else byRoute.set(guide.route,{...guide,answers:[...guide.answers]});
 }
 for(const g of byRoute.values())assert.equal(new Set(g.answers.map(a=>a.id)).size,g.answers.length,'Duplicate answer anchor '+g.route);
 const result=[...byRoute.values()];cache.set(locale,result);return result;
}
function guide(locale,route){return guides(locale).find(g=>g.route===route);}
function table(value){if(!value)return '';assert(value.caption&&value.columns.length&&value.rows.every(row=>row.length===value.columns.length));return '<div class="answer-table-scroll" role="region" tabindex="0" aria-label="'+esc(value.caption)+'"><table><caption>'+esc(value.caption)+'</caption><thead><tr>'+value.columns.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+value.rows.map(row=>'<tr>'+row.map((cell,i)=>i?'<td>'+esc(cell)+'</td>':'<th scope="row">'+esc(cell)+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function links(items=[]){return items.length?'<nav class="answer-links">'+items.map(a=>{assert(/^\/[a-z-]+\/|^https:\/\//.test(a.href),'Unsafe answer link');return '<a href="'+esc(a.href)+'"'+(a.href.startsWith('https:')?' rel="noopener noreferrer"':'')+'>'+esc(a.label)+' <span aria-hidden="true">↗</span></a>';}).join('')+'</nav>':'';}
function render(g,locale){const c=copy(locale);return '<section class="answer-guide" data-answer-guide="'+esc(g.kind)+'" aria-labelledby="direct-answers-heading"><h2 id="direct-answers-heading">'+esc(g.title||c.heading)+'</h2><div class="answer-grid">'+g.answers.map((a,index)=>'<article id="'+a.id+'" class="answer-card" data-answer-id="'+a.id+'" data-answer-state="'+a.model.status+'"><h3>'+esc(a.question)+'</h3>'+a.paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')+table(a.table)+links(a.links)+'<button type="button" class="answer-copy" data-answer-copy="'+a.id+'" hidden>'+esc(c.copy)+'</button></article>').join('')+'</div>'+(g.example?'<aside class="answer-example" id="answer-worked-example"><h3>'+esc(g.example.title||c.example)+'</h3>'+g.example.paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')+table(g.example.table)+links(g.example.links)+'</aside>':'')+'<p class="answer-copy-status" role="status" aria-live="polite" data-answer-copy-status data-copied="'+esc(c.copied)+'" data-failed="'+esc(c.copyFailed)+'"></p></section>';}
function basis(g,locale){if(!g.basis)return '';return '<details class="answer-basis" data-answer-basis><summary>'+esc(copy(locale).basis)+'</summary><p>'+esc(g.basis.text)+'</p>'+links(g.basis.links)+'</details>';}
function assets(){return ['css/answer-guides.css','js/answer-guides.js'].map(file=>file.endsWith('.css')?'<link data-answer-asset rel="stylesheet" href="/'+file+'?v='+digest(fs.readFileSync(path.join(ROOT,file)))+'">':'<script data-answer-asset defer src="/'+file+'?v='+digest(fs.readFileSync(path.join(ROOT,file)))+'"></script>').join('');}
function block(name,body){return '<!-- TS_ANSWER_'+name+'_BEGIN -->'+body+'<!-- TS_ANSWER_'+name+'_END -->';}
const markers=['BODY','BASIS','ASSETS'];
function strip(html){for(const name of markers)html=html.replace(new RegExp('<!-- TS_ANSWER_'+name+'_BEGIN -->[\\s\\S]*?<!-- TS_ANSWER_'+name+'_END -->','g'),'');return html;}
function validateAndStrip(html,locale,route,{required=false}={}){
 const present=html.includes('<!-- TS_ANSWER_')||/data-answer-(?:guide|basis|asset)/.test(html);
 if(!present){assert(!required||!guide(locale,route),'Missing answers '+route);return html;}
 const g=guide(locale,route);assert(g,'Answer owner on unsupported route '+route);
 const expected={BODY:render(g,locale),BASIS:basis(g,locale),ASSETS:assets()};
 const normalize=s=>parseHTML('<html><body>'+s+'</body></html>').document.body.innerHTML;
 for(const name of markers){const re=new RegExp('<!-- TS_ANSWER_'+name+'_BEGIN -->([\\s\\S]*?)<!-- TS_ANSWER_'+name+'_END -->','g'),matches=[...html.matchAll(re)];assert.equal(matches.length,1,'Missing or duplicate answer '+name+' '+route);assert.equal(normalize(matches[0][1]),normalize(expected[name]),'Unreviewed answer '+name+' '+route);}
 const clean=strip(html);assert(!/TS_ANSWER_|data-answer-(?:guide|basis|asset)/.test(clean),'Orphaned answer content');return clean;
}
function project(input,locale,route){
 const g=guide(locale,route);if(!g)return input;
 // Regenerate only this owner's delimited content. Validation is a separate,
 // strict gate so approved source corrections can replace an older projection.
 const html=strip(input),d=parseHTML(html).document,main=d.querySelector('main'),h1=main?.querySelector('h1');assert(h1,'Answer page requires a visible H1 '+route);
 for(const id of ['direct-answers-heading',...g.answers.map(a=>a.id),...(g.example?['answer-worked-example']:[])])assert(!d.getElementById(id),'Answer anchor collides with retained content: '+id);
 let anchor=h1.closest('header')||h1.closest('.ts3-character-stage,.hero,.p60-identity,.pet-hero')||h1;
 if(!main.contains(anchor))anchor=h1;
 anchor.insertAdjacentHTML('afterend',block('BODY',render(g,locale)));
 main.insertAdjacentHTML('beforeend',block('BASIS',basis(g,locale)));
 d.head.insertAdjacentHTML('beforeend',block('ASSETS',assets()));
 return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
}
function clearCache(){cache.clear();}
module.exports={ROOT,ORIGIN,guides,guide,render,basis,assets,strip,validateAndStrip,project,clearCache};
