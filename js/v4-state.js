(function(root){
 'use strict';
 const TABS=['formation','vs','growth'],MAX_BYTES=12000;
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
 function validate(state){
  if(!plain(state)||state.schema!==1||!TABS.includes(state.tab)||!plain(state.plans))throw Error('invalidState');
  if(Object.keys(state).some(k=>!['schema','tab','plans'].includes(k))||Object.keys(state.plans).some(k=>!TABS.includes(k)))throw Error('invalidState');
  let count=0;
  function visit(value,depth){
   if(++count>1600||depth>9)throw Error('invalidState');
   if(value===null||typeof value==='boolean')return;
   if(typeof value==='number'){if(!Number.isSafeInteger(value)||value<0)throw Error('invalidState');return;}
   if(typeof value==='string'){if(value.length>160||/[\u0000-\u001f\u007f]/u.test(value))throw Error('invalidState');return;}
   if(Array.isArray(value)){if(value.length>120)throw Error('invalidState');value.forEach(v=>visit(v,depth+1));return;}
   if(!plain(value)||Object.keys(value).length>160)throw Error('invalidState');
   for(const[k,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k)||k.length>80)throw Error('invalidState');visit(v,depth+1);}
  }
  for(const value of Object.values(state.plans)){if(!plain(value))throw Error('invalidState');visit(value,0);}
  const text=JSON.stringify(state);if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('invalidState');return JSON.parse(text);
 }
 function empty(){return{schema:1,tab:'formation',plans:{}};}
 function encode(state){const bytes=new TextEncoder().encode(JSON.stringify(validate(state)));let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
 function decode(value){
  if(typeof value!=='string'||value.length>MAX_BYTES*1.4||!value.length||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('invalidState');
  try{const raw=atob(value.replaceAll('-','+').replaceAll('_','/'));return validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))));}catch{throw Error('invalidState');}
 }
 function fromHash(hash){if(/^#v4=/.test(hash))return decode(hash.slice(4));const tab=hash.match(/^#v4-(formation|vs|growth)$/)?.[1];return tab?{...empty(),tab}:null;}
 function url(location,state){const u=new URL(typeof location==='string'?location:location.href,'https://tilessurvive.net');u.search='';u.hash='v4='+encode(state);return u.href;}
 function restore(storage,key){const raw=storage.getItem(key);if(raw===null)return null;if(raw.length>MAX_BYTES)throw Error('invalidState');return validate(JSON.parse(raw));}
 function save(storage,key,state){storage.setItem(key,JSON.stringify(validate(state)));}
 const api={TABS,MAX_BYTES,validate,empty,encode,decode,fromHash,url,restore,save};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TS_V4_STATE=api;
})(typeof window==='object'?window:globalThis);
