# Tile Survive Data Conflict Report

Last reviewed: 2026-09-18

## Policy

- **VERIFIED**: confirmed by an official source, or by two independent reliable sources that agree.
- **CANDIDATE**: supported by only one non-official source or by source-imported static data that has not been checked in game.
- **CONFLICT**: reliable sources disagree, or a patch changed a value without enough evidence to resolve the current live state.

## Open conflicts

| Area | Conflict | Current handling | Resolution needed |
|---|---|---|---|
| Event calendar | Static Event Helper rows may vary by State age, server reset, and live rotation. | Kept `verified:false`; source points are reference-only. | Check each event against live in-game schedules in representative States. |
| Hero star bonuses | Official v2.6.0 changed Candy and Kiki star-bonus attributes. Older hero pages may still describe the previous bonuses. | Do not bulk-rewrite from secondary sources. | Audit Candy and Kiki pages against current in-game screens. |
| Faction naming | Community sources use Mountain/Wasteland/Sky/Sea while official English patch notes use Stalwart/Aeronaut/Rover/Mariner. | Existing URLs and visible taxonomy remain stable. | Add an alias map before changing public labels. |
| Event naming | Independent guides use variant spellings such as Ghoulion/Ghoulian. | No canonical entity created yet. | Confirm the current in-game English localization. |
| Gear tiers and costs | Independent guides provide values that are not fully documented by official sources. | Treat as CANDIDATE; no new numeric claims published. | Verify with two independent captures or official documentation. |
| LootBar reward thresholds and dates | The program brief identifies two monthly eligibility periods and possible coupon values of $4.9, $9.9, or $99, but does not provide stable cumulative-spend thresholds or exact distribution dates. | Publish the periods and possible values without inventing thresholds or payout dates. | Confirm current conditions on the partner page or with LootBar support. |

No conflicted value should be promoted automatically to a public numeric fact.
