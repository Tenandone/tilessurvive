'use strict';
// A full build refreshes stale query strings for these two unchanged runtimes.
// Historical tests restore the old query only after verifying the entire asset.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const assets=[
  ['js/platform.js','ef55bbad3bfc','2d33a661dfe2c4e80c1fde3a111f0322108ef80888eb7501cb9821a8cf62ee95'],
  ['js/product-30.js','9ca4239511ed','5cfe8be3c13b02c325bbde4c13d71ffb2852813360878732b59aaa9e31835731']
];
function restore(document){
  for(const [file,previous,sha] of assets){
    const nodes=[...document.querySelectorAll('script[src]')].filter(n=>n.getAttribute('src')==='/'+file+'?v='+sha.slice(0,12));
    if(!nodes.length)continue;
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),sha,'Unchanged runtime required for cache-only allowance: '+file);
    nodes.forEach(n=>n.setAttribute('src','/'+file+'?v='+previous));
  }
  return document;
}
module.exports={restore,assets};
