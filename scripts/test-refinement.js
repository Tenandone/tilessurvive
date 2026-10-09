const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom'),{imageSize}=require('image-size');
const root=path.resolve(__dirname,'..'),pets=require('../data/companions.json'),heroes=require('../data/mariner-expansion.json');
let checks=0;function check(v,msg){checks++;assert.ok(v,msg);}
const read=r=>parseHTML(fs.readFileSync(path.join(root,r,'index.html'),'utf8')).document;
const langs=['ko','en','ja','ru','zh-tw'],newRoutes=[];
for(const lang of langs){
 const d=read(lang+'/database/pet-system');
 check(d.querySelectorAll('[data-pet-role]').length===7,lang+' roster count');
 check(d.querySelector('[data-pet-controls] input[type=search]'),lang+' pet search');
 for(const p of pets.pets){const row=d.getElementById('pet-'+p.id);check(row?.textContent.includes(p.name),lang+' '+p.name);check(row?.getAttribute('data-pet-role')===p.role,'role '+p.id);}
 const rows=[...d.querySelectorAll('#pet-growth tbody tr')].map(r=>[...r.querySelectorAll('td')].map(x=>x.textContent));
 check(JSON.stringify(rows)===JSON.stringify([['0','25%','0','0'],['1','40%','100','100'],['2','55%','200','300'],['3','70%','400','700']]),lang+' observed training values');
 check(!d.querySelector('a[href$="/pets/polar-bear/"]'),'No speculative polar bear detail');
 const directory=read(lang+'/heroes');
 check(directory.querySelectorAll('.hero-item .hero-item').length===0,lang+' no nested heroes');
 for(const h of heroes.heroes){
  const route=lang+'/heroes/'+h.id,hd=read(route);newRoutes.push(route);
  check(directory.querySelectorAll('a.hero-item[href="/'+route+'/"]').length===1,route+' directory link exactly once');
  for(const s of h.skills){check(hd.querySelector('main').textContent.includes(s.name),route+' skill '+s.name);for(const stage of s.stages||[])check(hd.querySelector('main').textContent.includes('Lv.'+stage.level+' · '+stage.value+s.unit),route+' snapshot '+stage.level);}
  check(hd.querySelectorAll('[data-stage-result]').length===(h.id==='undine'?4:2),route+' only observed levels');
 }
 const star=read(lang+'/database/pet-system/starhorn');newRoutes.push(lang+'/database/pet-system/starhorn');
 for(const value of ['157','31','10.31K','40,819','25%','120 EXP'])check(star.querySelector('main').textContent.includes(value),lang+' Starhorn '+value);
}
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8'),index=JSON.parse(fs.readFileSync(path.join(root,'data/search-index.json'),'utf8'));
for(const route of newRoutes){const d=read(route),url='https://tilessurvive.net/'+route+'/';
 check(d.querySelectorAll('h1').length===1,route+' H1');check(d.querySelector('link[rel=canonical]').href===url,route+' canonical');
 check(d.querySelectorAll('link[hreflang]').length===6,route+' hreflang');
 for(const lang of langs){const target=route.replace(/^[^/]+/,lang);check(d.querySelector(`link[hreflang="${lang}"]`).href==='https://tilessurvive.net/'+target+'/',route+' language target');}
 check(sitemap.includes('<loc>'+url+'</loc>'),route+' sitemap');check(JSON.stringify(index).includes('/'+route+'/'),route+' search index');
 for(const img of d.querySelectorAll('img')){const src=img.getAttribute('src');if(src.startsWith('/')){const size=imageSize(fs.readFileSync(path.join(root,src)));check(size.width>0,src);check(+img.getAttribute('width')>0&&+img.getAttribute('height')>0,'image dimensions '+src);}}
 check(d.querySelectorAll('link[href^="/css/refinement.css"]').length===1,route+' one stylesheet');
 check(d.querySelectorAll('script[src^="/js/refinement.js"]').length===1,route+' one interaction script');
}
const assets=require('../data/expansion-assets.json');for(const a of assets){check(fs.existsSync(path.join(root,a.file)),a.file);check(a.source.startsWith('https://'),'source '+a.file);}
check(assets.length===13,'13 evidence images');
check(!fs.existsSync(path.join(root,'img/heroes/undine.jpeg')),'Exclude unverified polished portraits');
const result={checks,newPages:newRoutes.length,pets:pets.pets.length,newSeaHeroes:heroes.heroes.length,evidenceImages:assets.length,errors:[]};
if(process.env.TS_REFINEMENT_RESULT)fs.writeFileSync(process.env.TS_REFINEMENT_RESULT,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
