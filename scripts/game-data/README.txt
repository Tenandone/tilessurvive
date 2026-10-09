Local game-data pipeline

Requires Node 22.13+ with node:sqlite. No dependencies, network calls, ADB collection,
scheduled collection, account data ingestion or deployment. Run cli.cjs --help.
Every path argument is explicit. Raw data, schemas, snapshots, evidence, diffs and
publication previews must stay outside the public site repository and all its
linked worktrees, including symlink targets. An unrelated private audit workspace
may itself use Git; that does not make it the public site repository.

normalize --source-dir PRIVATE_SOURCE --output-dir NEW_PRIVATE_SNAPSHOT
  Reads selected-source-manifest.json and its local files only. Sources require
  SHA256, byte count and exact local realtime-index MD5. Local-index consistency
  does not establish server freshness, release state or account availability.
  Optional --tables pet_base,pet_level limits scope. Schema-less chunks inherit
  only an unambiguous same-family schema, followed by row/ID/pointer validation.
  Writes per-table JSONL, schema/status JSON, snapshot.json and snapshot.sqlite.
  Record identity is tscfg:<declared-root-class>:<internal-ID>. Source string IDs,
  hashes, game version/build, raw condition fields and references stay private.
  Raw condition fields are not assigned gameplay meaning. All activation is UNKNOWN.
  Identical full/chunk copies share logical identity; conflicting copies block publication.
  Optional --previous-dir PRIVATE_SNAPSHOT enables incremental extraction. Scope
  must match and the prior snapshot must be complete, conflict-free and hash-valid.
  Every current binary is still hash/header/schema checked. Unchanged table rows
  are reused only under the same reader/normalizer/semantic-policy fingerprint,
  exact source metadata, schema and version/build. Modified tables are decoded.
  Reused rows are hash/identity/condition checked and written to the new snapshot;
  collection time and manifest provenance are explicitly rebound to the current
  source. A schema, policy or version change forces decoding. Corrupt cached
  artifacts block the table. Old snapshots without reuse fingerprints are parsed
  once to establish a reproducible cache. No prior files are modified or removed.

diff --before-dir PRIVATE_BEFORE --after-dir PRIVATE_AFTER --output-dir NEW_DIFF
  Requires identical table scopes and zero blocked tables. Reports added, modified,
  deleted and activationUnknown counts/records. Deleted means absent from a snapshot,
  never deactivated in the game. Hash/condition changes are compared separately;
  no data is automatically published or deleted from the site.

publication --source-dir PRIVATE_SNAPSHOT --output-dir NEW_PREVIEW
  Optional --registry REGISTRY_JSON --evidence-dir PRIVATE_EVIDENCE_DIRECTORY.
  Default semantics.json allows no public fields. Public output is still a private
  review artifact and is never copied automatically into the website.
  A rule requires ruleId, rootClass, field, publicKey, status CONFIRMED, meaning,
  unit, publicType (text/number/boolean/site-link), encoding and evidenceIds.
  Evidence.json is an array. Each claim requires id, kind GAME_SCREENSHOT or
  OFFICIAL_DOCUMENT, artifact {path,sha256}, recordKey, sourceSha256,
  conditionsSha256, field, rawValueSha256, confirmedValue, unit,
  activationStatus CONFIRMED_ACTIVE and observedAt. The artifact is hash-checked.
  Evidence is an explicit human-reviewed assertion, not automatic image interpretation.
  Exact source/value/condition bindings prevent carrying confirmation to other levels
  or versions. Registry rules cannot confirm their own values without a supplied artifact.
  All type-4 eight-byte values remain raw by default. A signed-le64 rule must supply
  byteOrder LE, signed true and divisor; only exact safe integer results are supported.
  No percentages, seconds, currency units, price or availability are inferred.
  Only explicitly admitted localized relative site routes can be public links.
  Public previews exclude raw source paths, schema, field status prose and evidence text.

Tests use real local allowed CFG files and synthetic negative controls only in a
temporary private directory. They do not establish new gameplay facts:
  Set TILES_CFG_SOURCE_DIR to PRIVATE_SOURCE, then run
  node --no-warnings --test scripts/game-data/test.cjs

Snapshot schema v1
  recordKey, identity, category, dataStatus, activation, conditions,
  conditionsSha256, provenance, valuesSha256, rawValues, references.
  A conditions hash covers game version/build plus preserved raw condition fields.
  Observed gameplay conditions remain unset until independently supported.
  Reference tag 0 permits a candidate class/ID key, not automatic semantic linkage.
  Unknown tags remain unresolved. Map integer keys are not guessed as references.
