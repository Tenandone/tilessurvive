'use strict';
// Release announcements and verified client capabilities remain independent.
const catalog=require('../../data/xssr-heroes.json');
const client=require('../../data/hero-atlas-client.json');
const details=require('../../data/xssr-details.json');
function record(id){const announced=catalog.heroes.find(h=>h.id===id),verified=details.heroes[id];if(!announced)return undefined;if(!verified)return announced;return{...announced,clientId:verified.clientId,typeRaw:verified.typeRaw,professionRaw:verified.professionRaw,factionRaw:verified.factionRaw,names:announced.names,capabilities:verified.capabilities,clientVersion:details.version.game};}
function officialHeroes(){return catalog.heroes.map(h=>record(h.id)).filter(h=>h.clientId===null).map(h=>({...h,identityId:h.id,variant:'base',officialOnly:true,rarityRaw:null,roles:{classTags:[]},factionNames:client.heroes.find(c=>c.factionRaw===h.factionRaw).factionNames}));}
function verifiedHeroes(){return Object.values(details.heroes).filter(h=>!client.heroes.some(c=>c.id===h.id)).map(h=>{const r=record(h.id),faction=client.heroes.find(c=>c.factionRaw===h.factionRaw),allTags=client.heroes.flatMap(c=>c.roles.classTags),classTags=h.classTagIds.map(id=>allTags.find(t=>t.clientId===id));if(classTags.some(t=>!t))throw Error('Unmapped verified class tag '+h.id);return{...r,sourceId:h.sourceId,nameKey:h.nameKey,baseClientId:h.clientId,identityId:h.id,variant:'base',officialOnly:false,clientSupplement:true,rarityRaw:h.rarityRaw,roles:{classTags},factionNames:faction.factionNames,factionNameKey:faction.factionNameKey,skillRefs:h.skills.map(s=>({clientId:s.clientId})),skills:h.skills,exclusiveGear:h.exclusiveGear,growth:h.growth,clientConditions:h.clientAvailability};});}
function heroes(){return [...client.heroes,...verifiedHeroes(),...officialHeroes()];}
function counts(){const all=heroes().filter(h=>h.variant==='base'),pending=all.filter(h=>['development','upcoming'].includes(record(h.id)?.release.status)).length;return {total:all.length,released:all.length-pending,development:pending,xssr:catalog.heroes.length};}
function copy(locale){const value=require('../../data/xssr-copy.json').locales[locale];if(!value)throw Error('Missing X-SSR locale '+locale);return value;}
module.exports={record,officialHeroes,verifiedHeroes,heroes,counts,copy};
