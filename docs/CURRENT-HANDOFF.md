# Current Handoff

Updated 2026-10-25 (Europe/Madrid).

<!-- AGENT_TASK_STATE_START -->
{"task_id":"REQ-014","repository":"dn-lx/pagechime","base":"develop","branch":"develop","pr":null,"status":"blocked","last_verified_sha":"bdb61533b2294aa2cde4ed01c24f7f8f705f8e88","next_step":"REQ-015 samples are delivered only to the owner; no sample UI/assets may be published. Await voice choice before full narration. REQ-014 hosted deploy/source checks still need authenticated Netlify access.","updated_at":"2026-10-25T05:15:20.050888+00:00"}
<!-- AGENT_TASK_STATE_END -->

## Voice auditions completed — REQ-015

Qwen3-TTS, Chatterbox Nano and Piper Cori original auditions generated locally and saved as three owner-downloadable MP3s. Kokoro unchanged. Latest owner instruction: samples only here, never on the website; upload after full recording is ready. Unpublished preview UI/assets/tests were removed before any source publication. Only offline preparation script/provenance/docs remain. No private book text, human voice recording or paid API. Models/environments/raw WAVs remain under /tmp/pagechime-voice-lab. See docs/plans/REQ-015-free-voice-auditions.md. Full-book voice choice/generation has not started.

REQ-014 overlay repair source2a677130 has45 unit/74 browser passes,2 private skips, mobile exports and successful application CI40162568905. Hosted deploy/source and interactions remain unverified because the browser is signed out of Netlify. See docs/REQ-014-VERIFICATION.md. Later audition QA found low contrast in the existing tiny selected-voice status label; no repair was included in this audio-only delivery. Prior copy runtime13488eed was ready in deploy6add361c782eba47291d2f53.

## Policy and current work

Work directly on develop with null PR, GitHub MCP writes. Main stays2396458e46609beb8c448221a647491fb90363c9 until explicit later promotion. Preserve leaf.* keys, app.dnlx.leaf identifiers, book-reader-api/book_reader_* identities. No production/outer-gate/payment/analytics/unrelated-app changes.

Owner approved Google spend is $0. scripts/google-narration.py blocks provider requests before credentials or network, including --check/--generate. No budget/env/cache bypass. Existing Kokoro bf_emma remains available. This lock does not verify Cloud billing or control unrelated apps. Cloud project project-89a9b506-ff91-4cd1-a2d reports setup; account billing/API state unverified. See docs/CONTENT-AND-VOICES.md.

REQ-013 remains accepted at runtime68c7d253 / ready deploy6add25a2, with actual-book desktop/mobile coverage, both PDFs, native exports and word-join/anchor verification. Earlier account outbox/timer, player sizing and reference-skip fixes remain covered by the new regression run. Historical evidence: docs/REQ-013-VERIFICATION.md.

## Editorial work and private assets

Owner confirms omissions affect text/audio, later requests proceeding without another question, then authorizes very minimal completion of nonsensical sentences. Album122 photos had two local OCR comparisons; most unmatched text was layout noise. Printed page5/key terms matched all6 passages. Eleven uncued runs were transcribed locally with100% expected-word overlap; this is sampled timing-gap evidence, not a full audiobook proofread. Bounded independent prose/PDF review found five page-end split words and one optional single-letter grammar repair, no definite missing clause/narration. Keep that limitation explicit.

Follow-up reading metadata uses5 continuesPreviousWord flags and1 readingEdits deletion, with no mutation of original segment text, audio, cue offsets or chapter order. Display-to-source UTF-16 maps preserve existing/new annotation anchors; shared pagination keeps joined halves together. Original PDFs/EPUBs stay intact. Independent overlay review passes36 targeted checks plus380 join/budget checks; the metadata is applied locally and by the develop build. No private text/photos/audio belong in Git.

Book: Manifest in Action,237 pages,19 chapters,1,136 passages; full Kokoro Emma recording13,682.328s. Acoustic word cues37,139/37,476 (99.1%); gaps stay visible without invented timings. Source originals/caches are private under /tmp/pagechime-*; screenshots/tests should use dedicated /tmp output directories. Supplied All-Editions ZIP remains in connected files if recovery is needed. See docs/REQ-012-VERIFICATION.md for historical acceptance.

Me+ wbqnctrvxohxwiaignhg, isolated bucket pagechime-library-develop,24MiB file cap, no anon/authenticated storage policies. pagechime-library v1 verifies capability auth despite verify_jwt=false. book_reader_library_keys has RLS/revoked public grants. Existing read-only build capability cannot modify assets or accounts.

Current published immutable version0e4a2bc8f8faf3292e231cd8fd2ce50e330cc8f075c021b9ecb755c4350824ae:27 files/87,290,086bytes, exactly8 reference flags versus original7e6afd6087edca77f985476fab4019017651843388c6f4d23cc2e24e29d0bdca. Fresh restore verifies27 hashes. Temporary upload capability expired, subsequent401; active1 build/0 upload, expired audit row retained. A new editorial upload was blocked by automatic approval review because private-book disclosure to Supabase was not explicitly authorized. No upload/publish retry: current pointer unchanged,0 recent objects. The new temporary upload key was expired; subsequent401 and active uploads0. A safer source-only hash-bound plan in scripts/book-reading-repairs.json applies metadata during prepare-assets after verified restore, with no book text in Git or new Supabase payload. Never print tokens or signed URLs.

## Hosting and remaining acceptance

Netlify site73688a4b-90ab-4eac-be6d-ef305f33ebc3, team don-alex-perera, linked dn-lx/pagechime. main production, only develop branch deploys, npm run build→apps/web/out, reader BFF/media edge. Develop URL https://develop--pagechime.netlify.app/. Team-login gate unchanged. Secret read-only connection is branch-deploy only with plan minimum Builds/Functions/Runtime scopes, no Post processing. Required asset verification stays fail-closed. Prior missing connection is repaired; no env change is needed for current work.

REQ-011 guest/member/email signup/Show-Hide fields are implemented; public signup grants reader, admin requires invitation. Me+ book-reader-api v3 unchanged. Previous disposable accounts removed. Owner single-use admin invite remains private/usable until2026-10-25T22:48:44Z; do not replace a usable invitation or choose an owner password. Guests have no personal persistence. REQ-004/006/007/011/012 device/hosted/provider acceptance stays separate. Native exports are not signed installs/store acceptance. Known native tooling advisories remain non-blocking REQ-005.
