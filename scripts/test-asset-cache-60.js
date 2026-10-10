'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const A=require('./asset-cache-test-allowances');
test('historical cache allowance accepts only the two content-verified runtime URLs',()=>{
  for(const [file,previous,sha] of A.assets){
    const good=parseHTML(`<script src="/${file}?v=${sha.slice(0,12)}"></script>`).document;
    A.restore(good);assert.equal(good.querySelector('script').getAttribute('src'),'/'+file+'?v='+previous);
    for(const url of ['/'+file+'?v=wrong','https://example.com/'+file+'?v='+sha.slice(0,12),'/js/unapproved.js?v='+sha.slice(0,12)]){
      const other=parseHTML(`<script src="${url}"></script>`).document;
      A.restore(other);assert.equal(other.querySelector('script').getAttribute('src'),url,'An unapproved URL must remain visible to strict historical tests');
    }
  }
});
