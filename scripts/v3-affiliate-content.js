"use strict";
const copy = require('./sync-ten-benefits-copy').project(require('../data/v3-affiliate-copy.json'));
const locales = new Set(require('../data/i18n/locales.json').locales.map(x => x.code));
const TEN_URL = 'https://www.lootbar.com/ko/shop/ten/top-up/tiles-survive';
const MEASUREMENT_ID = 'G-Z2MJ6TXZHK';
const SECONDARY_MEASUREMENT_ID = 'G-TMGDGSEWW6';
// Historical IDs are accepted only as reviewed migration inputs, never new destinations.
const LEGACY_HOME_MEASUREMENT_ID = 'G-Z2MJ6TZXHK';
const APPROVED_MEASUREMENT_IDS = new Set([MEASUREMENT_ID, SECONDARY_MEASUREMENT_ID, LEGACY_HOME_MEASUREMENT_ID]);
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function get(locale) {
  if (!locales.has(locale) || !copy.locales[locale]) throw new Error('Missing V3 affiliate locale: ' + locale);
  return copy.locales[locale];
}
function renderPrivacyNotice(locale) { get(locale); return ''; }

function renderGuide(locale) {
  const c = get(locale);
  // Keep the source FAQ order stable: step 2 still uses faq[3]. Render TEN's
  // operator-confirmed benefit answer first, using the shared payout policy.
  const qa = require('./ten-benefits-content').renderBenefits(locale) + c.faq.slice(0,7).map(([q,a]) => `<details class="v3-topup-question"><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('\n');
  return `<section id="v3-topup-guide" class="v3-affiliate-guide" data-v3-guide><h2>${escape(c.title)}</h2><p>${escape(c.lead)}</p>${qa}<p class="v3-source-note">${escape(c.evidence)}: <time datetime="${copy.reviewedOn}">${copy.reviewedOn}</time> · <a href="https://www.lootbar.com/top-up/tiles-survive" rel="noopener noreferrer" target="_blank">${escape(c.providerGuide)}</a> · <a href="https://static.lootbar.gg/static/user_agreement.html" rel="noopener noreferrer" target="_blank">${escape(c.providerTerms)}</a></p><p>${escape(c.disclosure)}</p><a class="v3-link-button" href="${TEN_URL}" data-v3-cta="outbound" data-v3-placement="guide" data-v3-feature="topup" target="_blank" rel="sponsored noopener noreferrer">${escape(c.outbound)}</a></section>`;
}
function renderResultChoices(locale, feature = 'calculator') {
  const c = get(locale);
  const allowed = new Set(['calculator','power_plant','calendar','search','home','tools','topup']);
  if (!allowed.has(feature)) throw new Error('Unknown V3 feature: ' + feature);
  return `<section class="v3-next-steps" data-v3-choices><h2>${escape(c.choicesTitle)}</h2><div class="v3-choice-grid"><article><h3>${escape(c.freeTitle)}</h3><p>${escape(c.freeText)}</p><a href="/${locale}/events/daily-missions/" data-v3-cta="free" data-v3-placement="result" data-v3-feature="${feature}">${escape(c.freeCta)}</a></article><article><h3>${escape(c.paidTitle)}</h3><p>${escape(c.paidText)}</p><a href="/${locale}/top-up/" data-v3-cta="guide" data-v3-placement="result" data-v3-feature="${feature}">${escape(c.guideCta)}</a></article></div><p>${escape(c.noEquivalence)}</p></section>`;
}
/** Narrow correction of the old three-step guide; callers scope to top-up pages.
 * The dated provider guide places payment before Self-TopUp redemption.
 * Return the old/new text so the publisher can keep an audit ledger.
 */
function projectLegacyTopup(document, locale) {
  const paragraph = document.querySelector('[data-topup-step="2"] p');
  if (!paragraph) return [];
  const before = paragraph.textContent, after = get(locale).faq[3][1];
  if (before === after) return [];
  paragraph.textContent = after;
  return [{selector: '[data-topup-step="2"] p', before, after, reason: 'Provider procedure: payment precedes Self-TopUp redemption', source: copy.provenance.sources[0], reviewedOn: copy.reviewedOn}];
}
/** Replace only the site's known GA4 bootstrap. AdSense/CMP scripts are untouched.
 * The shared runtime performs only denied-storage GA measurement and respects objections.
 */
function transformAnalytics(html) {
  const ids = new Set([MEASUREMENT_ID]);
  function retain(id) {
    if (!APPROVED_MEASUREMENT_IDS.has(id)) throw new Error('Unreviewed Google measurement ID: ' + id);
    ids.add(id);
  }
  let stripped = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (whole, attrs, body) => {
    if (/\bdata-v3-ga-bootstrap\b/i.test(attrs)) {
      // A second build must preserve the page's reviewed secondary destination.
      for (const id of body.match(/\bG-[A-Z0-9]+\b/g) || []) retain(id);
      const previous = body.match(/\bTS_V3_GA_IDS\s*=\s*(\[[\s\S]*?\])\s*;/);
      if (previous) {
        let values;
        try { values = JSON.parse(previous[1]); } catch (_) { throw new Error('Invalid prior V3 measurement IDs'); }
        if (!Array.isArray(values)) throw new Error('Invalid prior V3 measurement IDs');
        values.forEach(retain);
      }
      if (/adsbygoogle|googlesyndication|__tcfapi|__gpp/.test(body)) throw new Error('V3 GA bootstrap mixed with ad/CMP code');
      return '';
    }
    const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (srcMatch) {
      const src = new URL((srcMatch[1] || srcMatch[2] || srcMatch[3]).replace(/&amp;/g, '&'), 'https://tilessurvive.net');
      if (/^(?:www\.)?googletagmanager\.com$/.test(src.hostname) && src.pathname === '/gtag/js') {
        retain(src.searchParams.get('id'));
        return '';
      }
    }
    const configCalls = [...body.matchAll(/\b(?:window\.)?gtag\s*\(\s*(['"])config\1\s*,\s*(['"])([^'"]+)\2/g)];
    if (/\b(?:window\.)?gtag\s*\(\s*['"]config['"]/.test(body)) {
      const allConfigCalls = [...body.matchAll(/\b(?:window\.)?gtag\s*\(\s*['"]config['"]/g)];
      if (!configCalls.length || configCalls.length !== allConfigCalls.length) throw new Error('Unreviewed dynamic Google tag config');
      configCalls.forEach(call => retain(call[3]));
      // Do not discard an unreviewed ID hidden in a combined dynamic loader.
      for (const id of body.match(/\bG-[A-Z0-9]+\b/g) || []) retain(id);
      // Fail closed if a future combined script needs an intentional migration.
      if (/adsbygoogle|googlesyndication|__tcfapi|__gpp/.test(body)) throw new Error('GA bootstrap is mixed with ad/CMP code; split explicitly');
      return '';
    }
    return whole;
  });
  // The legacy coupon pages also preconnected to GA before a choice was made.
  stripped = stripped.replace(/<link\b[^>]*>/gi, whole => {
    const rel = whole.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const href = whole.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (rel && href && /^(preconnect|dns-prefetch)$/i.test(rel[1])) {
      const url = new URL(href[1], 'https://tilessurvive.net');
      if (/^(?:www\.)?googletagmanager\.com$/.test(url.hostname)) return '';
    }
    return whole;
  });
  const orderedIds = [MEASUREMENT_ID];
  const boot = `<script data-v3-ga-bootstrap data-v3-owned="analytics">window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.gtag('set','ads_data_redaction',true);window.gtag('set','url_passthrough',false);window.TS_ANALYTICS_BOOTSTRAPPED=true;window.TS_V3_GA_IDS=${JSON.stringify(orderedIds)};</script>`;
  if (!/<head\b[^>]*>/i.test(stripped)) throw new Error('Expected HTML head');
  return stripped.replace(/<head\b[^>]*>/i, match => match + boot);
}
module.exports = { TEN_URL, MEASUREMENT_ID, SECONDARY_MEASUREMENT_ID, LEGACY_HOME_MEASUREMENT_ID, renderGuide, renderResultChoices, renderPrivacyNotice, projectLegacyTopup, transformAnalytics };
