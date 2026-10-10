'use strict';
// Negative controls for the test-only 5.0 presentation projection.
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),cp=require('child_process'),{parseHTML}=require('linkedom'),P=require('./data-presentation-50-test-allowances');
const root=path.resolve(__dirname,'..');let controls=0;
function failMutation(file,mutate){const before=fs.readFileSync(path.join(root,file),'utf8'),d=parseHTML(before).document;mutate(d);assert.throws(()=>P.equal(d.documentElement.outerHTML,before,file));controls++;}
failMutation('en/buildings/power-plant/index.html',d=>d.querySelector('main table tbody td').textContent='999999999');
failMutation('en/buildings/power-plant/index.html',d=>d.querySelector('link[rel=canonical]').href='https://tilessurvive.net/en/changed/');
failMutation('en/heroes/beka/index.html',d=>d.querySelector('[data-growth-50] tbody td').textContent='999999999');
failMutation('en/heroes/beka/index.html',d=>d.querySelector('main img[data-image-role-50]').setAttribute('data-image-role-50','unreviewed'));
failMutation('en/database/items/index.html',d=>d.querySelector('[data-package-offer-50] a').href='https://example.invalid');
failMutation('zh-tw/heroes/cnay/index.html',d=>d.querySelector('.ts3-language a[lang=ko]').href='/ko/');
failMutation('en/database/items/index.html',d=>d.querySelector('[data-package-offer-50] small').textContent='Guaranteed price');
failMutation('en/database/pet-system/index.html',d=>{const s=d.querySelector('[data-growth-form] script');const x=JSON.parse(s.textContent);x.rows[0].cost++;s.textContent=JSON.stringify(x);});
failMutation('en/database/exclusive-gear/index.html',d=>d.querySelector('[data-growth-table]').setAttribute('data-growth-table','nonexistent'));
const source='js/database-22.js',before=cp.execFileSync('git',['show','5c5958b3d1a9c42d1ed33abe79e3fbd25b976cbe:'+source],{cwd:root,encoding:'utf8'}),after=fs.readFileSync(path.join(root,source),'utf8');
P.equal(after,before,source);assert.throws(()=>P.equal(after.replace('total+=r.cost','total+=r.cost+1'),before,source));controls++;
console.log(JSON.stringify({passed:true,negativeControls:controls,scope:'Test-only exact projection rejects numeric, canonical, added-model, image-role, affiliate, inline-model, table-target and formula mutations'}));
