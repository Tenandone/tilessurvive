(function(root){
 'use strict';
 function init(d=root.document){
  const panel=d?.querySelector('[data-v4-workbench]');if(!panel||panel.dataset.ready)return;panel.dataset.ready='true';
  const cfg=JSON.parse(panel.querySelector('[data-v4-config]').textContent),c=cfg.copy,S=root.TS_V4_STATE,key='tiles.v4.workbench.1';
  const message=panel.querySelector('[data-v4-message]'),shareBox=panel.querySelector('[data-v4-share-text]'),controllers={},pending={},models={};let state=S.empty(),loadingState=false;
  const buttons=[...panel.querySelectorAll('[data-v4-tab]')],host=t=>panel.querySelector('[data-v4-host="'+t+'"]');
  function say(text){message.textContent=text||'';}
  try{state=S.fromHash(root.location.hash)||S.restore(root.localStorage,key)||S.empty();}catch{say(c.restoreError);}
  function collect(){const candidate={...state,plans:{...state.plans}};for(const[t,ctl]of Object.entries(controllers))candidate.plans[t]=ctl.read();return S.validate(candidate);}
  function restoreAll(next){
   const previous=Object.fromEntries(Object.entries(controllers).map(([t,ctl])=>[t,ctl.read()]));loadingState=true;
   try{for(const[t,ctl]of Object.entries(controllers)){if(next.plans[t])ctl.restore(next.plans[t]);else ctl.reset();}state=next;}
   catch(error){for(const[t,ctl]of Object.entries(controllers))ctl.restore(previous[t]);throw error;}
   finally{loadingState=false;}
  }
  function sync(){if(loadingState)return;try{state=collect();root.history.replaceState(null,'',S.url(root.location.href,state));panel.dataset.valid='true';}catch{panel.dataset.valid='false';}}
  async function model(kind){if(!models[kind])models[kind]=root.fetch(cfg.models[kind],{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('load');return r.json();}).catch(e=>{delete models[kind];throw e;});return models[kind];}
  async function load(tab){
   if(controllers[tab])return controllers[tab];if(pending[tab])return pending[tab];
   const target=host(tab);target.setAttribute('aria-busy','true');
   pending[tab]=(async()=>{try{
    const data=await model(tab==='formation'?'formation':'economy'),ctx={host:target,model:data,copy:tab==='formation'?cfg.formationCopy:cfg.economyCopy,locale:cfg.locale,numberLocale:cfg.numberLocale,onChange:sync,common:c};
    loadingState=true;target.replaceChildren();const ctl=tab==='formation'?root.TS_V4_FORMATION_UI.mount(ctx):tab==='vs'?root.TS_V4_ECONOMY_UI.mountVS(ctx):root.TS_V4_ECONOMY_UI.mountGrowth(ctx);
    for(const method of ['read','restore','reset','render'])if(typeof ctl?.[method]!=='function')throw Error('controller');
    controllers[tab]=ctl;if(state.plans[tab]){try{ctl.restore(state.plans[tab]);}catch{ctl.reset();delete state.plans[tab];say(c.restoreError);}}ctl.render();target.setAttribute('aria-busy','false');return ctl;
   }catch{const text=d.createElement('p'),retry=d.createElement('button');text.textContent=c.loadError;text.setAttribute('role','alert');retry.type='button';retry.textContent=c.retry;retry.addEventListener('click',()=>{delete pending[tab];load(tab);});target.replaceChildren(text,retry);target.setAttribute('aria-busy','false');return null;}finally{loadingState=false;}})();return pending[tab];
  }
  async function activate(tab,focus=false){
   if(!S.TABS.includes(tab))return;state.tab=tab;
   for(const b of buttons){const on=b.dataset.v4Tab===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;d.getElementById(b.getAttribute('aria-controls')).hidden=!on;if(on&&focus)b.focus();}
   await load(tab);sync();
  }
  buttons.forEach((b,i)=>{b.addEventListener('click',()=>activate(b.dataset.v4Tab));b.addEventListener('keydown',e=>{const rtl=d.documentElement.dir==='rtl';let next;if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else if(e.key==='ArrowRight')next=(i+(rtl?-1:1)+buttons.length)%buttons.length;else if(e.key==='ArrowLeft')next=(i+(rtl?1:-1)+buttons.length)%buttons.length;if(next!==undefined){e.preventDefault();activate(buttons[next].dataset.v4Tab,true);}});});
  panel.querySelector('[data-v4-save]').addEventListener('click',()=>{try{const value=collect();S.save(root.localStorage,key,value);state=value;say(c.saved);}catch(e){say(panel.dataset.valid==='false'?c.invalid:c.storageError);}});
  panel.querySelector('[data-v4-load]').addEventListener('click',async()=>{try{const saved=S.restore(root.localStorage,key);if(!saved)throw Error('empty');restoreAll(saved);await activate(state.tab);say(c.restored);}catch{say(c.restoreError);}});
  panel.querySelector('[data-v4-reset]').addEventListener('click',()=>{const ctl=controllers[state.tab];if(!ctl)return;ctl.reset();delete state.plans[state.tab];sync();say(c.resetDone);});
  panel.querySelector('[data-v4-share]').addEventListener('click',async()=>{try{const value=collect(),url=S.url(root.location.href,value);shareBox.hidden=false;shareBox.value=url;try{await root.navigator.clipboard.writeText(url);say(c.copied);}catch{shareBox.focus();shareBox.select();say(c.copyFallback);}}catch{say(c.invalid);}});
  root.addEventListener('hashchange',()=>{try{const next=S.fromHash(root.location.hash);if(!next)return;if(root.location.hash.startsWith('#v4-')){activate(next.tab);return;}restoreAll(next);activate(next.tab);}catch{say(c.restoreError);}});
  activate(state.tab);return{collect,activate,controllers,getState:()=>S.validate(state)};
 }
 const api={init};if(typeof module==='object'&&module.exports)module.exports=api;else root.TS_V4_WORKBENCH=api;
 if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>init());else init();}
})(typeof window==='object'?window:globalThis);
