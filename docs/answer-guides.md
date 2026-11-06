# Data answers

The answer layer adds visible HTML to existing canonical pages. It does not add
URLs, a database, tracking, an API or AI-specific instructions. All questions are
anticipated user questions unless an actual Search Console query is separately
recorded in the private review evidence.

## Data ownership

`scripts/answer-guides/{nuclear,building,hero,pet,event}.js` project existing game
models through the same arithmetic used by the tools. Each answer retains its
stable anchor, target ID, start and target states, material/unit, calculation
method, scope, source rows/version and confirmation status. Display strings are
localized separately; no translated file owns game costs.

- Nuclear totals use `nuclear-fuel-summary` and `nuclear-age.plan`. The first
  Power Plant substep's operator-confirmed zero remains a service correction;
  the original missing field remains unchanged. Affected answers track the
  correction ID and actual confirmation date.
- Normal buildings use `building-system.sumRange` and the unified building
  registry. Their Lv.30/rank fields are not relabelled as Nuclear N levels.
- X-SSR growth uses the reviewed source bindings and existing calculator.
  Recruitment and internal rank groups remain separate. A raw rank number is
  not presented as a verified visual star count.
- Pet effects and recommendations retain training, ownership, skill and row
  conditions. Recommendations are editorial relationships, not invented win
  rates. Unresolved effects do not acquire a numeric coefficient.
- Alliance Duel answers identify profile, event day and one-unit base points.
  Threshold examples use ceiling and verify the preceding whole quantity too.
  A point threshold does not prove a chest is unlocked or an event is live.

## Regeneration

Use `npm run build` for the current complete release pipeline. It runs the answer
owner after native page owners, followed by search, presentation and identity.
`npm run build:answers` regenerates only the answer layer and its question aliases.
Do not hand-edit the generated HTML. The generic, German and Simplified Chinese
projectors validate/remove source-language answers and regenerate target-language
answers from the same models.

When an approved source record changes, regenerate its native owner and answer
owner before the strict release check. This updates the model, readable answer,
table, example and relevant poster together. Run `npm run test:answers` and the
native model tests. Incomplete requirements must remain partial, never zero.

`CONTENT_REVISION` in `build-answer-guides.js` is an explicitly reviewed content
date. Advance it only for a real content change. Only the existing affected
canonical sitemap entries receive that date; builds do not set today's date
globally. Source capture/verification dates are independent of that revision.

## Publication and preservation

The `TS_ANSWER_BODY`, `TS_ANSWER_BASIS` and `TS_ANSWER_ASSETS` delimiters define a
strict owner. `validateAndStrip` compares regenerated content and exact assets
before removing it for legacy preservation checks. Unknown additions, altered
numbers, duplicate blocks and orphaned markers fail validation. Source models,
ads, consent behavior, TEN links, fonts, images and saved plans stay protected.

Answer copying uses the canonical URL plus stable anchor. It does not include
the current query string, saved plan or calculator inputs. The main answer is
visible without JavaScript; scripting only enables copying and existing tools.

## Search claims

Keep page implementation, crawl access, indexing, search impressions, actual AI
citations and business outcomes separate. robots currently allows crawling; do
not change GPTBot training policy merely to enable OAI-SearchBot search access.
No FAQ rich-result promise or special AI file is required. Existing GA4 and
Search Console remain the only analytics services.
