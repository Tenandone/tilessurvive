'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),F=require('./build-favicon-assets');
test('horizontal reflection inverts only RGB and preserves alpha, including transparent pixels',()=>{
 const input=Buffer.from([10,20,30,0,100,150,200,127,0,255,64,255,5,15,25,8]);
 assert.deepEqual([...F.mirrorInvert(input,2,2)],[155,105,55,127,245,235,225,0,250,240,230,8,255,0,191,255]);
 assert.deepEqual(F.mirrorInvert(F.mirrorInvert(input,2,2),2,2),input);
});
test('official source pixel identity, alpha, and normalized outputs are reproducible',async()=>{
 const result=await F.prepare(),original=await sharp(result.input).ensureAlpha().raw().toBuffer(),{width,height}=result.sourceInfo;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const a=(y*width+x)*4,b=(y*width+width-1-x)*4;
  for(let c=0;c<3;c++)assert.equal(result.transformed[a+c],255-original[b+c]);
  assert.equal(result.transformed[a+3],original[b+3]);
 }
 for(const file of result.files){assert.deepEqual(fs.readFileSync(path.join(F.ROOT,file.path)),file.bytes);if(file.width){const m=await sharp(file.bytes).metadata();assert.equal(m.width,file.width);assert.equal(m.height,file.height);assert(m.hasAlpha);}}
 await F.build(false);
});
test('ICO contains real PNG images for all required small sizes',async()=>{
 const bytes=fs.readFileSync(path.join(F.ROOT,'favicon.ico'));assert.equal(bytes.readUInt16LE(0),0);assert.equal(bytes.readUInt16LE(2),1);assert.equal(bytes.readUInt16LE(4),3);
 for(let i=0;i<3;i++){const o=6+i*16,size=[16,32,48][i],length=bytes.readUInt32LE(o+8),offset=bytes.readUInt32LE(o+12);assert.equal(bytes[o],size);assert.equal(bytes[o+1],size);assert(offset+length<=bytes.length);const m=await sharp(bytes.subarray(offset,offset+length)).metadata();assert.equal(m.format,'png');assert.equal(m.width,size);assert.equal(m.height,size);}
});
