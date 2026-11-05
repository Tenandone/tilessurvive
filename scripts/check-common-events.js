#!/usr/bin/env node
'use strict';

// Read-only official-source monitor. Downloaded JavaScript is parsed as text only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {parseHTML} = require('linkedom');
const ROOT = path.resolve(__dirname, '..');
const EVENT_ORIGIN = 'https://ts-halloween-web.funplus.com';
const NEWS_ORIGIN = 'https://tilesurvivegame.com';
const NUCLEAR_PAGES = ['/en/blog/1213', '/ko/blog/1218', '/en/blog/1221', '/ko/blog/1226'];
const CLIENT_MODEL_PATH = 'data/nuclear-age.json';
const DEFAULT_SOURCES = [
  {id:'halloween-page', url:EVENT_ORIGIN + '/', kind:'event-page'},
  {id:'official-home', url:NEWS_ORIGIN + '/', kind:'news-page'},
  {id:'official-news', url:NEWS_ORIGIN + '/en/list', kind:'news-page'},
  {id:'nuclear-official-en', url:NEWS_ORIGIN + NUCLEAR_PAGES[0], kind:'nuclear-page'},
  {id:'nuclear-official-ko', url:NEWS_ORIGIN + NUCLEAR_PAGES[1], kind:'nuclear-page'},
  {id:'nuclear-release-en', url:NEWS_ORIGIN + NUCLEAR_PAGES[2], kind:'nuclear-page'},
  {id:'nuclear-release-ko', url:NEWS_ORIGIN + NUCLEAR_PAGES[3], kind:'nuclear-page'},
  {id:'nuclear-client-model', url:'repository:' + CLIENT_MODEL_PATH, kind:'client-model', reviewOnly:true}
];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const normalize = value => String(value || '').normalize('NFC').replace(/<br\s*\/?\s*>/gi,' ').replace(/\s+/g,' ').trim();
const unique = values => [...new Set(values)].sort();

function allowedURL(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash) throw new Error('URL_NOT_ALLOWED');
  if (u.origin === EVENT_ORIGIN && (u.pathname === '/' || /^\/assets\/[A-Za-z0-9_.-]+\.js$/.test(u.pathname))) return u;
  if (u.origin === NEWS_ORIGIN && ['/', '/en', '/en/', '/en/list', '/en/list/', ...NUCLEAR_PAGES].includes(u.pathname)) return u;
  throw new Error('URL_NOT_ALLOWED');
}

function optionsChecked(options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw new Error('INVALID_TIMEOUT');
  if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > 10 * 1024 * 1024) throw new Error('INVALID_SIZE_LIMIT');
  return {timeoutMs, maxBytes, fetcher:options.fetcher || globalThis.fetch};
}

async function fetchPublic(url, options = {}) {
  const {timeoutMs, maxBytes, fetcher} = optionsChecked(options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = allowedURL(url).href;
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetcher(current, {signal:controller.signal, redirect:'manual', credentials:'omit', headers:{Accept:'text/html, text/javascript, application/javascript;q=0.9', 'User-Agent':'TilesSurvive-public-event-review/1.0'}});
      if (response.status >= 300 && response.status < 400) {
        if (redirects === 3) throw new Error('TOO_MANY_REDIRECTS');
        const location = response.headers.get('location');
        if (!location) throw new Error('INVALID_REDIRECT');
        current = allowedURL(new URL(location, current).href).href;
        if (response.body) await response.body.cancel();
        continue;
      }
      if (!response.ok) throw new Error('HTTP_' + response.status);
      const type = response.headers.get('content-type') || '';
      if (!/^(?:text\/(?:html|javascript|plain)|application\/(?:javascript|x-javascript))(?:;|$)/i.test(type)) throw new Error('UNEXPECTED_CONTENT_TYPE');
      const declared = Number(response.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) throw new Error('RESPONSE_TOO_LARGE');
      if (!response.body) throw new Error('EMPTY_RESPONSE');
      const chunks = [], reader = response.body.getReader();
      let size = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw new Error('RESPONSE_TOO_LARGE'); }
        chunks.push(Buffer.from(value));
      }
      const bytes = Buffer.concat(chunks);
      return {url, finalURL:current, contentType:type, bytes:size, rawSha256:sha(bytes), text:bytes.toString('utf8')};
    }
    throw new Error('TOO_MANY_REDIRECTS');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('FETCH_TIMEOUT');
    throw error;
  } finally { clearTimeout(timer); }
}

