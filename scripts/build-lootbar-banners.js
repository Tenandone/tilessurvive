const fs=require('fs'),path=require('path'),{parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..'),copy=require('../data/lootbar-banners.json');
const url=require('../config/affiliate.json').tilesSurvive.url;
const routes=['','codes/','top-up/','guides/discount-topup/','guides/discount-topup-promotion/'];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function banner(lang,placement){const c=copy[lang];return `<a class="ts-lootbar" href="${url}" target="_blank" rel="sponsored nofollow noopener noreferrer" data-affiliate-placement="banner_${placement}" data-affiliate-campaign="lootbar" data-affiliate-variant="localized-1" aria-label="${esc(c.title+' '+c.message+' · '+c.newTab)}"><span class="ts-lootbar-art" aria-hidden="true"><img class="ts-lootbar-world" src="/img/banners/official-world.webp" width="1920" height="1080" alt="" loading="lazy" decoding="async"><img class="ts-lootbar-hero" src="/img/banners/official-hero.webp" width="1010" height="928" alt="" loading="lazy" decoding="async"></span><span class="ts-lootbar-copy"><img class="ts-lootbar-logo" src="/img/banners/official-logo.webp" width="520" height="208" alt="Tiles Survive!" loading="lazy" decoding="async"><span class="ts-lootbar-label">${c.label}</span><strong class="ts-lootbar-title">${c.title} <span>${c.message}</span></strong><span class="ts-lootbar-cta">${c.cta}<i aria-hidden="true">↗</i></span></span></a><small class="ts-lootbar-note">${c.note}</small>`;}
for(const lang of Object.keys(copy)){
  for(const route of routes){const file=path.join(root,lang,route,'index.html'),d=parseHTML(fs.readFileSync(file,'utf8')).document;
    const main=d.querySelector('main');let slot=d.querySelector('[data-lootbar-slot]');
    if(!slot){slot=d.createElement('aside');slot.className='ts-lootbar-slot';slot.setAttribute('data-lootbar-slot',route||'home');
      if(!route){const old=main.querySelector('[data-home-affiliate]');if(old)old.replaceWith(slot);else main.append(slot);}
      else if(route==='codes/'){
        // Replace three ad surfaces with one, after the usable coupon list.
        d.querySelector('.sponsorPill')?.remove();d.querySelector('#midDiscountLink')?.remove();
        d.querySelector('iframe[src*="lootbar"]')?.closest('section')?.remove();
        const controls=main.querySelector('#codesGrid')?.parentElement?.querySelector('.controls');
        if(!controls)throw new Error('Coupon placement missing '+file);controls.after(slot);
      }else if(route==='top-up/'){
        const old=main.querySelector('[data-affiliate-placement="topup_final"]')?.closest('section');
        if(!old)throw new Error('Top-up placement missing '+file);old.replaceWith(slot);
        main.querySelector('.topup-sticky')?.remove();
      }else if(route==='guides/discount-topup-promotion/'){
        const widget=main.querySelector('#widget');if(!widget)throw new Error('Promotion placement missing '+file);
        // Preserve anchor, heading and explanatory content; replace only the embedded ad.
        const embed=widget.querySelector('iframe');if(embed){const host=embed.parentElement;embed.replaceWith(slot);if(host.children.length===1)host.style.cssText='';}else widget.append(slot);
      }else{
        const actions=main.querySelector('[data-topup-hub-entry]');if(actions)actions.before(slot);else main.append(slot);
        // Existing instructional links stay usable. Remove the repeated final outbound buttons.
        for(const a of main.querySelectorAll('.cta-box .cta-row a[href*="lootbar"]'))a.remove();
      }
    }
    if(route==='guides/discount-topup-promotion/'){
      // Both legacy device wrappers contain placeholders that cover their children.
      // Move the responsive banner outside them before removing the old ad surfaces.
      const wrappers=[...main.querySelectorAll('#widget .widget-desktop,#widget .widget-mobile')];
      if(wrappers.length){wrappers[0].before(slot);wrappers.forEach(n=>n.remove());}
    }
    slot.setAttribute('aria-label',copy[lang].label);slot.innerHTML=banner(lang,route.replaceAll('/','_')||'home');
    d.querySelector('link[data-lootbar-style]')?.remove();const css=d.createElement('link');css.rel='stylesheet';css.href='/css/lootbar-banner.css?v=2';css.setAttribute('data-lootbar-style','');d.head.append(css);
    fs.writeFileSync(file,('<!DOCTYPE html>\n'+d.documentElement.outerHTML+'\n').replace(/^[ \t]+$/gm,''));
  }
  const folder=path.join(root,'components','banners');fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,lang+'.html'),`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Tiles Survive · LootBar · ${lang}</title><link rel="stylesheet" href="/css/lootbar-banner.css?v=2"><style>html,body{margin:0;background:#f8f9f7;overflow:hidden}.ts-lootbar{box-sizing:border-box;margin:0}html .ts-lootbar-note{display:none}</style></head><body>${banner(lang,'asset').replaceAll('loading="lazy"','loading="eager"').replaceAll('decoding="async"','decoding="sync"')}</body></html>`);
  fs.writeFileSync(path.join(folder,lang+'-mobile.html'),`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>LootBar mobile export · ${lang}</title><style>html,body{margin:0;width:1080px;height:1020px;overflow:hidden}iframe{width:360px;height:340px;border:0;transform:scale(3);transform-origin:0 0}</style></head><body><iframe src="${lang}.html" title="LootBar ${lang}"></iframe></body></html>`);
}
console.log('Localized LootBar banners: 5 languages, 25 contextual placements.');
