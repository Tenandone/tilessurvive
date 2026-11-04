'use strict';
// Current owner pipeline only. The legacy six-language generators are never
// invoked here. All writes are backed up outside the public repository.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const G=require('./client-release-gate');
function steps(root=G.ROOT){return ['scripts/build-v3-platform.js','scripts/build-hero-atlas.js',...(G.hook(root)?[G.hook(root)]:[]),'scripts/v4-workbench-content.js','scripts/build-hero-atlas-search.js','scripts/build-v4-search.js','scripts/build-v3-search.js'];}
function build({root=G.ROOT,apply=false,artifactRoot}={}){
 const plan=steps(root);G.validate(root);
 if(!apply){const result={mode:'check',validated:true,steps:plan,deployed:false};console.log(JSON.stringify(result));return result;}
 const artifacts=path.resolve(artifactRoot||process.env.CLIENT_RELEASE_ARTIFACT_ROOT||path.join(root,'../client-release-artifacts',new Date().toISOString().replace(/[:.]/g,'-')));
 assert(artifacts!==root&&!artifacts.startsWith(path.resolve(root)+path.sep),'Build artifacts must stay outside the public repository');fs.mkdirSync(artifacts,{recursive:true});
 const backup=path.join(artifacts,'backup'),before=G.snapshot(root,backup),result={mode:'apply',startedAt:new Date().toISOString(),baseline:G.BASELINE,steps:[],deployed:false};fs.writeFileSync(path.join(artifacts,'before.json'),JSON.stringify(before,null,2)+'\n');
 try{
  for(const file of plan){const run=cp.spawnSync(process.execPath,[path.join(root,file)],{cwd:root,encoding:'utf8',maxBuffer:30e6});fs.writeFileSync(path.join(artifacts,path.basename(file)+'.log'),(run.stdout||'')+(run.stderr||''));result.steps.push({file,exitCode:run.status});assert.equal(run.status,0,'Release owner failed: '+file);}
  result.validation=G.validate(root,{before,backup});result.v4Validation=require('./v4-release-gate').validate(root);const after=G.snapshot(root);result.changed=Object.keys(after.files).filter(f=>after.files[f]!==before.files[f]);result.status='PASS';
 }catch(error){
  // Restore only files captured by this invocation. Never remove unrelated files.
  for(const file of Object.keys(before.files)){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(backup,file),target);}
  result.status='FAILED_ROLLED_BACK';result.error=error.message;result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify(result,null,2)+'\n');throw error;
 }
 result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,artifactRoot:artifacts}));return result;
}
module.exports={steps,build};if(require.main===module)build({apply:process.argv.includes('--apply')});
