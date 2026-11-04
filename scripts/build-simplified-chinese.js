'use strict';
// Private staging only. Traditional Chinese source documents and data are read-only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const OpenCC = require('opencc-js');
const L = require('./lib/global-localization');
const { enhance } = require('./build-global-locales');
const TARGET = 'zh-cn';
const STAGE = path.resolve(L.ROOT, '../global-language-delivery-20261104/staging/zh-cn');
const REVIEW = path.join(L.ROOT, 'data/i18n/messages/zh-cn-review.json');
const cc = OpenCC.Converter({ from: 'tw', to: 'cn' });
const terms = require('../data/i18n/client-terms.json');
const contextualTerms = require('../data/i18n/contextual-terms.json');
const hasHan = s => /[\u3400-\u9fff]/u.test(s);
const escapeRE = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attributes = ['alt','title','aria-label','placeholder','data-idle','data-results','data-error','data-search-title','data-search-description'];
const metaKeys = new Set(['description','og:title','og:description','twitter:title','twitter:description']);
const manualExact = {
  'TILES SURVIVE · DATABASE': 'TILES SURVIVE · 数据库', 'GUIDES': '攻略',
  'TILES SURVIVE · ITEMS': 'TILES SURVIVE · 道具', 'System': '系统',
  'Asia': '亚洲', 'Europe': '欧洲', 'America': '美洲',
  'Star': '星级', 'Total': '合计', 'Power': '战力', 'Pet Eggs': '宠物蛋',
  'Baby seal': '小海豹', 'Raccoon': '浣熊', 'Turtle': '乌龟', 'Sheep': '绵羊',
  'Starlight deer': '星光鹿', 'Archive': '历史记录', 'LOADING': '正在加载',
  'TW GUIDE': '简体中文攻略', 'Gunners': '枪手', 'Marksmen': '射手',
  'TilesSurvive.net Tools': 'TilesSurvive.net 工具', 'Event Helper': '活动助手',
  'FAQ': '常见问题', 'via LootBar': '通过 LootBar',
  '點點木作戰': '点点大作战',
  'Breadcrumb':'面包屑导航', 'SEO summary':'页面摘要', 'Discount':'优惠', 'Close':'关闭',
  'Advanced Recruitment Token':'高级招募地图', '20h universal Speedup':'20h 通用加速',
  'play mindset':'游戏心态', 'old server caution':'老服务器注意事项',
  'alliance choice note':'选择联盟的提示', 'common speedup note':'通用加速提示',
  'speedup advice':'加速使用建议', 'final note':'最后提示', 'Guide CTA':'相关攻略',
  'quick notes':'简要提示', 'Important notice':'重要提示', 'promotion note':'优惠提示',
  'Top-up CTA':'充值说明', 'Ready account note':'准备账号的提示',
  '2FA check note':'2FA 检查提示', 'quick reassurance':'简要确认', 'Password note':'密码提示',
};
// Website terminology, not game entity names. Official names are protected first.
const editorialPhrases = {
  '資料庫': '数据库', '搜尋': '搜索', '行事曆': '日历', '儲值': '充值',
  '伺服器': '服务器', '影片': '视频', '連結': '链接', '選單': '菜单',
  '重設': '重置', '裝置': '设备', '檔案': '文件', '預設': '默认',
  '設定': '设置', '資料': '数据', '資訊': '信息', '滑鼠': '鼠标', '佇列':'队列',
  '載入':'加载', '擷取':'提取', '捲動':'滚动', '欄位':'列', '帳號':'账号',
  '聯盟行銷揭露':'推广合作披露', '聯盟揭露':'推广合作披露', '聯盟連結':'推广链接',
  '聯絡我們':'联系我们', '使用者':'用户',
  '聯絡':'联系', '新分頁':'新标签页', '頁籤':'标签页', '營運':'运营',
  '紀錄':'记录', '取得方式':'获取方式', '串連':'关联', '發電所':'发电厂',
  '點點木作戰': '点点大作战',
};
const englishPhrases = {
  'Wild boar': '野猪', 'Starlight deer': '星光鹿', 'ATK bonus': '攻击力加成',
  'Developer Feedback': '开发者反馈', 'Patch Notes': '更新说明',
  'September 11': '九月 11 日', 'Blue': '蓝色', 'Purple': '紫色', 'Gold': '金色',
  'Buff': '增益', 'hound': '猎犬', 'Tier':'阶段', 'Total':'合计', 'App':'应用',
  'game screenshot':'游戏截图', 'skill level evidence':'技能等级依据', 'MAX':'满级',
  'Advanced Recruitment Token':'高级招募地图', 'universal Speedup':'通用加速',
  'Spray ‘n’ Pray':'喷喷喷', 'Gunners':'枪手', 'Marksmen':'射手',
};
const retainedEnglish = new Set([
  'Top-up Now','Pay Now','Got it', // Instructions refer to actual third-party button text.
  'Tiles Survive','TILES SURVIVE','Tiles Survive Guide','TilesSurviveGuide',
  'LDShop','TilesMania','LootBar','Discord','YouTube','YouTube Shorts',
]);
const retainedSourceNames = /Arcadian Conquest|State Clash|Dragon Isle|\bLight\b|\bNight\b|\bFrost\b|\bFire\b|Reservoir: Glory Clash|Wall of Honor|Underground Goldmine|Player One|Rolex|\bPad\b|Shorts|Windows|macOS|\bSLG\b|KvK|3v3 Arena/;
const pageEntityAliases = [
  {page:'/heroes/candy/',source:'蔡宜葵',key:'survivor_candy_name'},
  {page:'/heroes/lagnar/',source:'拉格納',key:'survivor_ragnar_name'},
  {page:'/heroes/rusty/',source:'拉斯提',key:'survivor_rusty_name'},
  {page:'/heroes/shark/',source:'鯊克',key:'survivor_shark_name'},
];
const legacyAliases = {
  '/zh-tw/heroes/legend-gear-star/':'/zh-tw/database/legend-gear-star/',
  '/zh-tw/seasons/season-1-wave-of-fury/':'/zh-tw/seasons/season-1/',
  '/zh-tw/seasons/season-2-awakening-of-manryong/':'/zh-tw/seasons/season-2/',
  '/zh-tw/seasons/season-3-undecided/':'/zh-tw/seasons/season-3/',
  '/zh-tw/event-helper/':'/zh-tw/tools/event-helper/',
};
function numericSequence(s) {
  return (String(s).match(/[+−-]?\d+(?:(?:,\d{3})+|(?:\.\d+))*/g) || []).map(x=>x.replace(/,/g,'').replace(/−/g,'-'));
}
function protectedText(before, after, context) {
  assert.deepEqual(numericSequence(after), numericSequence(before), 'Numeric text changed: '+context+' '+before);
  assert.deepEqual(L.placeholders(after), L.placeholders(before), 'Placeholder changed: '+context);
}
function officialCatalog() {
  const exact = new Map(), ambiguous = new Map(), differences = [];
  for (const [key, values] of Object.entries(terms.terms)) {
    if (!values['zh-cn']) continue;
    if (values['zh-tw'] && cc(values['zh-tw']) !== values['zh-cn']) differences.push({key,traditional:values['zh-tw'],automatic:cc(values['zh-tw']),official:values['zh-cn']});
    // id_level means base level in this client; a generic level heading does not.
    if (key === 'id_level') continue;
    for (const language of ['zh-tw','en']) {
      const source = values[language]; if (!source) continue;
      const old = exact.get(source), entry = {source,target:values['zh-cn'],keys:[key],sourceLanguage:language};
      if (old && old.target !== entry.target) { ambiguous.set(source,[old,entry]); exact.delete(source); }
      else if (!ambiguous.has(source)) { if(old)old.keys.push(key);else exact.set(source,entry); }
    }
  }
  const names = [...exact.values()].filter(x => x.keys.some(k=>/name/.test(k)||k==='building_conscription') && x.source.length >= 2 && (hasHan(x.source) || x.source.length >= 4));
  names.sort((a,b)=>b.source.length-a.source.length);
  return {exact,names,ambiguous,differences};
}
function createConverter() {
  const catalog = officialCatalog(), corrections = new Map(), residue = new Map();
  const nameRE = new RegExp(catalog.names.map(x=>escapeRE(x.source)).join('|'),'gu');
  const named = new Map(catalog.names.map(x=>[x.source,x]));
  const regionalRE = new RegExp(Object.keys(editorialPhrases).sort((a,b)=>b.length-a.length).map(escapeRE).join('|'),'gu');
  const englishRE = new RegExp('\\b(?:'+Object.keys(englishPhrases).sort((a,b)=>b.length-a.length).map(escapeRE).join('|')+')\\b','gu');
  function record(source,target,kind,context,keys=[]) {
    const id = kind+'\0'+source+'\0'+target;
    if(!corrections.has(id))corrections.set(id,{source,target,kind,keys,occurrences:0,contexts:[]});
    const row=corrections.get(id);row.occurrences++;if(row.contexts.length<6&&!row.contexts.includes(context))row.contexts.push(context);
  }
  function plain(s,context) {
    s=s.replace(regionalRE,source=>{record(source,editorialPhrases[source],'editorial-regional',context);return editorialPhrases[source];});
    return cc(s).replace(englishRE,source=>{record(source,englishPhrases[source],'reviewed-English-residue',context);return englishPhrases[source];});
  }
  function convert(raw,context='') {
    if(typeof raw!=='string'||!raw.trim())return raw;
    const source=raw.trim();
    if(/^(?:https?:\/\/|mailto:)/.test(source)||/^[/#][A-Za-z0-9][^\s]*$/.test(source)&&!hasHan(source))return raw;
    if(context.includes('/heroes/undine/')) {
      const entry=contextualTerms.entries.find(row=>row.groupId==='heroes/undine/');
      const name=entry.names['zh-cn'].value;
      const aliases=entry.sourceAliases['zh-tw'];
      let resolved=source;
      for(const alias of aliases)resolved=resolved.split(alias).join(name);
      if(resolved!==source) {
        let target=convert(resolved,context);
        // The cited external page used the old label. Preserve that history
        // without treating it as the name of Travis's unrelated skill.
        if(source.includes('507.35')&&source.includes('8.34'))target=target.replace(name,name+'（原文旧称“Wild Hunt”）');
        protectedText(source,target,context);
        record(source,target,'reviewed-skill-slot-alias',context,[entry.clientKey]);
        return raw.replace(raw.trim(),target);
      }
    }
    if(context.includes('/heroes/shark/')) {
      // Legacy editorial aliases refer to the same four retained skill slots.
      // Resolve those aliases before the shorter hero name can split a phrase.
      const aliases={'Wave Crash':'survivor_shark_attack_name_newse','Shark Wave':'survivor_shark_skill_1_name_newse','Frontline Support':'survivor_shark_skill_2_name_newse','Deep Sea Invincible':'survivor_shark_skill_3_name_newse','深海之錨':'exclusive_weapon_name_shark','深海之锚':'exclusive_weapon_name_shark'};
      const used=[];let resolved=source;
      for(const [alias,key] of Object.entries(aliases))if(resolved.includes(alias)){resolved=resolved.split(alias).join(terms.terms[key]['zh-cn']);used.push(key);}
      if(resolved!==source){const target=convert(resolved,context);protectedText(source,target,context);record(source,target,'reviewed-skill-slot-alias',context,used);return raw.replace(raw.trim(),target);}
    }
    if(/[A-Za-z]{3}/.test(source.replace(/\{[^{}]*\}|<[^>]+>/g,''))&&!L.invariant(source)) {
      if(!residue.has(source))residue.set(source,{source,contexts:[],target:null,status:'pending'});
      const r=residue.get(source);if(r.contexts.length<4&&!r.contexts.includes(context))r.contexts.push(context);
    }
    let target;
    if(/pet-system/.test(context)&&['Snowball','Hardhead'].includes(source)) {
      const key=source==='Snowball'?'pet_seal_normal_name':'pet_armored_boar_normal_name';
      target=terms.terms[key]['zh-cn'];record(source,target,'reviewed-entity-alias',context,[key]);
    } else if(context.includes('/heroes/shark/')&&/鯊克技能/.test(source)) {
      const aliases={'鯊克技能 Wave Crash':'survivor_shark_attack_name_newse','鯊克技能 Shark Wave':'survivor_shark_skill_1_name_newse','鯊克技能 沙克 Wave':'survivor_shark_skill_1_name_newse','鯊克技能 Frontline Support':'survivor_shark_skill_2_name_newse','鯊克技能 Deep Sea Invincible':'survivor_shark_skill_3_name_newse'};
      const key=aliases[source];target=key?'沙克技能 '+terms.terms[key]['zh-cn']:undefined;
      if(target)record(source,target,'reviewed-entity-alias',context,[key]);
    }
    if(target!==undefined) { /* Page-specific alias already resolved by entity. */ }
    else if(Object.hasOwn(manualExact,source)){target=manualExact[source];record(source,target,'reviewed-exact',context);}
    else if(catalog.exact.has(source)) {
      const entry=catalog.exact.get(source);target=entry.target;record(source,target,'official-exact',context,entry.keys);
    } else {
      let at=0;target='';nameRE.lastIndex=0;
      for(const match of source.matchAll(nameRE)) {
        const entry=named.get(match[0]), i=match.index;
        // English names require word boundaries. Numeric resource strings stay whole.
        if(!hasHan(entry.source) && (/[A-Za-z0-9]/.test(source[i-1]||'')||/[A-Za-z0-9]/.test(source[i+entry.source.length]||'')))continue;
        target+=plain(source.slice(at,i),context)+entry.target;at=i+entry.source.length;
        record(entry.source,entry.target,'official-name',context,entry.keys);
      }
      target+=plain(source.slice(at),context);
      target=target.replace(/\bPHASE (\d+)\b/g,'阶段 $1').replace(/\bTier (\d+)\b/g,'阶段 $1')
        .replace(/^Star(?=\s*[↑↓])/,'星级').replace(/^Total(?=\s*[:↑↓])/,'合计').replace(/\bgear(\d+)\b/g,'装备 $1');
    }
    for(const alias of pageEntityAliases)if(context.includes(alias.page)&&source.includes(alias.source)) {
      const official=terms.terms[alias.key]?.['zh-cn'];assert.ok(official,'Missing official entity alias '+alias.key);
      target=target.split(cc(alias.source)).join(official);record(alias.source,official,'reviewed-page-entity-alias',context,[alias.key]);
    }
    protectedText(source,target,context);
    if(residue.has(source)){
      const r=residue.get(source);r.target=target;
      r.status=target!==cc(source)?'localized-or-partially-localized':retainedEnglish.has(source)||retainedSourceNames.test(source)||/https?:|\.com\b|\.net\b|UTC|GMT|CET|CEST|\b(?:SSR|SR|VIP|EXP|ATK|DEF|HP|PvP|PvE|ID|AND|OR|JavaScript)\b|\b[IVX]{2,}\b|Tile|TILES|LootBar|Discord|YouTube|Google|Facebook|FunPlus|iOS|Android|PayPal|VIP\d|^Lv\./.test(source)?'retained-brand-identifier-or-notation':'needs-context-review';
    }
    return raw.replace(raw.trim(),target);
  }
  return {convert,catalog,corrections,residue};
}
function makeRouter(groups) {
  const byTraditional=new Map(groups.map(g=>[g.routes['zh-tw'],g.routes[TARGET]]));
  const unmatched=new Set();
  function route(value) {
    if(typeof value!=='string'||!(/^(?:https:\/\/tilessurvive\.net)?\/zh-tw(?:\/|$)/.test(value)))return value;
    const absolute=value.startsWith('https://'), parsed=new URL(value,L.publicOrigin), target=byTraditional.get(legacyAliases[parsed.pathname]||parsed.pathname);
    if(!target){unmatched.add(value);return value;}
    return (absolute?L.publicOrigin:'')+target+parsed.search+parsed.hash;
  }
  return {route,unmatched};
}
function jsonConvert(value,convert,route,context,key='') {
  if(Array.isArray(value))return value.map((x,i)=>jsonConvert(x,convert,route,context+'['+i+']',key));
  if(value&&typeof value==='object') {
    if(Object.hasOwn(value,'zh-tw') && (Object.hasOwn(value,'en')||Object.hasOwn(value,'ko'))) {
      return {...value,[TARGET]:jsonConvert(value['zh-tw'],convert,route,context+'.zh-cn')};
    }
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,jsonConvert(v,convert,route,context+'.'+k,k)]));
  }
  if(typeof value!=='string')return value;
  if(['lang','language','inLanguage'].includes(key)&&/^zh(?:-|_)(?:tw|hant)$/i.test(value))return key==='inLanguage'?'zh-CN':TARGET;
  if(key==='locale'&&/^zh(?:-|_)(?:tw|hant)$/i.test(value))return 'zh-CN';
  const routed=route(value);if(routed!==value)return routed;
  const displayCopy=/(?:\.(?:copy|ui|dayLabels|labels|zh-cn)\b|^runtime:|^(?:ts3|event-calendar)-copy(?:\.|$))/.test(context);
  if(!displayCopy&&(L.nonDisplay.has(key)||key==='search'||/^(?:originalName|source|raw|internal|asset|image|icon)/i.test(key)||context.includes('.links.')||['query-input','item','activation','promotion','bonusDisplay','logic','timeBasis','condition','unit'].includes(key)&&!hasHan(value)))return value;
  if(!hasHan(value)&&!L.contentKeys.has(key)&&!/(?:\.(?:copy|ui|dayLabels|labels|zh-cn)\b|^runtime:)/.test(context))return value;
  return convert(value,context);
}
const literalRE = /"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'/g;
function literalSkeleton(code){return code.replace(literalRE,'__STRING__');}
function inlineConvert(code,convert,route,context) {
  const known=code.includes('const LANG_DATA')||code.includes('const CODE_LABELS')||code.includes("params.get('view') === 'landscape'");
  if(!known)return code;
  const result=code.replace(literalRE,token=>{
    const quote=token[0];let value=token.slice(1,-1);
    if(!hasHan(value)&&!/^zh-(?:tw|TW)$/.test(value)&&route(value)===value)return token;
    if(value.includes('\\'))return token; // Escaped data recognition literals are not labels.
    value=/^zh-(?:tw|TW)$/.test(value)?(value==='zh-TW'?'zh-CN':TARGET):route(convert(value,context+':inline-label'));
    return quote+value.replace(/\\/g,'\\\\').split(quote).join('\\'+quote)+quote;
  });
  assert.equal(literalSkeleton(result),literalSkeleton(code),'Executable code changed: '+context);
  new vm.Script(result,{filename:context});
  return result;
}
function immutableJSON(before,after,context) {
  if(Array.isArray(before)) {assert.equal(after.length,before.length,context);before.forEach((x,i)=>immutableJSON(x,after[i],context+'['+i+']'));return;}
  if(before&&typeof before==='object') {for(const[k,v]of Object.entries(before))immutableJSON(v,after[k],context+'.'+k);return;}
  if(typeof before==='number'||typeof before==='boolean'||before===null)assert.deepEqual(after,before,context);
  else if(typeof before==='string')protectedText(before,after,context);
}
function featurePayloads(document,convert,route) {
  const features={},uses=name=>!!document.querySelector('script[src^="/js/'+name+'.js"]');
  if(uses('data-workbench-30'))features.dataWorkbench=jsonConvert(require('../js/data-workbench-30').copy['zh-tw'],convert,route,'runtime:dataWorkbench');
  if(uses('tools-speedup-calculator')||document.querySelector('[data-speedup-calculator-page]'))features.speedup=jsonConvert(require('../js/tools-speedup-calculator').UI['zh-tw'],convert,route,'runtime:speedup');
  if(uses('event-helper')||document.querySelector('[data-event-helper-page]')) {
    const eventModule=require('../js/event-helper');
    features.eventHelper=jsonConvert({ui:eventModule.UI['zh-tw'],dayLabels:eventModule.DAY_LABELS['zh-tw']},convert,route,'runtime:eventHelper');
    for(const kind of ['events','calculators']) {
      const input=L.readJSON(path.join(L.ROOT,'data/event-helper-'+kind+'.json'));
      const translated=jsonConvert(input,convert,route,'runtime:event-helper-'+kind);
      immutableJSON(input,translated,'event-helper-'+kind);
      L.jsonScript(document,'event-helper-'+kind+'-data',translated);
    }
  }
  return features;
}
function validateRouteManifest(groups) {
  const ids=groups.map(group=>group.id);
  assert.equal(new Set(ids).size,ids.length,'Duplicate canonical translation route');
  assert.equal(ids.length,121,'The reviewed atlas release adds only one canonical route');
  assert(ids.includes('heroes/lava/'),'Missing reviewed Lava detail route');
  assert.equal(L.digest(JSON.stringify(ids.filter(id=>id!=='heroes/lava/').sort())),'a4bd34aedfa52874c8c2dcd2a27ee3ba346fb876bfe3df8ccbfa293b586882b7','The original 120 canonical routes must remain exact');
  return true;
}
// Pure page projection shared by staging and focused owner-regeneration tests.
function localizePage(source,group,groups,{converter=createConverter(),router=makeRouter(groups),ui=L.readJSON(path.join(L.ROOT,'data/i18n/ui/zh-cn.json')),available=[...L.existing,TARGET]}={}) {
    const sourceFile=group.routes['zh-tw'].slice(1)+'index.html';
    require('./build-hero-pet-pages').validateOwnership(source,'zh-tw');
    if(source.includes('data-hero-atlas-owned'))require('./build-hero-atlas').validateOwnership(source,'zh-tw',group.routes['zh-tw']);
    let numericJSONLeaves=0;
    const {document}=parseHTML(source),beforeIds=[...document.querySelectorAll('[id]')].map(e=>e.id),beforeMedia=[...document.querySelectorAll('img,iframe,video,source')].map(e=>e.getAttribute('src'));
    const protectedExternal=[...document.querySelectorAll('[href],[src]')].flatMap(e=>['href','src'].filter(a=>/^https?:/.test(e.getAttribute(a)||'')&&!e.getAttribute(a).startsWith(L.publicOrigin)).map(a=>[e.tagName,a,e.getAttribute(a)]));
    const convert=(v,where)=>converter.convert(v,sourceFile+':'+where),walker=document.createTreeWalker(document,4),nodes=[];let node;
    while((node=walker.nextNode()))if(!node.parentElement?.closest('script,style,.ts3-language nav,.language-switcher,[data-hero-atlas-owned],[data-hero-pet-owned]'))nodes.push(node);
    for(const n of nodes)n.data=convert(n.data,'text:'+n.parentElement?.tagName);
    document.documentElement.lang='zh-Hans';document.documentElement.setAttribute('data-lang',TARGET);document.documentElement.dir='ltr';
    for(const el of document.querySelectorAll('*')) {
      if(el.closest('[data-hero-atlas-owned],[data-hero-pet-owned]'))continue;
      for(const attr of attributes)if(el.hasAttribute(attr))el.setAttribute(attr,convert(el.getAttribute(attr),attr));
      for(const attr of ['href','action','data-search-url'])if(el.hasAttribute(attr)&&!el.matches('link[rel="alternate"],a[hreflang],.ts3-language a[lang]'))el.setAttribute(attr,router.route(el.getAttribute(attr)));
      if(el.hasAttribute('lang')&&/^zh-(tw|hant)$/i.test(el.getAttribute('lang'))&&!el.matches('a'))el.setAttribute('lang','zh-Hans');
      if(el.hasAttribute('data-lang')&&el.getAttribute('data-lang')==='zh-tw')el.setAttribute('data-lang',TARGET);
      if(el.tagName==='META') {
        const key=el.getAttribute('name')||el.getAttribute('property');
        if(metaKeys.has(key))el.setAttribute('content',convert(el.getAttribute('content')||'','meta:'+key));
        if(['og:url','twitter:url'].includes(key))el.setAttribute('content',router.route(el.content));
        if(key==='og:locale')el.setAttribute('content','zh_CN');
      }
    }
    for(const script of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
      if(script.closest('[data-hero-atlas-owned],[data-hero-pet-owned]'))continue;
      const value=JSON.parse(script.textContent),translated=jsonConvert(value,convert,router.route,script.id||'json');
      if(script.hasAttribute('data-building-system-model') && translated.locale)translated.locale.numberLocale='zh-CN';
      immutableJSON(value,translated,sourceFile+':'+(script.id||'json'));
      if(script.id==='research-phase3-data')for(const groupRow of translated.groups||[]) {
        groupRow.search=(groupRow.search+' '+groupRow.name).normalize('NFKC').toLocaleLowerCase();
      }
      const count=v=>typeof v==='number'?1:Array.isArray(v)?v.reduce((a,b)=>a+count(b),0):v&&typeof v==='object'?Object.values(v).reduce((a,b)=>a+count(b),0):0;
      numericJSONLeaves+=count(value);
      script.textContent=JSON.stringify(translated).replace(/</g,'\\u003c');
    }
    let protectedPrograms=0,localizedPrograms=0;
    for(const script of document.querySelectorAll('script:not([src])'))if(!script.type?.includes('json')&&!script.closest('[data-hero-atlas-owned],[data-hero-pet-owned]')) {
      const before=script.textContent,after=inlineConvert(before,convert,router.route,sourceFile);
      script.textContent=after;if(before===after)protectedPrograms++;else localizedPrograms++;
    }
    document.querySelector('link[rel="canonical"]').href=L.publicOrigin+group.routes[TARGET];
    // The common selector is data-driven; publish only known page alternatives in this preview.
    for(const nav of document.querySelectorAll('.ts3-language nav,.language-switcher')) {
      nav.replaceChildren();for(const code of available) {
        const info=L.byCode.get(code),a=document.createElement('a');a.href=group.routes[code];a.hreflang=info.hreflang;a.lang=info.htmlLang;a.textContent=info.nativeName;
        if(code===TARGET)a.setAttribute('aria-current','page');nav.append(a);
      }
    }
    assert.deepEqual([...document.querySelectorAll('[id]')].map(e=>e.id),beforeIds,'DOM IDs changed: '+sourceFile);
    assert.deepEqual([...document.querySelectorAll('img,iframe,video,source')].map(e=>e.getAttribute('src')),beforeMedia,'Media changed: '+sourceFile);
    assert.deepEqual([...document.querySelectorAll('[href],[src]')].flatMap(e=>['href','src'].filter(a=>/^https?:/.test(e.getAttribute(a)||'')&&!e.getAttribute(a).startsWith(L.publicOrigin)).map(a=>[e.tagName,a,e.getAttribute(a)])),protectedExternal,'External services or ads changed: '+sourceFile);
    const features=featurePayloads(document,convert,router.route);
    const html=enhance(document,TARGET,group,available,{...ui,featureCopies:{...features,...ui.featureCopies}},{preview:true});
    return {html,sourceFile,numericJSONLeaves,protectedPrograms,localizedPrograms,ids:beforeIds.length,media:beforeMedia.length,featureCopies:Object.keys(features)};
}
function build() {
  assert.equal(L.readJSON(path.join(L.ROOT,'node_modules/opencc-js/package.json')).version,'1.4.2','OpenCC version changed; review conversion first');
  const groups=L.routeGroups(),converter=createConverter(),router=makeRouter(groups),ui=L.readJSON(path.join(L.ROOT,'data/i18n/ui/zh-cn.json'));
  validateRouteManifest(groups);assert.ok(ui?.copy,'Simplified Chinese UI is required');
  const pages=[],outputs=[],available=[...L.existing,TARGET];
  let numericJSONLeaves=0;
  for(const group of groups) {
    const sourceFile=group.routes['zh-tw'].slice(1)+'index.html',source=fs.readFileSync(path.join(L.ROOT,sourceFile),'utf8');
    const converted=localizePage(source,group,groups,{converter,router,ui,available}),{html,...stats}=converted;
    numericJSONLeaves+=converted.numericJSONLeaves;
    const output=path.join(STAGE,group.routes[TARGET].slice('/zh-cn/'.length),'index.html');
    assert.ok(output.startsWith(STAGE+path.sep),'Outside staging destination');
    outputs.push({output,html});pages.push({source:sourceFile,target:group.routes[TARGET],sourceSHA256:L.digest(source),outputSHA256:L.digest(html),protectedPrograms:stats.protectedPrograms,localizedPrograms:stats.localizedPrograms,ids:stats.ids,media:stats.media,featureCopies:stats.featureCopies,validation:'pass'});
  }
  const report={schemaVersion:1,locale:TARGET,mode:'private-preview',sourceLocale:'zh-tw',sourcePageCount:pages.length,opencc:{package:'opencc-js',version:'1.4.2',from:'tw',to:'cn'},
    policy:{sourceReadOnly:true,publicOutputsWritten:false,conversionAloneIsNotTranslationReview:true,nativeSpeakerReviewed:false,contextualReview:'Official entity differences, generic level exception, website regional terminology, inherited English labels and representative prose reviewed; browser runtime not verified in this generator.',
      excludedOfficialKeys:[{key:'id_level',source:'等級',official:'基地等级',reason:'Generic level headings also describe hero, pet, skill and building levels; require an explicit base-level key context.'}]},
    validation:{pages:pages.length,numericJSONLeaves,idsPreserved:true,mediaPreserved:true,externalServiceAndAdURLsPreserved:true,unmodifiedExecutableSkeletons:true,researchSearch:'Original multilingual terms retained; simplified name appended to search index.',unmatchedSourceRoutes:[...router.unmatched]},
    reviewedSamples:{proseAndInterface:['/','about/','codes/','heroes/knotty/','heroes/ghost/','heroes/shark/','buildings/lumberyard/','database/research/','events/calendar/','tools/event-helper/','guides/reservoir-raid/','privacy/','terms/','affiliate-disclosure/'],heroHeadingsAndIntroductions:28,scope:'Direct static text review, not a rendered browser review. All pages additionally undergo structural and numeric checks.'},
    legacyRouteCorrections:legacyAliases,retainedEnglishPolicy:'External-source event titles without a verified official Chinese key, product/person/pet names in narrative, real external UI button labels, notation and source domains remain identifiable. They are recorded separately from translated English labels.',
    officialDifferences:converter.catalog.differences,ambiguousOfficialSources:[...converter.catalog.ambiguous].map(([source,entries])=>({source,entries})),
    corrections:[...converter.corrections.values()],inheritedEnglishResidues:[...converter.residue.values()],pages};
  L.safeWrite(REVIEW,JSON.stringify(report,null,2)+'\n');
  assert.equal(router.unmatched.size,0,'Unmapped source routes; review JSON written, no pages staged');
  for(const{output,html}of outputs)L.safeWrite(output,html);
  console.log(JSON.stringify({pages:pages.length,numericJSONLeaves,officialDifferences:report.officialDifferences.length,corrections:report.corrections.length,sourceEnglishResidues:report.inheritedEnglishResidues.length,unresolvedResidues:report.inheritedEnglishResidues.filter(x=>x.status==='needs-context-review').length,stage:STAGE}));
  return report;
}
function selfTest() {
  const t=createConverter(),groups=L.routeGroups(),r=makeRouter(groups);let cases=0;
  assert.equal(t.convert('派對蛋糕'),'派对松糕');cases++;
  assert.equal(t.convert('等級'),'等级');cases++;
  assert.equal(t.convert(' / 荒野 · R · 遠程'),' / 荒野 · R · 远程');cases++;
  assert.equal(t.convert('#s4qU 額外福利'),'#s4qU 额外福利');cases++;
  assert.equal(t.convert('木材廠 Lv.1 → 2: 1,000 木材'),'木材工坊 Lv.1 → 2: 1,000 木材');cases++;
  assert.equal(t.convert('此帳號有{count}個道具'),'此账号有{count}个道具');cases++;
  assert.equal(t.convert('Wave Crash、Shark Wave、Frontline Support、Deep Sea Invincible 與深海之錨','/heroes/shark/:meta'),'浪涛砸击、鲨鱼潮涌、前排援护、深海霸体 与深海巨锚');cases++;
  assert.equal(t.convert('Wild Hunt','/heroes/undine/:text'),'远洋共振');cases++;
  assert.equal(t.convert('狂獵天賦・友軍後排攻擊','/heroes/undine/:json'),'远洋共振・友军后排攻击');cases++;
  assert.equal(t.convert('Wild Hunt','/heroes/travis/:text'),terms.terms.survivor_travis_skill_2_name_newse['zh-cn']);cases++;
  assert.match(t.convert('外部詳細頁列出Azure Anthem 507.35% ATK與Wild Hunt 8.34% ATK，但未標示技能等級。','/heroes/undine/:text'),/远洋共振（原文旧称“Wild Hunt”）/);cases++;
  assert.equal(r.route('/zh-tw/heroes/tarzan/?q=one#skills'),'/zh-cn/heroes/tazan/?q=one#skills');cases++;
  assert.equal(r.route('https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive'),'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive');cases++;
  const input={lang:'zh-tw',id:'800003',name:{en:'Lumber Mill','zh-tw':'木材廠',ja:'木材工場'},cost:[100,0,null],links:{800003:'lumberyard'}};
  const output=jsonConvert(input,t.convert,r.route,'test');assert.equal(output.name['zh-cn'],'木材工坊');assert.equal(output.name.ja,input.name.ja);assert.deepEqual(output.cost,input.cost);assert.equal(output.links['800003'],'lumberyard');assert.equal(output.id,input.id);assert.equal(input.lang,'zh-tw');cases++;
  const program='const CODE_LABELS = {copy: "複製"}; const total = 60 * 1000; new Intl.DateTimeFormat("zh-TW");';
  const changed=inlineConvert(program,t.convert,r.route,'test');assert.equal(literalSkeleton(program),literalSkeleton(changed));assert.ok(changed.includes('"复制"'));assert.ok(changed.includes('"zh-CN"'));cases++;
  assert.throws(()=>protectedText('12,000','13,000','negative-test'));assert.throws(()=>protectedText('{count}','{total}','negative-test'));cases++;
  let schemaCount=0,originalJsonCount=0;
  for(const group of groups) {
    const outputFile=path.join(STAGE,group.routes[TARGET].slice('/zh-cn/'.length),'index.html');
    const {document:d}=parseHTML(fs.readFileSync(outputFile,'utf8'));
    assert.equal(d.documentElement.lang,'zh-Hans');assert.equal(d.documentElement.dataset.lang,TARGET);
    assert.equal(d.querySelector('link[rel="canonical"]').href,L.publicOrigin+group.routes[TARGET]);
    assert.equal(d.querySelector('meta[name="robots"]').content,'noindex,nofollow');
    const alternate=[...d.querySelectorAll('link[rel="alternate"][hreflang]')];assert.equal(alternate.length,8);
    assert.equal(alternate.find(x=>x.hreflang==='zh-CN').href,L.publicOrigin+group.routes[TARGET]);
    const walk=d.createTreeWalker(d,4);let n;
    while((n=walk.nextNode()))if(!n.parentElement?.closest('script,style,.ts3-language,.language-switcher'))assert.equal(cc(n.data),n.data,'Remaining traditional text: '+group.id+' '+n.data.trim());
    for(const s of d.querySelectorAll('script[type="application/ld+json"]')) {
      const v=JSON.parse(s.textContent);schemaCount++;
      const check=(x,k)=>{if(x&&typeof x==='object')Object.entries(x).forEach(([a,b])=>check(b,a));else if(k==='inLanguage')assert.ok(['zh-cn','zh-CN','zh-Hans'].includes(x),group.id+' '+x);};check(v);
    }
    for(const s of d.querySelectorAll('script[type="application/json"]')) {JSON.parse(s.textContent);originalJsonCount++;}
    const pageUI=JSON.parse(d.getElementById('ts-global-ui').textContent);assert.equal(pageUI.locale,TARGET);assert.equal(pageUI.copy.search,'搜索');
  }
  const research=parseHTML(fs.readFileSync(path.join(STAGE,'database/research/index.html'),'utf8')).document;
  const model=JSON.parse(research.getElementById('research-phase3-data').textContent);
  assert.equal(model.copy.kind,'参照类型');assert.equal(model.copy.target,'参照对象');assert.equal(model.copy.search,'搜索研究');
  for(const value of Object.values(model.copy))if(typeof value==='string')assert.equal(cc(value),value,'Traditional research UI copy');cases++;
  assert.ok(model.groups.every(g=>g.search.includes(g.name.normalize('NFKC').toLocaleLowerCase())));cases++;
  console.log(JSON.stringify({selfTests:cases,pages:groups.length,schemaCount,jsonBlocks:originalJsonCount,traditionalVisibleResidues:0,status:'PASS'}));
}
module.exports={createConverter,jsonConvert,inlineConvert,makeRouter,numericSequence,localizePage,validateRouteManifest,build,selfTest};
if(require.main===module){if(process.argv.includes('--self-test'))selfTest();else build();}
