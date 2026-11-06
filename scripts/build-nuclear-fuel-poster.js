'use strict';
// Deterministic vector artwork. Every displayed requirement comes from the
// same projection as the page; no separate poster cost table is maintained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {project}=require('./nuclear-fuel-summary');
const {SIX}=require('./nuclear-service-overrides');
const ROOT=path.resolve(__dirname,'..');
const REG=require('../data/i18n/locales.json').locales;
const DATA=require('../data/nuclear-age.json'),COPY=require('../data/nuclear-fuel-copy.json').locales;
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const SCOPES=Object.freeze(['all','tree']);
function route(locale,scope='all'){
 assert(SCOPES.includes(scope),'Unknown Nuclear Fuel poster scope');
 return `img/nuclear-age/fuel-table-${scope==='tree'?'tree-':''}${locale}.svg`;
}
const manifestPath='data/nuclear-fuel-poster-manifest.json';
const sourceFiles=['data/nuclear-age.json','data/nuclear-fuel-copy.json','data/i18n/locales.json','js/nuclear-age.js','scripts/nuclear-fuel-summary.js','scripts/nuclear-service-overrides.js','scripts/build-nuclear-fuel-poster.js'];
const pngCache=new Map();
function embeddedImage(src){
 const bytes=fs.readFileSync(path.join(ROOT,src)),key=sha(bytes);if(pngCache.has(key))return pngCache.get(key);
 // PNG is also supported by standalone SVG renderers which cannot decode WebP.
 const png=path.extname(src)==='.png'?bytes:execFileSync(process.execPath,['-e',"const fs=require('node:fs'),sharp=require('sharp');sharp(fs.readFileSync(0)).png().toBuffer().then(b=>process.stdout.write(b)).catch(()=>process.exit(1));"],{cwd:ROOT,input:bytes,maxBuffer:8*1024*1024});
 const value='data:image/png;base64,'+png.toString('base64');pngCache.set(key,value);return value;
}
function weight(text){return [...String(text)].reduce((n,c)=>n+(/[\u2e80-\u9fff\uac00-\ud7af\u3040-\u30ff]/u.test(c)?1:/[A-Z0-9]/.test(c)?.65:.55),0);}
function lines(text,maxUnits){
 const words=String(text).split(/\s+/),result=[];let line='';
 for(const word of words){
  if(weight(word)>maxUnits){if(line){result.push(line);line='';}let part='';for(const ch of word){if(weight(part+ch)>maxUnits){result.push(part);part='';}part+=ch;}line=part;continue;}
  if(line&&weight(line+' '+word)>maxUnits){result.push(line);line=word;}else line+=(line?' ':'')+word;
 }
 if(line)result.push(line);return result;
}
function render(locale,model=project()){
 const loc=REG.find(x=>x.code===locale),c=COPY[locale];assert(loc&&c,'Unknown poster locale');
 assert(SCOPES.includes(model.scope),'Unknown Nuclear Fuel poster scope');
 const title=c[model.scope+'Title'],help=c[model.scope+'Help'];
 assert(typeof title==='string'&&title.trim()&&typeof help==='string'&&help.trim(),'Missing poster scope copy');
 assert(typeof c.correctionNote==='string'&&c.correctionNote.trim(),'Missing poster correction note');
 const nf=new Intl.NumberFormat(loc.numberLocale),rtl=loc.dir==='rtl',parts=[],images=new Map();
 const name=b=>b.names[locale]||b.names.en,number=n=>nf.format(n);
 const marked=model.buildings.filter(b=>b.levels.some(l=>l.powerPlantRequirement));
 assert.deepEqual(marked.map(b=>b.id).sort((a,b)=>a-b),model.scope==='all'?[...SIX].sort((a,b)=>a-b):[],'Unreviewed poster prerequisite scope');
 const hasPowerPlantRequirement=b=>marked.some(x=>x.id===b.id);
 const first=model.firstPowerPlantUpgrade,showFirstZero=first?.buildingId===800005&&first.sourceId===501051&&first.nuclearFuel===0;
 if(showFirstZero)assert(typeof c.firstUpgradeFreeNote==='string'&&c.firstUpgradeFreeNote.trim(),'Missing first upgrade note');
 if(marked.length)for(const key of ['powerPlantBadge','powerPlantSharedNote','powerPlantCompletedStage'])assert(typeof c[key]==='string'&&c[key].trim(),'Missing prerequisite copy '+key);
 function image(src,x,y,w,h=w){
  if(!src)return;let id=images.get(src);if(!id){id='asset'+images.size;images.set(src,id);}
  parts.push(`<use href="#${id}" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
 }
 function text(value,x,y,size=22,color='#173f3b',anchor='start',bold=false,maxWidth,central=false){
  const actual=maxWidth?Math.min(size,maxWidth/Math.max(1,weight(value))):size;
  const arabic=/[\u0620-\u064a\u066e-\u06d3\u06fa-\u06fc]/.test(String(value));
  const physicalAnchor=arabic?({start:'end',end:'start',middle:'middle'}[anchor]):anchor;
  parts.push(`<text x="${x}" y="${y}" font-size="${actual.toFixed(2)}" fill="${color}" text-anchor="${physicalAnchor}" direction="${arabic?'rtl':'ltr'}" unicode-bidi="plaintext"${bold?' font-weight="700"':''}${central?' dominant-baseline="central"':''}>${esc(value)}</text>`);
 }
 function paragraph(value,y,{x=68,width=944,size=20,color='#526a64',lineHeight=29}={}){
  const rows=lines(value,width/size);for(const row of rows){text(row,rtl?x+width:x,y,size,color,rtl?'end':'start');y+=lineHeight;}return y;
 }
 function rect(x,y,w,h,fill,r=0,stroke){parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke?` stroke="${stroke}"`:''}/>`);}
 function requirement(value,x,y,{size=31,color='#163d37'}={}){
  const display=value.complete?number(value.total):value.knownFuel>0?number(value.knownFuel)+' + ?':'?';
  text(display,x,y,size,color,'middle',true,208);
 }
 const centers=[452,676,900];
 function table(top,mode,compact=false){
  const headerH=compact?72:94,rowH=compact?64:78,rows=model.buildings;
  parts.push(`<g data-nuclear-fuel-panel="${mode}">`);
  rect(54,top,972,headerH+rows.length*rowH+110,'#fffdf7',18,'#c9d5c8');
  rect(55,top+1,970,headerH,'#e5eddd',17);
  text(c.building,rtl?312:76,top+headerH/2+8,22,'#284b40',rtl?'end':'start',true,235);
  model.levels.forEach((level,i)=>{
   if(!compact){parts.push(`<g data-nuclear-level-marker="${level}">`);image(model.stageMarker?.src,centers[i]-27,top+7,54);text(number(level),centers[i],top+34,26,'#fffdf2','middle',true,undefined,true);parts.push('</g>');}
   text(c.level+' '+number(level),centers[i],top+headerH-15,19,'#244c40','middle',true,207);
  });
  rows.forEach((b,i)=>{
   const markedRow=hasPowerPlantRequirement(b);
   parts.push(`<g data-nuclear-fuel-building="${b.id}"${markedRow?` data-nuclear-power-plant-badge="${b.id}" aria-label="${esc(name(b)+' · '+c.powerPlantBadge)}"`:''}>`);
   const y=top+headerH+i*rowH;if(i%2===1)rect(55,y,970,rowH,'#f1f5e9');
   image(b.image?.src,69,y+9,rowH-18);
   const labelX=rtl?315:69+rowH-8;const labelWidth=compact?184:170;
   text(name(b)+(markedRow?' †':''),labelX,y+rowH/2+7,22,'#24463d',rtl?'end':'start',true,labelWidth);
   b.levels.forEach((l,j)=>requirement(l[mode],centers[j],y+rowH/2+10,{size:compact?28:32}));
   parts.push('</g>');
  });
  parts.push('<g data-nuclear-fuel-total="true">');
  const totalY=top+headerH+rows.length*rowH;rect(55,totalY,970,109,'#153e3a',15);
  const titleRows=lines(c.totalLabel,17);titleRows.forEach((s,i)=>text(s,rtl?312:78,totalY+42+i*25,19,'#fbf6df',rtl?'end':'start',true,230));
  model.totals.forEach((l,i)=>requirement(l[mode],centers[i],totalY+49,{size:35,color:'#f4d688'}));
  parts.push('</g></g>');
  return totalY+110;
 }
 function prerequisites(top){
  if(!marked.length)return top;
  text('† '+c.powerPlantBadge,rtl?1012:68,top,24,'#24473e',rtl?'end':'start',true,944);
  parts.push('<g id="nuclear-power-plant-note">');
  let y=paragraph(c.powerPlantSharedNote,top+34,{size:19,lineHeight:28});parts.push('</g>');
  y+=8;const powerPlant=model.buildings.find(b=>b.id===800005);assert(powerPlant,'Missing prerequisite Power Plant label');
  parts.push('<g id="nuclear-power-plant-flow">');
  model.levels.forEach((level,index)=>{
   const required=marked[0].levels[index].powerPlantRequirement;assert(required,'Missing prerequisite level');
   for(const b of marked)assert.deepEqual(b.levels[index].powerPlantRequirement,required,'All six buildings must share the displayed prerequisite');
   assert.equal(required.completedNuclearLevel,level);assert.equal(required.completedSequence,level*5);assert.equal(required.buildingId,800005);
   const x=54+index*330,center=x+156;
   parts.push(`<g data-nuclear-power-plant-flow-level="${level}" data-required-sequence="${required.completedSequence}" data-required-source="${required.sourceId}">`);
   rect(x,y,312,143,'#e8efdf',12,'#c9d5c8');
   text(name(powerPlant),center,y+28,22,'#24473e','middle',true,284);
   text(c.powerPlantCompletedStage.replace(/\{level\}/g,number(required.completedNuclearLevel)),center,y+57,24,'#24473e','middle',true,284);
   text('↓',center,y+91,30,'#8b6728','middle',true);
   text('† N'+number(level),center,y+124,26,'#24473e','middle',true);
   parts.push('</g>');
  });
  parts.push('</g>');return y+143+51;
 }
 rect(0,0,1080,224,'#103d3b');rect(0,0,1080,7,'#d6b362');
 text('TILES SURVIVE  /  NUCLEAR AGE',68,51,18,'#d9c986','start',true);
 text(title,rtl?902:68,119,47,'#fff9e8',rtl?'end':'start',true,817);
 text(c.fromBase.replace('{level}',number(model.baseLevel))+'  ·  '+c.fiveSteps.replace('{count}',number(model.stepsPerLevel)),rtl?902:68,166,24,'#d9e4ce',rtl?'end':'start',false,790);
 image(model.item.image?.src,925,58,105);
 let y=paragraph(help,267,{size:19,lineHeight:28})+22;
 if(showFirstZero){parts.push('<g id="nuclear-first-upgrade-zero">');y=paragraph(c.firstUpgradeFreeNote,y,{size:19,lineHeight:28,color:'#6b4a15'})+20;parts.push('</g>');}
 text(c.incremental,rtl?1012:68,y,31,'#173e36',rtl?'end':'start',true,944);
 y=paragraph(c.incrementalHelp,y+36)+17;y=table(y,'incremental')+57;
 y=prerequisites(y);
 text(c.cumulative,rtl?1012:68,y,31,'#173e36',rtl?'end':'start',true,944);
 y=paragraph(c.cumulativeHelp,y+36)+17;y=table(y,'cumulative',true)+54;
 parts.push('<g id="nuclear-fuel-correction-note">');
 y=paragraph(c.correctionNote,y,{color:'#845819',size:18,lineHeight:27});
 parts.push('</g>');
 y=paragraph(c.scopeNote,y+7,{size:17,lineHeight:25})+25;
 parts.push(`<path d="M68 ${y}H1012" stroke="#bcc8b7"/>`);
 text('TilesSurvive.net',68,y+40,23,'#24473e','start',true);
 const canonical=`https://tilessurvive.net/${locale}/eras/nuclear-age/`;
 parts.push(`<a href="${canonical}" target="_blank">`);text(canonical,68,y+70,16,'#24473e','start',false,900);parts.push('</a>');
 text(`Lv30 → 1 / 2 / 3  ·  ${model.client.version}`,1012,y+40,17,'#536b60','end');
 const height=Math.ceil((y+103)/10)*10;
 const defs=[...images].map(([src,id])=>`<symbol id="${id}" viewBox="0 0 1 1"><image width="1" height="1" preserveAspectRatio="xMidYMid meet" href="${embeddedImage(src)}"/></symbol>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="${height}" viewBox="0 0 1080 ${height}" lang="${esc(loc.htmlLang)}" role="img" aria-labelledby="poster-title poster-desc"><title id="poster-title">${esc(title)}</title><desc id="poster-desc">${esc([help,c.scopeNote,showFirstZero?c.firstUpgradeFreeNote:'',marked.length?c.powerPlantSharedNote:''].filter(Boolean).join(' '))}</desc><metadata id="nuclear-fuel-projection">${esc(JSON.stringify(model))}</metadata><defs>${defs}</defs><g font-family="Malgun Gothic, Arial, Noto Sans, sans-serif"><rect id="poster-background" width="1080" height="${height}" fill="#f4f1e6"/>${parts.join('')}</g></svg>\n`;
}
function build({check=false}={}){
 const models=Object.fromEntries(SCOPES.map(scope=>[scope,project(DATA,scope)])),outputs={},sources=Object.fromEntries(sourceFiles.map(file=>[file,sha(fs.readFileSync(path.join(ROOT,file)))]));let changed=0;
 for(const locale of REG)for(const scope of SCOPES){const file=route(locale.code,scope),body=render(locale.code,models[scope]),target=path.join(ROOT,file);outputs[file]={sha256:sha(body),bytes:Buffer.byteLength(body),locale:locale.code,scope};if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==body){changed++;if(!check)fs.writeFileSync(target,body);}}
 const imageSources=Object.values(models).flatMap(model=>[model.stageMarker?.src,model.item.image?.src,...model.buildings.map(b=>b.image?.src)]);
 const manifest={schemaVersion:2,projectionSHA256:Object.fromEntries(SCOPES.map(scope=>[scope,sha(JSON.stringify(models[scope]))])),sources,images:Object.fromEntries([...new Set(imageSources.filter(Boolean))].sort().map(src=>[src,sha(fs.readFileSync(path.join(ROOT,src)))])),outputs};
 const body=JSON.stringify(manifest,null,2)+'\n',target=path.join(ROOT,manifestPath);if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==body){changed++;if(!check)fs.writeFileSync(target,body);}
 if(check)assert.equal(changed,0,'Stale Nuclear Fuel posters or manifest; rebuild the guide');return {owner:'nuclear-fuel-poster',locales:REG.length,scopes:SCOPES.length,posters:Object.keys(outputs).length,changed,checked:check};
}
module.exports={ROOT,SCOPES,route,render,build,manifestPath};if(require.main===module)console.log(JSON.stringify(build({check:process.argv.includes('--check')})));
