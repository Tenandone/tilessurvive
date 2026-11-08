'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const G=require('./client-release-gate'),B=require('./build-client-release');

test('release pipeline projects every unified building before Nuclear links and final presentation',()=>{
 const plan=B.steps(),building=plan.indexOf('scripts/build-buildings-unified.js');
 assert.equal(plan.filter(file=>file==='scripts/build-buildings-unified.js').length,1);
 assert(building>plan.indexOf('scripts/build-v3-platform.js'));
 assert.equal(plan[building+1],'scripts/build-nuclear-age.js');
 assert(building<plan.indexOf('scripts/build-v6-system.js'));
 assert(building<plan.indexOf('scripts/build-site-identity.js'));
 assert.equal(plan.at(-1),'scripts/build-root-home.js','The root inherits the finished localized homes');
 assert.equal(new Set(plan).size,plan.length,'Each release owner runs once');
 assert.deepEqual([...plan].sort(),['build-v3-platform','build-analytics-privacy','build-hero-atlas','build-hero-pet-pages','v4-workbench-content','build-gift-codes','build-buildings-unified','build-nuclear-age','build-v5-landing','build-hero-atlas-search','build-v4-search','build-answer-guides','build-v3-search','build-v6-system','build-site-identity','build-root-home'].map(name=>'scripts/'+name+'.js').sort());
 assert(!plan.some(file=>/build-(?:global-locales|german-50|simplified-chinese|building-system)\.js$/.test(file)),'Legacy regeneration must not run in release publication');
});

function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'tilessurvive-release-rollback-')),root=path.join(base,'site'),artifacts=path.join(base,'artifacts');
 const files={'sitemap.xml':'<urlset/>','data/i18n/locales.json':JSON.stringify({locales:[{code:'en'}]}),'en/a/index.html':'first original','en/b/index.html':'second original','en/c/index.html':'third original'};
 for(const [file,content]of Object.entries(files)){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
 const ownerPath=path.join(root,'scripts/build-v3-platform.js');fs.mkdirSync(path.dirname(ownerPath),{recursive:true});fs.writeFileSync(ownerPath,'exports.build=()=>{};\n');const owner=require(ownerPath);
 t.after(()=>{delete require.cache[ownerPath];fs.rmSync(base,{recursive:true,force:true});});
 // Full-repository policy is covered by the existing gate tests. This fixture
 // exercises the real snapshot, backup, owner invocation, filesystem and catch.
 const validate=t.mock.method(G,'validate',()=>({status:'PASS'}));
 const original=Object.assign(new Error('Original fixture owner failure'),{code:'EOWNER_FIXTURE'});
 owner.build=()=>{for(const file of Object.keys(files))fs.writeFileSync(path.join(root,file),'changed');fs.writeFileSync(path.join(root,'unrelated.txt'),'keep');throw original;};
 return {root,artifacts,files,owner,original,validate};
}

test('a real rollback copy failure is recorded while later captured files are restored and the original error is rethrown',t=>{
 const f=fixture(t),build=f.owner.build;
 f.owner.build=()=>{try{build();}catch(error){const target=path.join(f.root,'en/a/index.html');fs.unlinkSync(target);fs.mkdirSync(target);throw error;}};
 assert.throws(()=>B.build({root:f.root,artifactRoot:f.artifacts,apply:true}),error=>error===f.original);
 const report=JSON.parse(fs.readFileSync(path.join(f.artifacts,'result.json'),'utf8'));
 assert.equal(report.status,'FAILED_ROLLBACK_INCOMPLETE');assert.equal(report.error,f.original.message);assert.deepEqual(report.errorDetails,{name:'Error',message:f.original.message,code:'EOWNER_FIXTURE',stack:f.original.stack});
 assert.equal(report.deployed,false);assert.equal(report.rollback.attempted,Object.keys(f.files).length);assert.equal(report.rollback.restored,Object.keys(f.files).length-1);assert.deepEqual(report.rollback.failures.map(e=>e.file),['en/a/index.html']);assert(report.rollback.failures[0].code);assert(report.rollback.failures[0].message);
 for(const file of ['sitemap.xml','data/i18n/locales.json','en/b/index.html','en/c/index.html'])assert.equal(fs.readFileSync(path.join(f.root,file),'utf8'),f.files[file]);
 assert(fs.statSync(path.join(f.root,'en/a/index.html')).isDirectory(),'Rollback never deletes a conflicting target');assert.equal(fs.readFileSync(path.join(f.root,'unrelated.txt'),'utf8'),'keep');
 assert.equal(f.validate.mock.callCount(),1,'No post-failure validation or subsequent owner is run');
});

test('complete rollback retains its original status and restores exactly the captured files',t=>{
 const f=fixture(t);assert.throws(()=>B.build({root:f.root,artifactRoot:f.artifacts,apply:true}),error=>error===f.original);
 const report=JSON.parse(fs.readFileSync(path.join(f.artifacts,'result.json'),'utf8'));
 assert.equal(report.status,'FAILED_ROLLED_BACK');assert.equal(report.deployed,false);assert.equal(report.errorDetails.code,'EOWNER_FIXTURE');assert.deepEqual(report.rollback,{attempted:Object.keys(f.files).length,restored:Object.keys(f.files).length,failures:[]});
 for(const [file,content]of Object.entries(f.files))assert.equal(fs.readFileSync(path.join(f.root,file),'utf8'),content);assert.equal(fs.readFileSync(path.join(f.root,'unrelated.txt'),'utf8'),'keep');
});

test('an unwritable failure-report path cannot replace the original build error or prevent restoration',t=>{
 const f=fixture(t);fs.mkdirSync(path.join(f.artifacts,'result.json'),{recursive:true});const log=t.mock.method(console,'error',()=>{});
 assert.throws(()=>B.build({root:f.root,artifactRoot:f.artifacts,apply:true}),error=>error===f.original);
 assert.equal(log.mock.callCount(),2);for(const [file,content]of Object.entries(f.files))assert.equal(fs.readFileSync(path.join(f.root,file),'utf8'),content);
});
