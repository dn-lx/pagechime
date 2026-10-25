# Pagechime requirements

Accepted scope: Next.js website and Expo React Native app, based on Agent Project Starter. Updated 2026-10-24.

## [ ] REQ-016 — Three complete local narrations
- Create full Qwen3-TTS, Chatterbox and Piper recordings of the supplied book. Prefer British female narration; use an available voice if necessary. Preserve the existing Kokoro recording and Google zero-spend block.
- Follow the book's narrative spine from introduction through epilogue, retaining all narrative words and excluding cover/contents/reference material from normal listening as previously requested.
- Use resumable, integrity-checked sections with stable synthetic narrator references, conservative CPU/memory scheduling and durable private checkpoints. No private book text/audio in Git or small sample clips on the website.
- Verify source coverage, initial acoustic transcription, all chunk hashes and complete output decoding; deliver three full audio files privately. Record timing/quality limits and do not represent old Kokoro word cues as timings for new narration.
- Plan: docs/plans/REQ-016-full-local-narrations.md. Generation in progress; no full recording is ready yet.

## [x] REQ-015 — Free voice auditions delivered only to the owner
- Generate the same original short English passage locally with Qwen3-TTS, Chatterbox and Piper; keep the existing Kokoro recording unchanged. No paid service, Google requests, private book text or human voice cloning.
- Deliver the three short audio files directly to the owner. Latest instruction: do not add sample clips to the website; upload only after a full recording is created.
- Retain model/revision/licence/generation provenance and durable downloadable samples. A sample does not constitute full-book narration or word timings.
- Completed2026-10-25: three MP3s saved and delivered, all decode and have no clipped raw samples. Qwen/Chatterbox automated transcripts match; Piper has one article-word ambiguity. Reproduction and exact provenance: docs/plans/REQ-015-free-voice-auditions.md. No app/runtime change or sample publication.

## [ ] REQ-014 — Dismissible settings and reliable overlays
- Appearance settings have a visible Close and Done action, outside-tap/Escape dismissal, contained keyboard focus and focus return; changes remain applied and narration/reading place are preserved.
- Keep close controls reachable on short/narrow screens and in fullscreen. A gesture that begins inside a dialog, or a tap on its padding, must not dismiss it accidentally. Escape dismisses the current dialog without also leaving fallback fullscreen.
- Audit reading help, voice, import, notes/account/join dialogs and the mobile library drawer for the same close/focus/overflow problems; fix confirmed defects without changing account/security boundaries.
- Verify narrow mobile/desktop, themes, keyboard and rendered screenshots, relevant regressions, web build/budget and develop-only deployment. Existing Google $0 policy remains in force.
- Source implementation2a677130 and local/CI acceptance pass: docs/REQ-014-VERIFICATION.md. Hosted deploy/source and interaction verification remain pending Netlify browser authentication.

## [x] REQ-013 — Fullscreen reader, clear transport and verified text
- Enter real browser fullscreen from the reader control; provide an obvious exit and a usable full-window fallback when the browser lacks the API. Keep reading/audio controls accessible and synchronize state after browser exit.
- Rewind/advance by exactly 10 seconds with readable labels, generous mobile touch targets and consistent media-session/native controls.
- Skip cover/publication/dedication/contents and back reference chapters in normal listening, while retaining every chapter for explicit access and preserving saved positions.
- Audit the supplied photo album against the private reading text. Restore photo-verified gaps and, under the owner’s latest instruction, use only the few words needed to complete an obviously broken sentence. Preserve source quote offsets and acoustic cues; never invent timestamps or commit private book text/photos. Record source restorations separately from editorial repairs.
- Polish the existing paper/olive reader and player, verify narrow mobile/desktop, fullscreen/fallback/exit, skip boundaries, themes, accessibility, real book coverage and develop deployment. Google remains paused under the owner's $0 policy; main stays unchanged.
- Plan: docs/plans/REQ-013-reader-controls-text.md. Verified develop source68c7d253, ready deploy6add25a2;45 contracts/types,64 fixture browser checks,2 actual-book cases, web/native exports and5 CI suites pass. Five verified word joins and one minimal reading-only grammar repair preserve original text/cues; no definite omitted clause was identified. Evidence: docs/REQ-013-VERIFICATION.md.

