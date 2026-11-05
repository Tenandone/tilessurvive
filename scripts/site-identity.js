'use strict';
// Small static head owner. Does not install tracking, a manifest or a worker.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const ROOT=path.resolve(__dirname,'..'),BEGIN='<!-- TS_SITE_IDENTITY_BEGIN -->',END='<!-- TS_SITE_IDENTITY_END -->';
const PATHS=['/favicon.ico','/favicon-96x96.png','/apple-touch-icon.png','/icons/icon-192.png','/icons/icon-512.png'];
const EXCLUDED=new Set(['.git','node_modules','scripts','test-results','delivery']);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function config(root=ROOT){
 const c=JSON.parse(fs.readFileSync(path.join(root,'data/site-identity.json'),'utf8'));
 assert.equal(c.schemaVersion,1);assert.deepEqual(c.icons.map(x=>x.path),PATHS,'Only reviewed stable icon paths');
 assert.deepEqual(c.icons.map(x=>x.type),['image/x-icon','image/png','image/png','image/png','image/png']);
 assert.deepEqual(c.icons.map(x=>[x.rel,x.sizes]),[['icon','16x16 32x32 48x48'],['icon','96x96'],['apple-touch-icon','180x180'],['icon','192x192'],['icon','512x512']]);
 for(const x of c.icons)assert(Object.keys(x).every(k=>['path','rel','type','sizes'].includes(k)),'Unknown icon field');
 assert(Array.isArray(c.verification.files)&&Array.isArray(c.verification.meta));
 for(const x of c.verification.files)assert(/^(?:google[a-z0-9]+|naver[a-z0-9]+)\.html$/.test(x.path)&&/^[a-f0-9]{64}$/.test(x.sha256),'Unreviewed verification file');
 assert.equal(new Set(c.verification.files.map(x=>x.path)).size,c.verification.files.length);
 for(const x of c.verification.meta)assert(x.name==='google-site-verification'&&/^[A-Za-z0-9_-]{10,}$/.test(x.content),'Verification value must come from the existing Google property');
 return c;
}
function render(root=ROOT){const c=config(root);return BEGIN+c.icons.map(x=>'<link data-site-identity="icon" rel="'+x.rel+'" href="'+x.path+'"'+(x.type?' type="'+x.type+'"':'')+' sizes="'+x.sizes+'">').join('')+c.verification.meta.map(x=>'<meta data-site-identity="verification" name="'+x.name+'" content="'+x.content+'">').join('')+END;}
function strip(input){
 const starts=input.split(BEGIN).length-1,ends=input.split(END).length-1;assert.equal(starts,ends,'Incomplete site identity block');assert(starts<=1,'Duplicate site identity blocks');
 const output=input.replace(/<!-- TS_SITE_IDENTITY_BEGIN -->[\s\S]*?<!-- TS_SITE_IDENTITY_END -->/g,'');
 assert(!/\bdata-site-identity\s*=/.test(output),'Site identity node outside owner block');return output;
}
function isDocument(html){return /<html\b/i.test(html)&&/<head\b[^>]*>[\s\S]*?<\/head\s*>/i.test(html);}
function project(input,{root=ROOT}={}){
 if(!isDocument(input))return input;
 const c=config(root);let html=strip(input);
 html=html.replace(/<head\b([^>]*)>([\s\S]*?)<\/head\s*>/i,(all,attrs,body)=>{
  const clean=body.replace(/<link\b[^>]*>/gi,tag=>{const node=parseHTML(tag).document.querySelector('link'),rel=(node?.getAttribute('rel')||'').toLowerCase().split(/\s+/);return rel.some(x=>['icon','apple-touch-icon','apple-touch-icon-precomposed','mask-icon'].includes(x))?'':tag;}).replace(/<meta\b[^>]*>/gi,tag=>{const node=parseHTML(tag).document.querySelector('meta');return c.verification.meta.some(x=>node?.getAttribute('name')===x.name&&node?.getAttribute('content')===x.content)?'':tag;});
  // Keep the encoding declaration at its original early byte position. This
  // placement also stays stable when V6 replaces its end-of-head assets.
  const charset=/<meta\b[^>]*charset[^>]*>/i.exec(clean);
  const at=charset?charset.index+charset[0].length:0;
  return '<head'+attrs+'>'+clean.slice(0,at)+render(root)+clean.slice(at)+'</head>';
 });
 return html;
}
function validateOwnership(html,{root=ROOT,required=false}={}){
 if(!isDocument(html))return false;
 strip(html);
 if(!html.includes(BEGIN)){assert(!required,'Missing site identity head owner');return false;}
 assert.equal(html,project(html,{root}),'Unreviewed site identity head owner');
 const d=parseHTML(html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i)[0]).document;
 for(const x of config(root).verification.meta)assert([...d.querySelectorAll('meta[name="google-site-verification"]')].some(n=>n.getAttribute('content')===x.content),'Missing approved Google ownership meta');
 return true;
}
function standaloneFiles(root=ROOT){
 const files=[];function walk(dir,relative=''){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.isDirectory()){if(!EXCLUDED.has(item.name))walk(path.join(dir,item.name),path.posix.join(relative,item.name));}else if(item.isFile()&&item.name.endsWith('.html')){const file=path.posix.join(relative,item.name);if(isDocument(fs.readFileSync(path.join(root,file),'utf8')))files.push(file);}}}walk(root);return files.sort();
}
function protectedFiles(root=ROOT){return [...config(root).icons.map(x=>x.path.slice(1)),'img/brand/tiles-survive-app-2.6.400.webp',...config(root).verification.files.map(x=>x.path)];}
function validateAssets(root=ROOT){
 const c=config(root),manifest=JSON.parse(fs.readFileSync(path.join(root,'data/favicon-assets.json'),'utf8'));assert(Array.isArray(manifest.outputs),'Missing source-bound favicon outputs');
 assert.equal(manifest.source?.path,'/img/brand/tiles-survive-app-2.6.400.webp','Unreviewed favicon original');assert.equal(sha(fs.readFileSync(path.join(root,manifest.source.path.slice(1)))),manifest.source.sha256,'Original app icon source binding');
 assert.deepEqual(manifest.outputs.map(x=>x.path).sort(),PATHS.slice().sort(),'Favicon output set');
 for(const icon of c.icons){const data=fs.readFileSync(path.join(root,icon.path.slice(1))),entry=manifest.outputs.find(x=>x.path===icon.path);assert.equal(sha(data),entry.sha256,'Favicon source binding '+icon.path);
  if(icon.path.endsWith('.png')){assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');const size=Number(icon.sizes.split('x')[0]);assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);}
  else{assert.equal(data.readUInt16LE(0),0);assert.equal(data.readUInt16LE(2),1);const count=data.readUInt16LE(4);assert.equal(count,3);const sizes=[];for(let i=0;i<count;i++){const p=6+i*16,w=data[p]||256,h=data[p+1]||256,len=data.readUInt32LE(p+8),offset=data.readUInt32LE(p+12);assert.equal(w,h);assert(offset>=6+16*count&&len>0&&offset+len<=data.length,'ICO image bounds');sizes.push(w);}assert.deepEqual(sizes.sort((a,b)=>a-b),[16,32,48]);}
 }
 for(const x of c.verification.files)assert.equal(sha(fs.readFileSync(path.join(root,x.path))),x.sha256,'Ownership verification file changed: '+x.path);
 return {icons:c.icons.length,verificationFiles:c.verification.files.length,googleMeta:c.verification.meta.length};
}
function validate(root=ROOT,{required=true}={}){const assets=validateAssets(root),files=standaloneFiles(root);for(const file of files)validateOwnership(fs.readFileSync(path.join(root,file),'utf8'),{root,required});return {pages:files.length,...assets};}
module.exports={ROOT,BEGIN,END,PATHS,config,render,strip,isDocument,project,validateOwnership,standaloneFiles,protectedFiles,validateAssets,validate};
