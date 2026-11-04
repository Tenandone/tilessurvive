'use strict';
// Read-only retained-client source audit; writes only the new V4 compact model.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {createSource}=require('./client-audit/source.cjs');
const previous=require('./build-hero-pet-relations');
const ROOT=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ATTACK_SKILLS={lucky:'survivor_lucky_attack',tony:'survivor_tony_attack',maddy:'survivor_maddie_attack',rosie:'survivor_rosie_attack',nikola:'survivor_nikola_attack',ray:'survivor_ray_attack',beka:'survivor_becca_attack',laila:'survivor_layla_attack',candy:'survivor_candy_attack',sarge:'survivor_sarge_attack',mike:'survivor_mike_attack','chef-ken':'survivor_ken_attack',freya:'survivor_freja_skill_1',travis:'survivor_travis_attack',eva:'survivor_eva_attack',rusty:'survivor_rusty_attack',ghost:'survivor_tim_attack',light:'survivor_wright_attack',kiki:'survivor_tithi_attack',tara:'survivor_tara_attack',jacob:'survivor_jacob_attack',tarzan:'survivor_tarzan_attack',kiron:'survivor_chiron_attack',shark:'survivor_shark_attack',knotty:'survivor_knotty_attack',undine:'survivor_undine_attack',dave:'survivor_dave_skill_1',lava:'survivor_lava_attack'};
const TARGETS={snowball:['enemy-random','all','all-conditional','pet'],dodo:['all-random','growth','growth','pet'],buckler:['nearest-ally','growth','growth','pet'],fluffy:['front','all','all','pet'],hardhead:['enemy-nearest','front','enemy-front','pet'],shadow:['enemy-random','all','all-conditional','pet'],snowy:['enemy-ahead','all','all-conditional','pet'],starhorn:['front-back','all','all','pet'],chompy:['enemy-lowest-health','all','all','pet'],hopper:['all-random','all','all-conditional','pet']};
const LUA_PINS={'NppMarchFormationSettingView.lua':'52e5bb5280199cb2338da7639fa12bb931040c4339ac9f6efbe11176238198a0','NppMarchFormationBonusItem.lua':'2a17c124383dbcf2a77f15800f81e95c534a897acf729cd39d69e69d22b1aa8a','SurvivorRestrainUtils.lua':'c979e72673001d211396a8051f052792b034060eb775cfceeba9ebd8060016c8','PetFormationProxy.lua':'629c4ba157413ba35d6c4a4516cb1b4b2d683f9b4bafe35fa080ac86a9d5160d'};
// Native constants and scene positions are read from original APK/bundle bytes.
// The object index supplies offsets; raw SHA and reciprocal pointers are checked.
const ORIGINAL_PY=String.raw`
import sys,json,hashlib,struct,zipfile
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'scripts/client-audit'))
from unity_bytes import unity_files
c=Path(sys.argv[1]);apk=c.parent/'structured/base.apk'
with zipfile.ZipFile(apk) as z: m=z.read('assets/bin/Data/Managed/Metadata/global-metadata.dat')
assert struct.unpack_from('<II',m)==(0xFAB11BAF,31)
names=['stringLiteral','stringLiteralData','string','events','properties','methods','parameterDefaultValues','fieldDefaultValues','fieldAndParameterDefaultValueData','fieldMarshaledSizes','parameters','fields','genericParameters','genericParameterConstraints','genericContainers','nestedTypes','interfaces','vtableMethods','interfaceOffsets','typeDefinitions']
h={n:struct.unpack_from('<II',m,8+i*8) for i,n in enumerate(names)}
def name(x):
 s,n=h['string'];assert 0<=x<n;return m[s+x:m.index(b'\0',s+x,s+n)].decode()
s,n=h['fieldDefaultValues'];defaults={f:(t,d) for f,t,d in struct.iter_unpack('<iii',m[s:s+n])}
constants={};s,n=h['typeDefinitions']
for p in range(s,s+n,88):
 r=struct.unpack_from('<16i8H2I',m,p);tn=name(r[0])
 wanted={'MarchConstant':['SURVIVOR_SLOT_MAX','SURVIVOR_SLOT_EMPTY'],'SurvivorFaction':['Mountain','Wilds','Sky','Ocean'],'FormationSettingScene':['SCENE_NAME','SURVIVOR_SLOT_PREFIX']}.get(tn,[])
 if not wanted:continue
 for i in range(r[8],r[8]+r[18]):
  f=struct.unpack_from('<IiI',m,h['fields'][0]+12*i);fn=name(f[0])
  if fn not in wanted:continue
  typ,offset=defaults[i];a=h['fieldAndParameterDefaultValueData'][0]+offset;byte=m[a];assert byte<128 and byte%2==0
  v=byte>>1 if typ==46701 else m[a+1:a+1+(byte>>1)].decode()
  constants[tn+'.'+fn]={'value':v,'fieldIndex':i,'offset':a,'encodedHex':m[a:a+1].hex()}
assert constants['MarchConstant.SURVIVOR_SLOT_MAX']['value']==5
assert constants['SurvivorFaction.Ocean']['value']==4
assert constants['FormationSettingScene.SCENE_NAME']['value']=='scene_ui_new_troop_edit'
assert constants['FormationSettingScene.SURVIVOR_SLOT_PREFIX']['value']=='hero_pos_'
sourcehash='b127d7bf65438376069055903f3f8ed3c65a9400073d162c14ec4961afe3f578'
b=(c/'integration-41/snapshot/blobs'/sourcehash).read_bytes();assert hashlib.sha256(b).hexdigest()==sourcehash
body=b[52:];assert hashlib.sha256(body).hexdigest()=='1d714adf802103313ab6cf2aadca4946aa706352c3844e61999009e368cf215a'
files,header=unity_files(body)
rows=[json.loads(x) for x in (c/'integration-41/unity/bodies/1d714adf802103313ab6cf2aadca4946aa706352c3844e61999009e368cf215a/objects.jsonl').read_text().splitlines()]
byid={str(r['pathId']):r for r in rows}
def raw(r):
 v=files[r['serializedFile']][r['byteStart']:r['byteStart']+r['byteSize']];assert hashlib.sha256(v).hexdigest()==r['rawSha256'];return v
positions=[]
for slot in range(1,6):
 r=next(r for r in rows if r.get('name')=='hero_pos_'+str(slot));g=raw(r);count=struct.unpack_from('<i',g)[0];assert count==1
 fid,tid=struct.unpack_from('<iq',g,4);assert fid==0;t=byid[str(tid)];v=raw(t);fid,gid=struct.unpack_from('<iq',v);assert fid==0 and gid==r['pathId']
 a=4+12*count+4;length=struct.unpack_from('<i',g,a)[0];assert g[a+4:a+4+length].decode()==r['name']
 q=struct.unpack_from('<4f',v,12);pos=struct.unpack_from('<3f',v,28)
 assert abs(q[0])<1e-6 and abs(q[2])<1e-6 and q[1]<0 and q[3]>0 and abs(q[1]**2+q[3]**2-1)<1e-5
 positions.append({'slot':slot,'position':list(pos),'rotation':list(q),'gameObjectId':str(gid),'transformId':str(tid),'gameObjectSHA256':r['rawSha256'],'transformSHA256':t['rawSha256']})
assert max(p['position'][0] for p in positions[:2]) < min(p['position'][0] for p in positions[2:])
print(json.dumps({'metadataSHA256':hashlib.sha256(m).hexdigest(),'constants':constants,'prefabSourceSHA256':sourcehash,'positions':positions,'meaning':'Retained client five-slot layout; first two slots face forward along negative X. Current server eligibility and live targeting not established.'}))
`;
function validate(model){
 assert.equal(model.schemaVersion,1);assert.equal(model.heroes.length,29);assert.equal(model.heldHeroIds.length,6);assert.equal(model.pets.length,10);
 assert.deepEqual([model.formation.heroSlots,model.formation.frontSlots,model.formation.backSlots,model.formation.petSlots],[5,2,3,1]);assert.equal(model.formation.liveEligibilityVerified,false);
 assert.equal(model.rules.length,70);assert.equal(model.rules.filter(r=>r.origin==='v4-position-attack').length,56);assert(!model.rules.some(r=>r.id==='chiron-ironhead-defense-window'));
 const heroMap=new Map(model.heroes.map(h=>[h.id,h])),petMap=new Map(model.pets.map(p=>[p.id,p]));assert.equal(heroMap.size,29);assert.equal(petMap.size,10);
 for(const r of model.rules){const h=heroMap.get(r.heroId),p=petMap.get(r.petId);assert(h&&p);for(const id of r.heroSkillIds)assert(h.skills.some(s=>s.clientId===id));for(const id of r.petSkillIds)assert(p.skills.some(s=>s.clientId===id));assert(['data-based','practical-check'].includes(r.status));assert(r.evidenceRefs.length);assert(!('score'in r||'winRate'in r));if(r.origin==='v4-position-attack'){assert.equal(h.attackScalingSkillId,r.heroSkillIds[0]);assert.equal(r.petId,r.requiredRow==='front'?'hardhead':'starhorn');}}
 for(const p of model.pets){assert.equal(p.levelExp.length,100);assert.equal(p.levelExp[99],0);assert.deepEqual(p.stages.map(s=>s.stage),[0,1,2,3,4,5]);assert.deepEqual(p.skills.map(s=>s.unlockStage),[0,2,4,5]);assert.equal(p.currentReleaseVerified,false);}
 return true;
}
function collect(corpus){
 const prior=previous.collect(corpus),kept=require('../data/hero-pet-relations.json');assert.deepEqual(prior.model,kept,'Previously published source cohort must remain unchanged');
 const source=createSource(corpus),tables=new Map(),audit={tables:[],limits:[]};
 function table(name){if(tables.has(name))return tables.get(name);const t=source.table(name),rows=t.records.map(x=>x.row);tables.set(name,rows);audit.tables.push({name,rows:rows.length,sha256:t.sourceSHA256,path:t.sourcePath});return rows;}
 const locales=require('../data/i18n/locales.json').locales.map(l=>l.code),langs={};for(const l of locales){const c={'zh-cn':'zh-CN','zh-tw':'zh-TW',ms:'my'}[l]||l;if(!['ar','vi','nb'].includes(l))langs[l]=JSON.parse(fs.readFileSync(path.join(corpus,'authorized-decryption/decoded-language/ingame-apk-'+c+'.json')));}
 const localNames=key=>Object.fromEntries(locales.map(l=>{const v=langs[l]?.[key];assert(v||['ar','vi','nb'].includes(l),'Missing official '+key+':'+l);return [l,{value:v||langs.en[key],status:v?'client-official':'english-fallback'}];}));
 const original=JSON.parse(cp.execFileSync('python',['-B','-c',ORIGINAL_PY,corpus],{cwd:ROOT,encoding:'utf8',maxBuffer:2*1024*1024}));audit.original=original;
 const idx=fs.readFileSync(path.join(corpus,'integration-41/unity/priority-lua/textassets-index.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse),lua=[];
 for(const [name,pin]of Object.entries(LUA_PINS)){const matches=idx.filter(r=>r.name===name);assert(matches.length);for(const r of matches){const b=fs.readFileSync(r.path.replaceAll('\\\\','\\'));assert.equal(sha(b),pin);assert.equal(r.sha256,pin);}lua.push({name,sha256:pin});}audit.lua=lua;
 const petModulePins=['f21ff1b9f875e281ea24660e390f4e21ce986a732867c9aaba092a6ba0e9ed68','84c0b5d54ea1a7bdb7bc11d1243e3549cc1380a8480bef797aa0a658d1544379'];
 const petModules=idx.filter(r=>r.name==='PetModule.lua');assert.equal(petModules.length,2);assert.deepEqual(petModules.map(r=>r.sha256).sort(),petModulePins.slice().sort());for(const r of petModules){assert.equal(sha(fs.readFileSync(r.path)),r.sha256);lua.push({name:'PetModule.lua#'+r.sha256.slice(0,12),sha256:r.sha256});}
 const configs=table('game_configs'),coeff=table('battle_formula_coefficient'),config=id=>{const r=configs.find(r=>r.Id===id);assert(r&&!r.KidValue);return r;},coef=id=>{const r=coeff.find(r=>r.Id===id);assert(r&&!r.KidValue);return r;};
 const bp=value=>{assert(/^\d+(?:\.\d{1,4})?$/.test(value));const n=Number(value)*10000;assert(Number.isInteger(Math.round(n))&&Math.abs(n-Math.round(n))<1e-6);return Math.round(n);};
 const groupValues=id=>Object.fromEntries(config(id).Value.split(',').map(pair=>{const [group,value,...rest]=pair.split('|');assert(!rest.length&&/^[2-5](?:_[2-5])?$/.test(group));return [group,bp(value)];}));
 const atlas=require('../data/hero-atlas-client.json'),routes=require('../data/hero-atlas-routes.json'),rawHeroes=table('survivor'),types=table('survivor_skill_type');
 const heroes=kept.heroes.filter(h=>h.publication==='published').map(h=>{const raw=rawHeroes.find(r=>r.InternalId===h.clientId),old=atlas.heroes.find(x=>x.id===h.id);assert(raw&&old);assert.deepEqual(raw.SkillConfig.map(x=>x.key),h.skillIds);assert.equal(raw.Faction,old.factionRaw);const attack=ATTACK_SKILLS[h.id]&&types.find(s=>s.Id===ATTACK_SKILLS[h.id]);if(attack){assert(h.skillIds.includes(attack.InternalId));assert(/(?:of |%<\/color> |<\/color> )(?:Attack|ATK)(?: |\.| Damage)/.test(langs.en[attack.DescriptionSquad]),'Reviewed explicit attack scaling '+h.id);assert.equal(sha(langs.en[attack.DescriptionSquad]),kept.skills[attack.InternalId].descriptionSHA256);}
  return {id:h.id,identityId:h.identityId,clientId:h.clientId,names:localNames(raw.Name),routes:routes.heroes.find(x=>x.id===h.id).routes,faction:raw.Faction,type:raw.Type,attackScalingSkillId:attack?.InternalId||null,skills:h.skillIds.map(id=>({clientId:id,sourceId:kept.skills[id].sourceId,names:kept.skills[id].names,slot:kept.skills[id].slot})),evidenceRefs:['survivor:'+h.clientId]};});
 const petRows=table('pet_base'),stageRows=table('pet_train_stage'),stepRows=table('pet_train_step'),levelRows=table('pet_level'),eggs=table('pet_egg'),pools=table('pet_hatch_pool'),items=table('itemlist'),itemMap=new Map();
 function item(id){if(!itemMap.has(id)){const r=items.find(r=>r.InternalId===id);assert(r,'Missing item '+id);itemMap.set(id,{clientId:id,names:localNames(r.Name)});}return id;}
 const pets=kept.pets.map(p=>{const r=petRows.find(r=>r.InternalId===p.clientId);assert(r);const ordered=stepRows.filter(x=>x.PetId.internalId===p.clientId).sort((a,b)=>a.Order-b.Order);assert.equal(ordered.length,101);assert(ordered.every((x,i)=>i===0||x.Order===ordered[i-1].Order+1),'Discontinuous training order');const stages=stageRows.filter(s=>s.PetId.internalId===p.clientId).sort((a,b)=>a.TrainStage-b.TrainStage).map(s=>{const costs={};const rows=stepRows.filter(x=>x.PetId.internalId===p.clientId&&x.TrainStage.internalId===s.InternalId);assert.equal(rows.length,s.TrainStage===5?1:20);assert.deepEqual(rows.map(x=>x.TrainStep).sort((a,b)=>a-b),Array.from({length:rows.length},(_,i)=>i));for(const x of rows){if(s.TrainStage<5)assert(x.FragmentCost?.length===1&&Number.isSafeInteger(x.FragmentCost[0].value)&&x.FragmentCost[0].value>0,'Missing training cost');else assert(!x.FragmentCost?.length,'Unexpected terminal training cost');for(const c of x.FragmentCost||[]){item(c.key);costs[c.key]=(costs[c.key]||0)+c.value;}}return {stage:s.TrainStage,skillLevels:s.SkillLevelMax,transferBasisPoints:s.ConvertRate,fullStageMaterialCosts:Object.entries(costs).map(([id,quantity])=>({itemId:Number(id),quantity})),evidenceRefs:['pet_train_stage:'+s.InternalId]};});
  const levels=levelRows.filter(x=>x.PetId.internalId===p.clientId).sort((a,b)=>a.Level-b.Level);assert.deepEqual(levels.map(x=>x.Level),Array.from({length:100},(_,i)=>i+1));
  return {id:p.id,clientId:p.clientId,names:p.names,quality:r.Quality,currentReleaseVerified:false,configuredRelease:{clientVersion:r.ClientVersion,serverOpenDays:r.ServerOpenDays,serverOpenWeeks:r.ServerOpenWeeks},levelExp:levels.map(x=>x.LevelExp),stages,duplicateMarks:r.DuplicateFragmentItem.map(c=>({itemId:item(c.key),quantity:c.value})),hatchOptions:eggs.filter(e=>pools.find(x=>x.InternalId===e.PoolId.internalId).PetWeight.some(x=>x.key===p.clientId)).map(e=>({eggId:e.InternalId,quality:e.Quality,baseSeconds:e.HatchSeconds,evidenceRefs:['pet_egg:'+e.InternalId]})),skills:p.skills.map(s=>({clientId:s.clientId,sourceId:s.sourceId,names:s.names,slot:s.slot,unlockStage:s.unlockStage,maxLevel:s.levelRange.max,target:TARGETS[p.id][s.slot-1],evidenceRefs:s.evidenceRefs})),evidenceRefs:p.evidenceRefs};});
 const rules=kept.rules.map(r=>({...r,origin:'retained-v3',requiredRow:null}));for(const h of heroes.filter(h=>h.attackScalingSkillId)){for(const [petId,slot,row]of [['hardhead',2,'front'],['starhorn',1,'back']]){const pet=pets.find(p=>p.id===petId),skill=pet.skills.find(s=>s.slot===slot);rules.push({id:h.id+'-'+petId+'-'+row+'-attack',heroId:h.id,petId,origin:'v4-position-attack',status:'data-based',mode:'squad',reasonKey:'position-attack-scaling',requiredRow:row,conditionKeys:['hero-skill-unlocked','pet-skill-unlocked','attack-modifier-applies',row==='front'?'hero-in-front':'hero-in-back',...(petId==='starhorn'?['temporary-window']:[])],cautionKeys:['not-official-pairing','no-performance-estimate','current-rules-unverified','modifier-order-unverified'],heroSkillIds:[h.attackScalingSkillId],petSkillIds:[skill.clientId],alternatePetIds:[],evidenceRefs:['survivor_skill_type:'+h.attackScalingSkillId,...skill.evidenceRefs]});}}
 const model={schemaVersion:1,version:kept.version,formation:{heroSlots:5,frontSlots:2,backSlots:3,petSlots:1,status:'retained-client-layout-verified',liveEligibilityVerified:false,roleRestrictionsVerified:false,evidenceRefs:['metadata:MarchConstant.SURVIVOR_SLOT_MAX','prefab:scene_ui_new_troop_edit','lua:NppMarchFormationSettingView.lua','lua:PetFormationProxy.lua']},factions:[1,2,3,4].map(id=>({id,names:localNames({1:'hero_faction_mountain',2:'hero_faction_wild',3:'hero_faction_sky',4:'hero_faction_ocean'}[id])})),factionRules:{healthBasisPoints:groupValues('same_unit_type_add_up_desc'),counterBasisPoints:groupValues('same_unit_type_restrain_add_up_desc'),oceanFaction:4,oceanAttackBasisPoints:bp(coef('seahero_attack_increase_ratio').Value),oceanHealthPenaltyBasisPoints:bp(coef('seahero_health_reduce_ratio').Value),healthUnlockSeconds:Number(coef('same_unit_type_open_time').Value),counterUnlockSeconds:Number(coef('target_damage_open_time').Value),relations:table('faction_restrain').map(r=>({from:r.Faction_1,to:r.Faction_2,value:r.Restrain})),meaning:'retained client UI display formula; not simulated final combat damage',evidenceRefs:['game_configs:102136','game_configs:103075','lua:NppMarchFormationSettingView.lua','lua:SurvivorRestrainUtils.lua']},heroes,heldHeroIds:kept.heroes.filter(h=>h.publication==='held').map(h=>h.id),pets,items:[...itemMap.values()],rules,localePolicy:kept.localePolicy,sources:[...audit.tables.map(t=>({id:t.name,sha256:t.sha256,rows:t.rows})),...lua.map(t=>({id:'lua:'+t.name,sha256:t.sha256})),{id:'metadata',sha256:original.metadataSHA256},{id:'prefab:scene_ui_new_troop_edit',sha256:original.prefabSourceSHA256}],limits:['No live server or account eligibility certification.','No final combat damage, win rate or optimum.','Hero skill unlocks require user confirmation; no invented star/rank conversion.','Pet stage unlocks are configured maxima, not proof that a skill was learned.','Duplicate buffs and healing modifiers are not added numerically.','Hatch seconds are base configuration; no rarity chance or guaranteed acquisition is asserted.']};
 validate(model);audit.summary={heroes:heroes.length,pets:pets.length,rules:rules.length,previousRules:kept.rules.length,newPositionRules:56,heroesWithCandidates:new Set(rules.map(r=>r.heroId)).size,uniqueHeroPetPairs:new Set(rules.map(r=>r.heroId+'|'+r.petId)).size};return {model,audit};
}
function build(corpus,auditPath){const result=collect(corpus);fs.writeFileSync(path.join(ROOT,'data/v4-formation.json'),JSON.stringify(result.model)+'\n');if(auditPath){assert(!path.resolve(auditPath).startsWith(ROOT+path.sep));fs.writeFileSync(auditPath,JSON.stringify(result.audit,null,2)+'\n');}return result;}
module.exports={collect,build,validate,ATTACK_SKILLS,TARGETS};
if(require.main===module){const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];};assert(arg('--corpus'),'--corpus required');console.log(JSON.stringify(build(path.resolve(arg('--corpus')),arg('--audit-output')).audit.summary));}
