# Nuclear Fuel overview and poster

The overview lives on the existing `/{locale}/eras/nuclear-age/` route, at `#nuclear-fuel-table`. Its 21 translations and downloadable SVG posters share `scripts/nuclear-fuel-summary.js`, which uses the existing planner's range calculation over `data/nuclear-age.json`.

## Meaning of a level

N1, N2 and N3 each contain five upgrades. “Per level” sums those five upgrades; “From Lv30” sums all upgrades after normal Lv30 through completion of that nuclear level. A cost is a configured Nuclear Fuel requirement, not a measurement of an account's actual balance deduction.

There are two comparison scopes. The **Power Plant tree** contains four buildings: Power Plant (`800005`), Barracks 1 (`800007`), Hospital (`800010`) and Lab 1 (`800012`). The **all-buildings** scope contains fourteen: those four, Barracks 2 (`800008`), Barracks 3 (`800009`), Lab 2 (`800168`), Communications Outpost (`800016`), Garrison Station (`800152`), Hero Academy (`800142`), Warbringer (`800147`), Aegis (`800148`), Guardian of Life (`800149`) and Artifact Workshop (`800150`). Canonical localized names, rather than this explanatory English list, are used in the UI.

Both scopes sum every included building to the same selected nuclear level. They are not minimum-cost dependency plans for reaching a Power Plant level. The original five announced buildings remain classified separately from the nine additional client-configured buildings; that provenance classification does not remove verified costs from the fourteen-building comparison. State-specific feature availability is a separate condition. The Nuclear Fuel Plant (`800419`) has twelve ordinary levels, remains separately selectable in the planner and contributes to neither nuclear-level total.

