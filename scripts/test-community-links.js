'use strict';

// Read-only checks for the support-link projection and its published snapshots.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseHTML } = require('linkedom');
const config = require('../config/community.json');
const { MARKER, ANCHOR, validateUrl, htmlFiles, project, run } = require('./sync-community-links');

const root = path.resolve(__dirname, '..');
const languages = ['ko', 'en', 'ja', 'ru', 'zh-tw', 'de'];
const retired = [
  'https://discord.gg/sUqbBskd',
  'https://discord.gg/EjqWhTPya',
  'https://discord.gg/sUqbBskdEjqWhTPya',
  'https://discord.gg/tiles-survive',
];
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const documentFor = html => parseHTML(html).document;
const supportAnchors = document => [...document.querySelectorAll(`a[${MARKER}]`)];

function assertSupportAnchor(anchor, expected, context) {
  assert.equal(anchor.getAttribute('href'), expected, context + ': configured destination');
  assert.equal(anchor.getAttribute('target'), '_blank', context + ': new tab');
  const rel = new Set((anchor.getAttribute('rel') || '').split(/\s+/));
  assert.ok(rel.has('noopener') && rel.has('noreferrer'), context + ': external-link security');
}

function maskOwnedTags(html) {
  return html.replace(ANCHOR, tag => documentFor(tag + '</a>').querySelector('a').hasAttribute(MARKER)
    ? '<SUPPORT-ANCHOR>' : tag);
}

test('projection changes only marked support anchors and preserves other content byte for byte', () => {
  const html = `<main data-value="unchanged"><script>window.dataLayer = [{ game: 123 }];</script>
<a class='help' data-support-discord href='https://discord.gg/old-support' target='_self' rel='nofollow sponsored'>Support <b>help</b></a>
<a data-support-discord="" class="button">Second support link</a>
<a href="https://discord.gg/unrelated-community" target="_self" rel="nofollow">Other Discord</a>
<a href="${retired[0]}">Unmarked legacy destination</a>
<a href="https://open.kakao.com/o/gako89Wh" rel="noopener noreferrer">KakaoTalk</a>
<a data-affiliate-placement="guide" href="https://lootbar.gg/top-up/tiles-survive?utm_source=tiles&amp;utm_medium=affiliate" rel="sponsored noopener" target="_blank">Affiliate</a>
<a href="/ko/calculators/#total">Calculator</a></main>`;
  const result = project(html);
  assert.notEqual(result, html, 'stale marked anchors must be updated');
  assert.equal(maskOwnedTags(result), maskOwnedTags(html), 'unowned markup, text and scripts stay identical');
  const anchors = supportAnchors(documentFor(result));
  assert.equal(anchors.length, 2);
  for (const anchor of anchors) assertSupportAnchor(anchor, config.supportDiscordUrl, 'fixture');
  assert.equal(anchors[0].className, 'help');
  assert.equal(anchors[0].innerHTML, 'Support <b>help</b>');
  assert.ok(anchors[0].rel.includes('nofollow') && anchors[0].rel.includes('sponsored'), 'existing rel tokens survive');
});

test('an invite change is projected from one supplied URL and remains idempotent', () => {
  const html = '<a data-support-discord href="https://discord.gg/first" rel="noopener">Help</a>';
  const override = 'https://discord.gg/replacement-for-test';
  const result = project(html, override);
  assertSupportAnchor(supportAnchors(documentFor(result))[0], override, 'override');
  assert.equal(project(result, override), result, 'a second pass must not alter generated HTML');
  const configured = project(result);
  assertSupportAnchor(supportAnchors(documentFor(configured))[0], config.supportDiscordUrl, 'config');
  assert.equal(project(configured), configured, 'configured projection is idempotent');
});

test('invalid or noncanonical configured invite destinations are rejected before projection', () => {
  assert.equal(validateUrl(config.supportDiscordUrl), config.supportDiscordUrl);
  for (const value of [
    '', 'not a URL', 'http://discord.gg/invite', 'https://example.com/invite',
    'https://discord.gg/', 'https://discord.gg/invite/extra', 'https://discord.gg/invite/',
    'https://discord.gg/invite?source=site', 'https://discord.gg/invite#join',
    'https://user:password@discord.gg/invite', 'https://discord.gg:8443/invite',
    'https://DISCORD.gg/invite', ' https://discord.gg/invite', 'javascript:alert(1)',
  ]) {
    assert.throws(() => validateUrl(value), undefined, String(value));
    assert.throws(() => project('<p>Unchanged page</p>', value), undefined, String(value));
  }
});

test('all generated support anchors match central configuration and cover six languages', () => {
  const byLanguage = Object.fromEntries(languages.map(lang => [lang, 0]));
  let total = 0;
  for (const file of htmlFiles(root)) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const html = fs.readFileSync(file, 'utf8');
    assert.equal(project(html), html, relative + ': generated snapshot is current');
    const document = documentFor(html);
    for (const anchor of supportAnchors(document)) {
      assertSupportAnchor(anchor, config.supportDiscordUrl, relative);
      total++;
      const lang = relative.split('/')[0];
      if (lang in byLanguage) byLanguage[lang]++;
    }
    for (const anchor of document.querySelectorAll('a[href]')) {
      if (anchor.getAttribute('href') === config.supportDiscordUrl) {
        assert.ok(anchor.hasAttribute(MARKER), relative + ': support destination must be centrally managed');
      }
    }
  }
  assert.ok(total > 0, 'support links were actually inspected');
  for (const lang of languages) assert.ok(byLanguage[lang] > 0, lang + ': localized support link coverage');
  assert.equal(run({ check: true }).pass, true, 'publication check must not require rewrites');
});

test('six guides and non-Korean components retain their support links while Korean community stays KakaoTalk', () => {
  for (const lang of languages) {
    const guide = documentFor(read(`${lang}/guides/discount-topup/index.html`));
    const mainLinks = [...guide.querySelectorAll(`main a[${MARKER}]`)];
    assert.equal(mainLinks.length, 2, lang + ': both article support calls to action');
    for (const anchor of mainLinks) assertSupportAnchor(anchor, config.supportDiscordUrl, lang + ' guide');
    for (const part of ['header', 'footer']) {
      const component = documentFor(read(`components/${lang}/${part}.html`));
      if (lang === 'ko') {
        assert.equal(supportAnchors(component).length, 0, 'Korean community component is not a Discord support link');
        assert.equal(component.querySelectorAll('a[href="https://open.kakao.com/o/gako89Wh"]').length, 1,
          'Korean ' + part + ': KakaoTalk community is preserved');
      } else {
        const anchors = supportAnchors(component);
        assert.equal(anchors.length, 1, lang + ' ' + part + ': managed community link');
        assertSupportAnchor(anchors[0], config.supportDiscordUrl, lang + ' ' + part);
      }
    }
    if (lang === 'ko') {
      assert.equal(guide.querySelectorAll('footer a[href="https://open.kakao.com/o/gako89Wh"]').length, 1,
        'Korean generated footer retains KakaoTalk alongside the article support links');
    }
  }
});

test('retired invite URLs are absent from public pages, configuration and build sources', () => {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/);
  const textExtension = /\.(?:html?|[cm]?js|json|md|ya?ml|txt|css|xml|svg|toml|ini)$/i;
  for (const relative of files) {
    if (relative === 'scripts/test-community-links.js' || !textExtension.test(relative)) continue;
    const html = read(relative);
    for (const url of retired) assert.ok(!html.includes(url), relative + ': retired invite ' + url);
  }
});
