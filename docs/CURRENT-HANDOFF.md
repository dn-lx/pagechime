# Current Handoff

Updated 2026-10-24.

<!-- AGENT_TASK_STATE_START -->
{"task_id":"REQ-013","repository":"dn-lx/pagechime","base":"develop","branch":"develop","pr":null,"status":"implementing","last_verified_sha":"6e38106e49e7141390d6b1530e8fe25d63c432d9","next_step":"Finish REQ-013 UI/theme/PDF checks and develop deployment. Private reference flags are published and upload access expired. Keep missing-sentence audit open; no speculative text/audio edits.","updated_at":"2026-10-24T14:41:28.994488+00:00"}
<!-- AGENT_TASK_STATE_END -->

## Active work and owner policy

REQ-013, directly on develop with null PR. The owner requires **$0 Google spend** and continued development. This supersedes earlier paid audition/full-book examples. Google --check/--generate, credential acquisition and HTTP calls are now blocked in source; budgets/env/cache cannot enable them. Offline estimates and existing Emma recordings remain available. Independent reviewer /root/guest_security_review found no material issue; synthetic Python 6/6, targeted Node 3/3 and diff whitespace passed. This local guard cannot control other applications or verify the Cloud account’s bill.

Owner Cloud project:project-89a9b506-ff91-4cd1-a2d; reports API setup. Provider billing/API state is not verified; Console/Cloud Shell were unavailable. The source lock prevents Pagechime Google requests, not unrelated applications’ spending. See docs/CONTENT-AND-VOICES.md.

REQ-013 reviewed changes implement real fullscreen/fallback/browser exit, measured player height, visible10s web/native transport and optional validated reference skipping. Root fixed the fullscreen main-shell min-height that let navigation fall behind the player. Core/source review passed13 checks; controls browser8/8 passed before the final prose-only fullscreen polish. Private book delta is8 skipByDefault flags only, no chapter reorder/text/audio/cue change; new immutable version0e4a2bc8f8faf3292e231cd8fd2ce50e330cc8f075c021b9ecb755c4350824ae is published. Fresh27-file restore verifies hashes; upload capability expired immediately, subsequent401; active counts1 build/0 upload (one expired audit row). Google lock/main/gate remain unchanged.

Owner confirms missing sentences affect both text and audio and later asks to proceed without another clarification. Album122 photos had two local OCR passes; no confident omitted sentence was isolated. Printed page5/key terms was visually checked against all6 current passages and matches. Eleven long uncued body runs were independently transcribed locally with100% expected-word overlap, so these sampled timing gaps are not missing narration. Do not guess text/audio replacements or claim the omission report resolved. Private audit evidence is under /tmp/pagechime-*; no private text/photos belong in Git.

## Verified book and source

Historical CI and runtime evidence is in docs/REQ-012-VERIFICATION.md. Native tooling advisories remain non-blocking REQ-005; documentation checkpoints are not new runtime evidence.

Supplied unmodified Manifest All-Editions ZIP contains page-matched/cozy PDFs (237 pages), Kindle/fixed-layout EPUBs and licences. Complete M4B from Drive: Kokoro bf_emma,19 chapters,13,682.328 s. Recovered private book has 1,136 passages, 207,752 characters, 37,139/37,476 acoustic word cues (99.1% overall; chapter 90.91–100%). Untimed words remain visible without guesses. Text follows words; PDFs follow source pages without glyph overlays. Native/web preserve selection offsets; legacy passage-only books work. Source originals and contents stay outside Git.

Historical complete-book, web/native and hosting checks: docs/REQ-012-VERIFICATION.md. REQ-013 unit/types38 checks, Next export, actual-book2 browser cases and native exports pass; shell565/900KiB. Final enhanced controls/theme/PDF checks and develop publication remain.

## Private asset source and external writes

Me+ `wbqnctrvxohxwiaignhg`, isolated from unrelated apps/Supabase Auth. Migration 20261024072446 and pagechime-library v1 (`a9cd086a-f612-4524-a8c8-3047a04d7b46`), verify_jwt=false with own capability auth. New book_reader_library_keys: RLS true, no public/anon/authenticated access. Private bucket pagechime-library-develop, 24 MiB file cap, no member/anonymous storage policies.

Immutable version 7e6afd6087edca77f985476fab4019017651843388c6f4d23cc2e24e29d0bdca: 27 files/87,289,918 bytes plus current.json. Fresh download verified every hash/size. Live checks: anonymous/unknown401; build GET200/POST403; upload GET403. Temporary upload key deleted and then401; final 1 build key/0 upload keys. No new provider calls or uploads are needed for current source changes.

Netlify repair 2026-10-24: prior Builds-only upserts did not persist. Independent review passed before saving the existing read-only key with the plan’s minimum secret scopes Builds/Functions/Runtime, no Post processing, branch-deploy only. Getter confirms is_secret=true and only that context. Runtime consumers do not use the key. Connected build verifies 27 files and exports successfully; 36 tests/typechecks pass, shell 563/900 KiB, zero credential scan matches. Library remains required.

## Hosting blocker and branch policy

Netlify pagechime site 73688a4b-90ab-4eac-be6d-ef305f33ebc3, team don-alex-perera, Git-linked dn-lx/pagechime. Production branch main; only develop branch deploys; npm run build → apps/web/out; reader BFF/media edge. Non-production team-login gate stays unchanged.

Current runtime source6e38106e49e7141390d6b1530e8fe25d63c432d9 deploy6adc929cc4e8e1686f1b482d: ready, develop/branch-deploy, reader function/media edge. Hosted guest catalog shows1 book/19 chapters after reload; Emma advances, active word renders, chapters10/19 and both PDF editions render. Google disabled; main/gate unchanged. Prior source0ef9efd repaired the connection. CI exposed the early-seek race; deterministic regression failed4.2→0 before the reviewed fix and passes after. All5 exact-source CI suites pass (54 fixture browser cases;2 private cases pass separately; Android/iOS exports). Details: docs/REQ-012-VERIFICATION.md. Member login and native/device acceptance remain separate.

No main promotion: main remains 2396458e46609beb8c448221a647491fb90363c9. Do not create a release PR, reopen superseded PR #2 or alter historical branches. Use GitHub MCP for writes. Preserve leaf.* keys, app.dnlx.leaf IDs, book-reader-api and book_reader_* identities.

## Accounts and remaining acceptance

REQ-011 guest/member, email signup and Show/Hide password are deployed in the prior runtime. Public signup grants reader; admin requires private invite. book-reader-api v3/earlier migration unchanged. Previous disposable test accounts removed. Owner-only single-use admin invite remains private/usable until 2026-10-25T22:48:44Z; reopen its original link. Do not choose an owner password or replace a usable invitation.

Keep REQ-004/006/007/011/012 runtime criteria open; native exports are not signed apps/device/store acceptance. No payments, analytics, unrelated backend or production changes. This session’s maximum approved Google spend remains zero.
