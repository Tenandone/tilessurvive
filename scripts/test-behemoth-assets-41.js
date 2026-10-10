'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{parseHTML}=require('linkedom');
const B=require('./build-behemoth-assets-41'),m=require('../data/foundation-40/behemoth-assets-41.json');
const root=path.resolve(__dirname,'..'),base='6cb65a7dfe0a45fe9ab4d91b07b97b4813399c0b',pages=B.langs.flatMap(l=>B.routes.map(r=>l+'/'+r));
const read=f=>fs.readFileSync(path.join(root,f)),lf=b=>b.toString().replaceAll('\r\n','\n'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=execFileSync('git',['ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.html')||/^(js|css|data|img)\//.test(f)||['sitemap.xml','robots.txt','CNAME'].includes(f));
const batch=execFileSync('git',['cat-file','--batch'],{cwd:root,input:files.map(f=>base+':'+f).join('\n')+'\n',maxBuffer:500e6}),original=new Map();let at=0;
for(const f of files){const end=batch.indexOf(10,at),header=batch.subarray(at,end).toString();assert.match(header,/^[a-f0-9]{40} blob \d+$/);const size=Number(header.split(' ')[2]);at=end+1;original.set(f,batch.subarray(at,at+size));at+=size+1;}assert.equal(at,batch.length);

test('five exact approved images with minimal metadata and lossless WebP encoding',()=>{
 B.validate(m);assert.deepEqual(m.assets.map(a=>a.entity),B.ids);
 assert.deepEqual(fs.readdirSync(path.join(root,'img/game-41/behemoths')).sort(),B.ids.map(id=>id+'.webp').sort());
 assert.equal(m.assets.reduce((sum,a)=>sum+a.bytes,0),485924);
 for(const a of m.assets){const bytes=read(a.src);assert.equal(sha(bytes),a.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(4)+8,bytes.length);assert.equal(bytes.toString('ascii',8,16),'WEBPVP8L');}
 assert(!/tscfg:|InternalId|sourcePath|C:\\|audit-results|serializedFile|pathIdDecimal/.test(JSON.stringify(m)));
});

test('twenty complete documents preserve every non-image byte and 55 existing image nodes',()=>{
 let changedImages=0;
 for(const f of pages){
  const before=lf(original.get(f)),after=lf(read(f));assert.notEqual(before,after);assert.equal(B.render(before,m),after);assert.equal(B.render(after,m),after);
  const old=parseHTML(before).document,current=parseHTML(after).document;
  const oldImages=[...old.querySelectorAll('img')],newImages=[...current.querySelectorAll('img')];assert.equal(newImages.length,oldImages.length);
  for(let i=0;i<oldImages.length;i++){
   const a=m.assets.find(a=>a.previousSrc===oldImages[i].getAttribute('src'));if(!a)continue;
   assert.equal(newImages[i].getAttribute('src'),a.src);assert.equal(newImages[i].getAttribute('width'),String(a.width));assert.equal(newImages[i].getAttribute('height'),String(a.height));
   newImages[i].replaceWith(oldImages[i].cloneNode(true));changedImages++;
  }
  let reversed=current.documentElement.outerHTML;
  for(const a of m.assets)reversed=reversed.split(a.src).join(a.previousSrc);
  assert.equal(reversed,old.documentElement.outerHTML,f+' quantities, names, alt text, scripts, forms, links, SEO, structure');
 }
 assert.equal(changedImages,55);
});

test('all existing unrelated pages, game data, scripts, styles, SEO and original images remain intact',()=>{
 for(const [f,b]of original){if(pages.includes(f))continue;if(f.startsWith('img/'))assert.equal(sha(read(f)),sha(b),f);else assert.equal(lf(read(f)),lf(b),f);}
 for(const a of m.assets)assert.equal(sha(read(a.previousSrc)),sha(original.get(a.previousSrc.slice(1))));
});

test('unknown entities, paths, dimensions, damaged hashes and private fields fail closed',()=>{
 for(const mutate of [x=>x.assets.pop(),x=>x.assets.push({...x.assets[0]}),x=>x.assets[0].entity='unknown',x=>x.assets[0].src='/img/../../private',x=>x.assets[0].previousSrc='/unknown.png',x=>x.assets[0].width=256,x=>x.assets[0].bytes++,x=>x.assets[0].sha256='0'.repeat(64),x=>x.assets[0].sourcePath='private',x=>x.private='no']){const bad=structuredClone(m);mutate(bad);assert.throws(()=>B.validate(bad));}
 const a=m.assets[0],probe=`<img data-src="/ignored.png" data-width="20" src="${a.previousSrc}" width="12" height="13" alt="kept">`;
 const out=B.render(probe,m);assert(out.includes('data-src="/ignored.png" data-width="20"'));assert(out.includes('width="512" height="512" alt="kept"'));assert.equal(B.render(out,m),out);
});
