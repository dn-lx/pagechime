# Manifest library, narration following and Neural2

Accepted 2026-10-24. Work directly on develop; do not change main or the outer Netlify access gate.

## Verified inputs and gaps

- Source ae75d8b; uploaded All-Editions ZIP contains 237-page page-matched/cozy PDFs, reflowable/fixed-layout EPUBs, proofreading notes and font licences. The M4B in Drive is Roxie Nafousi / Manifest in Action, 13,682.328 seconds, 19 chapters, Kokoro bf_emma. Preserve these originals and keep contents outside public Git.
- Clean Git builds have an empty library. The screenshot is a failed catalog state; Netlify logged a 200 JSON catalog response, so successful network responses must not be turned into failures by worker caching. Existing worker is cache-first for catalog/metadata and lets cache writes reject successful requests.
- Current reader supports reflowable text, source PDF and passage following; no word cue contract. Existing Google preparation has passage timings only. Google Cloud credentials/project are unavailable in this runtime.

## Implementation sequence

1. Safely ingest the supplied edition bundle and recover chapter audio from embedded M4B boundaries. Reconstruct page-owned reading text; retain edition choices/licences. Force-align the existing audio to known text locally, cache results, audit coverage/boundaries and label timing provenance. Never invent word timestamps from proportional text length.
2. Extend shared validation and web/native rendering with optional bounded word cues while preserving passage-only imports and selection/notes offsets. Follow actual audio time, page turns and seeks; support pauses and missing cues without a fake active word. Reuse existing Kindle-style appearance and PDF viewing.
3. Repair catalog loading: network-first catalog metadata, safe cache fallbacks, successful network responses survive unavailable cache storage, explicit valid empty state, useful load errors and retry. Preserve account-cache isolation and guest network-only media.
4. Persist private book assets outside Git in an isolated private Supabase bucket. A capability-authenticated library function signs bounded immutable file paths; short-lived upload capability is retired after seeding, build capability is read-only. No unrelated Me+ data/grants change. Netlify develop builds download a verified manifest with SHA256/size checks and fail rather than silently publishing an empty shelf when configured assets are unavailable. No privileged key or book contents in clients, CI logs or Git.
5. Upgrade offline Neural2 preparation to SSML word marks/timepoints, bounded requests, resumable audio+timing cache, voice/credential preflight, explicit cost estimate and generation budget. Match voice selection to actual available audio. Do not claim live Google audio without successful credentials/synthesis; do not incur unquoted full-book charges.
6. Verify contract/worker/private-ingress negative paths, actual Manifest completeness/first-last chapters/PDF, desktop/mobile word following and selection/appearance, accessible loading/empty/error states, budget and native exports. Independent security review before external data/credential writes. Publish only develop and verify exact-head CI/deploy/source/asset checks.

## Compatibility and recovery

Optional words/editions preserve existing book imports and account records. No analytics. Alignment tooling is offline only, not a web dependency. Asset uploads use immutable content-version paths; publishing is atomic, and build downloads verify every digest. Roll back code/deploy without making the bucket public or weakening auth. Retain the original audiobook/editions in their original locations. Missing Google auth remains an explicit final connection step after all setup work is reviewable.

## Owner update — zero Google spend and continued reading work

2026-10-24: Owner reports completing the Cloud API step and requires no billing. The $0 limit supersedes all earlier possible paid auditions/full-book examples. Enforce the pause at CLI entry, credential acquisition and Google HTTP boundaries; neither --check/--generate nor a CLI budget may enable requests. Offline preflight remains available. Retain existing Emma audio. Provider account billing and unrelated usage cannot be verified from this session. Do not assume the free quota or a budget alert is a hard stop.

Continue the reading experience by persisting the chosen packaged PDF edition through chapter changes/reloads in existing account-local preference storage, with an allowlist check on restore. Guest preferences remain ephemeral. No backend schema, secret, API call or paid service is needed for this change. Add regression checks for both cost boundaries and edition restore/rejected addresses, review the cost guard independently, verify web/native builds and targeted desktop/mobile UI, and publish develop only. Preserve the existing Netlify private-log/access blocker; do not repeat its declined sign-in.

## Hosting repair after the owner supplied the build log

2026-10-24: The log proves the required private-library environment connection was absent at build time. Authenticated Netlify UI confirms no project variables. The current plan locks individual scope selection; secret variables force minimum scopes Builds/Functions/Runtime (no Post processing), so previous Builds-only attempts did not persist. Repair the existing read-only library capability in the same PageChime site, branch-deploy context only; only develop has branch deployments enabled. No production value, public/client prefix, provider permission expansion or paid plan upgrade. The consumer remains build preparation. This minimum provider-supported scope replaces the earlier unachievable Builds-only assumption; independent review must precede the write.

Commit only the public URL and required flag in context.develop.environment, keep the key in Netlify’s secret controller, verify saved context/scopes without reading the secret, and trigger a normal develop Git build. Retain the required-library failure and hash/path checks. Missing settings now report exact variable names, never values. Verify the private manifest and all supplied book assets during build; no Google calls, no main promotion.

Independent review passed before the 2026-10-24 secret write. Netlify readback confirms PAGECHIME_LIBRARY_KEY is secret, scopes Builds/Functions/Runtime, with only a branch-deploy value. No production/default value or upgrade was created.

Repair validation before publication: 36/36 unit/contracts and all workspace/server typechecks pass; strict documentation and startup budgets pass. Connected develop build verifies all 27 immutable private files (version 7e6afd6087ed…), completes Next static export and service-worker preparation. Shell 563/900 KiB. Exact credential scan found zero matches across tracked source and 82 generated files. Targeted missing-setting cases pass. Hosted deployment still requires exact-commit verification.

## Playback race discovered during repair verification

The repaired connection deployed source 0ef9efd5ec884453a93afdff2454934ac589f61b as ready branch-deploy 6adc8f9361ac54958f02fa9d. Hosted guest catalog/book, advancing Emma audio, active word, middle chapter and both rendered PDF editions pass. Google remains disabled. CI Application 40088076109 caught the old mixed-cue test seeking before metadata; its retained artifact shows playback at 3.1 instead of the intended 4.2+ position.

A deterministic regression delays the real media response, seeks to 4.2, then releases metadata. It fails on desktop/mobile before the fix (actual0), passes after retaining the latest requested time in the generation-guarded metadata handler, and verifies playback advances. Service-worker blocking is limited to this media-interception test. Existing live word test observes the same short quiet cue with browser animation-frame polling started before playback, preventing host-side polling from missing its 0.6-second window. No assertion or timeout weakened. All8 word-following browser tests pass, Next export passes, and independent review has no material findings. No auth, storage, native or cost boundary changed.

Final source6e38106e49e7141390d6b1530e8fe25d63c432d9 is ready as develop branch-deploy6adc929cc4e8e1686f1b482d. Hosted reload confirms the recovered guest shelf and final chapter. Actual-book desktop/mobile checks pass2/2; types/unit36, word browser8, Next/budget and secret output scan pass. Final CI evidence belongs in docs/REQ-012-VERIFICATION.md. Main remains2396458e46609beb8c448221a647491fb90363c9 and Google calls remain blocked.

All five exact-source CI suites passed for6e38106, including54 fixture browser cases and Android/iOS Hermes exports. Verification details and known REQ-005 advisory remain in docs/REQ-012-VERIFICATION.md. This repair is complete; broader member/native acceptance and timing-quality review remain open, with Google paused by owner policy.
