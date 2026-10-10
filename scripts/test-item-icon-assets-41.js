'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{parseHTML}=require('linkedom'),{imageSize}=require('image-size');
const {validateItemIcons}=require('./lib/item-icon-assets-41'),manifest=require('../data/foundation-40/item-icons-41.json');
const root=path.resolve(__dirname,'..'),baseline='5ef9bf80356e3936e1cf43c120993fc7b0c1280a',langs=['ko','en','ja','ru','zh-tw'];
const expected=['reforge-hammer','advanced-recruitment-token','stamina-10','arena-ticket','normal-recruitment-coin','wood-100k','epic-hero-fragment','hero-exp-10k'];
const pages=langs.map(lang=>`${lang}/database/items/index.html`),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=file=>fs.readFileSync(path.join(root,file)),lf=b=>b.toString('utf8').replaceAll('\r\n','\n'),doc=b=>parseHTML(b.toString('utf8')).document;
const attrs=n=>Object.fromEntries([...n.attributes].map(a=>[a.name,a.value]));
const originalFiles=execFileSync('git',['ls-tree','-r','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(f=>f.endsWith('.html')||f.startsWith('js/')||f.startsWith('css/')||f.startsWith('data/')||f==='sitemap.xml'||f==='robots.txt');
const batch=execFileSync('git',['cat-file','--batch'],{cwd:root,input:originalFiles.map(f=>baseline+':'+f).join('\n')+'\n',maxBuffer:200e6}),original=new Map();
let at=0;
for(const file of originalFiles){const end=batch.indexOf(10,at),header=batch.subarray(at,end).toString();assert.match(header,/^[a-f0-9]{40} blob \d+$/);const size=Number(header.split(' ')[2]);at=end+1;original.set(file,batch.subarray(at,at+size));at+=size+1;}
assert.equal(at,batch.length);

test('only eight reviewed, lossless item icons are shipped with minimal public metadata',()=>{
 assert.equal(sha(lf(read('data/foundation-40/item-icons-41.json'))),'0b4129ea5bb68127ccb21a753843227efb95e54ed66b265644a183f23ff73808');
 assert.deepEqual([...validateItemIcons(manifest).keys()],expected);
 assert.deepEqual(fs.readdirSync(path.join(root,'img/game-41/items')).sort(),expected.map(id=>id+'.webp').sort());
 let bytes=0;
 for(const asset of manifest.assets){
  const data=read(asset.src),size=imageSize(data);bytes+=data.length;
  assert.equal(sha(data),asset.sha256);assert.equal(data.length,asset.bytes);
  assert.equal(size.type,'webp');assert.equal(size.width,asset.width);assert.equal(size.height,asset.height);
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.readUInt32LE(4)+8,data.length);assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.equal(data.toString('ascii',12,16),'VP8L','Lossless payload');
 }
 assert.equal(bytes,129430);
 assert(!/tscfg:|InternalId|sourcePath|sourceRecord|C:\\|audit-results|serializedFile|pathIdDecimal|ImageCentral/.test(JSON.stringify(manifest)));
});

test('five full documents differ only by forty decorative images beside unchanged item names',()=>{
 let inserted=0;
 for(const file of pages){
  const before=doc(original.get(file)),after=doc(require('./build-item-chest-rewards-41').strip(read(file).toString(),file.split('/')[0]));
  for(const asset of manifest.assets){
   const prior=before.getElementById(asset.entity),item=after.getElementById(asset.entity);
   assert(prior&&item);assert.equal(prior.querySelectorAll('img').length,0);
   const images=item.querySelectorAll('img');assert.equal(images.length,1);const image=images[0];
   assert.equal(image.parentElement.className,'ts40-item-label');assert.equal(image.parentElement.parentElement.tagName,'SUMMARY');
   assert.deepEqual(attrs(image),{class:'ts40-item-icon',src:asset.src,width:String(asset.width),height:String(asset.height),alt:'','aria-hidden':'true',loading:'lazy',decoding:'async'});
   assert.equal(item.querySelector('summary').textContent,prior.querySelector('summary').textContent);
   assert.equal(image.nextElementSibling.tagName,'SPAN');assert(image.nextElementSibling.textContent.trim());
   image.remove();inserted++;
  }
  assert.equal(after.documentElement.outerHTML,before.documentElement.outerHTML,file+' exact remaining DOM: text, quantities, conditions, SEO, links, forms and existing images');
  for(const id of ['pet-eggs','speedup-20h'])assert.equal(after.getElementById(id).querySelectorAll('img').length,0,'Unbound or broad item stays image-free');
 }
 assert.equal(inserted,40);
});

test('all other HTML, data, search, client scripts, styles and SEO files remain unchanged',()=>{
 for(const [file,bytes]of original){if(pages.includes(file))continue;if(file==='data/search-index.json'){require('./lib/item-chest-regression-41').assertSearchExtension(bytes,read(file));continue;}const beast=require('./build-behemoth-assets-41'),art=require('../data/foundation-40/behemoth-assets-41.json');let expected=beast.langs.some(l=>beast.routes.some(r=>file===l+'/'+r))?beast.render(lf(bytes),art):lf(bytes);const heroRules=require('./build-arms-race-hero-rules-41');if(heroRules.langs.some(l=>file===`${l}/events/arms-race/index.html`))expected=heroRules.apply(expected,file.split('/')[0]);assert.equal(lf(read(file)),expected,file);}
 const oldImages=require('../data/foundation-40/image-assets.json').assets.filter(a=>a.kind==='item');assert.equal(oldImages.length,8);
 for(const a of oldImages){const before=execFileSync('git',['show',baseline+':'+a.src.slice(1)],{cwd:root});assert.deepEqual(read(a.src),before,a.src);}
});

test('the actual build gate rejects wrong identities, private metadata and damaged integrity claims',()=>{
 const mutations=[
  m=>m.assets.pop(),
  m=>m.assets.push({...m.assets[0]}),
  m=>m.assets[0].entity='pet-eggs',
  m=>m.assets[0].id='item:another-item',
  m=>m.assets[0].src='/img/game-41/items/../../private.webp',
  m=>m.assets[0].src=m.assets[1].src,
  m=>m.assets[0].width=256,
  m=>m.assets[0].height=64,
  m=>m.assets[0].bytes++,
  m=>m.assets[0].sha256='0'.repeat(64),
  m=>m.assets[0].InternalId=1,
  m=>m.sourcePath='private'
 ];
 for(const mutate of mutations){const bad=structuredClone(manifest);mutate(bad);assert.throws(()=>validateItemIcons(bad));}
 assert.equal(validateItemIcons(manifest).size,8,'Unmodified reviewed data remains accepted');
});
