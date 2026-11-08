'use strict';

// npm run test:root:browser. Install the compatible browser with
// npx playwright-core install chromium, or supply CHROMIUM_EXECUTABLE_PATH.
// TS_ROOT_BROWSER_SITE_DIR optionally serves a separate release snapshot.
const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright-core');

const site = path.resolve(process.env.TS_ROOT_BROWSER_SITE_DIR || path.join(__dirname,'..'));
const readJSON = file => JSON.parse(fs.readFileSync(path.join(site,file),'utf8'));
const eventFacts = readJSON('data/common-events.json').events;
const scoreProfiles = readJSON('data/v4-economy.json').events.find(e=>e.id==='alliance-duel').profiles;
const scheduledEvent = eventFacts.find(e => e.verified && Date.parse(e.startsAt) < Date.parse(e.endsAt));
const fixtureTime = scheduledEvent ? new Date(Math.floor((Date.parse(scheduledEvent.startsAt)+Date.parse(scheduledEvent.endsAt))/2)) : new Date('2026-11-04T02:34:56Z');
const zone = 'Asia/Seoul';
const prefsKey = 'tiles.v6.preferences.v1';
const duelKey = 'tiles.v5.dashboard.v1';
const first = 'season-1', second = 'season-2-cross';
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
let server, browser, origin;

before(async () => {
  server = http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://127.0.0.1');
      const name = decodeURIComponent(url.pathname).slice(1) + (url.pathname.endsWith('/') ? 'index.html' : '');
      const file = path.resolve(site,name), relative = path.relative(site,file);
      if (!['HEAD','GET'].includes(req.method) || relative.startsWith('..') || path.isAbsolute(relative)) {
        res.writeHead(403).end();return;
      }
      const data = await fs.promises.readFile(file);
      res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
      res.end(req.method==='HEAD' ? undefined : data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {})});
});
after(async () => {
  try { await browser?.close(); }
  finally { if(server?.listening)await new Promise(resolve=>server.close(resolve)); }
});

function saved(profile=first) {
  return {prefs:{version:1,offset:330,quantity:7,target:20000},duel:{version:1,profile,day:3,checks:{retained:true}}};
}
const scenarios = [
  {name:'fresh session keeps UTC+9 and season 2 selected during translation',edits:[['offset','9'],['profile',second]],offset:540,profile:second},
  {name:'saved UTC+5:30 and season 1 yield to both newer user edits',saved:saved(),edits:[['offset','9'],['profile',second]],offset:540,profile:second},
  {name:'untouched saved fields retain UTC+5:30 and season 2',saved:saved(second),edits:[],offset:330,profile:second},
  {name:'untouched fresh fields use UTC and season 1',edits:[],offset:0,profile:first},
  {name:'editing only the offset retains the saved season',saved:saved(second),edits:[['offset','9']],offset:540,profile:second},
  {name:'editing only the season retains the saved offset',saved:saved(),edits:[['profile',second]],offset:330,profile:second},
  {name:'the last edits win even when they return to the initial HTML defaults',saved:saved(second),edits:[['offset','9'],['offset','-3'],['offset','0'],['profile',second],['profile',first]],offset:0,profile:first},
  {name:'failed translation keeps both edits on the English fallback',saved:saved(),edits:[['offset','9'],['profile',second]],offset:540,profile:second,failure:true},
  {name:'focused UTC input survives translation and commits only on its native change',saved:saved(),edits:[['offset','9']],offset:540,profile:first,keepOffsetFocused:true},
];

async function checkSchedule(page,locale,minutes) {
  const clock=await page.locator('[data-v6-server-clock]').textContent();
  const offsetLabel='UTC'+(minutes<0?'−':'+')+String(Math.floor(Math.abs(minutes)/60)).padStart(2,'0')+':'+String(Math.abs(minutes)%60).padStart(2,'0');
  const timeFormat=new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'UTC'});
  assert.equal(clock,timeFormat.format(fixtureTime.getTime()+minutes*60000)+' '+offsetLabel);
  const active=eventFacts.find(e=>Date.parse(e.startsAt)<=+fixtureTime && +fixtureTime<Date.parse(e.endsAt));
  if(!active){assert(await page.locator('[data-common-schedule-empty]').isVisible());return;}
  const card=page.locator(`[data-common-schedule="${active.id}"]`);
  assert(await card.isVisible());
  const range=timeZone=>{
    const f=new Intl.DateTimeFormat(locale,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone});
    return f.format(new Date(active.startsAt))+' — '+f.format(new Date(active.endsAt));
  };
  assert.equal(await page.locator('[data-common-period]').textContent(),range('UTC'));
  assert((await card.locator('[data-common-schedule-local]').textContent()).endsWith(range(zone)));
}

async function checkScore(page,scenario,locale) {
  const profile=scoreProfiles.find(p=>p.id===scenario.profile);
  const rule=profile.days.find(d=>d.day===3).rules.find(r=>r.materialId==='item-208593');
  assert(rule && rule.points>0,'Verified Research day scoring rule is required');
  await page.locator('[data-v5-day="3"]').click();
  const config=await page.locator('[data-v5-config]').evaluate(node=>JSON.parse(node.textContent));
  const day=config.profiles.find(p=>p.id===scenario.profile).days.find(d=>d.day===3);
  const ruleIndex=day.rules.findIndex(r=>r.id===rule.id);
  assert(ruleIndex>=0);
  await page.locator('[data-v6-score-rule]').selectOption(String(ruleIndex));
  await page.locator('[data-v6-quantity]').fill('7');
  await page.locator('[data-v6-target]').fill('20000');
  const number=new Intl.NumberFormat(locale);
  assert.equal(await page.locator('[data-v5-stage-title]').textContent(),day.name);
  assert.equal(await page.locator('[data-v6-score-output]').textContent(),number.format(7*rule.points));
  assert.equal(await page.locator('[data-v6-score-remaining]').textContent(),number.format(Math.max(0,20000-7*rule.points)));
  const persisted=await page.evaluate(([prefs,duel])=>[JSON.parse(localStorage.getItem(prefs)),JSON.parse(localStorage.getItem(duel))],[prefsKey,duelKey]);
  assert.deepEqual(persisted[0],{version:1,offset:scenario.offset,quantity:7,target:20000});
  assert.deepEqual(persisted[1],{version:1,profile:scenario.profile,day:3,checks:scenario.saved?.duel.checks || {}});
}

