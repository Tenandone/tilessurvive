'use strict';
const copy=require('../data/v3-affiliate-copy.json');
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
  for(const h of policy.history){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(h.month)||h.currency!=='USD'||h.status!=='paid'||h.futureCompositionGuaranteed!==false||h.packages.some(p=>!Number.isSafeInteger(p.faceValueCents)||p.faceValueCents<=0||!Number.isSafeInteger(p.recipients)||p.recipients<1)||h.packages.reduce((n,p)=>n+p.recipients,0)!==h.totalRecipients)throw Error('Invalid TEN payout record');}
}
function renderBenefits(locale){
  validatePolicy();const {c,definition,values:v}=get(locale),language=definition.numberLocale;
  const number=new Intl.NumberFormat(language),money=new Intl.NumberFormat(language,{style:'currency',currency:'USD',currencyDisplay:'code',minimumFractionDigits:2,maximumFractionDigits:2});
  const history=policy.history.map(h=>{
    const month=new Intl.DateTimeFormat(language,{year:'numeric',month:'long',timeZone:'UTC',calendar:'gregory'}).format(new Date(h.month+'-01T00:00:00Z'));
    const period=v.historyMonth.replace('{month}',month),total=v.historyTotal.replace('{count}',number.format(h.totalRecipients));
    const rows=h.packages.map(p=>`<tr><td><data value="${p.faceValueCents}" data-ten-package-cents>${esc(money.format(p.faceValueCents/100))}</data></td><td><data value="${p.recipients}" data-ten-recipients>${number.format(p.recipients)}</data></td></tr>`).join('');
    return `<details class="ten-payouts" data-ten-history="${h.month}" data-payout-status="${h.status}"><summary>${esc(v.historyTitle)} · <time datetime="${h.month}">${esc(period)}</time> · <span data-ten-total="${h.totalRecipients}">${esc(total)}</span></summary><p>${esc(v.historyIntro)}</p><div class="ten-payout-table"><table><caption>${esc(period)}</caption><thead><tr><th scope="col">${esc(v.packageLabel)} (USD)</th><th scope="col">${esc(v.recipientsLabel)}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="ten-conditions">${esc(v.historyCaveat)}</p></details>`;
  }).join('');
  return `<details class="v3-topup-question ten-benefits" data-ten-benefits="${policy.policyId}" open><summary>${esc(c.faq[7][0])}</summary><ol class="ten-benefit-flow">${[v.flow1,v.flow2,v.flow3,v.flow4].map(s=>'<li>'+esc(s)+'</li>').join('')}</ol><div class="ten-benefit-grid"><article><h3>${esc(v.couponTitle)}</h3><p>${esc(v.couponText)}</p></article><article><h3>${esc(v.drawTitle)}</h3><p>${esc(v.drawText)}</p></article></div><p class="ten-conditions">${esc(v.eligibility)}</p><p class="ten-conditions">${esc(v.variation)}</p>${history}<div class="ten-benefit-actions">${link(locale)}<a class="ten-bookmark-jump" href="/${locale}/top-up/#ten-bookmark">${esc(v.bookmarkButton)}</a></div><p class="ten-disclosure">${esc(c.disclosure)}</p></details>`;
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
  section.innerHTML=`<div class="bookmark-box"><h2 id="${esc(id)}">${esc(v.bookmarkTitle)}</h2><p>${esc(v.bookmarkText)}</p><div class="ten-bookmark-actions">${link(locale,' data-ten-bookmark-destination')}<button class="btn" type="button" data-bookmark-cta="" data-affiliate-placement="topup_bookmark">${esc(v.bookmarkButton)}</button></div><p class="bookmark-hint" data-bookmark-hint="" hidden>${esc(v.bookmarkHint)}</p></div>`;
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
module.exports={get,fields,link,validatePolicy,renderBenefits,projectBookmark,projectLegacyBenefitCopy};