function pageSemantic(html, url) {
  const document = parseHTML(html).document;
  const assets = unique([...document.querySelectorAll('script[src]')].map(n => new URL(n.getAttribute('src'),url).href));
  const articles = unique([...document.querySelectorAll('a[href]')].map(n => {
    try { const u = new URL(n.getAttribute('href'),url); return u.origin === NEWS_ORIGIN && /^\/en\/blog\/\d+\/?$/.test(u.pathname) ? u.origin + u.pathname.replace(/\/$/,'') : null; }
    catch { return null; }
  }).filter(Boolean));
  const metadata = [...document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]')].map(n=>[n.getAttribute('name') || n.getAttribute('property'),normalize(n.getAttribute('content'))]).sort((a,b)=>a[0].localeCompare(b[0]));
  document.querySelectorAll('script,style,noscript').forEach(n=>n.remove());
  const semantic = {kind:'page', title:normalize(document.querySelector('title')?.textContent), metadata, text:normalize(document.body?.textContent), articles};
  if (!semantic.title && !semantic.text) throw new Error('EMPTY_PAGE_SEMANTICS');
  return {semantic, assets};
}

function canonicalJSON(value) {
  if (Array.isArray(value)) return value.map(canonicalJSON);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalJSON(value[key])]));
  return value;
}

function clientModelSemantic(source) {
  if (Buffer.byteLength(source) > 5 * 1024 * 1024) throw new Error('CLIENT_MODEL_TOO_LARGE');
  let data;
  try { data = JSON.parse(String(source)); } catch { throw new Error('CLIENT_MODEL_INVALID_JSON'); }
  if (data?.schemaVersion !== 1 || data.id !== 'nuclear-age' || !data.client || typeof data.client.version !== 'string' || !Number.isInteger(data.client.build) || !data.scope || !Array.isArray(data.scope.buildingTypeIds)) throw new Error('CLIENT_MODEL_INVALID');
  const digest = sha(JSON.stringify(canonicalJSON(data)));
  // The fixed, already-public model is only a review candidate. No raw game
  // files, account data, private source paths, or downloaded code are loaded.
  return {kind:'client-model',modelId:data.id,modelSha256:digest,clientVersion:data.client.version,clientBuild:data.client.build,buildingTypeCount:data.scope.buildingTypeIds.length,reviewOnly:true};
}

function inspectClientModel(item) {
  if (item.id !== 'nuclear-client-model' || item.url !== 'repository:' + CLIENT_MODEL_PATH) throw new Error('CLIENT_MODEL_SOURCE_NOT_ALLOWED');
  const file = path.join(ROOT,CLIENT_MODEL_PATH);
  let source;
  try {
    if (fs.lstatSync(file).isSymbolicLink() || fs.realpathSync(file) !== file) throw new Error('CLIENT_MODEL_PATH_INVALID');
    if (fs.statSync(file).size > 5 * 1024 * 1024) throw new Error('CLIENT_MODEL_TOO_LARGE');
    source = fs.readFileSync(file,'utf8');
  } catch(error) {
    if (/^CLIENT_MODEL_/.test(error.message)) throw error;
    throw new Error('CLIENT_MODEL_READ_FAILED');
  }
  const semantic = clientModelSemantic(source);
  return {...item,status:'ok',bytes:Buffer.byteLength(source),rawSha256:sha(source),semanticSha256:sha(JSON.stringify(semantic)),semantic};
}

