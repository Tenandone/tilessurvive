/* Fixed 3.0.1 release regression for the reviewed 4.0 additions.
 * Output and the immutable Git archive live outside the public repository.
 * No browser rendering, live service, mobile, or purchase claims are made. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const { execFileSync } = require('child_process');
const { parseHTML } = require('linkedom');
const delta=require('./foundation-40-test-allowances');
const patch41=require('./integration-41-test-allowances');
const root = path.resolve(__dirname, '..'), langs = ['ko', 'en', 'ja', 'ru', 'zh-tw'];
const release = '9ab98dc28ac8cd8e8bb8dbf94b61385be8f8e9e1';
const out = path.resolve(process.env.TS_FOUNDATION_AUDIT_DIR || path.join(root, '../audit-results/game-observations-20261009/foundation-40/site-tests'));
if (out === root || out.startsWith(root + path.sep)) throw Error('Audit output must stay outside the public repository');
fs.mkdirSync(out, { recursive: true });
const baseline = path.join(out, 'baseline-' + release), marker = path.join(baseline, '.source-commit');
if (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim() !== release) {
  const top = execFileSync('git', ['ls-tree', '--name-only', release], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(p => !['node_modules', '_sources', 'scripts'].includes(p));
  const archive = path.join(out, release + '.tar');
  execFileSync('git', ['archive', '--format=tar', '--output=' + archive, release, ...top], { cwd: root });
  fs.mkdirSync(baseline, { recursive: true });
  execFileSync('tar', ['-xf', archive, '-C', baseline]);
  fs.writeFileSync(marker, release + '\n');
}
if (process.argv.includes('--capture')) {
  console.log(JSON.stringify({ release, baseline, scope: 'Read-only fixed-release archive preparation; regression has not run.' }, null, 2));
  process.exit(0);
}
const read = (base, file) => fs.readFileSync(path.join(base, file), 'utf8');
const json = (base, file) => JSON.parse(read(base, file));
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const norm = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const text = node => norm(node?.textContent);
const parse = html => parseHTML(html).document;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const relative = file => path.relative(baseline, file).replaceAll('\\', '/');
const allBaseline = walk(baseline).map(relative), oldPages = allBaseline.filter(p => /^(ko|en|ja|ru|zh-tw)\/.*\.html$/.test(p));
const addedPages = langs.flatMap(lang => ['database/items', 'events/arms-race', 'events/daily-missions', 'heroes/dave'].map(route => `${lang}/${route}/index.html`));
const routeFor = file => '/' + file.replace(/index\.html$/, '');
const dataPet = json(root, 'data/foundation-40/pet-observations.json');
const official = json(root, 'data/foundation-40/official-sources-input.json');
const heroes = json(root, 'data/foundation-40/hero-observations.json');
const heroLevels = json(root, 'data/foundation-40/hero-skill-levels.json'), heroGear = json(root, 'data/foundation-40/hero-gear-levels.json'), heroCopy = require('../data/foundation-40/hero-skill-levels-copy');
const explorer = json(root, 'data/foundation-40/explorer.json');
const localized = require('../data/foundation-40/explorer-copy');
const daily = json(root, 'data/foundation-40/daily-missions.json');
const dailyCopy = require('../data/foundation-40/daily-missions-copy');
const errors = [], allowances = [], baselineCheckoutLineEndings = [], counts = { baselinePages: oldPages.length, newPages: 0, numericRows: 0, growthForms: 0, legacyImages: 0, protectedFiles: 0, localResources: 0, localLinks: 0, localFragments: 0, scriptSyntax: 0, heroBanners: 0 };
let checks = 0;
const check = (ok, message) => { checks++; if (!ok) errors.push(message); return !!ok; };
const tree = new Map(execFileSync('git', ['ls-tree', '-r', '--format=%(objectname)\t%(path)', release], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim().split('\n').map(line => line.split('\t')).map(([oid, file]) => [file, oid]));
for (const file of allBaseline.filter(file => file !== '.source-commit')) {
  const bytes = fs.readFileSync(path.join(baseline, file));
  const gitBlob = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  // Git for Windows may apply core.autocrlf when exporting unattributed text.
  // Accept that exact reversible conversion only when it recovers the Git blob.
  const lf = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
  const lfBlob = crypto.createHash('sha1').update(`blob ${lf.length}\0`).update(lf).digest('hex');
  const checkoutEOL = /(?:\.md|\.txt|^\.gitattributes|^\.gitignore)$/.test(file) && lfBlob === tree.get(file);
  if (gitBlob !== tree.get(file) && checkoutEOL) baselineCheckoutLineEndings.push(file);
  check(gitBlob === tree.get(file) || checkoutEOL, 'Baseline archive matches fixed Git blob (including exact checkout EOL conversion) ' + file);
}
const docs = new Map();
const load = file => { if (!docs.has(file)) docs.set(file, parse(fs.readFileSync(file, 'utf8'))); return docs.get(file); };
const rows = d => [...d.querySelectorAll('main table tr')].filter(r => r.querySelector('td') && /\d/.test(text(r))).map(r => [...r.children].filter(c => /^(TD|TH)$/.test(c.tagName)).map(text));
const forms = d => [...d.querySelectorAll('[data-growth-form]')].map(n => ({ key: n.getAttribute('data-growth-form'), config: JSON.parse(n.querySelector('script[type="application/json"]').textContent) }));
const webPages = d => {
  const found = [], visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if ([value['@type']].flat().includes('WebPage')) found.push({ name: value.name || null, description: value.description || null, url: value.url || null, inLanguage: value.inLanguage || null });
    if (value['@graph']) visit(value['@graph']);
  };
  for (const script of d.querySelectorAll('script[type="application/ld+json"]')) visit(JSON.parse(script.textContent));
  return found;
};
const metadata = d => ({ title: text(d.querySelector('title')), description: d.querySelector('meta[name="description"]')?.content || null, ogTitle: d.querySelector('meta[property="og:title"]')?.content || null, ogDescription: d.querySelector('meta[property="og:description"]')?.content || null, webPages: webPages(d), canonical: d.querySelector('link[rel="canonical"]')?.href || null, robots: d.querySelector('meta[name="robots"]')?.content || null, alternates: [...d.querySelectorAll('link[hreflang]')].map(n => [n.getAttribute('hreflang'), n.href]).sort() });
// This is a dated, field-specific correction, not an exception for an entire page.
const arcadiaPrefix = {
  ko: ['공성 시간 3시간 ·', '공성은 v2.5.600부터 2시간입니다. 다음 점령·보상 수치는 2026-01-07 가이드 기준입니다:'],
  en: ['The siege lasts 3 hours.', 'The contest lasts 2 hours from v2.5.600. The following occupation and reward values are from the guide dated 2026-01-07:'],
  ja: ['攻城は3時間。', '攻城期間はv2.5.600から2時間です。以下の占領・報酬の数値は2026-01-07のガイドに基づきます。'],
  ru: ['Осада длится 3 часа.', 'Начиная с v2.5.600 осада длится 2 часа. Следующие значения удержания и наград приведены по руководству от 2026-01-07:'],
  'zh-tw': ['攻城持續3小時；', '攻城時間自v2.5.600起為2小時。以下佔領與獎勵數值依據2026-01-07指南：']
};
const arcadiaText = (value, lang) => value.replace(...arcadiaPrefix[lang]);
const roles = { ko: ['공격', '지원'], en: ['Attacker', 'Support'], ja: ['攻撃', '支援'], ru: ['Атака', 'Поддержка'], 'zh-tw': ['攻擊', '支援'] };
const petChanges = [ ['snowball', 'role', 'Support', 'Attacker'], ['dodo', 'role', 'Attacker', 'Support'], ['snowball', 'rarity', null, 'R'], ['buckler', 'rarity', null, 'R'], ['hardhead', 'rarity', null, 'SR'], ['shadow', 'rarity', null, 'SR'] ];
const packagePoints = [[500,0,99,'not-shown'],[2500,0,499,'not-shown'],[5000,0,999,'not-shown'],[10000,10000,1999,'one-time-purchase'],[25000,25000,4999,'one-time-purchase'],[50000,50000,9999,'one-time-purchase']];
check(same(explorer.packages.map(p=>[p.baseDiamonds,p.bonusDiamonds,p.coinCost,p.condition]),packagePoints), 'Six exact screen-observed package base/bonus/coin/condition points');
check(explorer.packageScope.currency === 'exploration-coin' && explorer.packageScope.currencyNameKo === '탐색 코인' && explorer.packageScope.region === null && explorer.packageScope.reset === null, 'Package currency scope does not invent fiat region or reset');
check(explorer.packages.every(p=>p.currency === 'exploration-coin' && p.evidenceIds.includes('ui-057') && p.bonusDisplay === (p.bonusDiamonds ? 'shown' : 'not-shown')), 'Package point evidence and absent-bonus label');
const dailyPoints = [['login',1,'login',10],['exploration-chest',1,'chest',10],['vip-free-package',1,'claim',10],['intel',3,'missions',10],['heal',10,'troops',10],['building',1,'upgrade',30],['research',1,'research',30],['alliance-donation',15,'donations',10],['hero-recruit',1,'recruit',10],['troop-training',50,'troops',20],['speedup-use',1,'use',10],['timer-help',5,'helps',10],['infected-boss',1,'boss',10],['arena-challenge',1,'challenge',10],['payment',1,'payment',50],['dispatch-raid',1,'raid',20],['transport-raid',1,'raid',20],['speedup-minutes',120,'minutes',30]];
check(same(daily.missions.map(m=>[m.id,m.target,m.unit,m.points]),dailyPoints), 'Exact 18 observed daily mission target/unit/point pairs');
check(same(daily.milestones,[25,60,100,140,180,235,290]), 'Exact seven observed daily milestones');
check(daily.scope === 'observed-targets-only' && daily.gameVersion === '2.6.200' && daily.observedAt === '2026-10-09', 'Daily observation scope and version');
check(daily.missions.every(m=>m.paid === (m.id === 'payment') && langs.every(l=>typeof m.names[l] === 'string' && m.names[l].trim())), 'Only one optional paid mission and complete five-language labels');
check(dataPet.pets.length === 6 && dataPet.corrections.length === 2, 'Exactly the six observed pets and two role corrections');
for (const [id, field, from, to] of petChanges) {
  const observation = dataPet.pets.find(p => p.id === id);
  check(observation?.status === 'CONFIRMED' && observation[field] === to, `Pet evidence ${id}/${field}`);
  if (field === 'role') check(dataPet.corrections.some(c => c.id === id && c.from === from && c.to === to && c.status === 'CONFIRMED'), `Role correction gate ${id}`);
}
const duration = official.facts.find(f => f.id === 'arcadia-contest-duration-250600');
check(duration?.status === 'CONFIRMED' && duration.value === 2 && duration.unit === 'hours' && duration.sourceURL === 'https://tilesurvivegame.com/en/blog/1055' && duration.gameVersion === '2.5.600' && duration.sourcePublishedAt === '2026-07-09 11:03:57', 'Exact dated Arcadia duration evidence');
function expectedRow(row, file) {
  if (!/\/database\/pet-system\/index\.html$/.test(file)) return row;
  const lang = file.split('/')[0], [attack, support] = roles[lang], next = [...row];
  if (row.length === 5 && row[0] === (lang === 'ko' ? '스노우볼' : 'Snowball') && row[1] === support) next[1] = attack;
  if (row.length === 5 && row[0] === (lang === 'ko' ? '도도' : 'Dodo') && row[1] === attack) next[1] = support;
  return next;
}
function expectedIdentity(node, file) {
  if (file === 'ko/heroes/undine/index.html') {
    const expected = node.cloneNode(true), h1 = expected.querySelector('h1');
    if (h1?.textContent === 'Undine') h1.textContent = '운디네 (Undine)';
    return text(expected);
  }
  const match = file.match(/^(ko|en|ja|ru|zh-tw)\/database\/pet-system\/([^/]+)\/index\.html$/);
  if (!match) return text(node);
  const [, lang, id] = match, [attack, support] = roles[lang];
  const expected = node.cloneNode(true), kicker = expected.querySelector('.ts3-character-kicker span');
  if (!kicker) return text(node);
  if (id === 'snowball') kicker.textContent = kicker.textContent.replace(support, attack);
  if (id === 'dodo') kicker.textContent = kicker.textContent.replace(attack, support);
  const rarity = petChanges.find(c => c[0] === id && c[1] === 'rarity');
  if (rarity) kicker.textContent += ' · ' + rarity[3];
  return text(expected);
}
function verifyHeroAdditions(d, file) {
  const lang = file.split('/')[0], hero = heroes.heroes.find(h => file === `${lang}/heroes/${h.id}/index.html`);
  const skill = d.querySelector('[data-hero-observations-40="skills"]'), gear = d.querySelector('[data-hero-observations-40="equipment"]');
  if (!hero) { check(!skill && !gear, 'No unapproved hero comparison ' + file); return []; }
  const number = s => lang === 'ru' ? String(s).replace('.', ',') : String(s);
  const value = (row, key) => (row.unit === 'percent-bonus' ? '+' : '') + number(row[key]) + (row.unit === 'percent-atk' ? '% ATK' : '%');
  const expected = delta.localized(hero.rows.map(r => [norm(r.name[lang]), value(r, 'current'), value(r, 'next')]),file);
  const rowTexts = node => [...node?.querySelectorAll('tbody tr') || []].map(r => [...r.children].map(text));
  check(same(rowTexts(skill?.querySelector('table')), expected), 'Exact original three scoped skill rows ' + file);
  const model=heroLevels.heroes.find(h=>h.id===hero.id), copy=heroCopy[lang];
  check(text(skill?.querySelector('[data-skill-level-condition]'))===norm(copy.condition.replace('{cap}',hero.displayedSkillCap)), 'Exact conditional unlock/cap scope ' + file);
  const levelRows=model.skills[0].values.map((r,i)=>[String(r.level),...model.skills.map(s=>value({unit:s.unit,n:s.values[i].value},'n'))]);
  check(same(rowTexts(skill?.querySelector('[data-hero-levels-40="table"]')),levelRows),'Exactly forty explicit skill levels '+file);
  const selectors=[...skill.querySelectorAll('[data-skill-level-compare] select')];
  check(selectors.length===2&&selectors.every(s=>same([...s.querySelectorAll('option')].map(o=>Number(o.value)),Array.from({length:40},(_,i)=>i+1))),'Two forty-level selectors '+file);
  check(same(JSON.parse(d.getElementById('hero-skill-levels-data')?.textContent||'{}'),delta.localized({hero:model,copy},file)),'Exact curated level client payload with reviewed official labels '+file);
  expected.push(...levelRows);
  if (hero.gear) {
    const gearRows = hero.gear.rows.map(r => [norm(r.label[lang]), number(r.current), number(r.preview)]);
    check(same(rowTexts(gear?.querySelector('table')), gearRows), 'Exact equipment-panel preview rows ' + file);
    check(text(gear).includes(norm(heroes.copy.gearCondition[lang])), 'Equipment scope condition ' + file);
    expected.push(...gearRows);
    const gearNumber=n=>norm(new Intl.NumberFormat(lang).format(n));
    const allGear=heroGear.levels.map(r=>[String(r.level),...['attack','defense','hp','power'].map(k=>gearNumber(r[k])),'+'+gearNumber(r.frontDefense)+'%','+'+gearNumber(r.backAttack)+'%']);
    check(same(rowTexts(gear.querySelector('[data-hero-levels-40="gear"]')),allGear),'Exactly fifteen explicit gear rows '+file);expected.push(...allGear);
  } else check(!gear, 'No unobserved equipment table ' + file);
  if(hero.id==='lagnar'){
    const gearModel=require('../data/foundation-40/sea-hero-growth.json').gears.find(g=>g.id==='lagnar'),math=require('../js/sea-hero-growth-40'),name=require('../data/foundation-40/official-character-locales.json').heroes.find(h=>h.id==='lagnar').gear.skillName[lang];
    const added=[[name,math.format(gearModel.descriptionTemplate[lang],gearModel.levels[0].args),math.format(gearModel.descriptionTemplate[lang],gearModel.levels[14].args)],...gearModel.levels.map(r=>[String(r.level),math.format(gearModel.descriptionTemplate[lang],r.args)])].map(r=>r.map(norm));
    check(same(rowTexts(d.querySelector('[data-sea-growth="gear"]')),added),'Exactly scoped 15 Lagnar gear levels plus one endpoint comparison '+file);expected.push(...added);
  }
  return expected;
}
function verifyPage(file, old) {
  const full = path.join(root, file);
  if (!check(fs.existsSync(full), 'Preserved URL ' + routeFor(file))) return;
  const d = load(full), lang = file.split('/')[0], route = routeFor(file);
  const baseURL = new URL(d.querySelector('base[href]')?.getAttribute('href') || route, 'https://tilessurvive.net');
  check(d.querySelectorAll('h1').length === 1, 'One H1 ' + route);
  const ids = [...d.querySelectorAll('[id]')].map(n => n.id);
  check(ids.length === new Set(ids).size, 'Unique IDs ' + route);
  check(d.documentElement.lang === (old ? old.documentElement.lang : lang), 'HTML language preserved/localized ' + route);
  const officialPage = official.pages.find(page => file === `${lang}/${page.route}/index.html`);
  if (officialPage) {
    const section = d.querySelector(`[data-official-facts-40="${officialPage.route}"]`);
    check(d.querySelectorAll(`[data-official-facts-40="${officialPage.route}"]`).length === 1, 'One reviewed official addition ' + route);
    check(text(section?.querySelector('h2')) === norm(officialPage.sectionTitle[lang]), 'Localized official heading ' + route);
    check(section?.querySelectorAll('p[data-official-fact-ids]').length === officialPage.blockIds.length, 'Exact number of official fact blocks ' + route);
    for (const id of officialPage.blockIds) {
      const block = official.blocks.find(block => block.id === id), p = section?.querySelector(`[data-official-fact-ids="${block.factIds.join(' ')}"]`), copy = p?.cloneNode(true);
      copy?.querySelectorAll('small').forEach(node => node.remove());
      check(text(copy) === norm(block.text[lang]), 'Exact scoped official fact prose ' + route + ' ' + id);
      const sources = [...new Set(block.factIds.map(id => official.facts.find(f => f.id === id).sourceId))].map(id => official.sources.find(source => source.id === id));
      check(same([...p?.querySelectorAll('a[data-official-source]') || []].map(a => [a.getAttribute('data-official-source'), a.href, text(a)]), sources.map(source => [source.id, source.url, 'v' + source.gameVersion])), 'Official version/source citation ' + route + ' ' + id);
    }
  }
  if (file === `${lang}/database/pet-system/index.html`) {
    const scope = d.getElementById('pet-exp-scope-40'), form = d.querySelector('[data-growth-form="petExp"]');
    check(d.querySelectorAll('#pet-exp-scope-40').length === 1 && text(scope)===norm(patch41.expScope[lang]), 'Exact seven-pet shared EXP and training scope with default Starhorn ' + route);
    check(form?.getAttribute('aria-describedby')?.split(/\s+/).includes('pet-exp-scope-40'), 'EXP scope associated with existing form ' + route);
    patch41.assertPetSelection(d,lang);
    check(d.querySelector('[data-growth-form="petTraining"]')?.getAttribute('aria-describedby')?.split(/\s+/).includes('pet-training-scope-41'), 'Seven-pet training scope associated with existing form ' + route);
  }
  const observedPet = dataPet.pets.find(p => file === `${lang}/database/pet-system/${p.id}/index.html`);
  if (observedPet) {
    const points = [...d.querySelectorAll('[data-pet-exp-point-40]')], exp = observedPet.expObservation;
    check(points.length === 1 && points[0].getAttribute('data-pet-exp-point-40') === observedPet.id && text(points[0]) === `Lv.${exp.level} → ${exp.level + 1}: ${exp.threshold.toLocaleString('en-US')} EXP`, 'Exact single observed pet EXP point survives build ' + route);
  }
  // Validate both complete new tables against the pinned, reviewed model before
  // admitting their rows. Every pre-existing row still enters the multiset below.
  const approvedGearTables41=patch41.reviewedGearTables(d,lang,route);
  const approvedGearRows41=[...approvedGearTables41].flatMap(table=>[...table.querySelectorAll('tr')].filter(r=>r.querySelector('td')&&/\d/.test(text(r))).map(r=>[...r.children].filter(c=>/^(TD|TH)$/.test(c.tagName)).map(text)));
  const allowedNewRows = [...verifyHeroAdditions(d, file),...delta.petExpRows(file),...approvedGearRows41];
  if (['events/index.html','tools/index.html'].includes(file.slice(lang.length + 1))) {
    const entries = [...d.querySelectorAll('[data-daily-missions-entry] a')];
    check(entries.length === 1 && entries[0].href === `/${lang}/events/daily-missions/` && text(entries[0]) === norm(dailyCopy[lang].title + ' →'), 'One localized daily-mission entry on existing hub ' + route);
  }
  if (old) {
    const expectedMeta = metadata(old);
    if (file === `${lang}/events/arcadian-conquest/index.html`) {
      expectedMeta.description = arcadiaText(expectedMeta.description, lang);
      expectedMeta.ogDescription = arcadiaText(expectedMeta.ogDescription, lang);
      for (const page of expectedMeta.webPages) if (page.description) page.description = arcadiaText(page.description, lang);
      const expectedProse = norm(arcadiaText(old.querySelector('main > section.ts-database-22 > p')?.textContent || '', lang));
      check(text(d.querySelector('main > section.ts-database-22 > p')) === expectedProse, 'Arcadia only duration changed; historical quantities dated ' + route);
      check(!!d.querySelector('a[data-official-source="blog-1055"][href="https://tilesurvivegame.com/en/blog/1055"]'), 'Arcadia primary citation ' + route);
      allowances.push({ file, field: 'description/main duration paragraph', source: duration.sourceURL, version: duration.gameVersion });
    }
    const petRole = file === `${lang}/database/pet-system/snowball/index.html` ? [roles[lang][1], roles[lang][0]] : file === `${lang}/database/pet-system/dodo/index.html` ? [roles[lang][0], roles[lang][1]] : null;
    if (petRole) {
      expectedMeta.description = expectedMeta.description.replace(...petRole);
      expectedMeta.ogDescription = expectedMeta.ogDescription?.replace(...petRole) || null;
      for (const page of expectedMeta.webPages) if (page.description) page.description = page.description.replace(...petRole);
    }
    if (file === 'ko/heroes/undine/index.html') {
      const before = 'Undine · 스킬·능력치·성장 | TilesSurvive.net', after = '운디네 (Undine) · 스킬·능력치·성장 | TilesSurvive.net';
      check(expectedMeta.title === before && expectedMeta.ogTitle === before, 'Exact Undine name baseline');
      expectedMeta.title = after; expectedMeta.ogTitle = after;
      for (const page of expectedMeta.webPages) { check(page.name === before, 'Exact Undine WebPage name baseline'); page.name = after; }
      check(text(d.querySelector('h1')) === require('../data/foundation-40/official-character-locales.json').heroes.find(h=>h.id==='undine').names.ko, 'Official Korean Undine H1');
      check(![...d.querySelectorAll('main p')].some(p => text(p) === '이름은 영문 게임 표기 기준입니다.'), 'Obsolete English-name-only warning removed');
      allowances.push({ file, fields: ['h1', 'title', 'og:title', 'WebPage.name'], from: 'Undine', to: '운디네 (Undine)', evidence: 'undine-korean-name-evidence.json; screenshots 010 and 014' });
    }
    check(same(metadata(d), delta.localized(expectedMeta,file)), 'Exact SEO metadata/canonical/hreflang with scoped official labels ' + route);
    const oldRows = delta.expectedRows(rows(old),file,true), currentRows = rows(d);
    const actual = new Map(); for (const row of currentRows) actual.set(JSON.stringify(row), (actual.get(JSON.stringify(row)) || 0) + 1);
    for (const row of [...oldRows, ...allowedNewRows]) {
      const key = JSON.stringify(row), count = actual.get(key) || 0;
      check(count > 0, 'Numeric row/unit preserved or explicitly approved ' + route + ' ' + key.slice(0, 150));
      if (count) actual.set(key, count - 1);
    }
    check([...actual.values()].every(n => n === 0), 'No unapproved numeric table rows ' + route);
    counts.numericRows += oldRows.length;
    check(same(forms(d), delta.forms(forms(old),file)), 'Exact existing calculator configs with only reviewed Starhorn rows ' + route); counts.growthForms += forms(old).length;
    for (const selector of ['main .ts-skill-body', '[data-stage-picker]', 'main .stat-card,main .equipment-stat,main .ts-data-strip', 'main .ts3-character-identity']) {
      const current = new Set([...d.querySelectorAll(selector)].map(text));
      for (const n of old.querySelectorAll(selector)) check(current.has(selector.includes('identity') ? delta.identity(n, file) : delta.text(text(n),file,'skills')), 'Existing game block preserved ' + route + ' ' + text(n).slice(0, 100));
    }
    const imageList = [...d.querySelectorAll('main img')].map(n => n.getAttribute('src'));
    for (const n of old.querySelectorAll('main img')) { counts.legacyImages++; check(imageList.includes(delta.image(file,n.getAttribute('src'))), 'Original or exact approved game artwork destination ' + route + ' ' + n.getAttribute('src')); }
    const links = new Set([...d.querySelectorAll('main a[href]')].map(n => n.getAttribute('href')));
    for (const n of old.querySelectorAll('main a[href]')) check(links.has(n.getAttribute('href')), 'Original content link retained ' + route + ' ' + n.getAttribute('href'));
    const oldBanners = [...old.querySelectorAll('[data-lootbar-slot]')].map(n => n.outerHTML), newBanners = [...d.querySelectorAll('[data-lootbar-slot]')].map(n => n.outerHTML);
    check(same(newBanners, oldBanners), 'Banner markup/placement dimensions/referral unchanged ' + route);
    const affiliate = doc => [...doc.querySelectorAll('a[href*="lootbar.com"]')].map(n => n.outerHTML);
    check(same(affiliate(d), affiliate(old)), 'Every existing affiliate anchor unchanged ' + route);
    const coupon = old.querySelector('script[data-coupon-app]');
    if (coupon) check(hash(coupon.textContent) === hash(d.querySelector('script[data-coupon-app]')?.textContent || ''), 'Coupon logic hash ' + route);
  } else {
    counts.newPages++;
    const m = metadata(d), slug = file.slice(lang.length + 1).replace('/index.html', '');
    check(m.canonical === 'https://tilessurvive.net' + route && !!m.description && !!m.title, 'New page SEO ' + route);
    const expected = [...langs.map(l => [l, `https://tilessurvive.net/${l}/${slug}/`]), ['x-default', `https://tilessurvive.net/en/${slug}/`]].sort();
    check(same(m.alternates, expected), 'Five-language new page hreflang ' + route);
    if(slug==='heroes/dave')check(d.querySelector('.ts-lootbar-slot--hero')?.outerHTML===load(path.join(root,lang,'heroes/undine/index.html')).querySelector('.ts-lootbar-slot--hero').outerHTML,'One identical approved Dave hero banner '+route);
    else check(!d.querySelector('main a[href*="lootbar.com"]'), 'No unsolicited new advertising ' + route);
    const config = JSON.parse(d.querySelector('#foundation-data')?.textContent || '{}');
    if (['database/items','events/arms-race'].includes(slug)) check(same(config.event, explorer.event) && same(config.copy, localized[lang]), 'Exact curated explorer data ' + route);
    if (slug === 'database/items') {
      check(same([...d.querySelectorAll('[data-item-entry]')].map(n => n.id), [...explorer.items.map(i => i.id),...require('./build-item-chest-rewards-41').ids]), 'All curated items in searchable HTML ' + route);
      check(d.querySelectorAll('[data-item-filter] input[type="search"]').length === 1, 'Item search input ' + route);
      check(same(config.packages, explorer.packages), 'Exact six observed package configs ' + route);
      const section = d.getElementById('packages-heading')?.closest('section'), number = n => norm(new Intl.NumberFormat(lang).format(n));
      const packageRows = [...section?.querySelectorAll('tbody tr') || []].map(row => [...row.children].map(text));
      check(packageRows.length === 6, 'Six static package rows ' + route);
      explorer.packages.forEach((offer, i) => check(same(packageRows[i]?.slice(1), [number(offer.baseDiamonds), offer.bonusDisplay === 'shown' ? number(offer.bonusDiamonds) : norm(localized[lang].packageNoBonus), number(offer.baseDiamonds + offer.bonusDiamonds), number(offer.coinCost), norm(offer.condition === 'one-time-purchase' ? localized[lang].packageOneTime : localized[lang].packageNoCondition)]), 'Package quantity/unit/condition cells ' + route + ' ' + offer.id));
      check(text(section).includes(norm(localized[lang].packageScope.replace('{version}', explorer.packageScope.gameVersion).replace('{date}', explorer.packageScope.observedAt))) && text(section).includes(norm(localized[lang].packageUnits)) && text(section).includes(norm(localized[lang].packageCompareNote)), 'Observed account/version and same-currency package limitations ' + route);
      check(d.querySelectorAll('[data-package-compare] select').length === 2 && d.querySelector('[data-package-result]')?.getAttribute('aria-live') === 'polite', 'Package comparison inputs and accessible results ' + route);
    } else if (slug === 'events/arms-race') {
      check(d.querySelectorAll('[data-training-plan] select').length === 3, 'Training planner selectors ' + route);
      check(d.querySelectorAll('#points-heading + .ts40-scroll tbody tr').length === 11, 'Eleven training score rows ' + route);
    } else if (slug === 'events/daily-missions') {
      const c = JSON.parse(d.querySelector('#daily-missions-data')?.textContent || '{}'), copy = dailyCopy[lang];
      check(same(c,{missions:daily.missions.map(({id,points})=>({id,points})),milestones:daily.milestones,copy}), 'Exact scoped daily client payload ' + route);
      check(text(d.querySelector('h1')) === norm(copy.title) && m.description === copy.intro, 'Localized daily title and description ' + route);
      const missionRows = [...d.querySelectorAll('[data-daily-mission]')];
      check(same(missionRows.map(r=>r.getAttribute('data-daily-mission')),daily.missions.map(m=>m.id)), 'All 18 observed missions remain searchable HTML ' + route);
      const paidCopy = {ko:'선택 · 유료 결제',en:'Optional · paid purchase',ja:'任意・有料購入',ru:'Необязательно · платная покупка','zh-tw':'選填・付費購買'};
      for (const [i,mission] of daily.missions.entries()) {
        const row = missionRows[i], input = row?.querySelector('input'), label = row?.querySelector('label span')?.cloneNode(true);
        label?.querySelector('small')?.remove();
        check(text(label) === norm(mission.names[lang]) && text(row?.querySelector('td')) === String(mission.points), 'Exact mission label and point row ' + route + ' ' + mission.id);
        check(input?.value === mission.id && input.type === 'checkbox' && !input.hasAttribute('checked') && input.hasAttribute('hidden') && input.hasAttribute('disabled'), 'Unselected progressive-enhancement mission input ' + route + ' ' + mission.id);
        check(mission.paid ? text(row.querySelector('small')) === norm(paidCopy[lang]) : !row.querySelector('small'), 'Paid mission is optional only where observed ' + route + ' ' + mission.id);
      }
      check(same([...d.querySelectorAll('.ts40-daily-milestones li')].map(text),daily.milestones.map(String)), 'Seven static milestone amounts ' + route);
      check(same([...d.querySelectorAll('select[name="target"] option')].map(n=>Number(n.value)),daily.milestones), 'Seven exact planning targets ' + route);
      check(text(d.getElementById('daily-scope-note')) === norm(copy.incomplete) && text(d.getElementById('daily-plan-note')) === norm(copy.planning), 'Daily incomplete-coverage and session-only planning limitations ' + route);
      check(d.querySelector('[data-daily-result]')?.getAttribute('aria-live') === 'polite' && !!d.querySelector('[data-daily-clear]'), 'Accessible daily planning output and reset control ' + route);
    }
  }
  const heroBanner = d.querySelector('[data-lootbar-slot="hero_detail"]');
  if (heroBanner) {
    counts.heroBanners++;
    const lastSkill = [...d.querySelectorAll('main .ts-skill')].at(-1)?.closest('section');
    check(heroBanner.previousElementSibling === lastSkill, 'Hero banner follows skill section ' + route);
    check(heroBanner.querySelector('a[href]')?.href === 'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive', 'Exact referral attribution ' + route);
    check(d.querySelectorAll('main a[href*="lootbar.com"]').length === 1, 'One hero affiliate CTA ' + route);
  }
  for (const n of d.querySelectorAll('img[src],script[src],link[rel="stylesheet"][href],source[srcset]')) {
    const raw = n.getAttribute('src') || n.getAttribute('href') || n.getAttribute('srcset');
    for (const value of raw.split(',').map(x => x.trim().split(/\s+/)[0])) {
      const url = new URL(value, baseURL); if (url.origin !== 'https://tilessurvive.net') continue;
      counts.localResources++; check(fs.existsSync(path.join(root, decodeURIComponent(url.pathname))), 'Static resource exists ' + route + ' ' + url.pathname);
    }
    if (n.tagName === 'IMG') check(n.hasAttribute('alt') && Number(n.getAttribute('width')) > 0 && Number(n.getAttribute('height')) > 0, 'Image alt/dimensions ' + route + ' ' + raw);
  }
  for (const anchor of d.querySelectorAll('a[href]')) {
    const raw = anchor.getAttribute('href'); if (!raw || /^(mailto:|tel:|javascript:)/.test(raw)) continue;
    let url; try { url = new URL(raw, baseURL); } catch { check(false, 'Invalid link ' + route + ' ' + raw); continue; }
    if (url.origin !== 'https://tilessurvive.net') continue;
    const target = path.join(root, decodeURIComponent(url.pathname), path.extname(url.pathname) ? '' : 'index.html');
    counts.localLinks++; check(fs.existsSync(target), 'Local destination ' + route + ' ' + url.pathname);
    if (url.hash && fs.existsSync(target) && target.endsWith('.html')) { counts.localFragments++; check(!!load(target).getElementById(decodeURIComponent(url.hash.slice(1))), 'Local fragment ' + route + ' ' + url.pathname + url.hash); }
  }
  for (const script of d.querySelectorAll('script')) {
    if (/application\/(ld\+)?json/.test(script.type || '')) { try { JSON.parse(script.textContent); check(true, ''); } catch { check(false, 'Valid embedded JSON ' + route); } }
    else if (!script.src && (!script.type || script.type === 'text/javascript')) { try { new vm.Script(script.textContent); check(true, ''); counts.scriptSyntax++; } catch (e) { check(false, 'Inline JS syntax ' + route + ': ' + e.message); } }
  }
}
for (const file of oldPages) verifyPage(file, parse(read(baseline, file)));
for (const file of addedPages) verifyPage(file, null);
const currentPages = langs.flatMap(lang => walk(path.join(root, lang))).filter(f => f.endsWith('.html')).map(f => path.relative(root, f).replaceAll('\\', '/'));
check(same([...currentPages].sort(), [...oldPages, ...addedPages].sort()), 'Existing URL set plus exactly fifteen intentional additions');

for (const file of allBaseline.filter(p => p.endsWith('.html') && !/^(ko|en|ja|ru|zh-tw)\//.test(p))) {
  check(fs.existsSync(path.join(root, file)) && hash(fs.readFileSync(path.join(root, file))) === hash(fs.readFileSync(path.join(baseline, file))), 'Other existing HTML URL/component unchanged ' + file);
}
// Existing content is frozen except these precise, reviewed JSON field updates.
const protectedFiles = allBaseline.filter(p => /^(img|js|css|config)\//.test(p) || /^\.github\/workflows\//.test(p) || /^data\/.*\.json$/.test(p) || ['CNAME', 'robots.txt', 'favicon.ico'].includes(p));
const oldWorkflowFiles = allBaseline.filter(p => /^\.github\/workflows\//.test(p)).sort();
const workflowDir = path.join(root, '.github/workflows');
const currentWorkflowFiles = fs.existsSync(workflowDir) ? walk(workflowDir).map(f => path.relative(root,f).replaceAll('\\','/')).sort() : [];
check(same(currentWorkflowFiles,oldWorkflowFiles), 'Workflow file set unchanged (including no added workflow when the baseline has none)');
counts.workflowFiles = currentWorkflowFiles.length;
for (const file of protectedFiles) {
  if (file === 'data/search-index.json') continue;
  counts.protectedFiles++;
  if(delta.deletedDrafts[file]){check(!fs.existsSync(path.join(root,file))&&hash(fs.readFileSync(path.join(baseline,file)))===delta.deletedDrafts[file],'Exact privately backed-up unused draft deletion '+file);continue;}
  if (!check(fs.existsSync(path.join(root, file)), 'Protected file exists ' + file)) continue;
  if(['data/companions.json','data/expansion-22/database.json','data/expansion-22/ledger.json','data/expansion-22/manifest.json'].includes(file))check(require('util').isDeepStrictEqual(json(root,file),delta.source(file,json(baseline,file))),'Only exact approved source/provenance fields '+file);
  else {const reviewed=delta.reviewedScript(file,read(baseline,file));check(hash(fs.readFileSync(path.join(root, file))) === hash(reviewed===null?fs.readFileSync(path.join(baseline, file)):reviewed), reviewed===null?'Protected formula/data/artwork/style/config hash '+file:'Only exact alias haystack expression changed '+file);}
}
const expectedCopy = JSON.parse(JSON.stringify(require(path.join(baseline, 'data/expansion-22/copy.js'))));
for (const lang of langs) expectedCopy[lang].arcadiaText = arcadiaText(expectedCopy[lang].arcadiaText, lang);
check(same(require('../data/expansion-22/copy'), expectedCopy), 'Only exact dated Arcadia copy values changed in five locales');
const oldXML = read(baseline, 'sitemap.xml'), currentXML = read(root, 'sitemap.xml');
const nodes = xml => xml.match(/<url>[\s\S]*?<\/url>/g) || [];
const oldNodes = nodes(oldXML), newNodes = nodes(currentXML), oldSet = new Set(oldNodes);
for (const node of oldNodes) check(newNodes.filter(n => n === node).length === 1, 'Original sitemap entry preserved byte-for-byte ' + node.match(/<loc>(.*?)<\/loc>/)?.[1]);
const extras = newNodes.filter(n => !oldSet.has(n));
check(same(extras.map(n => n.match(/<loc>(.*?)<\/loc>/)?.[1]).sort(), addedPages.map(f => 'https://tilessurvive.net' + routeFor(f)).sort()), 'Only fifteen sitemap URL additions');
const searchOld = json(baseline, 'data/search-index.json'), search = json(root, 'data/search-index.json');
check(search.itemCount === search.items.length, 'Search count');
check(new Set(search.items.map(i => i.url)).size === search.items.length, 'Unique search URL entries');
for (const old of searchOld.items) check(search.items.some(i => i.url === old.url && i.language === old.language), 'Existing searchable URL preserved ' + old.url);
for (const file of addedPages) {
  const lang = file.split('/')[0], item = search.items.find(i => i.url === routeFor(file)), d = load(path.join(root, file));
  check(item?.language === lang && item.title === text(d.querySelector('title')) && item.description === metadata(d).description, 'New page searchable with matching locale/metadata ' + routeFor(file));
}
for (const lang of langs) for (const item of explorer.items) {
  const url = `/${lang}/database/items/#${item.id}`, indexed = search.items.find(entry => entry.url === url);
  check(indexed?.language === lang && indexed.title === localized[lang][item.id], 'Localized item search entry ' + url);
  check(!!load(path.join(root, lang, 'database/items/index.html')).getElementById(item.id), 'Item search anchor destination ' + url);
}
check(same(search.items.map(item => item.url).sort(), [...searchOld.items.map(item => item.url), ...addedPages.map(routeFor), ...langs.flatMap(lang => explorer.items.map(item => `/${lang}/database/items/#${item.id}`)), ...require('./lib/search-additions-41').entries().map(item=>item.url), ...require('./build-item-chest-rewards-41').entries().map(item=>item.url), ...langs.flatMap(lang=>require('../data/foundation-40/pet-skills-41.json').skills.map(s=>`/${lang}/database/pet-system/${s.pet}/#pet-skill-${s.slot}-41`))].sort()), 'Exact approved page, item, gear-comparison, pet-training and pet-skill search destinations');
for (const file of ['js/foundation-40.js', 'js/foundation-40-math.js', 'js/daily-missions-40.js','js/pet-exp-profiles-40.js','js/sea-hero-growth-40.js']) {
  try { new vm.Script(read(root, file)); counts.scriptSyntax++; check(true, ''); } catch (e) { check(false, 'New JS syntax ' + file + ': ' + e.message); }
}
check(counts.baselinePages === 473 && counts.newPages === 20, '473 preserved language pages and twenty approved new pages');
check(counts.heroBanners === 140, '135 preserved plus five approved Dave hero banner placements');
for(const [script,args]of [['test-hero-skill-levels-40.js',[]],['test-dave-40.js',[]],['test-pet-growth-40.js',['--source-only']],['test-official-locales-40.js',[]],['test-pet-exp-profiles-40.js',[]],['test-sea-hero-growth-40.js',[]],['test-search-additions-41.js',[]]]){
 try{execFileSync(process.execPath,[path.join(__dirname,script),...args],{cwd:root,encoding:'utf8'});check(true,'');}catch(e){check(false,'Exact reviewed model and component checks '+script+': '+String(e.stdout||e.message).slice(-1500));}
}
const result = { release, checkedAt: new Date().toISOString(), checks, counts, allowances, baselineCheckoutLineEndings, errors, passed: errors.length === 0, scope: 'Static and source regression against immutable 9ab98dc. Existing routes, exact canonical/hreflang, numerical rows, calculator configs and formula hashes, coupon logic, art and affiliate markup. New page JSON/search/sitemap/link/syntax validation. No browser/mobile/production/purchase claims.' };
fs.writeFileSync(path.join(out, 'regression.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, errors: errors.slice(0, 60), totalErrors: errors.length }, null, 2));
if (errors.length) process.exitCode = 1;
