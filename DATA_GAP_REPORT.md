# TilesSurvive.net Data Gap Report

Last reviewed: 2026-09-18

## Current baseline

The repository is a five-language static site with 300+ sitemap URLs. It has hero, building, behemoth, season, database, guide, code, event-helper, and tool content. Core weaknesses are duplicated page markup, uneven language coverage, no shared entity schema, no automated source-review pipeline, incomplete trust pages, and limited relationship data between heroes, seasons, events, gear, items, guides, and tools.

## Source policy

- Official source: [Tiles Survive official site](https://tilesurvivegame.com/en/list)
- Independent research references: [Tiles Survive Guide](https://tilessurviveguide.com/) and [MTurboGamer](https://mturbogamer.com/category/tiles-survive/)
- Independent sources are used for gap discovery only. Their wording, layouts, and unsupported numbers are not copied.

## Gap matrix

| Area | Current site | External/latest signal | Gap | Status | Priority |
|---|---|---|---|---|---:|
| Heroes | 25 hero directories in Korean; five-language detail coverage is broadly present. | Official patches continue changing hero skills and star bonuses. | No generation, obtain method, mode suitability, provenance, or per-field verification schema. | CANDIDATE | P0 |
| Hero generations | Not modeled as an entity. | Independent guides organize lineups by generation and server age. | Add generation and availability fields only after source validation. | CANDIDATE | P1 |
| Skills | Embedded in hero HTML. | Official patches can change individual skills. | Extract to structured hero records with `lastVerified` and sources. | VERIFIED need | P0 |
| Hero gear | Several gear database pages exist. | Official reforging guide and current patch history confirm an evolving system. | Missing gear entity graph, stat aliases, and hero-role links. | VERIFIED need | P0 |
| Lineups | No authoritative lineup database. | Strong search demand and independent coverage exist. | Create clearly labeled recommendations by mode, generation, and budget; avoid objective-tier claims. | CANDIDATE | P1 |
| Seasons | Season I-III pages exist. | Official v2.5.900 announces Season IV: Blizzard Era. | Season IV hub and cross-links are missing. | VERIFIED | P0 |
| Events | Event helper and Reservoir/Alliance Duel content exist. | Official updates mention Arcadian Conquest, Reservoir: Glory Clash, 3v3 Arena, Underground Goldmine, and rotating systems. | Missing canonical event entities, recurrence fields, unlock requirements, and provenance. | VERIFIED need | P0 |
| Research | Only partial database references. | Might of the Ocean tech tree confirmed in official v2.4.600. | No research hub or structured trees. | VERIFIED | P1 |
| Buildings | Strong five-language building coverage. | Official updates continue adding systems and minimum-level dependencies. | Missing structured upgrade costs and last-verified metadata. | CANDIDATE | P1 |
| Equipment | Exclusive and legendary gear pages exist. | Official reforging guide plus recent patches show changing stats. | Missing Superalloy/Alloy entity model and source history. | CANDIDATE | P1 |
| Superalloy gear | No dedicated canonical page. | Independent sources cover Alloy gear; official guide confirms reforging but not every community value. | Publish only system-level facts until numeric costs are independently verified. | CANDIDATE | P1 |
| Items | Fragmented across database pages. | New Pet Eggs, Gift EXP, Game Tokens, and seasonal materials are official. | Add item taxonomy and acquisition/use relationships. | VERIFIED need | P1 |
| Transfer / passes | No dedicated entity. | Community demand exists, but current official details were not established in this audit. | Research official unlock rules and current pass costs. | CANDIDATE | P2 |
| Alliance systems | Alliance Duel and Reservoir content exists. | Official patch history includes Alliance Duel League, Siege, Clash events, and gifting. | Create alliance-system hub and canonical event links. | VERIFIED need | P1 |
| Gift System | Codes exist; player-to-player Gift System is not modeled. | Official v2.6.0 adds cross-State gifting, batch gifting, anonymous gifts, and Gift EXP. | Add update coverage and later a system guide after live verification. | VERIFIED | P0 |
| Reservoir | One guide exists. | Official feedback and Glory Clash patch confirm continued changes. | Split Raid and Glory Clash entities; add last verified dates. | VERIFIED need | P1 |
| Arena / 3v3 | No dedicated hub. | Official v2.6.0 moves 3v3 Arena access; older patches change defense behavior. | Add mode pages and non-authoritative lineup guidance. | VERIFIED need | P1 |
| Wall of Honor | Missing. | Official v2.5.700 confirms unlock at 10 Stars and faction grouping. | Add system entity and link from maxed SSR heroes. | VERIFIED | P0 |
| Underground Goldmine | Missing dedicated page. | Official 2026 patches add Level 6 and move access to Event Checklist. | Add canonical event/system page. | VERIFIED | P0 |
| Hero Fragment Exchange | Mentioned indirectly. | Official v2.5.700 confirms Recycling Center exchange use. | Add item flow and eligibility constraints after in-game validation. | VERIFIED need | P1 |
| Might of the Ocean | Missing. | Official v2.4.600 confirms a Mariner-focused Settlement Tech tree. | Add research/system page and Sea hero relationships. | VERIFIED | P0 |
| Pets | Five-language canonical Pet System page and structured entity added. | Official v2.6.100 introduces Pet Eggs, growth, appearances, Hero stat bonuses, and battle support; rollout is State-progress gated. | Numeric growth costs and Pet-specific skill values remain unavailable. | ALREADY COVERED | P0 |
| Chief Collections | Partial references only. | Official v2.6.100 announces a full upgrade. | Capture current UI and create an entity after verification. | VERIFIED need | P1 |

## 2026-09-18 research refresh

| Classification | Data | Source | verifiedAt | Confidence | Handling |
|---|---|---|---|---|---|
| ALREADY COVERED | Pet System existence, Pet Eggs from Pet-related Intel Missions, growth, appearances, Hero-wide stats, battle support | [Official v2.6.100](https://tilesurvivegame.com/en/blog/1173), [Developer Feedback September 11](https://tilesurvivegame.com/en/blog/1134) | 2026-09-18 | official-verified | Added as `/database/pet-system/` in five languages. |
| PARTIAL | Chief Collections upgrade, Collection Stats overview, Set Bonuses, Mythic Collection Sets | [Official v2.6.100](https://tilesurvivegame.com/en/blog/1173) | 2026-09-18 | official-system-level | Keep in Updates until collection names, set requirements, and values are captured. |
| MISSING | Pet growth costs, Pet skill values, Pet roster, Pet Eggs drop quantities | Official patch does not publish values | 2026-09-18 | unknown | Do not publish numeric claims. |
| CANDIDATE | Current formation meta, gear priorities, event scoring, and detailed upgrade economics | [MTurboGamer](https://mturbogamer.com/category/tiles-survive/) | 2026-09-18 | single-independent-source | Use for gap discovery only; requires official or second independent confirmation. |
| CONFLICT | Faction names and hero role labels across official and community terminology | Official patches and independent guides | 2026-09-18 | mixed | Preserve current URLs and maintain the alias-map requirement. |
| HIGH PRIORITY | Chief Collections entity and structured Pet/item relationships | Official v2.6.100 | 2026-09-18 | official-verified-at-system-level | Next capture pass should add current in-game values without extrapolation. |

### Benchmark notes

- The Tile Survive Field Guide endpoint was not reliably readable during this audit, so no claim from it was promoted into production.
- TilesSurviveGuide and MTurboGamer were reviewed for coverage gaps. Their lineup, gear, scoring, and economy details remain candidate material unless another reliable source agrees.
- The official update list now identifies v2.6.100 (2026-09-17) as the latest patch. No newer official patch was visible during this review.
- MTurboGamer currently surfaces additional demand around formations, gem use, State Transfer, research priorities, and alliance progression. These remain single-source candidates and were not promoted into production data.
- No stable public API or sufficiently reliable two-source feed for Gift Codes was found. The home page therefore exposes only the already verified permanent/no-known-expiry codes and keeps the full code archive as a lower-priority destination.

## Immediate implementation boundary

This phase keeps the verified Pet System entity and five-language page, strengthens the home-to-Top-Up funnel, and preserves low-intent information pages by placing only one contextual CTA after the content. Numeric game data that lacks sufficient evidence remains out of production and is tracked in `DATA_CONFLICT_REPORT.md`.
