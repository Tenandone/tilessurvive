'use strict';
const fs=require('node:fs'),path=require('node:path');
const {parseHTML}=require('linkedom');
const L=require('./lib/global-localization'),{enhance}=require('./build-global-locales');
const rootStyles = `
    * { box-sizing: border-box }
    body { margin: 0; padding: 24px; color: #173e36; background: #f3f6f3; font: 1rem/1.55 system-ui, sans-serif }
    .card { max-width: 52rem; margin: 0 auto; padding: clamp(20px, 5vw, 48px); background: white; border: 1px solid #d7e3dd; border-radius: 24px }
    .logo { display: block; width: 130px; max-width: 100%; height: auto; margin-bottom: 16px }
    h1 { margin: 0; font-size: clamp(1.7rem, 5vw, 2.5rem); line-height: 1.18; letter-spacing: -.035em; text-wrap: balance }
    p { margin: .65rem 0; color: #344e48 }
    p[lang="en"] { color: #49625b; font-size: .95rem }
    h2 { margin: 1.5rem 0 .7rem; font-size: 1.12rem; line-height: 1.4 }
    h2 span { font-size: .94rem; font-weight: 500; color: #48645b }
    .lang-grid, .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); gap: .5rem }
    .lang-btn, .feature-grid a { display: flex; gap: .3rem; flex-wrap: wrap; align-items: center; justify-content: center; min-height: 44px; padding: .4rem .55rem; border: 1px solid #ceddd4; border-radius: 12px; color: #174c40; text-align: center; text-decoration: none; font-weight: 600 }
    .feature-grid a { background: #f1f7f3 }
    a[data-recommended] { border-color: #267259 }
    .recommended-label { color: #24604c; font-size: .72rem }
    a:hover { background: #e5f1ea }
    a:focus-visible { outline: 3px solid #236747; outline-offset: 2px }
    @media (max-width: 520px) { body { padding: 10px } .card { padding: 19px 14px; border-radius: 16px } }
  `;
