# Current Handoff

## Completed Qwen3 integration — verified on develop (2026-11-18)

**Code and deployment:** Qwen voice selection and same-book manifest validation are on GitHub develop. The verified code ref is 627a203bc22b3437f7aaf9f09574171f164c72f2; Netlify deploy 6afd430e619d39bb88a1d04b is ready. The protected preview is https://develop--pagechime.netlify.app/. GitHub main and the production website deployment were not changed.

**Private library:** Qwen was added to the existing Supabase library as immutable version 36237ab930429a1de47ac46ed61232b85300684bf96cd63874edee3940179010 (66 files, 267,185,165 bytes). Kokoro and Piper remain present. An independent restore checked every file hash. Temporary Qwen upload/build capabilities are expired. The owner authorized this production catalog update; the catalog is shared by build contexts, so a future main build can read it without changing the main branch.

**Live reader verification:** In the deployed reader, Qwen3 showed “Selected · ready to listen.” Introduction playback advanced from about 0:02 to 0:22, and the highlighted word advanced with the visible book text. The export contains 20 MP3 tracks, 229 passages and 36,219 estimated word cues. Automated text, timing, schema and library checks passed; the project check (62 Node tests, typecheck, docs and agent-stack checks) and clean build passed.

**Review boundary:** Estimated alignment coverage is 96.2% overall and 47.93% in the index. Seventeen page transitions remain provisional and two split-boundary cues were omitted. This browser check verified playback and word-follow, not subjective audio quality. The menu labels the voice English/female; British accent and naturalness still need listening review. No full proofread is claimed.

**Next:** Qwen is ready on develop. Owner listening review is optional acceptance; keep the code on develop unless separately authorized. Chatterbox remains a separate incomplete voice in the broader three-engine request.

Updated 2026-11-18 (Europe/Berlin).

## Current work — PageChime 0.3.0

PR #8 merged 0.3.0 to main at 046f009e. Netlify production deploy 6aed00a789daae96fd796049 is current, with library/reader functions and the media edge. Main and develop share the private catalog. Kokoro is the existing Manifest default. The exact release tree passed Application 42119331554 with 62 Node and 88 browser cases, four private skips, exports and 574/900 KiB. The separate PR run stalled installing Chromium. The sample passed isolated desktop and Pixel 7 publishing. Team sign-in gates live admin verification. GitHub tag and release publication are pending. See REQ-019/018 plans.

REQ-021 runtime fdf1b721 is ready on develop deploy 6aee9ddbf8b572cb6933d418. Desktop paper grew from 740 to 1120px at 980×1750. Checks passed with 62 Node and 48 reader cases, and 576/900 KiB. Short windows, editions, themes and phones were checked. Hosted book checks require team sign-in.

<!-- AGENT_TASK_STATE_START -->
{"task_id":"REQ-016","repository":"dn-lx/pagechime","base":"develop","branch":"develop","pr":null,"status":"reviewing","last_verified_sha":"627a203bc22b3437f7aaf9f09574171f164c72f2","next_step":"Qwen integration is verified on develop. Optional owner listening review for accent/naturalness; Chatterbox completion remains separate. Do not promote to main without explicit approval.","updated_at":"2026-11-18T09:52:37.708Z"}
<!-- AGENT_TASK_STATE_END -->

## Reader synchronization — REQ-017

Source ef3878f6 passes51 Node/80 browser cases, web/mobile exports and budget. Playback/voice navigation retains real reading anchors; hosted verification remains behind Netlify team sign-in. See docs/plans/REQ-017-reader-narration-position.md.

## Recordings — REQ-016

Piper is complete and published privately as45 declared files/187,054,263bytes, immutable version94da1b70b50c4009a99e2bb11dc94c3d2a02e4b2a4c4a815fad56cfa7bf2334f. Temporary capabilities expired;1 existing build/0 upload active. Original Kokoro/editions retained. Piper website source fc6fe2c passes CI40174845078 (48 Node/76 browser), with its own manifest-piper identity and real passage boundaries.

Historical Qwen and Chatterbox checkpoints remain in the owner's private Drive; Chatterbox is incomplete. See docs/plans/REQ-016-full-local-narrations.md for recovery and provenance.

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
