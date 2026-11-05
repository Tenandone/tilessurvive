'use strict';
const copy=require('./sync-ten-benefits-copy').project(require('../data/v3-affiliate-copy.json'));
const policy=require('../data/ten-benefits-policy.json');
const registry=require('../data/i18n/locales.json');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields=['couponTitle','couponText','drawTitle','drawText','flow1','flow2','flow3','flow4','eligibility','variation','historyTitle','historyMonth','historyIntro','packageLabel','recipientsLabel','historyTotal','historyCaveat','bookmarkTitle','bookmarkText','bookmarkButton','bookmarkHint','bookmarkCta'];
function get(locale){
  const c=copy.locales[locale],definition=registry.locales.find(l=>l.code===locale);
  if(!c||!definition)throw Error('Missing TEN benefit locale '+locale);
  const values={};for(const key of fields){const value=c['ten'+key[0].toUpperCase()+key.slice(1)];if(typeof value!=='string'||!value.trim())throw Error('Missing TEN benefit copy '+locale+': '+key);values[key]=value;}
  return {c,definition,values};
}
function link(locale,extra=''){
  const {values}=get(locale);
  return `<a class="v3-link-button ten-link" href="${esc(policy.tenUrl)}" data-v3-cta="outbound" data-v3-placement="guide" data-v3-feature="topup" target="_blank" rel="sponsored noopener noreferrer"${extra}>${esc(values.bookmarkCta)}</a>`;
}
function validatePolicy(){
  if(policy.tenUrl!=='https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive'||policy.frequency!=='monthly'||policy.applicationRequired!==false||policy.freePackages.selection!=='draw'||policy.freePackages.guaranteedForEveryParticipant!==false)throw Error('TEN policy requires an explicit review');
  if(policy.schemaVersion!==2||policy.coupons.recipientRule!=='all-ten-top-up-members'||policy.coupons.includesOneTimeTopUpMembers!==true||policy.coupons.issuancePercent!==100||policy.coupons.issuanceGuaranteed!==true||policy.coupons.lifetimeIssuanceAfterOneTopUp!==false||policy.coupons.discountPercent!==null||policy.coupons.delivery!=='lootbar-coupon-bag'||policy.freePackages.entryBasis!=='monthly-cumulative-ten-top-up-records'||policy.freePackages.delivery!=='lootbar-coupon-bag'||policy.additionalCoupon.code!=='#s4qU'||policy.additionalCoupon.oneTime!==true||policy.additionalCoupon.newMembersOnly!==false||policy.additionalCoupon.redemptionSurface!=='lootbar-search-box')throw Error('TEN V6.1 member policy requires review');
  for(const h of policy.history){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(h.month)||h.currency!=='USD'||h.status!=='paid'||h.futureCompositionGuaranteed!==false||h.packages.some(p=>!Number.isSafeInteger(p.faceValueCents)||p.faceValueCents<=0||!Number.isSafeInteger(p.recipients)||p.recipients<1)||h.packages.reduce((n,p)=>n+p.recipients,0)!==h.totalRecipients)throw Error('Invalid TEN payout record');}
}
function renderBenefits(locale){
  validatePolicy();return require('./v61-ten-content').renderProgram(locale,{placement:'guide'});
}
// Only the legacy bookmark box and its existing same-page contents link change.
// Existing article anchors and the delegated bookmark button listener survive.
function projectBookmark(document,locale){
  const {values:v}=get(locale),button=document.querySelector('[data-bookmark-cta]');
  if(!button)throw Error('Missing legacy bookmark button '+locale);
  const section=button.closest('section'),heading=section?.querySelector('h2');
  if(!section||!heading?.id)throw Error('Missing legacy bookmark owner '+locale);
  const changes=[],before=section.outerHTML,id=heading.id;
  section.id='ten-bookmark';section.setAttribute('data-v3-owned','topup-bookmark');
  section.innerHTML=require('./v61-ten-content').renderBookmark(locale,'guide',{headingId:id,headingLevel:2});
  if(before!==section.outerHTML)changes.push({before,after:section.outerHTML,reason:'TEN destination bookmark instructions, not a promise of automatic bookmarking or eligibility'});
  for(const anchor of document.querySelectorAll('a[href]')){
    let url;try{url=new URL(anchor.getAttribute('href'),'https://tilessurvive.net/'+locale+'/top-up/');}catch(_){continue;}
    if(url.origin!=='https://tilessurvive.net'||url.pathname!=='/'+locale+'/top-up/'||url.hash!=='#'+id)continue;
    const old=anchor.outerHTML;anchor.textContent=v.bookmarkTitle;anchor.setAttribute('data-v3-owned','topup-bookmark-link');
    if(old!==anchor.outerHTML)changes.push({before:old,after:anchor.outerHTML,reason:'Retain the existing article anchor with its updated bookmark heading'});
  }
  return changes;
}
function projectLegacyBenefitCopy(document,locale){
  const {c,values:v}=get(locale),faq=document.querySelector('.topup-faq > details'),disclosure=document.querySelector('p.topup-disclosure');
  if(!faq||!disclosure)throw Error('Missing legacy TEN policy surfaces '+locale);
  const changes=[],beforeFaq=faq.outerHTML;
  faq.setAttribute('data-v3-owned','topup-bookmark-faq');faq.innerHTML=`<summary>${esc(v.bookmarkTitle)}</summary><p>${esc(v.bookmarkText)}</p><p>${esc(v.eligibility)}</p>`;
  if(beforeFaq!==faq.outerHTML)changes.push({before:beforeFaq,after:faq.outerHTML,reason:'Bookmark the TEN destination; bookmarking alone is not eligibility'});
  const beforeDisclosure=disclosure.outerHTML,policyLink=disclosure.querySelector('a');
  if(!policyLink||policyLink.getAttribute('href')!==`/${locale}/affiliate-disclosure/`)throw Error('Unexpected affiliate disclosure destination '+locale);
  const retainedLink=policyLink.cloneNode(true);disclosure.textContent=c.disclosure+' ';disclosure.appendChild(retainedLink);disclosure.setAttribute('data-v3-owned','topup-policy-disclosure');
  if(beforeDisclosure!==disclosure.outerHTML)changes.push({before:beforeDisclosure,after:disclosure.outerHTML,reason:'Retain commission disclosure without conflating operator benefits and provider rewards'});
  return changes;
}
function summary(locale){const c=require('./v61-ten-content').get(locale);return c.couponText+' '+c.drawText;}
function projectMetadata(document,locale){
  const description=summary(locale),changes=[];
  for(const node of document.querySelectorAll('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]')){const before=node.outerHTML;node.setAttribute('content',description);if(before!==node.outerHTML)changes.push({before,after:node.outerHTML,reason:'Shared TEN policy summary'});}
  for(const node of document.querySelectorAll('script[type="application/ld+json"]')){let data;try{data=JSON.parse(node.textContent);}catch(_){continue;}if(data['@type']!=='WebPage'||data.url!=='https://tilessurvive.net/'+locale+'/top-up/')continue;const before=node.outerHTML;data.description=description;node.textContent=JSON.stringify(data);if(before!==node.outerHTML)changes.push({before,after:node.outerHTML,reason:'Shared TEN policy structured description'});}
  return changes;
}
module.exports={get,fields,link,validatePolicy,renderBenefits,projectBookmark,projectLegacyBenefitCopy,summary,projectMetadata};