## [ ] REQ-012 — Manifest library and word-following narration
- Restore Manifest in Action from the supplied 237-page PDF/EPUB editions and complete 19-chapter audiobook, with a reliable private build asset source outside public Git.
- Provide the Kindle-style reading/PDF experience with real optional word timestamps, active-word audio following and preserved notes/selection/reading anchors across web/native.
- Fix catalog loading/cache failures and correctly distinguish valid empty, offline fallback and failed loads.
- Prepare British female Neural2 with SSML word timepoints and resumable generation. Owner update 2026-10-24: maximum approved Google spend is $0; disable Google network requests until a later explicit owner instruction. Existing Emma playback remains available.
- Remember each account’s selected packaged PDF edition across chapter changes and reloads; reject saved addresses outside the book’s current edition list. Guest preferences remain memory-only.
- Verify actual-book text/audio/page coverage, desktop/mobile runtime/screenshots, worker/private-storage negative paths, independent review, exports/budget and develop-only deployment.
- Plan: docs/plans/REQ-012-manifest-library.md. Restored 19-chapter/237-page assets and verified private source; real word following and cache fixes implemented. Remains open for live Google synthesis and protected hosted/native acceptance.

## [ ] REQ-011 — Guest reading and reliable account creation
- Guests can read/listen without an account. They cannot save bookmarks, notes, highlights, reading places or offline copies; guest state cannot expose or become another account's data.
- Readers can create their own account. Usernames and email addresses are accepted consistently by web, native, API and database; admin privileges still require a private invitation.
- Sign-in and account-creation fields offer accessible show/hide password controls and clear format/length validation.
- Guest media access is limited to the packaged shared catalog. Personal data and unlisted media remain protected at the server boundary.
- Acceptance: independent security review, positive/negative API/database tests, desktop/mobile rendered flows and inspected screenshots, account isolation, web/native types and exports, current develop deployment and hosted checks.
- Plan: docs/plans/REQ-011-guest-accounts.md.

## [x] REQ-001 — Complete Manifest read-along
- All 19 narration chapters and all PDF pages are available from beginning to end.
- Timed passages highlight as audio plays. Original PDF follows passage page cues.
- Play/pause, seek, chapters, speed and sleep timer work; recorded British female voice is retained.
- No transcript, PDF or book audio is committed to the public GitHub source repository.
- Acceptance: unit tests on timing boundaries and browser tests using the actual book, including chapter changes and reload.

## [x] REQ-002 — A polished accessible reading room
- Responsive library and reader, warm paper/olive design, readable editorial typography, keyboard controls, usable mobile touch targets.
- Light/night themes, text sizing, reduced motion, focused reading mode and purposeful transitions.
- Acceptance: inspected desktop/mobile screenshots, no overflow, critical axe checks, no application console errors.

## [x] REQ-003 — Grow the personal library
- Import PDF and audio, with optional timed-book JSON. Imports without timings use manual pages.
- Device-local progress/bookmarks and offline saving are explicit and recoverable.
- Acceptance: import validation, persistence, empty/error states and offline-range playback checks.

## [ ] REQ-004 — Next.js and Expo delivery
- A shared typed core package provides the book contract and timing logic.
- Website is built/exported and privately deployed. Expo native app uses native audio and reading controls with bundled private book assets.
- Android/iOS bundles are verified. Native signing/store publication requires the owner's build-service credentials and is not represented as verified without a build.
- Starter's branch, continuity, project memory and CI conventions are adapted and checked.

Evidence for REQ-001–003: 4 core tests; 12 desktop/mobile browser checks; actual Manifest first/last chapter audio/PDF checks; independent review. See docs/PAGECHIME-VERIFICATION.md. Native sleep timer is foreground-only and device testing remains separate.

## [ ] REQ-005 — Recheck Expo CLI advisory before native signing/OTA delivery
- Track GHSA-86w9-cpqp-85rv in node-forge 1.4.0 via Expo CLI; upstream has no patched release as of 2026-10-23.
- Web/core production dependency audit must remain blocking and pass.
- Keep full tooling audit visible; update the dependency when a verified patch becomes available.
- Signed/native store and Expo OTA workflows require renewed dependency/security review and real-device verification.
- Evidence and reachability assessment: docs/SECURITY-REVIEW.md.

## [ ] REQ-006 — Netlify development delivery
- Deploy exclusively from develop, including its real Netlify branch deploy. Main stays unchanged until the owner explicitly requests promotion after development.
- Use Netlify team don-alex-perera and site pagechime; preserve privacy until app access is enforced.
- Verify a real ready deploy, source revision, assets and access controls; report any necessary account connection action precisely.

