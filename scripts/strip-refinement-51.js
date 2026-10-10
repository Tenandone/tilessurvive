'use strict';
const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..');
const owned='[data-hero-refinement-51],[data-growth-refinement-51],[data-building-refinement-51],[data-building-plan-steps-51],[data-building-refinement-51-asset]';
function strip(d){d.querySelectorAll(owned).forEach(n=>n.remove());}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name==='index.html'?[path.join(dir,e.name)]:[]);}
function build(){let pages=0;for(const lang of ['ko','en','ja','ru','zh-tw','de'])for(const file of walk(path.join(root,lang))){const text=fs.readFileSync(file,'utf8');if(!/data-(?:hero-refinement-51|growth-refinement-51|building-refinement-51|building-plan-steps-51)/.test(text))continue;const d=parseHTML(text).document;strip(d);fs.writeFileSync(file,'<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n');pages++;}console.log(JSON.stringify({strippedRefinementPages:pages}));}
module.exports={strip,owned};if(require.main===module)build();
