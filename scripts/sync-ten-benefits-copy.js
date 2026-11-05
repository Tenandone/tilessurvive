'use strict';
// Keep the historical affiliate-owner interface derived from the shared TEN
// copy. Provider, privacy, commission and unrelated FAQ fields stay unchanged.
const fs=require('node:fs'),path=require('node:path'),copy=require('../data/ten-benefits-copy.json');
const ROOT=path.resolve(__dirname,'..');
function project(input){const out=structuredClone(input);for(const [locale,c]of Object.entries(copy.locales)){
 const target=out.locales[locale];if(!target)throw Error('Missing affiliate locale '+locale);
 const fields={couponTitle:c.couponTitle,couponText:c.couponText,drawTitle:c.drawTitle,drawText:c.drawText,flow1:c.steps[0].title,flow2:c.steps[1].title,flow3:c.steps[2].title,flow4:c.steps[3].title,eligibility:c.deliveryText,variation:c.issuanceNote,bookmarkTitle:c.bookmarkTitle,bookmarkText:c.bookmarkText,bookmarkButton:c.bookmarkButton,bookmarkHint:c.bookmarkHint,bookmarkCta:c.cta};
 for(const [key,value]of Object.entries(fields))target['ten'+key[0].toUpperCase()+key.slice(1)]=value;
 target.faq[7]=[c.benefitTitle,[c.couponText,c.drawText,c.deliveryText].join(' ')];
 }return out;}
function build(){const file=path.join(ROOT,'data/v3-affiliate-copy.json'),before=fs.readFileSync(file,'utf8'),after=JSON.stringify(project(JSON.parse(before)),null,2)+'\n';if(before!==after)fs.writeFileSync(file,after);return {locales:Object.keys(copy.locales).length,changed:before!==after};}
module.exports={project,build};if(require.main===module)console.log(JSON.stringify(build()));
