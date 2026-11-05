# Power Plant requirements publication

The approved publication rule is **A numeric values + B prerequisites**.
It began as a Power Plant `800005` exception. On 2026-11-06 the user explicitly
extended this public projection to all 29 retained building IDs. Raw profiles
remain independent and unchanged. See `BUILDINGS_UNIFICATION.md` for the current
all-building publisher; the Power Plant model and its existing values remain exact.

## Sources and ownership

- Retained A: `data/client-buildings-52.json`, building `800005`, profile `original`.
- Retained B: the same building, profile `d` (the original `*D` fields, not `*B`).
- Canonical published rows: `data/power-plant-unified.json`.
- Generator: `scripts/build-power-plant-unified-data.js`.
- Locale copy: `data/power-plant-unified-copy.json` (21 locales).
- Publisher: `scripts/build-power-plant-unified.js`.

Both raw profiles remain untouched. Match `(building ID, level, rank)` exactly.
The supported publication has levels 1–30: rank 0 for levels 1–29 and rank 1 for
level 30. Do not join every retained raw-client row by level alone: other ranks
and transitions exist outside this publication scope.

Copy resources, seconds, battle power and construction items from A. Copy the
complete ordered prerequisite list (building ID, required level and rank) from
B. All 30 A construction-item lists are currently empty; do not invent special
materials. Missing, duplicate or conflicting identities block generation.

The values were checked against retained client 2.6.200 build 1512. That check
does not establish applicability to the current live game or independently
prove that the A+B combination is an official live-game profile.

## Publish and test

Run `npm run build:power-plant:unified`, then `npm run test:power-plant:unified`,
the relevant building regression suites and `npm run test:global`. Run
`npm run test:power-plant:global` to verify regeneration in the 14 translated
locales and unchanged output for their other 1,666 pages. Run the
publisher twice: its second run must report zero page/cache changes.

The publisher reuses each locale's existing names and display settings, updates
only the Power Plant section and related guidance, and refreshes the shared
building script cache key. It does not regenerate other building content.
Static HTML and interactive calculations use the same canonical rows.

## URLs and calculations

The existing `/{locale}/buildings/power-plant/` URLs and fragments remain.
`profile=800005:original` and `profile=800005:d` are compatibility inputs for the
single `800005:unified` profile. They do not expose a second table. Unknown
profile identifiers disable calculations rather than silently selecting data.
Level/range, exact display, capture, current/target level, inventory and fragment
state survive the supported language switch.

The calculator sums target levels `from < level <= to`; starting at 0 includes
construction. Prerequisites are shown for each selected step. Their own upgrade
costs are not added to Power Plant resource or time totals.

## Rollback

The pre-change deployment is commit
`f487f7317ac12fdcfc3a8d8179b4ea4a6cb0e198`, also retained on local branch
`codex/power-plant-baseline-20261104`. The private sibling review directory
contains raw A/B backups, row-by-row differences and verification results.
If a release fails, revert only this task's release commit, validate the restored
pages and push the normal deployment branch. Do not force-push or overwrite
unrelated changes. Retain the existing HTTPS configuration.
