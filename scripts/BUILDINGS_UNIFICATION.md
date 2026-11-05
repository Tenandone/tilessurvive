# Building requirements publication

The user-approved publication combines **A numeric values and B prerequisites**
for all 29 retained building IDs on 22 routes, in 21 locales. Here A means the
`original` profile and B means `d` / the client's `*D` fields. This is a field
selection rule, not addition of two resource vectors. It does not establish that
the combined profile matches every current game account.

## Ownership and preserved sources

- `scripts/building-data/unified.js` joins exact building, level and rank identities.
- `scripts/building-data-registry.js` keeps the complete raw model separately and
  exposes the public projection through `publicBuildings(slug)`.
- `scripts/build-building-system.js` and `js/building-system.js` own the table,
  prerequisite path, inventory shortfalls and cumulative calculations.
- `scripts/build-buildings-unified.js` publishes the same model in all 21 locales
  using existing localized building, prerequisite and construction-item names.
- Existing generic UI wording comes from `data/power-plant-unified-copy.json`.

Retain all 58 source profiles and their 1,522 rows in
`data/client-buildings-52.json`, `data/content-60/buildings.json`,
`data/content-60/buildings-phase2.json` and `data/building-system-evidence.json`.
Do not rewrite these sources to the public projection. They describe retained
client 2.6.200 data, not a newly verified current server configuration.

The public view has 29 profiles and 761 rows. A contributes resources, base
seconds, battle power, construction items and availability guards. B contributes
the complete ordered prerequisite list. The nine unknown initial resource rows
remain unknown, and the two unresolved initial-condition guards still block
calculation. Special construction items remain separate from ordinary resources.

Functional effects use A's rows and **A's metric definitions** together. In
particular the two stele profiles have integer A effects and distinct percentage
D effects. Never attach the building-level D metric metadata to A values.

## Publisher API and regeneration

`build-buildings-unified.js` exports:

- `localizedConfig(existing, locale, slug)` validates identities and values before
  transferring existing translations to canonical rows.
- `project(html, locale, slug)` replaces only the requirements sheet and the
  reviewed effect section. It does not rewrite unrelated prose, SEO, ads or TEN.
- `validateOwnership(html, locale, slug)` rejects changed owned markup or values.
- `build()` publishes `codes × slugs` and refreshes the shared runtime hash.
- `codes`, `slugs`, `pages` define the exact 21-locale, 22-route scope.

The global, German and Simplified Chinese generators recognize the shared owner.
Translated models are rendered again instead of translating numeric table
compositions as prose. Keep exact ownership checks before regeneration.

The old per-building `original` and `d` profile query values point to that same
building's `unified` view. Multi-building pages still select the building; a
profile alias must never select a different ID. Keep current/target levels,
inventory, range, exact display, capture, custom query parameters and fragments.

The calculator includes `current < target row <= target`, and current level zero
includes construction. It does not add the costs of prerequisite buildings or
apply research, hero, alliance or account bonuses. The Nuclear Fuel guide has a
separate current-client model and is not part of this source substitution.

The V4 growth planner shares the same building projection through
`scripts/sync-v4-building-projection.js`. After reviewed building source changes,
run `npm run sync:buildings:v4` before publishing. This replaces only the building
profiles in `data/v4-economy.json`; all other models and existing localized labels
remain unchanged. The normal release gate rejects a stale V4 projection. Saved
and shared `original`/`d` goals migrate to that same building's `unified` profile
before validation, with range, inventory, duplicate-spending and unknown-value
guards retained.

## Validation and release

Run the dedicated publication and regeneration tests, the generic runtime and
registry tests, and the existing source-preservation checks. Generate through the
normal release pipeline, repeat it to establish zero changes, then inspect the
single- and multi-building pages on desktop and mobile. Preserve the exact
Power Plant data and all original source hashes. A successful local test is not
a claim that deployment or live-game applicability was verified.
