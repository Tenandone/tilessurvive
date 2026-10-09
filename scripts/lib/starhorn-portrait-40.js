'use strict';
const {parseHTML}=require('linkedom');
const copy=require('../../data/foundation-40/pet-growth-copy');
const assert=(v,m)=>{if(!v)throw Error(m);};
module.exports=function(html,lang){
 const d=parseHTML(html).document,t=copy[lang],stage=d.querySelector('.ts3-pet-stage');
 assert(stage,'Starhorn stage');
 const existing=stage.querySelector('[data-pet-main-art-40="starhorn"]');
 const capture=d.querySelector('[data-starhorn-screen-40]');
 if(existing){
  assert(existing.getAttribute('src')==='/img/game-40/pets/starhorn.webp'&&capture?.querySelector('img')?.getAttribute('src')==='/img/pets/growth-source.webp','Existing scoped portrait and original screen');
  assert(!capture.hasAttribute('open')&&capture.querySelector('summary').textContent===t.screenshot,'Collapsed localized original screen');
  const before=existing.outerHTML,oldScreen=capture.querySelector('img'),beforeScreen=oldScreen.outerHTML;
  existing.setAttribute('loading','eager');existing.setAttribute('decoding','async');oldScreen.setAttribute('loading','lazy');
  assert(html.split(before).length===2&&html.split(beforeScreen).length===2,'Exact portrait/capture attributes');
  return html.replace(before,()=>existing.outerHTML).replace(beforeScreen,()=>oldScreen.outerHTML);
 }
 assert(!capture,'No duplicate original-screen panel');
 const source=stage.querySelector('img[src="/img/pets/growth-source.webp"]'),oldFigure=source?.closest('figure');
 assert(oldFigure?.classList.contains('ts3-pet-observation'),'Expected original Starhorn screen position');
 assert(source.getAttribute('width')==='731'&&source.getAttribute('height')==='920'&&source.alt==='Starhorn Lv.1 game screenshot','Exact original capture properties');
 const before=stage.outerHTML,original=source.cloneNode(true);original.setAttribute('loading','lazy');
 const figure=d.createElement('figure');figure.className='ts3-pet-portrait';figure.setAttribute('data-pet-portrait-40','starhorn');
 const image=d.createElement('img');image.setAttribute('data-pet-main-art-40','starhorn');image.src='/img/game-40/pets/starhorn.webp';image.alt=stage.querySelector('h1').textContent+' · Starhorn';image.setAttribute('width','360');image.setAttribute('height','492');image.setAttribute('loading','eager');image.setAttribute('decoding','async');image.setAttribute('style','object-fit:contain;width:100%;height:100%');figure.append(image);oldFigure.replaceWith(figure);
 const details=d.createElement('details');details.setAttribute('data-starhorn-screen-40','');details.className='ts-evidence-22';
 const summary=d.createElement('summary');summary.textContent=t.screenshot;details.append(summary);
 const scope=d.createElement('p');scope.textContent=t.screenshotScope;details.append(scope,original);
 assert(html.split(before).length===2,'Unique stage fragment');
 return html.replace(before,()=>stage.outerHTML+details.outerHTML);
};
