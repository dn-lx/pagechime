# Current Handoff

Updated 2026-10-25 (Europe/Madrid).

<!-- AGENT_TASK_STATE_START -->
{"task_id":"REQ-016","repository":"dn-lx/pagechime","base":"develop","branch":"develop","pr":null,"status":"blocked","last_verified_sha":"fc6fe2c6a1edf9cb32a8c61ebe3ddbc203394ac2","next_step":"Confirm live Netlify develop deployment. Resume saved Qwen/Chatterbox checkpoints when compute becomes available; do not claim active workers.","updated_at":"2026-10-25T08:04:35.071Z"}
<!-- AGENT_TASK_STATE_END -->

## Piper website and unfinished recordings — REQ-016

Owner explicitly requests full Piper added to develop; no short samples. Complete private MP3:12,397.920s,715 chunks,36,025 narrative words. Filename Manifest-in-Action-Piper.mp3, Library libfile_32ae1fd154488191b47d9a92fdcd2003. Site packages17 chapters with exact passage boundaries, no inherited word cues. Separate manifest-piper identity isolates progress/notes/bookmarks. Nearest-passage voice switching and declared-path guest traversal are implemented; source fc6fe2c6a1edf9cb32a8c61ebe3ddbc203394ac2 passes Application CI40174845078:48 Node tests,76 browser passes/4 private skips, web/mobile exports and567KiB/900KiB budget. Security/policy/reliability pass except known non-blocking REQ-005 advisory. First-run contrast and mobile chapter-header assertion were repaired. Live develop deployment is unverified; the available Netlify connector exposes an older published production deploy, not the current branch build.

Private current version94da1b70b50c4009a99e2bb11dc94c3d2a02e4b2a4c4a815fad56cfa7bf2334f:45 files/187,054,263bytes. Fresh complete hash restore verified; both temporary capabilities expired (1 existing build/0 upload active). Encoding intermediates excluded before deployment. No private book/media or keys in Git.

Compute became unavailable before source synchronization; website changes were recovered through GitHub MCP. Earlier local48 Node/4 targeted fixture/4 real-book browser checks passed; reconstructed application revision is now verified by the remote CI above. Local workers cannot be claimed active. Latest observed Qwen39/Chatterbox>=70. Durable checkpoint ZIPs version1 contain38/43 chunks: libfile_6c7f4ad27d2081918be19f3472d74398 / libfile_91cc8030ae308191b8ddb710c0019fad. Resume sequentially when compute returns. Full details/model provenance/private plan paths in docs/plans/REQ-016-full-local-narrations.md. Qwen/Chatterbox are not website recordings.

## Policy and current work

Work directly on develop with null PR, GitHub MCP writes. Main stays2396458e46609beb8c448221a647491fb90363c9 until explicit later promotion. Preserve leaf.* keys, app.dnlx.leaf identifiers, book-reader-api/book_reader_* identities. No production/outer-gate/payment/analytics/unrelated-app changes.

Owner approved Google spend is $0. scripts/google-narration.py blocks provider requests before credentials or network, including --check/--generate. No budget/env/cache bypass. Existing Kokoro bf_emma remains available. This lock does not verify Cloud billing or control unrelated apps. Cloud project project-89a9b506-ff91-4cd1-a2d reports setup; account billing/API state unverified. See docs/CONTENT-AND-VOICES.md.

REQ-013 remains accepted at runtime68c7d253 / ready deploy6add25a2, with actual-book desktop/mobile coverage, both PDFs, native exports and word-join/anchor verification. Earlier account outbox/timer, player sizing and reference-skip fixes remain covered by the new regression run. Historical evidence: docs/REQ-013-VERIFICATION.md.

## Editorial work and private assets

Owner confirms omissions affect text/audio, later requests proceeding without another question, then authorizes very minimal completion of nonsensical sentences. Album122 photos had two local OCR comparisons; most unmatched text was layout noise. Printed page5/key terms matched all6 passages. Eleven uncued runs were transcribed locally with100% expected-word overlap; this is sampled timing-gap evidence, not a full audiobook proofread. Bounded independent prose/PDF review found five page-end split words and one optional single-letter grammar repair, no definite missing clause/narration. Keep that limitation explicit.

Follow-up reading metadata uses5 continuesPreviousWord flags and1 readingEdits deletion, with no mutation of original segment text, audio, cue offsets or chapter order. Display-to-source UTF-16 maps preserve existing/new annotation anchors; shared pagination keeps joined halves together. Original PDFs/EPUBs stay intact. Independent overlay review passes36 targeted checks plus380 join/budget checks; the metadata is applied locally and by the develop build. No private text/photos/audio belong in Git.

Book: Manifest in Action,237 pages,19 chapters,1,136 passages; full Kokoro Emma recording13,682.328s. Acoustic word cues37,139/37,476 (99.1%); gaps stay visible without invented timings. Source originals/caches are private under /tmp/pagechime-*; screenshots/tests should use dedicated /tmp output directories. Supplied All-Editions ZIP remains in connected files if recovery is needed. See docs/REQ-012-VERIFICATION.md for historical acceptance.

Me+ wbqnctrvxohxwiaignhg, isolated bucket pagechime-library-develop,24MiB file cap, no anon/authenticated storage policies. pagechime-library v1 verifies capability auth despite verify_jwt=false. book_reader_library_keys has RLS/revoked public grants. Existing read-only build capability cannot modify assets or accounts.

Earlier immutable library0e4a2bc8f8faf3292e231cd8fd2ce50e330cc8f075c021b9ecb755c4350824ae had27 files; the current Piper version above preserves those originals. Earlier editorial upload was denied without disclosure authorization; current owner instruction explicitly authorizes full Piper website upload. Hash-bound reading overlays and all original Kokoro cues remain. Never print capabilities or signed URLs.

## Hosting and remaining acceptance

Netlify site73688a4b-90ab-4eac-be6d-ef305f33ebc3, team don-alex-perera, linked dn-lx/pagechime. main production, only develop branch deploys, npm run build→apps/web/out, reader BFF/media edge. Develop URL https://develop--pagechime.netlify.app/. Team-login gate unchanged. Secret read-only connection is branch-deploy only with plan minimum Builds/Functions/Runtime scopes, no Post processing. Required asset verification stays fail-closed. Prior missing connection is repaired; no env change is needed for current work.

REQ-011 guest/member/email signup/Show-Hide fields are implemented; public signup grants reader, admin requires invitation. Me+ book-reader-api v3 unchanged. Previous disposable accounts removed. Owner single-use admin invite remains private/usable until2026-10-25T22:48:44Z; do not replace a usable invitation or choose an owner password. Guests have no personal persistence. REQ-004/006/007/011/012 device/hosted/provider acceptance stays separate. Native exports are not signed installs/store acceptance. Known native tooling advisories remain non-blocking REQ-005.
