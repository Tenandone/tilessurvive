'use strict';
// Deterministic build asset: preserve the official artwork, mirror X, invert RGB.
// No generated/repainted pixels; alpha is copied unchanged before resampling.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),sharp=require('sharp');
const ROOT=path.resolve(__dirname,'..');
const SOURCE='img/brand/tiles-survive-app-2.6.400.webp';
const OUTPUTS=[['favicon-96x96.png',96],['apple-touch-icon.png',180],['icons/icon-192.png',192],['icons/icon-512.png',512]];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function mirrorInvert(data,width,height){
 const out=Buffer.alloc(data.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const from=(y*width+width-1-x)*4,to=(y*width+x)*4;
  for(let c=0;c<3;c++)out[to+c]=255-data[from+c];
  out[to+3]=data[from+3];
 }
 return out;
}
function bounds(data,width,height){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 assert(right>=left&&bottom>=top,'Empty source icon');
 return {left,top,width:right-left+1,height:bottom-top+1};
}
function ico(entries){
 const header=Buffer.alloc(6+16*entries.length);header.writeUInt16LE(1,2);header.writeUInt16LE(entries.length,4);let offset=header.length;
 entries.forEach(({size,bytes},i)=>{const o=6+i*16;header[o]=size;header[o+1]=size;header.writeUInt16LE(1,o+4);header.writeUInt16LE(32,o+6);header.writeUInt32LE(bytes.length,o+8);header.writeUInt32LE(offset,o+12);offset+=bytes.length;});
 return Buffer.concat([header,...entries.map(e=>e.bytes)]);
}
async function prepare(){
 const input=fs.readFileSync(path.join(ROOT,SOURCE)),decoded=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width,height,channels}=decoded.info;assert.equal(channels,4);
 const transformed=mirrorInvert(decoded.data,width,height),crop=bounds(transformed,width,height);
 async function png(size){
  const inset=Math.max(1,Math.round(size*0.04)),inner=size-inset*2;
  const subject=await sharp(transformed,{raw:{width,height,channels:4}}).extract(crop).resize(inner,inner,{fit:'contain',background:'#00000000',kernel:'lanczos3'}).png().toBuffer();
  return sharp({create:{width:size,height:size,channels:4,background:'#00000000'}}).composite([{input:subject,left:inset,top:inset}]).png({compressionLevel:9,adaptiveFiltering:false}).toBuffer();
 }
 const entries=await Promise.all([16,32,48].map(async size=>({size,bytes:await png(size)})));
 const files=[{path:'favicon.ico',bytes:ico(entries),sizes:[16,32,48]}];
 for(const [file,size]of OUTPUTS)files.push({path:file,bytes:await png(size),width:size,height:size});
 const manifest={schemaVersion:1,source:{path:'/'+SOURCE,sha256:sha(input),width,height,package:'com.funplus.ts.global',appVersion:'2.6.400',versionCode:1546,apkEntry:'res/mipmap-xxxhdpi-v4/app_icon.webp',apkSha256:'f8b56ca5b55e3dbbaa966623ef384833784ed70017f03cbc99f214461749ef7a',capturedAt:'2026-11-05T09:24:27.579736Z'},transform:{horizontalMirror:true,colorInversion:'RGB: 255 - channel',alpha:'preserved before resampling',crop,marginRatio:0.04,resampling:'lanczos3',largerOutputs:'upscaled from the official 192px source; no invented detail'},generator:{sharp:sharp.versions.sharp},outputs:files.map(({path:file,bytes,...size})=>({path:'/'+file,...size,bytes:bytes.length,sha256:sha(bytes)}))};
 return {files,manifest,input,transformed,sourceInfo:{width,height,channels},png};
}
async function build(apply=false){
 const result=await prepare();let changed=0;
 for(const file of [...result.files,{path:'data/favicon-assets.json',bytes:Buffer.from(JSON.stringify(result.manifest,null,2)+'\n')}]){
  const dest=path.join(ROOT,file.path),same=fs.existsSync(dest)&&fs.readFileSync(dest).equals(file.bytes);
  if(!same){changed++;if(apply){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,file.bytes);}}
 }
 if(!apply)assert.equal(changed,0,'Favicon assets drifted; run node scripts/build-favicon-assets.js --apply');
 return {changed,source:result.manifest.source.sha256,outputs:result.manifest.outputs};
}
module.exports={ROOT,SOURCE,OUTPUTS,mirrorInvert,bounds,ico,prepare,build};
if(require.main===module)build(process.argv.includes('--apply')).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
