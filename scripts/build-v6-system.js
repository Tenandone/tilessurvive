'use strict';
// Presentation only. Reversible start-tag patches preserve the exact source
// outside owned links/images; all game records, text, IDs and URLs remain intact.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseDocument}=require('htmlparser2'),select=require('css-select'),{textContent}=require('domutils');
const {cardRules}=require('../js/v6-system');
const ROOT=path.resolve(__dirname,'..');
const locales=require('../data/i18n/locales.json').locales.map(l=>l.code);
const ASSETS=['css/v6-system.css','js/v6-system.js'];
const digest=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,12);
function tagEnd(html,start){let quote='';for(let i=start;i<html.length;i++){const c=html[i];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')return i+1;}throw Error('Unclosed presentation tag');}
function edits(html,changes){for(const change of changes.sort((a,b)=>b.start-a.start))html=html.slice(0,change.start)+change.text+html.slice(change.end);return html;}
function validateTag(node,original){
 const old=parseDocument(original).children.find(n=>n.type==='tag');assert(old&&old.name===node.name,'Invalid original presentation element');
 const markers=['data-v61-original','data-v61-card','data-v61-link','data-v61-link-path','data-v61-control'],allowed=new Set(markers);
 for(const key of markers.slice(1))if(Object.hasOwn(node.attribs,key))assert.equal(node.attribs[key],'','Invalid presentation marker '+key);
 if(node.attribs['data-v61-source']){const image=require('../data/v61-image-assets.json').images.find(i=>i.source===old.attribs.src);assert(old.name==='img'&&image,'Unregistered image presentation');for(const [key,value]of Object.entries({'data-v61-source':image.source,src:image.src,width:image.width,height:image.height,'data-v61-image':image.kind})){assert.equal(node.attribs[key],String(value),'Unreviewed image presentation '+key);allowed.add(key);}}
 if(Object.hasOwn(node.attribs,'data-v61-link')&&!Object.hasOwn(old.attribs,'aria-label')&&!Object.hasOwn(old.attribs,'aria-labelledby')){
  let card=node.parent;while(card&&!Object.hasOwn(card.attribs||{},'data-v61-card'))card=card.parent;const heading=card&&select.selectOne('h2,h3,h4',card.children),title=heading&&textContent(heading).trim(),label=textContent(node).trim();if(title&&!label.includes(title)){assert.equal(node.attribs['aria-label'],title+(label?' · '+label:''),'Unreviewed card accessible name');allowed.add('aria-label');}
 }
 const retained=attributes=>Object.fromEntries(Object.entries(attributes).filter(([key])=>!allowed.has(key)));assert.deepEqual(retained(node.attribs),retained(old.attribs),'Unowned presentation attributes changed');
}
function strip(html){
 let out=html.replace(/<!-- TS_V6_SYSTEM_BEGIN -->[\s\S]*?<!-- TS_V6_SYSTEM_END -->/g,'').replace(/(<html\b[^>]*?)\sdata-v6-system=""/i,'$1').replace(/(<html\b[^>]*?)\sdata-v6-page="[a-z-]+"/i,'$1');
 if(out.includes('data-v61-original=')){const d=parseDocument(out,{withStartIndices:true}),changes=[];for(const node of select.selectAll('[data-v61-original]',d)){const original=Buffer.from(node.attribs['data-v61-original'],'base64').toString('utf8');assert(new RegExp('^<'+node.name+'(?:\\s|/?>)','i').test(original)&&tagEnd(original,0)===original.length,'Invalid original presentation tag');validateTag(node,original);changes.push({start:node.startIndex,end:tagEnd(out,node.startIndex),text:original});}out=edits(out,changes);}return out;
}
function presentation(html,root=ROOT){
 const d=parseDocument(html,{withStartIndices:true}),changes=new Map(),escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const mark=(node,key,value='')=>{if(!changes.has(node))changes.set(node,{});changes.get(node)[key]=value;};
 const inside=(node,selector)=>{for(let n=node;n;n=n.parent)if(n.type==='tag'&&select.is(n,selector))return true;return false;};
 for(const [selector,primary]of cardRules)for(const card of select.selectAll('main '+selector,d)){
  if(inside(card,'[data-v5-home],[data-v61-ten]')||Object.hasOwn(card.attribs,'data-v61-card'))continue;
  const link=select.selectOne(primary,card.children),href=link?.attribs.href;if(!href||!href.startsWith('/')||href.startsWith('//')||Object.hasOwn(link.attribs,'download')||inside(link,'button,label,summary'))continue;
  mark(card,'data-v61-card');mark(link,'data-v61-link');
  const heading=select.selectOne('h2,h3,h4',card.children),title=heading&&textContent(heading).trim(),label=textContent(link).trim();if(title&&!link.attribs['aria-label']&&!link.attribs['aria-labelledby']&&!label.includes(title))mark(link,'aria-label',title+(label?' · '+label:''));
  for(let node=link.parent;node&&node!==card;node=node.parent)mark(node,'data-v61-link-path');
  for(const node of select.selectAll('a[href],button,input,select,textarea,label,details,summary,[role="button"],[contenteditable="true"]',card.children))if(node!==link&&!inside(node,'[data-v61-link]'))mark(node,'data-v61-control');
 }
 const file=path.join(root,'data/v61-image-assets.json'),images=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).images:[];
 const bySource=new Map(images.map(i=>[i.source,i]));
 for(const img of select.selectAll('main img[src]',d)){const item=bySource.get(img.attribs.src);if(!item||inside(img,'[data-v5-home],[data-v61-ten]'))continue;mark(img,'data-v61-source',img.attribs.src);mark(img,'src',item.src);mark(img,'width',item.width);mark(img,'height',item.height);mark(img,'data-v61-image',item.kind);}
 return edits(html,[...changes].map(([node,attributes])=>{const end=tagEnd(html,node.startIndex),original=html.slice(node.startIndex,end);let tag=original;for(const [key,value]of Object.entries(attributes)){const re=new RegExp('\\s'+key+'(?![\\w:-])(?:\\s*=\\s*(?:"[^"]*"|\x27[^\x27]*\x27|[^\\s>]+))?','i');tag=tag.replace(re,'');}const tail=/\/>$/.test(tag)?'/>':'>';tag=tag.slice(0,-tail.length)+Object.entries(attributes).map(([key,value])=>' '+key+'="'+escape(value)+'"').join('')+' data-v61-original="'+Buffer.from(original).toString('base64')+'"'+tail;return {start:node.startIndex,end,text:tag};}));
}
function pageKind(route,locale){
 const rel=route.replace(new RegExp('^/'+locale+'/'),'').replace(/index\.html$/,'');
 if(!rel)return 'home';
 if(rel==='heroes/')return 'hero-atlas';
 if(rel.startsWith('heroes/'))return 'hero-detail';
 if(rel==='database/pet-system/')return 'pet-atlas';
 if(rel.startsWith('database/pet-system/'))return 'pet-detail';
 if(rel.startsWith('tools/'))return 'tools';
 if(rel.startsWith('buildings/'))return rel==='buildings/'?'buildings':'building-detail';
 if(rel.startsWith('database/research/'))return 'research';
 if(rel.startsWith('database/'))return 'database';
 if(rel.startsWith('codes/'))return 'codes';
 if(rel.startsWith('top-up/'))return 'topup';
 return 'content';
}
function fontFaces(root=ROOT){
 const file=path.join(root,'data/v61-visual-system.json');if(!fs.existsSync(file))return '';
 const font=JSON.parse(fs.readFileSync(file,'utf8')).displayFont;if(!font?.enabled)return '';
 assert.equal(font.status,'authorized-local-files','Font registration requires authorized local files');assert.equal(font.family,'TilesSurvive Sword');assert(font.faces?.length,'Missing display font faces');
 if(font.delivery){assert.deepEqual(font.delivery,{mode:'unicode-range-subsets',manifest:'data/v61-font-subsets.json',stylesheet:'css/v61-fonts.css'},'Unreviewed font delivery');const delivery=require('./v61-font-delivery');assert.deepEqual(font.faces,[400,600].map(weight=>({path:delivery.SOURCES[weight].path,weight,format:'woff2'})),'Original font registration changed');return delivery.stylesheet(root);}
 return '<style data-v6-owned="system-assets">'+font.faces.map(face=>{assert(/^fonts\/[a-z0-9/_-]+\.woff2$/.test(face.path)&&!face.path.includes('..'),'Invalid local font path');assert([400,600].includes(face.weight)&&face.format==='woff2','Unverified display font face');const bytes=fs.readFileSync(path.join(root,face.path));assert.equal(bytes.subarray(0,4).toString(),'wOF2','Invalid WOFF2 font');return '@font-face{font-family:"TilesSurvive Sword";src:url("/'+face.path+'?v='+digest(bytes)+'") format("woff2");font-style:normal;font-weight:'+face.weight+';font-display:swap;}';}).join('')+'</style>';
}
function assets(root=ROOT){return fontFaces(root)+ASSETS.map(file=>{const url='/'+file+'?v='+digest(fs.readFileSync(path.join(root,file)));return file.endsWith('.css')?'<link data-v6-owned="system-assets" rel="stylesheet" href="'+url+'">':'<script data-v6-owned="system-assets" defer src="'+url+'"></script>';}).join('');}
function project(input,locale,route='/'+locale+'/',options={}){
 if(!locales.includes(locale))throw Error('Unsupported V6 locale: '+locale);
 const html=strip(input);
 if(!route.startsWith('/'+locale+'/')||!/<main\b/i.test(html)||!/<\/head>/i.test(html)||/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html))return html;
 const block='<!-- TS_V6_SYSTEM_BEGIN -->'+(options.assets||assets(options.root))+'<!-- TS_V6_SYSTEM_END -->';
 return presentation(html,options.root).replace(/<html\b/i,'<html data-v6-system="" data-v6-page="'+pageKind(route,locale)+'"').replace(/<\/head>/i,block+'</head>');
}
function validateOwnership(input,locale,route,options={}){
 if(!/TS_V6_SYSTEM|data-v6-(?:system|page|owned)/.test(input))return false;
 assert.equal(input.replaceAll('\r\n','\n'),project(input,locale,route,options).replaceAll('\r\n','\n'),'Unreviewed V6 presentation owner '+route);
 return true;
}
function walk(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.isFile()&&e.name==='index.html'?[path.join(dir,e.name)]:[]);}
function build({root=ROOT,apply=true}={}){
 const report={owner:'v6-system',locales:locales.length,pages:0,eligible:0,changed:0,applied:apply,counts:{},deployed:false},bundle=assets(root);
 for(const locale of locales){report.counts[locale]=0;for(const file of walk(path.join(root,locale))){
  const input=fs.readFileSync(file,'utf8'),route='/'+path.relative(root,file).replaceAll('\\','/').replace(/index\.html$/,''),output=project(input,locale,route,{assets:bundle});
  report.pages++;if(output.includes('data-v6-system=""')){report.eligible++;report.counts[locale]++;}
  if(input!==output){report.changed++;if(apply)fs.writeFileSync(file,output);}
 }}
 console.log(JSON.stringify(report));return report;
}
module.exports={ROOT,ASSETS,locales,digest,strip,pageKind,fontFaces,assets,presentation,project,validateOwnership,build,walk};
if(require.main===module)build({apply:!process.argv.includes('--check')});