for(const scenario of scenarios) test(scenario.name,{timeout:30000},async()=>{
  const context=await browser.newContext({locale:'ko-KR',timezoneId:zone,viewport:{width:1280,height:900}});
  let release, observed;
  const gate=new Promise(resolve=>{release=resolve;}),requested=new Promise(resolve=>{observed=resolve;});
  let pendingRequests=0;
  const errors=[];
  try {
    await context.addInitScript(({saved,prefs,duel})=>{
      Object.defineProperty(navigator,'languages',{get:()=>['ko-KR','en-US']});
      if(saved){localStorage.setItem(prefs,JSON.stringify(saved.prefs));localStorage.setItem(duel,JSON.stringify(saved.duel));}
    },{saved:scenario.saved,prefs:prefsKey,duel:duelKey});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      if(url.pathname==='/data/root-home/ko.json'){
        pendingRequests++;observed();await gate;
        if(scenario.failure)return route.fulfill({status:503,contentType:'application/json',body:'{}'});
      }
      return route.continue();
    });
    const page=await context.newPage();page.setDefaultTimeout(4000);page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(fixtureTime);
    await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await requested;
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await page.locator('[data-v5-home]').getAttribute('data-mounted'),null);
    const offset=page.locator('[data-v6-offset]'),profile=page.locator('[data-v5-profile]');
    if(scenario.edits.some(([field])=>field==='offset'))await page.locator('details.v6-status-settings > summary').click();
    for(const [field,value] of scenario.edits){
      if(field==='offset')await offset.fill(value);
      else await profile.selectOption(value);
    }
    const search=page.locator('.ts-header input[name="q"]');
    const focusedField=scenario.keepOffsetFocused ? offset : search;
    const selection=()=>focusedField.evaluate(input=>[input.value,input.selectionStart,input.selectionEnd,input.selectionDirection,document.activeElement===input]);
    if(!scenario.keepOffsetFocused){
      await search.fill('guide fuel');await search.press('Home');await search.press('ArrowRight');
      await search.press('Shift+ArrowRight');await search.press('Shift+ArrowRight');
    }
    const fromUser=await selection();
    if(scenario.keepOffsetFocused){
      assert.equal(fromUser[0],'9');assert.equal(fromUser[4],true);
      assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).offset,prefsKey),330,'Typing alone must not commit the new offset');
    }else assert.deepEqual(fromUser,['guide fuel',1,3,'forward',true]);
    release();
    const ready=await page.evaluate(()=>window.TS_ROOT_HOME_READY);
    const locale=scenario.failure?'en':'ko';
    assert.equal(ready.locale,locale);assert.equal(ready.fallback,Boolean(scenario.failure));
    assert.deepEqual(ready.failedScripts,[]);assert.equal(pendingRequests,1);
    assert.equal(new URL(page.url()).pathname,'/');
    assert.equal(await page.locator('html').getAttribute('lang'),locale);
    assert.equal(await page.locator('[data-v5-home]').getAttribute('data-mounted'),'true');
    assert.deepEqual({offset:Number(await offset.inputValue())*60,profile:await profile.inputValue()},{offset:scenario.offset,profile:scenario.profile},'User choices after language data and landing initialization');
    assert.deepEqual(await selection(),fromUser,'Field text, caret, selection direction and focus');
    if(scenario.keepOffsetFocused){
      assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).offset,prefsKey),330,'Translation must not commit the focused edit');
      await checkSchedule(page,locale,scenario.offset); // The visible clock previews the draft without persisting it.
      await offset.press('Tab'); // The user now commits the valid value via the native change event.
    }
    // Inspect storage before interacting with the calculator: a later click must
    // not be able to hide a missing save at the translation boundary.
    const [prefs,duel]=await page.evaluate(([p,d])=>[JSON.parse(localStorage.getItem(p)),JSON.parse(localStorage.getItem(d))],[prefsKey,duelKey]);
    if(scenario.saved || scenario.edits.some(([field])=>field==='offset')){
      assert.deepEqual(prefs,{version:1,offset:scenario.offset,quantity:scenario.saved?.prefs.quantity || 0,target:scenario.saved?.prefs.target || 0});
    }
    if(scenario.saved || scenario.edits.some(([field])=>field==='profile')){
      assert.deepEqual(duel,{version:1,profile:scenario.profile,day:scenario.saved?.duel.day ?? null,checks:scenario.saved?.duel.checks || {}});
    }
    if(scenario.saved){
      assert.equal(await page.locator('[data-v6-quantity]').inputValue(),'7');
      assert.equal(await page.locator('[data-v6-target]').inputValue(),'20000');
      assert.equal(await page.locator('[data-v5-day="3"]').getAttribute('aria-pressed'),'true');
    }
    await checkSchedule(page,locale,scenario.offset);await checkScore(page,scenario,locale);
    assert.deepEqual(errors,[]);
  } finally {release();await context.close();}
});
