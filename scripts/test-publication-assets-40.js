'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {imageSize}=require('image-size'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),manifest=require('../data/foundation-40/image-assets.json');
const langs=['ko','en','ja','ru','zh-tw'];
const expectedIds=[
  ...['undine','lagnar','dave'].map(id=>'hero:'+id),'gear:undine',
  ...['undine-1','undine-2','undine-3','lagnar-1','lagnar-2','lagnar-3','lagnar-4','dave-1','dave-2','dave-3','dave-4'].map(id=>'skill:'+id),
  ...['snowball','dodo','buckler','hardhead','shadow','starhorn','fluffy'].map(id=>'pet:'+id),
  ...['hero-skill-book','arms-medal','food-10k','wood-10k','metal-10k','speedup-5m','food-100k','undine-gear-fragment'].map(id=>'item:'+id)
].sort();
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const target=path.join(dir,entry.name);assert(!entry.isSymbolicLink(),'Unexpected symlink '+target);return entry.isDirectory()?files(target):[target];});}
test('the publication manifest contains only thirty approved image identities and safe public metadata',()=>{
  assert.deepEqual(Object.keys(manifest).sort(),['assets','version']);assert.equal(manifest.version,1);
  assert.deepEqual(manifest.assets.map(asset=>asset.id).sort(),expectedIds);
  assert.equal(new Set(manifest.assets.map(asset=>asset.src)).size,30);
  for(const asset of manifest.assets){
    assert.deepEqual(Object.keys(asset).sort(),['bytes','entity','height','id','kind','sha256','src','version','width']);
    assert.match(asset.src,/^\/img\/game-40\/(?:heroes|gear|skills|pets|items)\/[a-z0-9-]+\.webp$/);
    assert.equal(asset.version,'2.6.200');assert.match(asset.sha256,/^[a-f0-9]{64}$/);
    for(const key of ['width','height','bytes'])assert(Number.isSafeInteger(asset[key])&&asset[key]>0);
  }
});
test('every shipped image matches a manifest hash and actual WebP dimensions with no extra payloads',()=>{
  const actual=files(path.join(root,'img/game-40')).map(file=>'/'+path.relative(root,file).replaceAll('\\','/')).sort();
  assert.deepEqual(actual,manifest.assets.map(asset=>asset.src).sort());
  for(const asset of manifest.assets){const bytes=fs.readFileSync(path.join(root,asset.src)),size=imageSize(bytes);assert.equal(bytes.length,asset.bytes,asset.id);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.id);assert.equal(size.type,'webp',asset.id);assert.equal(size.width,asset.width,asset.id);assert.equal(size.height,asset.height,asset.id);}
});
test('all thirty images have actual localized HTML consumers and no dangling game-40 image references',()=>{
  const index=new Map(manifest.assets.map(asset=>[asset.src,asset]));
  for(const lang of langs){
    const consumed=new Set();
    for(const file of files(path.join(root,lang)).filter(file=>file.endsWith('.html'))){
      const html=fs.readFileSync(file,'utf8');if(!html.includes('/img/game-40/'))continue;
      const doc=parseHTML(html).document;
      for(const img of doc.querySelectorAll('img[src^="/img/game-40/"]')){
        const src=img.getAttribute('src'),asset=index.get(src);assert(asset,lang+' unmanifested image '+src);consumed.add(src);
        const width=Number(img.getAttribute('width')),height=Number(img.getAttribute('height'));
        assert(Number.isSafeInteger(width)&&width>0,file+' missing reserved width');assert(Number.isSafeInteger(height)&&height>0,file+' missing reserved height');
        const sameRatio=Math.abs(width/height-asset.width/asset.height)<0.005,contain=/object-fit\s*:\s*contain/.test(img.getAttribute('style')||'');
        assert(sameRatio||contain,file+' changed image ratio without contain');assert(img.hasAttribute('alt'),file+' missing alt');
      }
    }
    assert.deepEqual([...consumed].sort(),[...index.keys()].sort(),lang+' unused public image');
  }
});
