# Global localization build

The English canonical pages remain the editorial source for new languages. Simplified Chinese uses the existing Traditional Chinese pages, OpenCC 1.4.2, reviewed regional wording, and exact retained client terminology. Existing six-language pages are never retranslated.

## Inputs and provenance

- `data/i18n/locales.json`: URL codes, HTML/hreflang/number locales, direction, evidence, and publication state.
- `data/i18n/client-terms.json`: relevant retained client localization keys and their original values. Missing language values are not fabricated as official terms.
- `data/i18n/messages/*.json`: contextual editorial translations, structural phrases, units and explicitly reviewed unchanged proper names.
- `data/i18n/ui/*.json`: website navigation and shared interface copy. A website menu must not inherit a kitchen-menu translation.
- `data/i18n/structural-messages.json`: source-derived numeric and entity templates. Numeric bindings and placeholders are preserved.
- `data/i18n/contextual-terms.json`: page-specific legacy-name corrections with client keys, source hashes, and authored-name exceptions. The Undine alias must never rename Travis's distinct skill.

The retained Android source is version 2.6.200. The official App Store language list and retained client list differ. Web `ms` is Malay; client `my` is an internal Malay identifier, not the web Burmese locale. Norwegian Bokmål (`nb`) is supported by the official store listing but does not have a complete retained in-game translation corpus. A generated catalog is not proof of native-speaker review.

## Private preview

```powershell
node scripts/build-global-locales.js --locales=fr,es
node scripts/build-simplified-chinese.js
node scripts/build-simplified-chinese.js --self-test
node scripts/build-global-navigation.js --preview --include=zh-cn,fr,es
node scripts/build-global-search.js --preview --locales=zh-cn,fr,es
```

Preview pages and detailed reports go to the sibling `global-language-delivery-20261104` directory, outside the website tree. Preview pages have `noindex,nofollow` and an unpublished marker. Each locale gets a separate `translation-build-<code>.json` to avoid concurrent report collisions. Rebuilding preview navigation changes output hashes; regenerate translations before preparing a release.

## Release gates

```powershell
npm run test:global
npm run test:calendar
node scripts/build-global-release.js --locales=zh-cn,fr,es
```

The release command above validates and writes a local release plan only. It does not deploy. It requires zero missing messages and validation errors, complete UI keys and affiliate labels frozen by hash, unchanged source/output hashes, preserved numeric/Boolean/null model values (including numeric strings, percentages and compact suffixes) and model identifiers, and unchanged form bounds/media/ad URLs. Executable programs must match the source exactly after only the explicitly supported display-string transformations; erasing string literals is not sufficient. It checks every canonical route, not just representative articles.

After local HTTP and real-browser checks, add `--apply` to assemble the public working-tree candidate. The script validates all selected languages before writing deployable files. It then updates exact reciprocal routes, homepage `x-default`, registry, search shards, and sitemap. Existing sitemap URLs and any evidence-backed dates are retained; a build timestamp is not used to invent `lastmod`.

`--apply` still does not push, deploy, or request AdSense review. A separate reviewed Git release is required. Record the current production commit, review the exact candidate diff, check a clean dependency install/full legacy build in an isolated worktree, and retain the production commit for rollback. The legacy generator has pre-existing non-idempotent output; unrelated regenerated content must not be copied blindly into this release.

## Verification and maintenance

- Keep `npm run test:global` differential checks against the fixed production JS. Old output behavior is preserved while new languages use registry formatting.
- Legacy preservation allowances accept only exact locale-display changes; they still compare arithmetic, guards, reset behavior, and existing-language results against the fixed source.
- Run `scripts/verify-global-preview.js --locales=<available codes>` against the private server. Transport retries are recorded; HTTP error responses are not hidden.
- After deployment, set `TS_VERIFY_ORIGIN=https://tilessurvive.net` and verify production HTTP, metadata, indexing flags, links and assets. Inspect robots/sitemap GET and HEAD separately and verify HTTPS policy.
- To test an assembled public candidate locally, serve the working tree alone on a loopback address with an `X-Robots-Tag: noindex` response header, then set `TS_VERIFY_ORIGIN` to that address and `TS_VERIFY_CANDIDATE=1`. This checks that the HTML itself has production indexing flags while keeping the local server private. Unset that flag for production verification.
- Real-browser checks must cover language switching, hero/building/research data, calculators, events, navigation, mobile layout, and RTL where applicable. Static tests cannot establish translation fluency or prove browser rendering.
- Add local-language research names to the search index without changing research IDs, levels or power values.
- Keep raw client sources read-only. Do not replace absent official names with guesses labelled as official. Record source inconsistencies and review current game terminology when better evidence becomes available.

Build inputs, catalogs, scripts and test artifacts are excluded from the served Jekyll site via `_config.yml`.