function renderRootContent(d) {
  d.documentElement.lang = 'ko';
  d.title = '타일 서바이벌 공략·쿠폰·성장 계산기 | TilesSurvive.net';
  d.querySelector('meta[name="description"]').content = '타일 서바이벌 영웅·펫 도감, 건물 업그레이드 비용, 성장 계산기, 이벤트 일정과 쿠폰을 확인하세요. 언어를 선택하면 해당 언어의 게임 가이드로 이동합니다.';
  d.querySelector('head > style').textContent = rootStyles;
  const main = d.querySelector('main.card');
  main.removeAttribute('aria-label');
  main.setAttribute('aria-labelledby', 'root-heading');
  main.innerHTML = `
    <header>
      <img class="logo" src="/img/banners/official-logo.webp" width="130" height="52" alt="Tiles Survive!">
      <h1 id="root-heading">타일 서바이벌 공략과 성장 계산기</h1>
      <p>영웅과 펫의 스킬을 비교하고, 건물 업그레이드에 필요한 자원을 계산하세요. 이벤트 일정과 쿠폰도 확인할 수 있습니다.</p>
      <p lang="en">Explore Tiles Survive hero and pet guides, building costs, growth calculators, event schedules and gift codes in your language.</p>
    </header>
    <nav aria-labelledby="root-languages">
      <h2 id="root-languages">언어 선택 <span lang="en">Choose your language</span></h2>
      <div class="lang-grid"></div>
    </nav>
    <nav aria-labelledby="root-guides">
      <h2 id="root-guides">한국어 가이드 바로가기</h2>
      <div class="feature-grid">
        <a href="/ko/heroes/">영웅 도감</a>
        <a href="/ko/database/pet-system/">펫 도감</a>
        <a href="/ko/buildings/">건물 업그레이드</a>
        <a href="/ko/tools/">성장 계산기</a>
        <a href="/ko/events/calendar/">이벤트 일정</a>
        <a href="/ko/codes/">쿠폰 코드</a>
      </div>
    </nav>
  `;
}
function rootDocument(source,available) {
  const d=parseHTML(source).document;
  renderRootContent(d);
  for(const script of d.querySelectorAll('script:not([src])'))if(script.textContent.includes('window.TS_ROOT_LANG'))script.remove();
  for(const script of d.querySelectorAll('script[src^="/js/site-locales.js"],script[src^="/js/root-language.js"]'))script.remove();
  for(const link of d.querySelectorAll('link[rel="alternate"][hreflang]'))link.remove();
  const grid=d.querySelector('.lang-grid');const routes={};
  for(const code of available) {
    const locale=L.byCode.get(code);routes[code]='/'+code+'/';
    const link=d.createElement('link');link.rel='alternate';link.hreflang=locale.hreflang;link.href=L.publicOrigin+routes[code];d.head.append(link);
    const a=d.createElement('a');a.className='lang-btn';a.href=routes[code];a.lang=locale.htmlLang;a.setAttribute('hreflang',locale.hreflang);a.dataset.rootLocale=code;a.textContent=locale.nativeName;grid.append(a);
  }
  const fallback=d.createElement('link');fallback.rel='alternate';fallback.hreflang='x-default';fallback.href=L.publicOrigin+'/';d.head.append(fallback);
  L.jsonScript(d,'ts-root-routes',routes);
  for(const name of ['site-locales','root-language']) {
    const script=d.createElement('script');script.defer=true;script.src='/js/'+name+'.js?v='+L.digest(fs.readFileSync(path.join(L.ROOT,'js',name+'.js'))).slice(0,12);d.head.append(script);
  }
  return ('<!doctype html>\n'+d.documentElement.outerHTML+'\n').replace(/[\t ]+$/gm,'');
}
function build({available=L.registry.locales.filter(l=>l.status==='published').map(l=>l.code),apply=false,preview=false}={}) {
  const stage=path.resolve(L.ROOT,'../global-language-delivery-20261104/staging');
  const groups=L.routeGroups(),plans=[];
  for(const code of available) {
    if(!L.byCode.has(code))throw Error('Unknown locale: '+code);
    for(const group of groups) {
      const route=group.routes[code];if(!route)throw Error('Missing equivalent route: '+code+'/'+group.id);
      const staged=path.join(stage,route.slice(1),'index.html');
      const file=preview&&!L.existing.has(code)?staged:path.join(L.ROOT,route.slice(1),'index.html');
      if(!fs.existsSync(file))throw Error('Missing public page: '+route);
      const before=fs.readFileSync(file,'utf8'),document=parseHTML(before).document;
      if(!preview&&(document.documentElement.dataset.translationStatus==='preview-unpublished'||/noindex/i.test(document.querySelector('meta[name="robots"]')?.content||'')))throw Error('Unpublishable locale route: '+route);
      const ui=require('../data/i18n/ui/'+code+'.json');
      const body=enhance(document,code,group,available,ui,{preview});
      plans.push({file:preview?staged:file,before,body});
    }
  }
  const file=path.join(L.ROOT,'index.html'),before=fs.readFileSync(file,'utf8');let body=rootDocument(before,available);
  if(preview)body=body.replace(/(<meta name="robots" content=")[^"]*/, '$1noindex,nofollow');
  plans.push({file:preview?path.join(stage,'index.html'):file,before,body});
  if(apply)for(const p of plans)L.safeWrite(p.file,p.body);
  const result={mode:preview?'private-preview':apply?'apply':'check',locales:available,routes:plans.length,changed:plans.filter(p=>p.before!==p.body).length};console.log(JSON.stringify(result));return result;
}
module.exports={rootDocument,build};
if(require.main===module){const add=process.argv.find(x=>x.startsWith('--include='));build({apply:process.argv.includes('--apply')||process.argv.includes('--preview'),preview:process.argv.includes('--preview'),available:add?[...L.existing,...add.slice(10).split(',')]:undefined});}
