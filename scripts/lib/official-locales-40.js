'use strict';
const data=require('../../data/foundation-40/official-character-locales.json');
const aliases=require('../../data/foundation-40/character-label-aliases.json');
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function replaceLabels(value,pairs){
  const mapping=new Map(pairs.filter(([from,to])=>from&&to&&from!==to));
  if(!mapping.size)return value;
  const expression=new RegExp('(?<![\\p{L}\\p{N}])(?:'+[...mapping.keys()].sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?![\\p{L}\\p{N}])','gu');
  return String(value).replace(expression,match=>mapping.get(match));
}
function entries(lang){
  return ['heroes','pets'].flatMap(type=>data[type].map(entity=>{
    const before=aliases[type].find(r=>r.id===entity.id).locales[lang];
    const names=[before.name,entity.names.en].filter(Boolean);
    const namePairs=names.map(name=>[name,entity.names[lang]]);
    const skillPairs=(entity.skills||[]).flatMap((skill,i)=>[before.skills?.[i],skill.name.en].filter(Boolean).map(name=>[name,skill.name[lang]]));
    const gearPairs=entity.gear?[['name','skillName'].flatMap(key=>entity.gear[key]?.en?[[entity.gear[key].en,entity.gear[key][lang]]]:[])].flat():[];
    return {type,entity,route:before.route,names,namePairs,pairs:[...namePairs,...skillPairs,...gearPairs]};
  }));
}
function pagePairs(file){const lang=file.split('/')[0],route='/'+file.replace(/index\.html$/,'');return entries(lang).find(e=>e.route===route)?.pairs||[];}
module.exports={data,aliases,entries,pagePairs,replaceLabels};