## [ ] REQ-007 — Me+ standalone reader accounts and personal notes
- Custom username/password accounts live in isolated Me+ tables; passwords are salted hashes, never plain text. Supabase Auth users are not required.
- Server-side access checks, expiring/revocable sessions and login rate limits protect both data and book files.
- Bookmarks, notes and reading places belong to the authenticated account across web and mobile. Account switching does not expose another reader's device or server data.
- Readers can create/edit/delete notes at a passage/page. Administrators can provision and disable access without sending unsolicited messages.
- Acceptance: independent security review; two-account ownership/negative-path tests; browser login, notes, logout/switch and offline-isolation checks; native types/exports with device limits stated.
- Plan: docs/plans/REQ-007-reader-accounts.md.

REQ-006/007 implementation is in PR #3. Custom Me+ schema/API are live and tested; web/native source, private notes, scoped offline data, revocation and fixture flows pass. Actual Netlify deployment/media routing and positive hosted account verification remain pending CLI/network setup. See docs/READER-ACCOUNTS.md for evidence and precise remaining steps. Do not mark these items complete from source checks alone.


## [x] REQ-008 — Pagechime identity and one development environment
- Use Pagechime in website/mobile wordmarks, titles, install metadata, workspace packages and maintained project documentation.
- Rename the existing Netlify project in place to pagechime; retain dev as the single integration branch and keep production paused.
- Rename the existing GitHub repository to dn-lx/pagechime without creating another repository; verify its canonical name before changing source-control bindings.
- Preserve existing accounts, notes/bookmarks, pending logout and account-scoped offline data. Keep deployed API/database and native application identities stable.
- Acceptance: web/native checks and exports, desktop/mobile visual verification, independent review and readback of external identities/privacy settings.
- Plan: docs/plans/REQ-008-pagechime.md. Netlify and GitHub canonical names/unchanged IDs and privacy/PR continuity are verified. Types,14 unit tests,93 starter checks,22 browser checks, both full-content native exports and web budget pass; desktop/mobile branding was inspected, including320–1440px wordmark geometry. Independent review found no blocker. No duplicate development site was created.


## [x] REQ-009 — Interactive book reading
- Default to a reflowable Kindle-style text reader for timed books; original PDF is optional.
- Turn reading pages with touch/buttons/keyboard, retain place independently of PDF pagination, and preserve text through font/viewport changes.
- Offer readable serif/sans typography, text size, line spacing, page width, paper/sepia/night surfaces, focus mode and reduced-motion transitions.
- Follow narrated passages; manual page turns pause following without losing audio position. Resume following explicitly.
- Readers can select a quotation, highlight it or attach a note. Notes/highlights and reading place stay account-specific and sync through the existing API.
- Web and Expo share pagination/anchor semantics; preserve the full Manifest text and existing audio, imports, accounts, notes and bookmarks.
- Acceptance: meaningful pagination/anchor tests, desktop/mobile browser reading/selection/appearance/persistence tests, accessibility and inspected runtime screenshots, web/native exports and performance checks. Native device/signing limitations remain explicit.
- Plan: docs/plans/REQ-009-ebook-reading.md. Continue single Netlify project ID73688a4b-90ab-4eac-be6d-ef305f33ebc3, now named pagechime by the owner; dev remains integration and prod stays paused.

REQ-009 evidence: PR #4;20 unit/contracts,36 browser cases (22 existing and14 new), both full-content native exports, Next/types,93 starter checks,556/900KiB budget and independent review. Full Manifest is lossless across four reading layouts; real opening/ending screenshots were inspected on desktop/mobile. See docs/PAGECHIME-VERIFICATION.md for native/hosting limits. Netlify deployment and positive hosted account/media checks remain REQ-004/006/007.

## [x] REQ-010 — Develop-only workflow and branch deploy
- Create develop from the latest verified reader source and keep implementation on it.
- CI and release-source safeguards use develop/main; promotion to main needs a later explicit owner instruction.
- Verify a ready develop branch deploy on the existing Netlify project, its source revision and preserved private visitor gate. Live application-account/media behavior remains REQ-007.
- Preserve historical branches and close superseded release PR #2 without merging.
- Plan: docs/plans/REQ-010-develop-delivery.md. Evidence: develop created; CI and policy migrated; superseded PR #2 closed without merge; ready Netlify branch-deploy 6adbe48e6d265f521861abbc on 724444ec6cc5c34e38cc58af19e66cbf159e4c0a; main unchanged at 2396458e46609beb8c448221a647491fb90363c9. All five source suites passed on f99a2b224955f924886dff352922792f6af0ba3c; later exact-head checks remain separately recorded.
