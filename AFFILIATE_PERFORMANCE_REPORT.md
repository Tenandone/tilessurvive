# TilesSurvive.net Affiliate Performance Baseline

Last reviewed: 2026-09-18

## Referral destination

- Current repository URL: `https://lootbar.gg/shop/ten/top-up/tiles-survive`
- The existing referral path is preserved. No guessed referral parameters or UTM values were added.

## Measurement

The lightweight click listener in `js/affiliate-tracking.js` emits a GA4 event named `affiliate_click` when a LootBar link is activated.

Parameters:

- `destination`
- `page`
- `language`
- `placement`
- `campaign`
- `content_type`

No personal data is collected by this listener.

## Placement taxonomy

| Placement | Intent | Typical location |
|---|---:|---|
| `topup_primary` | High | Top-up landing and top-up guides |
| `hero_primary` / `hero_inline` | Medium to high | Hero growth pages |
| `gear_inline` | High | Gear and exclusive-equipment content |
| `event_bottom` | High | Event preparation content |
| `season_prepare` | High | Season preparation content |
| `content_inline` | Medium | Other relevant content |
| `footer` | Low | Footer disclosure/navigation |

## Baseline limitations

GA4 account-level users, sessions, countries, traffic sources, revenue, and LootBar conversions are not available from the repository. They must not be inferred. After deployment, compare `affiliate_click` by page, language, placement, and content type. Revenue attribution remains dependent on LootBar reporting.

## A/B test candidates

1. Top-up landing primary CTA copy by language.
2. Event preparation CTA near the resource checklist versus at the page end.
3. Hero growth CTA after Quick Facts versus after equipment details.
4. Disclosure wording placement near the CTA versus a compact inline note plus full policy link.
