'use strict';
const fs=require('node:fs'),path=require('node:path'),I=require('./site-identity');
function build({root=I.ROOT,apply=true}={}){const assets=I.validateAssets(root),files=I.standaloneFiles(root);let changed=0;for(const file of files){const target=path.join(root,file),before=fs.readFileSync(target,'utf8'),after=I.project(before,{root});I.validateOwnership(after,{root,required:true});if(before!==after){changed++;if(apply)fs.writeFileSync(target,after);}}const result={owner:'site-identity',pages:files.length,changed,applied:apply,...assets};console.log(JSON.stringify(result));return result;}
module.exports={build};if(require.main===module)build({apply:!process.argv.includes('--check')});
