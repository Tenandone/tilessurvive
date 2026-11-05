'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {buildSkillValues,parseModifiers,formatParameter}=require('./build-xssr-skill-values');
const {createCapture,readLanguages}=require('./build-xssr-details');
const published=require('../data/xssr-skill-values.json');
assert.equal(Object.keys(published.skills).length,12);
assert.equal(Object.values(published.skills).reduce((n,s)=>n+Object.keys(s.levels).length,0),465);
assert.deepEqual(published.skills[25401397].levels[1],['120%','10%','2','10%','2']);
assert.deepEqual(published.skills[25401398].levels[50],['521.5%','968.5%','2']);
assert.deepEqual(published.skills[25401399].levels[50],['14.9%','3.725%']);
assert.deepEqual(published.skills[25401405].levels[1],['100%','30%','10%','2']);
assert.deepEqual(published.skills[25401407].levels[50],['22.35']); // Critical stat, not a percentage.
assert.deepEqual(published.skills[25401384].levels[1],['35','25','50']); // Literal % belongs to template.
assert.equal(published.skills[25401384].levels[1].length,3); // Unused stale descriptor slots are not zero-filled.
assert.equal(formatParameter(-100,'11'),'10%');
assert.throws(()=>formatParameter(1,'99'),/Unreviewed/);
assert.equal(parseModifiers({RaidSkillParam_1:['pve_effect|x|effect_param2|1',null,'pve_effect|y|effect_param2|1']}).length,1);
assert.deepEqual(parseModifiers({RaidSkillParam_1:['pve_effect|x|effect_param2|1.49'],RaidSkillParam_2:['pve_effect|x|effect_param2|2']})[0],{table:'pve_effect',id:'x',field:'effect_param2',index:-1,multiplier:1.49,addend:2});
const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];
if(args.includes('--source')){
 const source=get('--source'),languages=readLanguages(get('--languages'));
 const first=buildSkillValues(createCapture(source),languages),second=buildSkillValues(createCapture(source),languages);
 assert.deepEqual(first,second,'Repeated raw-source builds must be deterministic');
 assert.deepEqual(first,published,'Published numeric values drifted from current source');
 const capture=createCapture(source),original=capture.table;
 capture.table=name=>name==='pve_new_buff'?original(name).map(r=>r.Id==='furiosa_attack_def_down_fake_text'?{...r,Param3:null}:r):original(name);
 assert.throws(()=>buildSkillValues(capture,languages),/Unresolved/,'Missing numeric values may not become zero');
 const bad=createCapture(source),read=bad.table;
 bad.table=name=>name==='survivor_skill_type'?read(name).map(r=>r.InternalId===25401405?{...r,PveSkillParam:r.PveSkillParam.replace('0|10|0|0','0|10|0|unverified_formula')}:r):read(name);
 assert.throws(()=>buildSkillValues(bad,languages),/Context-dependent/);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xssr-skill-guard-'));
 try{
  fs.mkdirSync(path.join(temp,'BinaryConfig'));
  fs.copyFileSync(path.join(source,'version.json'),path.join(temp,'version.json'));
  fs.copyFileSync(path.join(source,'BinaryConfig/BinVersionList_Realtime.json'),path.join(temp,'BinaryConfig/BinVersionList_Realtime.json'));
  const bytes=fs.readFileSync(path.join(source,'BinaryConfig/pve_new_effect.bin'));bytes[bytes.length-1]^=1;
  fs.writeFileSync(path.join(temp,'BinaryConfig/pve_new_effect.bin'),bytes);
  assert.throws(()=>createCapture(temp).table('pve_new_effect'),/differs from this capture/);
 }finally{
  // Delete only this freshly created, explicitly resolved temporary directory.
  assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(temp,{recursive:true});
 }
}
console.log('X-SSR skill parameters: PASS (12 skills, 465 levels; raw build, unit and missing-source guards)');
