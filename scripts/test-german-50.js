'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const R=path.resolve(__dirname,'..');
const G=require('./build-german-50'),W=require('../js/data-workbench-30'),M=require('../js/platform-math');
const cat=JSON.parse(fs.readFileSync(path.join(R,'data/product-50/german.json'),'utf8'));
for(const name of ['core','hero','calculator','growth','editorial','building','client52']){const p=path.join(R,'data/product-50/german-'+name+'-review.json');if(fs.existsSync(p))Object.assign(cat.exact,JSON.parse(fs.readFileSync(p,'utf8')).exact);}
Object.assign(cat.exact,JSON.parse(fs.readFileSync(path.join(R,'data/product-50/german-root-overrides.json'),'utf8')).exact);
const {translate,missing}=G.createTranslator(cat);
let checks=0,numericLeaves=0,cells=0,forms=0,ranges=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function typed(value,out={},prefix='') {if(value&&typeof value==='object'){for(const [k,v]of Object.entries(value)){if(k!=='de')typed(v,out,prefix+'/'+k);}}else if(typeof value!=='string')out[prefix]=value;return out;}
const strip=d=>{require('./strip-refinement-51').strip(d);require('./build-pet-skill-levels').stripOwnedSections(d,'en');d.querySelectorAll('[data-growth-50],[data-growth-research-50],[data-growth50-asset],[data-package-offer-50]').forEach(n=>n.remove());};
for(const route of JSON.parse(fs.readFileSync(path.join(R,'data/product-50/german-routes.json'),'utf8'))){
 const source=fs.readFileSync(path.join(R,'en',route),'utf8');
 const en=parseHTML(source).document,de=parseHTML(G.render(source,translate,route)).document;require('./content-60-owned').strip(en);strip(en);
 eq(de.documentElement.lang,'de',route+' language');
 const ec=[...en.querySelectorAll('td')],dc=[...de.querySelectorAll('td')];eq(ec.length,dc.length,route+' cells');
 ec.forEach((e,i)=>{eq(W.sourceValue(dc[i]),e.textContent.trim(),route+' raw cell '+i);cells++;
  const s=e.textContent.trim();if(/^[+−-]?[\d,.]+(?:%|[KMB])?$/.test(s))eq(dc[i].textContent.trim(),G.germanNumbers(s,s),route+' displayed numeric cell '+i);
 });
 const attrs=n=>['name','type','value','min','max','step'].map(a=>n.getAttribute(a));
 eq([...de.querySelectorAll('input,select option')].map(attrs),[...en.querySelectorAll('input,select option')].map(attrs),route+' form values');forms+=en.querySelectorAll('input,select').length;
 eq([...de.querySelectorAll('img')].map(x=>x.getAttribute('src')),[...en.querySelectorAll('img')].map(x=>x.getAttribute('src')),route+' same image sources');
 const es=[...en.querySelectorAll('script[type*="json"]')],ds=[...de.querySelectorAll('script[type*="json"]')];eq(es.length,ds.length,route+' JSON count');
 es.forEach((s,i)=>{let a,b;try{a=JSON.parse(s.textContent);b=JSON.parse(ds[i].textContent);}catch(err){throw new Error(route+' invalid JSON '+err.message);}const aa=typed(a),bb=typed(b);eq(bb,aa,route+' numeric/boolean/null model');numericLeaves+=Object.keys(aa).length;});
 for(const form of en.querySelectorAll('form[data-table]')){
  const id=form.dataset.table,et=en.getElementById(id),dt=de.getElementById(id);if(!et||!dt)continue;
  const rows=t=>[...t.querySelectorAll('tbody tr')].map(r=>({level:+W.sourceValue(r.children[0]),cells:[...r.children].map(W.sourceValue)}));
  const er=rows(et),dr=rows(dt);eq(dr,er,route+' arithmetic input rows');
  const lev=er.map(r=>r.level).filter(Number.isFinite);for(const from of lev.slice(0,3))for(const to of lev.filter(n=>n>from).slice(0,3)){
   let a,b;try{a=M.sumRange(er,from,to,[2,3,4,5],Number(form.dataset.timeColumn));}catch(e){a={error:e.message};}try{b=M.sumRange(dr,from,to,[2,3,4,5],Number(form.dataset.timeColumn));}catch(e){b={error:e.message};}eq(b,a,route+' sumRange '+from+' '+to);ranges++;
  }
 }
}
for(const [a,b] of [['2,500','2.500'],['10.00%','10,00%'],['1,234.5K','1.234,5K'],['v2.6.200','v2.6.200'],['2026-10-09','2026-10-09'],['Lv.1 → Lv.2','Lv.1 → Lv.2'],['4.29M','4,29M']])eq(G.germanNumbers(a,a),b,'German display '+a);
const raw=parseHTML('<td data-ts-original-value="1,234.5">1.234,5</td>').document.querySelector('td');eq(W.numeric(W.sourceValue(raw)),1234.5,'raw numeric value');
eq(W.compare(W.sourceValue(raw),'20','de',1)>0,true,'numeric order unaffected by German display');
eq(G.germanNumbers('2,500','2.500'),'2.500','already-localized override preserved');
const unknown=G.createTranslator({exact:{}});unknown.translate('Never silently inherit this English sentence','fixture');eq(unknown.missing.size,1,'unknown strings held');
const detailFixture='<html lang="en"><head></head><body><main><p>Details</p></main></body></html>';
eq(parseHTML(G.render(detailFixture,translate,'heroes/lagnar/index.html')).document.querySelector('main p').textContent,'Einzelheiten','generic hero wording is preserved');
eq(parseHTML(G.render(detailFixture,translate,'seasons/season-1/index.html')).document.querySelector('main p').textContent,'Einzelheiten','generic season wording is preserved');
eq(parseHTML(G.render(detailFixture,translate,'buildings/index.html')).document.querySelector('main p').textContent,'Details','building control wording remains scoped');
eq(missing.size,0,'all inherited strings have catalog coverage');
console.log(JSON.stringify({status:'PASS',checks,routes:100,cells,numericLeaves,controls:forms,rangeComparisons:ranges,scope:'Inherited German projection; late six-language owners are tested separately. Numeric model and original calculation lexemes preserved.'}));
