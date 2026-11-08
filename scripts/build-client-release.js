'use strict';
// Current owner pipeline only. The legacy six-language generators are never
// invoked here. All writes are backed up outside the public repository.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const G=require('./client-release-gate');
function errorDetails(error){return {name:error?.name||'Error',message:error?.message||String(error),...(error?.code?{code:error.code}:{}),...(error?.stack?{stack:error.stack}:{})};}
function writeFailureReport(artifacts,result){
 try{fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify(result,null,2)+'\n');}
 catch(error){(result.reportingErrors??=[]).push(errorDetails(error));console.error('Unable to write release failure report:',error.message);}
}
function steps(root=G.ROOT){return ['scripts/build-v3-platform.js','scripts/build-analytics-privacy.js','scripts/build-hero-atlas.js',...(G.hook(root)?[G.hook(root)]:[]),'scripts/v4-workbench-content.js','scripts/build-gift-codes.js','scripts/build-buildings-unified.js','scripts/build-nuclear-age.js','scripts/build-v5-landing.js','scripts/build-hero-atlas-search.js','scripts/build-v4-search.js','scripts/build-answer-guides.js','scripts/build-v3-search.js','scripts/build-v6-system.js','scripts/build-site-identity.js','scripts/build-root-home.js'];}
function build({root=G.ROOT,apply=false,artifactRoot}={}){
 const plan=steps(root);G.validate(root,{allowUnprojectedIdentity:apply});
 if(!apply){const result={mode:'check',validated:true,steps:plan,deployed:false};console.log(JSON.stringify(result));return result;}
 const artifacts=path.resolve(artifactRoot||process.env.CLIENT_RELEASE_ARTIFACT_ROOT||path.join(root,'../client-release-artifacts',new Date().toISOString().replace(/[:.]/g,'-')));
 assert(artifacts!==root&&!artifacts.startsWith(path.resolve(root)+path.sep),'Build artifacts must stay outside the public repository');fs.mkdirSync(artifacts,{recursive:true});
 const backup=path.join(artifacts,'backup'),before=G.snapshot(root,backup),result={mode:'apply',startedAt:new Date().toISOString(),baseline:G.BASELINE,steps:[],deployed:false};fs.writeFileSync(path.join(artifacts,'before.json'),JSON.stringify(before,null,2)+'\n');
 try{
  // The owner modules expose the same build entry point as their CLIs. Run
  // them in this process so Windows writes retain the release invocation's
  // filesystem context; all source models stay immutable during projection.
  for(const file of plan){const owner=require(path.join(root,file));assert.equal(typeof owner.build,'function','Missing release owner build entry point: '+file);const report=owner.build();fs.writeFileSync(path.join(artifacts,path.basename(file)+'.log'),JSON.stringify(report)+'\n');result.steps.push({file,exitCode:0});}
  result.validation=G.validate(root,{before,backup});result.v4Validation=require('./v4-release-gate').validate(root);const after=G.snapshot(root);result.changed=Object.keys(after.files).filter(f=>after.files[f]!==before.files[f]);result.status='PASS';
 }catch(error){
  // Persist the original failure before rollback can encounter its own I/O error.
  // Reporting failures must not replace the owner/validation exception either.
  result.status='FAILED_ROLLBACK_PENDING';result.error=error?.message||String(error);result.errorDetails=errorDetails(error);result.rollback={attempted:0,restored:0,failures:[]};writeFailureReport(artifacts,result);
  // Restore only files captured by this invocation. Never remove unrelated files.
  for(const file of Object.keys(before.files)){
   result.rollback.attempted++;
   try{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(backup,file),target);result.rollback.restored++;}
   catch(restoreError){result.rollback.failures.push({file,...errorDetails(restoreError)});}
  }
  result.status=result.rollback.failures.length?'FAILED_ROLLBACK_INCOMPLETE':'FAILED_ROLLED_BACK';result.finishedAt=new Date().toISOString();writeFailureReport(artifacts,result);throw error;
 }
 result.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(artifacts,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,artifactRoot:artifacts}));return result;
}
module.exports={steps,build};if(require.main===module)build({apply:process.argv.includes('--apply')});
