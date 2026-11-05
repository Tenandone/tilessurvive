'use strict';
// Shared release-test contract for the operator-authorized V6.1 policy change.
// The old payout record, exact TEN URL and unrelated affiliate fields stay fixed.
const assert=require('node:assert/strict'),Sync=require('./sync-ten-benefits-copy'),copy=require('../data/ten-benefits-copy.json');
function assertPolicyTransition(prior,current){
 const expected=structuredClone(prior);Object.assign(expected,{schemaVersion:2,confirmedOn:'2026-11-05',eligibility:'All members who have topped up through the TEN link published on TilesSurvive.net, including members who topped up only once',coupons:{recipientRule:'all-ten-top-up-members',includesOneTimeTopUpMembers:true,issuancePercent:100,issuanceGuaranteed:true,lifetimeIssuanceAfterOneTopUp:false,discountPercent:null,minimumTopUpAmount:null,delivery:'lootbar-coupon-bag'},freePackages:{selection:'draw',automaticEligibleEntry:true,entryBasis:'monthly-cumulative-ten-top-up-records',guaranteedForEveryParticipant:false,delivery:'lootbar-coupon-bag'},additionalCoupon:{code:'#s4qU',oneTime:true,newMembersOnly:false,existingMembersCanSignIn:true,redemptionSurface:'lootbar-search-box',authority:'operator-confirmed',confirmedOn:'2026-11-05',publicProviderVerification:'pending',accountRedemptionTested:false},priceOffer:{maximumApproximateDiscountPercent:24,status:'operator-confirmed',checkedOn:'2026-11-05',basis:'operator-stated-conservative-display',sourceBaseDiscountPercent:26,couponNotCombined:true,independentlyPriceVerified:false,appliesToEveryPackage:false,priceURL:prior.tenUrl},couponUseConditionsMayVary:true});delete expected.conditionsMayVary;
 assert.deepEqual(current,expected,'Only explicitly approved V6.1 policy fields may change');
 assert.equal(current.tenUrl,'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive');assert.deepEqual(current.history,prior.history);
}
function assertCopyTransition(prior,current){
 assert.deepEqual(current,Sync.project(prior),'Only canonical TEN fields and FAQ[7] may change');
 for(const [locale,c]of Object.entries(copy.locales))for(const key of ['historyTitle','historyMonth','historyIntro','packageLabel','recipientsLabel','historyTotal','historyCaveat'])assert.equal(c[key],prior.locales[locale]['ten'+key[0].toUpperCase()+key.slice(1)],locale+':'+key);
}
module.exports={assertPolicyTransition,assertCopyTransition};
