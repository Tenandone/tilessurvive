'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('./v4-release-gate'),A=require('./answer-guide-content'),V4=require('./v4-workbench-content'),V3=require('./build-v3-platform');
const route='/en/events/calendar/',source='<!doctype html>\n<html lang="en"><head><title>Calendar</title><script data-fixture async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script></head><body><main id="main"><h1>Calendar</h1><p data-original>Retained introduction</p><table><tr><td>3049</td></tr></table><script type="application/json">{"cost":650,"heroId":25300243}</script><a href="https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive">TEN</a></main></body></html>\n';
test('V4 expected surroundings replay only the registered answer owner serialization',()=>{
 const published=A.project(V4.project(source,'en',route),'en',route);
 const actual=V4.strip(A.validateAndStrip(published,'en',route,{required:true}));
 assert.notEqual(actual,source,'Fixture must reproduce serialized bare attributes and doctype');
 assert.equal(actual,G.projectReviewedAnswerSurroundings(source,'en',route));
 assert.equal(G.projectReviewedAnswerSurroundings(source,'en','/en/unreviewed/'),source,'Unregistered routes must not be normalized');
});
test('the exact retained calendar baseline reproduces the formerly failing serialization',()=>{
 const file='en/events/calendar/index.html',old=G.baseline([file],A.ROOT).get(file),baseline=V3.project(old,'en',route);
 const approved=A.project(V4.project(baseline,'en',route),'en',route),actual=V4.strip(A.validateAndStrip(approved,'en',route,{required:true}));
 assert.notEqual(actual,baseline);assert.equal(actual,G.projectReviewedAnswerSurroundings(baseline,'en',route));
});
test('answer serialization never masks surrounding prose, tables, model, SEO, ad or TEN mutations',()=>{
 const approved=A.project(V4.project(source,'en',route),'en',route),expected=G.projectReviewedAnswerSurroundings(source,'en',route);
 for(const [before,after]of [['Retained introduction','Unreviewed introduction'],['<td>3049</td>','<td>3050</td>'],['"cost":650','"cost":651'],['"heroId":25300243','"heroId":25300244'],['<title>Calendar','<title>Unreviewed'],['pagead2.googlesyndication.com','evil.example'],['/shop/ten/','/shop/other/'],['<p data-original="">','<p data-original="" data-unreviewed="true">']]){
  const bad=approved.replace(before,after);assert.notEqual(bad,approved,'Mutation fixture absent '+before);
  const actual=V4.strip(A.validateAndStrip(bad,'en',route,{required:true}));assert.notEqual(actual,expected,'Unowned mutation was hidden '+before);
 }
});
test('tampered answer blocks still fail before any surrounding-content comparison',()=>{
 const approved=A.project(V4.project(source,'en',route),'en',route);
 for(const mutate of [s=>s.replace('<!-- TS_ANSWER_BODY_END -->','<p>Unreviewed answer sibling</p><!-- TS_ANSWER_BODY_END -->'),s=>s.replace(/(\/js\/answer-guides.js\?v=)[a-f0-9]+/,(_,prefix)=>prefix+'000000000000'),s=>s.replace(/<!-- TS_ANSWER_BASIS_BEGIN -->[\s\S]*?<!-- TS_ANSWER_BASIS_END -->/,'')])assert.throws(()=>G.stripReviewedPresentation(mutate(approved),'en',route),/answer/i);
});
test('registered answer serialization preserves localized Nuclear cards after V4 reprojection',()=>{
 const N=require('./build-nuclear-age'),r='/ru/buildings/power-plant/';
 const native=V4.project(N.projectLinks(source,'ru',r),'ru',r),published=A.project(native,'ru',r),reviewed=A.validateAndStrip(published,'ru',r,{required:true});
 assert(native.includes('\u00a0'),'Fixture must contain native nonbreaking-space number formatting');
 assert(reviewed.includes('&#160;'),'Approved serialization must retain the same number as an entity');
 assert(N.validateLinks(reviewed,'ru',r));assert.notEqual(V4.project(reviewed,'ru',r),reviewed);
 assert.equal(G.projectReviewedAnswerSurroundings(V4.project(reviewed,'ru',r),'ru',r),reviewed);
 const changed=reviewed.replace('data-era-id="','data-era-id="unreviewed-');
 assert.throws(()=>V4.project(changed,'ru',r),/Unreviewed/,'The native card is still validated before serialization');
});