The retained 2.6.400 client tables are the numerical source. Earlier 2.6.300 data uses a different item and must not be relabeled as Nuclear Fuel. The official [initial announcement](https://tilesurvivegame.com/en/blog/1213) and [2.6.400 release](https://tilesurvivegame.com/en/blog/1221) establish level structure and state-dependent availability, not the individual numeric costs.

The retained client row `501051` has a null `ReqItemSoc`. On **2026-11-06 the operator confirmed in the game that this one upgrade requires zero Nuclear Fuel**. The service model therefore publishes `nuclearFuel: 0` with an explicit `operator-confirmed` override, while retaining the original table hash and null value in its evidence record. The correction is limited to Power Plant `800005`, source row `501051`, `building_stronghold_30_2`, level `30`, rank `1`, sequence `1`, target N1 step 1, and Nuclear Fuel item `210658`. Neither the whole of N1 nor the first steps of N2/N3 are free.

`scripts/nuclear-service-overrides.js` provides a pure, idempotent `project`, a strict `validate` and an exact `sourceProjection` inverse. The inverse removes only the approved correction and the ninety validated derived prerequisite records. Its normalized JSON SHA-256 must remain `734f29e851c2ca1f5fe48c637743fde2d83ab23f97a0d121da5b00f839d57a1c`, preserving every pre-service source fact. The retained Buildings table SHA-256 is `19b0eb838c5dfce7c47c3fae2dacbaf98bf2754bdb90fc98ef963be076fd76df`.

This correction completes both overview totals without adding fuel to their previously known sums. Other nulls remain unknown: in particular, Nuclear Fuel Plant row `507644` is not converted to zero. An empty selected upgrade interval also returns zero, but means that no upgrade was requested.

## Prerequisite direction and completed levels

Six buildings have fifteen verified `ReqBuildingD` transitions each, for ninety rows:

| Target building | Building ID | Source rows |
| --- | --- | --- |
| Artifact Workshop | 800150 | 507720–507734 |
| Aegis | 800148 | 507614–507628 |
| Guardian of Life | 800149 | 507629–507643 |
| Warbringer | 800147 | 507599–507613 |
| Hero Academy | 800142 | 507705–507719 |
| Garrison Station | 800152 | 508280–508294 |

Each target's N1 steps 1–5 require **completed Power Plant N1**; N2 steps require completed N2; N3 steps require completed N3. The exact Power Plant completion states are source row `501054`, level `31`, rank `0`, sequence `5`; row `501058`, level `32`, rank `0`, sequence `10`; and row `501249`, level `33`, rank `0`, sequence `15`. Sequence 1–4 is not completed N1, and sequence 6–9 is not completed N2.

The relation points **from completed Power Plant level to permission to advance the target building**, not in the reverse direction. These six buildings already belong to the fourteen-building scope. They are not added again and are not added to the four-building tree on the basis of this relation. Existing ordered prerequisites and `functionOpen` fields remain unchanged. The service's `powerPlantRequirement` only normalizes the verified Power Plant condition; it does not assert that all other unlock conditions are met.

The Nuclear Age planner checks the selected target against the user's current Power Plant sequence (`0`–`15`). Its fuel result counts only the selected building's exclusive-start, inclusive-end interval. It does not add prerequisite-building costs, skip the target's own upgrades or claim a minimum path cost.

## Reviewed totals

| Scope | N1 interval | N2 interval | N3 interval | Through N1 | Through N2 | Through N3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Power Plant | 400 | 930 | 1,050 | 400 | 1,330 | 2,380 |
| Four-building tree | 1,480 | 3,162 | 3,570 | 1,480 | 4,642 | 8,212 |
| All fourteen buildings | 8,335 | 15,289 | 18,315 | 8,335 | 23,624 | 41,939 |

These are regression expectations for the reviewed source, not values to force on a future client update. All 210 nuclear stage costs retain their previous values except the one documented null-to-zero correction. Adding prerequisite descriptions changes no fuel costs.

## Ordinary-building and V4 integration

The ordinary building registry and V4 growth planner remain based on client **2.6.200**, with **29 public unified profiles / 761 rows** and **58 retained raw profiles / 1,522 rows**. The unified ordinary model uses A numeric values plus B (`d` / `ReqBuildingD`) prerequisites. Its Power Plant level `30`, rank `1` is not identified with the 2.6.400 nuclear source row merely because those two numbers match. Nuclear Fuel must not be inserted into that older resource vector, ordinary score calculation or saved-plan schema.

The Nuclear Age entry on tools and related building pages provides the dedicated nuclear planner. The current owner has sixteen entry routes per locale (336 across twenty-one locales), including all six affected building routes. The guide, summary, calculator and posters consume the shared Nuclear Age service model; the ordinary model and its saved/shared plans keep their existing meaning.

## Regeneration

1. Review client version, source IDs, item ID, level/rank mapping and availability before changing the canonical data. Keep the raw evidence and replaced values in the private ledger outside this repository. A future importer must apply the reviewed service projection, rather than overwrite the correction or silently carry it to an unrelated client row. Validate with `node scripts/nuclear-service-overrides.js`; its explicit `--write` option synchronizes only the authorized service model.
2. Update `data/nuclear-fuel-copy.json` when editorial labels change. Building and item names come from the canonical client localization.
3. For a coordinated data refresh, run the Nuclear Age owner, then the home, shared design and identity owners to refresh their reviewed asset hashes. The full release pipeline uses the same owners and validates the public boundaries:

   ```sh
   node scripts/build-nuclear-age.js
   node scripts/build-v5-landing.js
   node scripts/build-v6-system.js
   node scripts/build-site-identity.js
   npm run build
   npm run test:nuclear-age
   npm run test:nuclear-fuel
   npm run test:buildings:unified
   node --test scripts/test-v4-economy.js scripts/test-v4-economy-ui.js
   npm run test:site-identity
   npm run build:release:check
   ```

The Nuclear Age owner synchronously regenerates all **42 SVGs** (two scopes × twenty-one languages) and `data/nuclear-fuel-poster-manifest.json`. Each standalone poster embeds PNG image data and the same complete projection used by the table. The manifest records input, projection, image and output hashes. `node scripts/build-nuclear-fuel-poster.js --check` rejects stale posters. Do not enter poster numbers manually.

The stage artwork is the client's shared `sp_icon_level_upper` symbol with a separate level number, matching the client composition. Laboratory artwork is its base building icon. Neither is represented as an unretrieved level-specific building skin.

Before publishing, retain the Git baseline and back up the `img/nuclear-age/fuel-table-*.svg` outputs as well as the release pipeline's ordinary public-file snapshot. Validate mobile, desktop and RTL layouts, both modes, the existing planner and the SVG download. Do not change GA consent, Ads/CMP, TEN URLs, canonical/hreflang or the existing guide URL as part of a data refresh.

`npm run build` is a guarded local generation command, not a deployment. Its release artifact directory records the pre-build snapshot, each owner result and final preservation checks; failures restore only captured public files. Repeat the same build and require no unexplained changes. Publish the reviewed commit through the repository's existing GitHub Pages setup, verify that Pages built that exact SHA, then verify live guide/table/planner/poster output and asset status. Record the actual release and rollback commit in the deployment report.

The repository's checked-in `.github/workflows/common-events-review.yml` is a **read-only source monitor**, scheduled Monday 09:17 Asia/Seoul, with a manual trigger and evidence artifact. It runs `scripts/test-common-events.js` and compares official public sources; it does not rebuild, publish or independently run the nuclear regression suite. A successful monitor run must not be reported as a successful nuclear deployment test.
