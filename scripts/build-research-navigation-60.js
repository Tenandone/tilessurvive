'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),langs=['ko','en','ja','ru','zh-tw','de'];
const routes=['database','buildings/lab'];
const copy={
 ko:{title:'연구 탐색기',text:'연구 이름을 검색하고 각 연구의 레벨별 전투력 기여값과 설정에 연결된 건물·연구 조건을 살펴보세요.',link:'연구 그룹과 레벨 탐색'},
 en:{title:'Research explorer',text:'Search research names and inspect each research’s power contribution at each level and configured building and research references.',link:'Explore research groups and levels'},
 ja:{title:'研究エクスプローラー',text:'研究名を検索し、各研究がそのレベルで寄与する戦闘力と設定上の建物・研究条件を確認できます。',link:'研究グループとレベルを見る'},
 ru:{title:'Обозреватель исследований',text:'Ищите исследования по названию, смотрите вклад каждого исследования в мощь на выбранном уровне и связанные условия зданий и исследований из настроек.',link:'Открыть группы и уровни исследований'},
 'zh-tw':{title:'研究探索器',text:'搜尋研究名稱，查看各項研究在指定等級的戰力貢獻值，以及設定中連結的建築、研究條件。',link:'探索研究群組與等級'},
 de:{title:'Forschungsübersicht',text:'Suche Forschungsnamen und sieh den Kampfkraftbeitrag jeder Forschung je Stufe sowie verknüpfte Gebäude- und Forschungsbedingungen aus der Konfiguration.',link:'Forschungsgruppen und Stufen erkunden'}
};
function project(html,lang,route){
 assert(langs.includes(lang)&&routes.includes(route));const d=parseHTML(html).document,t=copy[lang];
 d.querySelectorAll('[data-research-phase3-entry],[data-research-phase3-nav-style]').forEach(n=>n.remove());
 const section=d.createElement('section');section.className='c60-panel';section.setAttribute('data-research-phase3-entry','');
 const h=d.createElement('h2');h.className='c60-heading';h.textContent=t.title;section.append(h);
 const p=d.createElement('p');p.textContent=t.text;section.append(p);
 const a=d.createElement('a');a.href=`/${lang}/database/research/`;a.textContent=t.link;section.append(a);
 if(route==='database'){const hero=d.querySelector('main > .hero-card');assert(hero,'Database hero required');hero.after(section);}
 else{const research=d.querySelector('[data-growth-research-50]');assert(research,'Existing research table required');research.before(section);}
 if(!d.querySelector('link[href^="/css/content-60.css"]')){const link=d.createElement('link');link.rel='stylesheet';link.href='/css/content-60.css?v=1';link.setAttribute('data-research-phase3-nav-style','');d.head.append(link);}
 return '<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n';
}
function build(){let changed=0;for(const lang of langs)for(const route of routes){const file=path.join(root,lang,route,'index.html'),before=fs.readFileSync(file,'utf8'),after=project(before,lang,route);if(after!==before){fs.writeFileSync(file,after);changed++;}}const result={researchNavigationPages:12,changed};console.log(JSON.stringify(result));return result;}
module.exports={project,build,langs,routes,copy};if(require.main===module)build();
