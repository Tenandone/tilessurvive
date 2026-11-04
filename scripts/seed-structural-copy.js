'use strict';
// Authored presentation labels. Source values and entity IDs are separate bindings.
const fs=require('node:fs'),path=require('node:path');
const rows={
 'zh-cn':['前置条件','基础时间','秒','天','小时','分钟','秒'],
 ar:['المتطلبات','الوقت الأساسي','ث','ي','س','د','ث'],
 nl:['Vereisten','Basistijd','s','d','u','min','s'],
 fr:['Prérequis','Durée de base','s','j','h','min','s'],
 id:['Persyaratan','Waktu dasar','dtk','h','j','mnt','dtk'],
 it:['Requisiti','Tempo base','s','g','h','min','s'],
 pl:['Wymagania','Czas podstawowy','s','d','godz.','min','s'],
 pt:['Requisitos','Tempo base','s','d','h','min','s'],
 es:['Requisitos','Tiempo base','s','d','h','min','s'],
 sv:['Krav','Grundtid','s','d','h','min','s'],
 th:['ข้อกำหนด','เวลาพื้นฐาน','วินาที','วัน','ชม.','นาที','วินาที'],
 tr:['Gereksinimler','Temel süre','sn','g','sa','dk','sn'],
 vi:['Điều kiện','Thời gian cơ bản','giây','ngày','giờ','phút','giây'],
 ms:['Syarat','Masa asas','s','h','j','min','s'],
 nb:['Krav','Grunntid','s','d','t','min','s']
};
const locales={};
for(const [locale,[requirements,time,seconds,d,h,m,s]]of Object.entries(rows)) {
 const phrases={
  '{{label}} {{amount}}':'{{label}} {{amount}}',
  '{{research}} {{ordinal}} · {{tree}}':'{{research}} {{ordinal}} · {{tree}}',
  '{{research}} {{ordinal}}':'{{research}} {{ordinal}}',
  '{{research}} · {{tree}}':'{{research}} · {{tree}}',
  'Base time {{duration}} ({{exactSeconds}} s)':time+' {{duration}} ({{exactSeconds}} '+seconds+')',
  '{{duration}} ({{exactSeconds}} s)':'{{duration}} ({{exactSeconds}} '+seconds+')',
  '{{duration}}':'{{duration}}'
 };
 for(const before of ['{{building}}','{{building}} {{instance}}'])for(const after of ['', ' · {{from}} → {{to}}',' · {{from}} → {{to}} · {{count}}'])phrases[before+' · Requirements {{profile}}'+after]=before+' · '+requirements+' {{profile}}'+after;
 locales[locale]={phrases,units:{d,h,m,s}};
}
const output={schemaVersion:1,provenance:{method:'Authored locale-specific labels and time abbreviations; values are bound from unchanged source data',nativeSpeakerReview:false},locales};
fs.writeFileSync(path.resolve(__dirname,'../data/i18n/structural-copy.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({locales:Object.keys(locales).length,method:'typed-bindings'}));
