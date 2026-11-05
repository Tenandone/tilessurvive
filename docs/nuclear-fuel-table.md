# Nuclear Fuel overview and poster

The overview lives on the existing `/{locale}/eras/nuclear-age/` route, at `#nuclear-fuel-table`. Its 21 translations and downloadable SVG posters share `scripts/nuclear-fuel-summary.js`, which uses the existing planner's range calculation over `data/nuclear-age.json`.

## Meaning of a level

N1, N2 and N3 each contain five upgrades. “Per level” sums those five upgrades; “From Lv30” sums all upgrades after normal Lv30 through completion of that nuclear level. A cost is a configured Nuclear Fuel requirement, not a measurement of an account's actual balance deduction.

The main totals include Power Plant, Barracks 1, Barracks 2, Barracks 3 and Hospital. These are the buildings covered by the current official announcement. The two laboratories have separate client-configured upgrade rows; their availability has not been confirmed in the current release notices, so their preview never contributes to the main totals. The Nuclear Fuel Plant's ordinary levels are separate and remain in the existing planner.

The retained 2.6.400 client tables are the numerical source. Earlier 2.6.300 data uses a different item and must not be relabeled as Nuclear Fuel. The official [initial announcement](https://tilesurvivegame.com/en/blog/1213) and [2.6.400 release](https://tilesurvivegame.com/en/blog/1221) establish level structure and state-dependent availability, not the individual numeric costs.

Power Plant row `501051` still has a null `ReqItemSoc`. The projection keeps its total null and separately exposes the known subtotal and missing source IDs. That uncertainty propagates through all cumulative totals. A zero is accepted only when explicitly present in the numeric source. It is never substituted for missing information.

## Regeneration

1. Review client version, source IDs, item ID, level/rank mapping and availability before changing the canonical data. Keep the raw evidence and replaced values in the private ledger outside this repository.
2. Update `data/nuclear-fuel-copy.json` when editorial labels change. Building and item names come from the canonical client localization.
3. Run the Nuclear Age owner, then the home, shared design and identity owners to refresh their reviewed asset hashes:

   ```sh
   node scripts/build-nuclear-age.js
   node scripts/build-v5-landing.js
   node scripts/build-v6-system.js
   node scripts/build-site-identity.js
   npm run build
   npm run test:nuclear-age
   npm run test:nuclear-fuel
   npm run test:site-identity
   ```

The Nuclear Age owner synchronously regenerates all SVGs and `data/nuclear-fuel-poster-manifest.json`. Each standalone poster embeds PNG image data and the same complete projection used by the table. The manifest records input, projection, image and output hashes. `node scripts/build-nuclear-fuel-poster.js --check` rejects stale posters.

The stage artwork is the client's shared `sp_icon_level_upper` symbol with a separate level number, matching the client composition. Laboratory artwork is its base building icon. Neither is represented as an unretrieved level-specific building skin.

Before publishing, retain the Git baseline and back up the `img/nuclear-age/fuel-table-*.svg` outputs as well as the release pipeline's ordinary public-file snapshot. Validate mobile, desktop and RTL layouts, both modes, the existing planner and the SVG download. Do not change GA consent, Ads/CMP, TEN URLs, canonical/hreflang or the existing guide URL as part of a data refresh.