function bundleSemantic(source) {
  // Only JSON string literals and simple key-to-identifier maps are decoded.
  // No eval, VM, module import, browser context, or downloaded-code execution.
  const strings = new Map();
  for (const m of source.matchAll(/(?:^|[,; ])([A-Za-z_$][\w$]*)=("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g)) {
    try {
      if (m[2][0] === '"') strings.set(m[1],JSON.parse(m[2]));
      else if (!m[2].includes('${')) strings.set(m[1],m[2].slice(1,-1).replace(/\\(?:u\{([\da-f]+)\}|u([\da-f]{4})|x([\da-f]{2})|(\r?\n)|(.))/gis,(all,cp,u,x,newline,c)=>cp||u||x?String.fromCodePoint(parseInt(cp||u||x,16)):newline?'':({n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0'}[c]??c)));
    } catch {}
  }
  const languageMap = new Map();
  const config = source.match(/config:\{((?:[a-z_]+:[A-Za-z_$][\w$]*,?)+)\},code:\[/);
  for (const pair of (config?.[1]||'').split(',')) { const [locale,ref]=pair.split(':'); if(ref)languageMap.set(ref,locale); }
  const locales = [];
  for (const m of source.matchAll(/([A-Za-z_$][\w$]*)=\{(event_title:[^{}]+)\}/g)) {
    const entries = [];
    for (const pair of m[2].split(',')) {
      const split = pair.indexOf(':');
      const key = pair.slice(0,split), ref = pair.slice(split+1);
      if (strings.has(ref) && /^(event_|daily_tasks_|social_tasks_|friend_tasks_|milestone_|item_|pool_item_|prize_pool_|rules_binding_)/.test(key)) entries.push([key,normalize(strings.get(ref))]);
    }
    if (entries.some(([key])=>key==='event_rules_description')) locales.push({locale:languageMap.get(m[1])||'unmapped',entries:entries.sort((a,b)=>a[0].localeCompare(b[0]))});
  }
  const textSets = unique(locales.map(v=>JSON.stringify(v)));
  if (!textSets.length) throw new Error('EVENT_TEXT_EXTRACTION_FAILED');
  const numeric = unique([...source.matchAll(/\b(threshold|quantity|probability):([0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?)(?=[,}])/gi)].map(m=>m[1]+':'+Number(m[2])));
  const tasks = unique([...source.matchAll(/"((?:h5_|social_|invite_friend_)[a-z0-9_]+|today_recharge|open_thirdpay)"/g)].map(m=>m[1]));
  // The UI computes each prize's 10% using a map. Preserve static field numbers
  // and reward array tuples, even when minifier variable names change.
  const rewardTuples = unique([...source.matchAll(/\["(item_[a-z0-9_]+)","([a-z0-9_-]+)",(\d+)\]/g)].map(m=>[m[1],Number(m[3])].join(':')));
  const milestoneRewards = unique([...source.matchAll(/\{threshold:([0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?),code:(null|"[a-z0-9_]+"),quantity:([0-9]+(?:e[+-]?[0-9]+)?),key:"([a-z0-9_]+)"\}/gi)].map(m=>JSON.stringify({threshold:Number(m[1]),code:JSON.parse(m[2]),quantity:Number(m[3]),key:m[4]})));
  return {kind:'event-public-text',localeCount:textSets.length,localizedText:textSets.map(v=>JSON.parse(v)),numeric,tasks,rewardTuples,milestoneRewards};
}

function compare(current, baseline) {
  const previous = new Map((baseline?.sources || []).map(s=>[s.id,s]));
  const changes = {newSources:[],contentChanged:[],accessFailures:[],newArticles:[],removedArticles:[]};
  for (const source of current.sources) {
    if (source.status !== 'ok') { changes.accessFailures.push({id:source.id,url:source.url,error:source.error}); continue; }
    const old = previous.get(source.id);
    if (!old) changes.newSources.push(source.id);
    else if (old.status !== 'ok' || source.semanticSha256 !== old.semanticSha256) changes.contentChanged.push(source.id);
  }
  const collect = report=>new Set((report?.sources||[]).filter(s=>s.status==='ok').flatMap(s=>s.semantic?.articles||[]));
  if (baseline) {
    const before = collect(baseline), after = collect(current);
    changes.newArticles = [...after].filter(v=>!before.has(v)).sort();
    // An inaccessible news page cannot prove removal.
    if (!current.sources.some(s=>s.kind==='news-page'&&s.status!=='ok')) changes.removedArticles = [...before].filter(v=>!after.has(v)).sort();
  }
  return changes;
}

async function check(options = {}) {
  optionsChecked(options);
  const report = {schemaVersion:1,checkedAt:new Date().toISOString(),baselineProvided:!!options.baseline,sources:[]};
  async function inspect(item) {
    try {
      if (item.kind === 'client-model') return inspectClientModel(item);
      const response = await fetchPublic(item.url, options);
      let semantic, assets = [];
      if (item.kind === 'event-script') semantic = bundleSemantic(response.text);
      else ({semantic,assets} = pageSemantic(response.text,response.finalURL));
      if (item.id === 'official-news' && !semantic.articles.length) throw new Error('OFFICIAL_NEWS_LINKS_MISSING');
      const semanticSha256 = sha(JSON.stringify(semantic));
      // Hash full public text in memory; reports carry compact facts, not copied
      // localized rule books or page prose. Baselines need only this hash.
      const {text,localizedText,...summary} = semantic;
      return {...item,status:'ok',finalURL:response.finalURL,bytes:response.bytes,rawSha256:response.rawSha256,semanticSha256,semantic:summary,assets};
    } catch (error) { return {...item,status:'error',error:String(error.message||error).slice(0,160)}; }
  }
  // Independent public pages can be fetched together. Every result is reported.
  report.sources = await Promise.all(DEFAULT_SOURCES.map(inspect));
  const page = report.sources.find(s=>s.id==='halloween-page');
  if (page.status === 'ok') {
    const refs = page.assets.filter(v=>/\.js$/.test(v));
    if (!refs.length || refs.length > 8) report.sources.push({id:'halloween-script-discovery',url:page.url,kind:'event-script',status:'error',error:'INVALID_SCRIPT_REFERENCE_COUNT'});
    else for (let i=0;i<refs.length;i++) report.sources.push(await inspect({id:'halloween-script-'+(i+1),url:refs[i],kind:'event-script'}));
  }
  report.changes = compare(report,options.baseline);
  report.status = report.changes.accessFailures.length ? 'needs-review' : !options.baseline ? 'baseline-created' : Object.values(report.changes).some(v=>v.length) ? 'changed' : 'unchanged';
  return report;
}

function externalOutput(value) {
  if (!value) throw new Error('--output is required and must be outside the public repository');
  const absolute = path.resolve(value);
  const realParent = fs.realpathSync(path.dirname(absolute));
  const resolved = path.join(realParent,path.basename(absolute));
  const relative = path.relative(fs.realpathSync(ROOT),resolved);
  if (relative === '' || (!relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('OUTPUT_MUST_BE_OUTSIDE_REPOSITORY');
  if (fs.existsSync(resolved) && fs.lstatSync(resolved).isSymbolicLink()) throw new Error('OUTPUT_SYMLINK_NOT_ALLOWED');
  return resolved;
}

async function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i=0;i<argv.length;i+=2) {
    if (!['--output','--baseline','--timeout-ms','--max-bytes'].includes(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--')) throw new Error('Usage: node scripts/check-common-events.js --output <external-report.json> [--baseline <previous-report.json>] [--timeout-ms 15000] [--max-bytes 5242880]');
    args[argv[i]] = argv[i+1];
  }
  const output = externalOutput(args['--output']);
  let baseline;
  if (args['--baseline']) {
    if (path.resolve(args['--baseline']) === output) throw new Error('BASELINE_MUST_DIFFER_FROM_OUTPUT');
    const stat = fs.statSync(args['--baseline']);
    if (stat.size > 20*1024*1024) throw new Error('BASELINE_TOO_LARGE');
    baseline = JSON.parse(fs.readFileSync(args['--baseline'],'utf8'));
    if (baseline.schemaVersion !== 1 || !Array.isArray(baseline.sources)) throw new Error('INVALID_BASELINE');
  }
  const report = await check({baseline,timeoutMs:args['--timeout-ms']?Number(args['--timeout-ms']):undefined,maxBytes:args['--max-bytes']?Number(args['--max-bytes']):undefined});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:report.status,checkedAt:report.checkedAt,output,changes:report.changes}));
  if (report.changes.accessFailures.length) process.exitCode = 2;
  return report;
}

module.exports = {allowedURL,fetchPublic,pageSemantic,bundleSemantic,clientModelSemantic,inspectClientModel,compare,check,externalOutput,main,DEFAULT_SOURCES,normalize};
if (require.main === module) main().catch(error=>{console.error(error.message);process.exitCode=1;});
