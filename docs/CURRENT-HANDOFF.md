# Current Handoff

Updated 2026-11-06 (Europe/Madrid).

## Current work — PageChime 0.3.0

PR #8 merged 0.3.0 to main at 046f009e. Netlify production deploy 6aed00a789daae96fd796049 is current, with library/reader functions and the media edge. Main and develop share the private catalog. Kokoro is the existing Manifest default. The exact release tree passed Application 42119331554 with 62 Node and 88 browser cases, four private skips, exports and 574/900 KiB. The separate PR run stalled installing Chromium. The sample passed isolated desktop and Pixel 7 publishing. Team sign-in gates live admin verification. GitHub tag and release publication are pending. See REQ-019/018 plans.

REQ-020 runtime c025fc61 is ready on develop deploy 6aee58c5d3354137e966dc0b. Phones fill the browser window by default and retain the reader after Chromium suspension and resume. Checks passed with 62 Node and 88 browser cases, four private skips, and 575/900 KiB. Physical lock testing remains open.

<!-- AGENT_TASK_STATE_START -->
{"task_id":"REQ-020","repository":"dn-lx/pagechime","base":"develop","branch":"develop","pr":null,"status":"reviewing","last_verified_sha":"c025fc610eafb1092504225dd9473b5075987713","next_step":"Owner review on develop. Promote only with explicit owner approval.","updated_at":"2026-11-06T22:49:00Z"}
<!-- AGENT_TASK_STATE_END -->

## Reader synchronization — REQ-017

Source ef3878f6 passes51 Node/80 browser cases, web/mobile exports and budget. Playback/voice navigation retains real reading anchors; hosted verification remains behind Netlify team sign-in. See docs/plans/REQ-017-reader-narration-position.md.

## Recordings — REQ-016

Piper is complete and published privately as45 declared files/187,054,263bytes, immutable version94da1b70b50c4009a99e2bb11dc94c3d2a02e4b2a4c4a815fad56cfa7bf2334f. Temporary capabilities expired;1 existing build/0 upload active. Original Kokoro/editions retained. Piper website source fc6fe2c passes CI40174845078 (48 Node/76 browser), with its own manifest-piper identity and real passage boundaries.

Status check2026-10-25: workers/session57469 stopped; /tmp/pagechime-voice-lab models/environments/logs are absent. Qwen50/715 (903.12s), all WAV/source hashes verified, saved Library version3; Chatterbox46/715 (878.00s), version2. IDs libfile_6c7f4ad27d2081918be19f3472d74398 / libfile_91cc8030ae308191b8ddb710c0019fad. Local recovery root: /workspace/scratch/452ae38be48c/recovered-recordings; execution/engine status says stopped. Owner-requested Drive copy: https://drive.google.com/drive/folders/1h4-G8SWQrsg5vxMEnIWWeVPhxKMzRroP contains complete Piper, playable partial Qwen50/Chatterbox46 MP3s and both recovery ZIPs. MP3s fully decoded; uploaded sizes/readback verified. Qwen backup was replaced in place after an incomplete copy; final31,291,915bytes verified. ZIPs retain plans/reference/WAVs/scripts. Restore pinned models/environments and current helpers before resuming; initialize registries from fresh Library versions. Prior scheduling: alternating10-section batches, one offline6-thread worker. Preserve spoken-word duration checks,3 bounded Chatterbox retries, waveform/token checks and watermarking. Uncertain saves stop for reconciliation. Unattended completion needs a persistent runtime. Finalize after715 sections, fully decode MP3s and save privately. Provenance/Piper: docs/plans/REQ-016-full-local-narrations.md.

## Policy and current work

Implement on develop and promote only after explicit owner approval. Preserve leaf.* keys, app.dnlx.leaf identifiers, book-reader-api/book_reader_* identities and the private site gate.

Owner approved Google spend is $0. scripts/google-narration.py blocks provider requests before credentials or network, including --check/--generate. No budget/env/cache bypass. Existing Kokoro bf_emma remains available. This lock does not verify Cloud billing or control unrelated apps. Cloud project project-89a9b506-ff91-4cd1-a2d reports setup; account billing/API state unverified. See docs/CONTENT-AND-VOICES.md.

REQ-013 remains accepted at runtime68c7d253 / ready deploy6add25a2, with actual-book desktop/mobile coverage, both PDFs, native exports and word-join/anchor verification. Earlier account outbox/timer, player sizing and reference-skip fixes remain covered by the new regression run. Historical evidence: docs/REQ-013-VERIFICATION.md.

## Editorial work and private assets

Editorial joins/deletion-only reading repairs preserve original text, cue offsets and note anchors. Sampled OCR/acoustic review found no definite missing narration; no full proofread claimed. Evidence: docs/REQ-012-VERIFICATION.md and docs/REQ-013-VERIFICATION.md. Private text/photos stay outside Git.

Book: Manifest in Action,237 pages,19 chapters,1,136 passages; full Kokoro Emma recording13,682.328s. Acoustic word cues37,139/37,476 (99.1%); gaps stay visible without invented timings. Source originals/caches are private under /tmp/pagechime-*; screenshots/tests should use dedicated /tmp output directories. Supplied All-Editions ZIP remains in connected files if recovery is needed. See docs/REQ-012-VERIFICATION.md for historical acceptance.

Me+ wbqnctrvxohxwiaignhg, isolated bucket pagechime-library-develop,24MiB file cap, no anon/authenticated storage policies. pagechime-library v2 verifies capability auth despite verify_jwt=false. book_reader_library_keys has RLS/revoked public grants. Existing read-only build capability cannot modify assets or accounts.

Earlier immutable library0e4a2bc8f8faf3292e231cd8fd2ce50e330cc8f075c021b9ecb755c4350824ae had27 files; the current Piper version above preserves those originals. Earlier editorial upload was denied without disclosure authorization; current owner instruction explicitly authorizes full Piper website upload. Hash-bound reading overlays and all original Kokoro cues remain. Never print capabilities or signed URLs.

## Hosting and remaining acceptance

Netlify site73688a4b-90ab-4eac-be6d-ef305f33ebc3, team don-alex-perera, linked dn-lx/pagechime. Main production and develop branch deploys use npm run build → apps/web/out. The team-login gate applies to both. Build-time media verification fails closed. Production and develop library credentials stay scoped to their deploy contexts.

REQ-011 guest/signup/Show-Hide fields are implemented; signup grants reader, admin requires invitation. Me+ book-reader-api v3 unchanged. Owner invite expired 2026-10-25T22:48:44Z; no replacement created. Guests lack personal persistence. Hosted/device/provider acceptance remains separate. Native exports are unsigned; REQ-005 tooling advisories remain.
