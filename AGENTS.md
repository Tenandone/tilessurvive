# AGENTS.md

## Project
TilesSurvive.net

## Site Purpose
TilesSurvive.net is a multilingual static data hub for the Tiles Survive game.
The site provides heroes, buildings, behemoths, seasons, database pages, guides, and gift code information.

## Repository Context
- Remote repository: https://github.com/Tenandone/tilessurvive.git
- Main branch: main
- Typical local path: C:\Users\ant79\dev\tilessurvive
- This project must not be mixed with NOMADTEN or any other project.

## Technology
- Static HTML site
- HTML + inline CSS + JavaScript + JSON
- Common layout JavaScript: /js/layout.js
- Layout components: /components/{lang}/header.html and /components/{lang}/footer.html
- Coupon data: /data/tilessurvive-coupons.json
- Development command: npm run dev

## Localization Rules
- Korean /ko/ pages are the source version.
- Other language pages should normally preserve the Korean page structure.
- Supported language folders:
  - /ko/
  - /en/
  - /ja/
  - /ru/
  - /zh-tw/
- Keep slug names consistent across languages unless the user explicitly requests otherwise.
- Main content pages should use the folder/index.html structure.
- Do not casually change menu order, menu count, or shared UI structure.
- When localizing, prefer changing text, metadata, hreflang, lang attributes, and language-specific href values.

## Community Link Exception
External community links are language-specific:
- ko uses KakaoTalk links.
- en, ja, ru, and zh-tw use Discord links.
This is treated as link-value replacement only, not a structural change.

## Editing Guidelines
- Prefer minimal, safe edits for normal page updates.
- Do not modify unrelated files unless required by the requested task.
- Preserve existing class names and section structure when possible.
- Before editing shared files, check global impact.
- Before editing /js/layout.js, consider all language folders and shared components.
- Before editing /components/{lang}/header.html or footer.html, compare language versions.
- Many pages currently use inline CSS. Do not assume one style edit will affect all pages.
- If a requested task is better solved by common CSS, shared components, or light refactoring, propose the plan first unless the user directly asks for the full implementation.

## Allowed Improvements
The following are allowed when requested or clearly beneficial:
- SEO improvements
- sitemap and robots updates
- common CSS extraction
- shared layout cleanup
- duplicated style reduction
- mobile layout fixes
- accessibility improvements
- performance improvements
- data JSON cleanup
- broken link fixes
- language coverage fixes

For broad improvements, explain:
1. Which files will be affected
2. Why the change is needed
3. Whether the change affects all languages
4. Whether the change changes structure or only text/style

## Git Rules
- Do not commit or push unless explicitly requested.
- Before committing, summarize changed files.
- If the working tree is not clean before starting, report it.
- Never touch NOMADTEN or unrelated project folders.

## Output Preference
- When the user asks for final code, provide complete copy-paste-ready final files.
- Prefer practical results over long explanations.
- For code changes, summarize changed files and what changed.
- Keep responses focused on the current task.
