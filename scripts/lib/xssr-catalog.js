'use strict';
// Announcement records are display data. They never become retained client rows.
const catalog=require('../../data/xssr-heroes.json');
const client=require('../../data/hero-atlas-client.json');
function record(id){return catalog.heroes.find(h=>h.id===id);}
function officialHeroes(){return catalog.heroes.filter(h=>h.clientId===null).map(h=>({...h,identityId:h.id,variant:'base',officialOnly:true,rarityRaw:null,roles:{classTags:[]},factionNames:client.heroes.find(c=>c.factionRaw===h.factionRaw).factionNames}));}
function heroes(){return [...client.heroes,...officialHeroes()];}
function counts(){const all=heroes().filter(h=>h.variant==='base'),pending=all.filter(h=>['development','upcoming'].includes(record(h.id)?.release.status)).length;return {total:all.length,released:all.length-pending,development:pending,xssr:catalog.heroes.length};}
function copy(locale){const value=require('../../data/xssr-copy.json').locales[locale];if(!value)throw Error('Missing X-SSR locale '+locale);return value;}
module.exports={record,officialHeroes,heroes,counts,copy};
