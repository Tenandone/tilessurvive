'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createSource,hash,privateOutput}=require('./source.cjs');
function cfg(fragment=false){
 const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},str=s=>Buffer.concat([Buffer.from([s.length]),Buffer.from(s)]);
 const schema=Buffer.concat([u32(1),Buffer.from([12]),str('Fixture'),u32(2),Buffer.from([3]),str('InternalId'),Buffer.from([8]),str('Id')]);
 const b=Buffer.alloc(50);Buffer.from('1b434647','hex').copy(b);b.writeUInt32LE(30,4);b.writeUInt32LE(50,8);b.writeUInt32LE(1,12);str('alpha').copy(b,16);b.writeInt32LE(42,22);b.writeInt32LE(-14,26);b.writeUInt32LE(1,30);b.writeUInt32LE(22,34);b.writeUInt32LE(1,38);b.writeUInt32LE(42,42);
 return fragment?b:Buffer.concat([b,schema]);
}
function fixture(mutator){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'client-audit-test-')),entries=[],index={};
 for(const [name,fragment]of [['fixture',false],['fixture_1',true]]){const b=cfg(fragment),filePath=name+'.bin';fs.writeFileSync(path.join(root,filePath),b);const md5=hash(b,'md5');index[name]=md5;entries.push({tableName:name,filePath,bytes:b.length,sha256:hash(b),md5,expectedRealtimeMD5:md5,currentness:'MATCHES_LOCAL_REALTIME_INDEX',rootClass:fragment?null:'Fixture',declaredRecords:1});}
 if(mutator)mutator({root,entries,index});
 const bytes=Buffer.from(JSON.stringify(index));fs.writeFileSync(path.join(root,'index.json'),bytes);fs.writeFileSync(path.join(root,'selected-source-manifest.json'),JSON.stringify({metadata:{'BinVersionList_Realtime.json':{filePath:'index.json',sha256:hash(bytes),bytes:bytes.length}},entries}));return root;
}
test('embedded and null-metadata fragment derive exactly the same actual schema',()=>{const s=createSource(fixture());assert.equal(s.table('fixture').records[0].row.Id,'alpha');assert.equal(s.table('fixture_1').reader.rootClass,'Fixture');assert.equal(s.table('fixture_1').records[0].row.InternalId,42);});
test('new captured-index table cannot be silently omitted',()=>assert.throws(()=>createSource(fixture(({index})=>{index.new_unreviewed_table='a'.repeat(32);})),/absent from selected/));
test('mutated CFG bytes fail source SHA even if size unchanged',()=>{const r=fixture(),file=path.join(r,'fixture.bin'),b=fs.readFileSync(file);b[20]^=1;fs.writeFileSync(file,b);assert.throws(()=>createSource(r).table('fixture'),/Source SHA/);});
test('captured index digest is mandatory',()=>{const r=fixture();fs.appendFileSync(path.join(r,'index.json'),' ');assert.throws(()=>createSource(r),/Captured index SHA/);});
test('wrong fragment family fails instead of normalized fallback',()=>{const r=fixture(({entries,index})=>{entries.splice(0,1);delete index.fixture;});assert.throws(()=>createSource(r).table('fixture_1'),/family schema/);});
test('public input path is rejected',()=>assert.throws(()=>createSource(path.join(__dirname,'../..')),/outside the public/));
test('audit output cannot be placed inside originals',()=>{const root=fixture();assert.throws(()=>privateOutput(root,path.join(root,'audit')),/original corpus/);});
