# Current Handoff

Updated 2026-10-25 (Europe/Madrid).

<!-- AGENT_TASK_STATE_START -->
{"task_id":"REQ-016","repository":"dn-lx/pagechime","base":"develop","branch":"develop","pr":null,"status":"implementing","last_verified_sha":"ef3878f6109ff37caae0d2dc4762d3d8600f4ba4","next_step":"Monitor restored model downloads/supervisor, verify accepted audio progress and checkpoint saves. No running-render claim until actual status advances.","updated_at":"2026-10-25T10:17:09.765590+00:00"}
<!-- AGENT_TASK_STATE_END -->

## Reader synchronization — REQ-017

Playback load/seek now carries an explicit reading request, so previous/next, Contents, cross-chapter seeks and automatic advancement align a detached ebook. Opening a saved book still restores its manual place; same-chapter play/pause remains independent. Voice selection maps the visible UTF-16 source anchor through ordered normalized text across different chapter/chunk layouts, preserving view/follow state and overriding stale target history. Real cue/passage timestamps only; unmatched sections keep the original voice/place. Main and Google remain unchanged.

Local checks:51 Node tests/types/docs,80 browser passes/4 private skips, web export and568/900KiB budget. Ten focused desktop/mobile cases and inspected screenshots verify round trips and retained layout. Direct live check reaches Netlify team-protection sign-in; hosted verification is blocked without weakening the gate. Source ef3878f6 passes CI40183409963 (51 tests,80 browser cases, web/mobile exports); direct live check remains gated. See docs/plans/REQ-017-reader-narration-position.md.

## Recordings — REQ-016

Piper is complete and published privately as45 declared files/187,054,263bytes, immutable version94da1b70b50c4009a99e2bb11dc94c3d2a02e4b2a4c4a815fad56cfa7bf2334f. Temporary capabilities expired;1 existing build/0 upload active. Original Kokoro/editions retained. Piper website source fc6fe2c passes CI40174845078 (48 Node/76 browser), with its own manifest-piper identity and real passage boundaries.

New workspace lacks prior models/caches. Recovered and hash-verified Library version1 checkpoints:38/715 Qwen sections (695.2s),43/715 Chatterbox (825.92s). Local ZIPs/extracted copies: /workspace/scratch/452ae38be48c/recovered-recordings/{qwen,chatterbox}. Library IDs libfile_6c7f4ad27d2081918be19f3472d74398 / libfile_91cc8030ae308191b8ddb710c0019fad. Pinned environments restored; model files downloading. Supervisor session62422 waits for all pinned file sizes/hashes, then runs Chatterbox followed by Qwen in10-section batches with guarded Library checkpoints. Status: recovered-recordings/execution-status.json. No accepted progress beyond38/43 yet. If a save is uncertain, stop and reconcile before retrying. Do not report old39/>=70 unsaved host counts as recovered progress. Sequential CPU scheduling avoids7.7GiB paging. Model provenance and full Piper download: docs/plans/REQ-016-full-local-narrations.md.

## Policy and current work

Work directly on develop with null PR, GitHub MCP writes. Main stays2396458e46609beb8c448221a647491fb90363c9 until explicit later promotion. Preserve leaf.* keys, app.dnlx.leaf identifiers, book-reader-api/book_reader_* identities. No production/outer-gate/payment/analytics/unrelated-app changes.

Owner approved Google spend is $0. scripts/google-narration.py blocks provider requests before credentials or network, including --check/--generate. No budget/env/cache bypass. Existing Kokoro bf_emma remains available. This lock does not verify Cloud billing or control unrelated apps. Cloud project project-89a9b506-ff91-4cd1-a2d reports setup; account billing/API state unverified. See docs/CONTENT-AND-VOICES.md.

REQ-013 remains accepted at runtime68c7d253 / ready deploy6add25a2, with actual-book desktop/mobile coverage, both PDFs, native exports and word-join/anchor verification. Earlier account outbox/timer, player sizing and reference-skip fixes remain covered by the new regression run. Historical evidence: docs/REQ-013-VERIFICATION.md.

## Editorial work and private assets

Editorial joins/deletion-only reading repairs preserve original text, cue offsets and note anchors. Sampled OCR/acoustic review found no definite missing narration; no full proofread claimed. Evidence: docs/REQ-012-VERIFICATION.md and docs/REQ-013-VERIFICATION.md. Private text/photos stay outside Git.

Book: Manifest in Action,237 pages,19 chapters,1,136 passages; full Kokoro Emma recording13,682.328s. Acoustic word cues37,139/37,476 (99.1%); gaps stay visible without invented timings. Source originals/caches are private under /tmp/pagechime-*; screenshots/tests should use dedicated /tmp output directories. Supplied All-Editions ZIP remains in connected files if recovery is needed. See docs/REQ-012-VERIFICATION.md for historical acceptance.

Me+ wbqnctrvxohxwiaignhg, isolated bucket pagechime-library-develop,24MiB file cap, no anon/authenticated storage policies. pagechime-library v1 verifies capability auth despite verify_jwt=false. book_reader_library_keys has RLS/revoked public grants. Existing read-only build capability cannot modify assets or accounts.

Earlier immutable library0e4a2bc8f8faf3292e231cd8fd2ce50e330cc8f075c021b9ecb755c4350824ae had27 files; the current Piper version above preserves those originals. Earlier editorial upload was denied without disclosure authorization; current owner instruction explicitly authorizes full Piper website upload. Hash-bound reading overlays and all original Kokoro cues remain. Never print capabilities or signed URLs.

## Hosting and remaining acceptance

Netlify site73688a4b-90ab-4eac-be6d-ef305f33ebc3, team don-alex-perera, linked dn-lx/pagechime. main production, only develop branch deploys, npm run build→apps/web/out, reader BFF/media edge. Develop URL https://develop--pagechime.netlify.app/. Team-login gate unchanged. Secret read-only connection is branch-deploy only with plan minimum Builds/Functions/Runtime scopes, no Post processing. Required asset verification stays fail-closed. Prior missing connection is repaired; no env change is needed for current work.

REQ-011 guest/member/email signup/Show-Hide fields are implemented; public signup grants reader, admin requires invitation. Me+ book-reader-api v3 unchanged. Previous disposable accounts removed. Owner single-use admin invite remains private/usable until2026-10-25T22:48:44Z; do not replace a usable invitation or choose an owner password. Guests have no personal persistence. REQ-004/006/007/011/012 device/hosted/provider acceptance stays separate. Native exports are not signed installs/store acceptance. Known native tooling advisories remain non-blocking REQ-005.
