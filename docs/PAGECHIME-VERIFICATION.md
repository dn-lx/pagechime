# Pagechime verification evidence

Candidate: initial 0.1.0 implementation on feature/leaf-read-along, PR #1. Final SHA and deployment identity are recorded in Current Handoff and GitHub checks.

## Checks

- Shared core tests: passage/seek boundaries, invalid timing imports, validated duration.
- Web TypeScript and production static export.
- Expo TypeScript and Android/iOS Hermes bundle export with complete private assets.
- Playwright desktop + mobile Chromium: actual audio playback, chapters, bookmarks and restore, PDF canvas, voice setup, theme, accessibility, offline download/reload/range playback and persistent imports. Fixtures are original, isolated from the private book.
- Private Manifest runtime: 19 chapters, 986 cues, 237 PDF pages, complete first/last cues and existing audio files. Actual-book desktop/mobile screenshots and playback/PDF smoke checks are inspected separately from fixture tests.
- Static compressed JS/CSS/font budget ≤900 KiB, host per-file budget ≤25 MiB; PDF engine is deferred.
- Strict documentation/agent-stack validation and starter tooling regression suite.
- Independent source/security review required by AGENTS.md; findings repaired before delivery.

The precise command results and remaining verification limits are updated at delivery. A successful export does not prove device behavior. Google synthesis is setup pending and has not run. Private hosting's owner-authenticated browser cannot be substituted with an anonymous test; inspect deployment state and public access-gate behavior separately.

Final local results: 4/4 core checks; 93/93 starter regressions; 12/12 Playwright desktop/mobile checks; Next production export; Expo Android/iOS exports; all workspace TypeScript; strict docs/agent stack checks. Budget: approximately 543 KiB compressed JS/CSS/fonts against 900 KiB. Independent review found no remaining actionable source blocker after fixes. Additional manual negative-path checks confirmed partial offline-cache rollback and manual bookmark page restoration. Actual Manifest first chapter plays, final chapter opens, final PDF page 237 renders/restores. Continuous full-length playback was not performed.

Web/core production dependency audit: zero vulnerabilities. The separate full-monorepo tooling audit reports the open Expo CLI advisory in REQ-005; see docs/SECURITY-REVIEW.md. This is not described as a clean full-monorepo audit.


## Interactive text reader (REQ-009, PR #4)

The current reader uses the timed transcript as reflowable book pages; source PDF remains optional. Shared UTF-16 passage offsets preserve the reading place through page/font/viewport changes and independently of audio. Manual reading, audio chapter auto-advance, explicit return to narration, PDF-only/mixed imports and synced anchors without a local follow preference have regression coverage. Native UTF-8 text and multi-paragraph quotations exclude playback controls. Selected quotations retain exact ranges; highlights/notes use existing account-owned state. Native markup is escaped and bridge messages are document-scoped and checked against visible fragments.

Verification on the final PR candidate includes20 unit/core/API cases, the existing22 browser account/reader checks and14 new desktop/mobile reader/selection/native-markup cases (36 total), all workspace/server types, Next export, both full-content Expo Hermes exports,93 starter regressions, strict docs/adapters and secret scanning. Compressed initial JS/CSS/fonts:556KiB/900KiB (prior550KiB). Final-head CI receipts live on PR #4.

Private Manifest coverage: all986 passages across19 chapters reconstructed exactly at budgets30/90/180/360, checking2,273 generated pages. The actual book's first and final chapter rendered on1440px desktop and390px mobile with no page errors or horizontal overflow; the final cue and end-of-book marker were verified. Screenshots were inspected, including sepia typography and the ending. Outputs remain local under /workspace/output/pagechime-reader; no book content/screenshots were added to public Git. Long rendered pages can scroll within their paper surface; this is a word-budget pagination model, not PDF page numbering or measured line/word narration alignment.

Independent review found and repaired audio/text chapter coupling, native selection/Alert limits, stale selection identity, mixed-import fallback and web PDF/fresh-follow restore issues. No remaining blocking source finding. Edge Function v2 with reviewed additive metadata validation is ACTIVE; real hosted account/Netlify media validation remains pending. Browser checks of generated native HTML and successful Expo exports do not establish physical iOS/Android selection, signed installs or store readiness. Continuous3h48m playback was not performed. Google remains setup-only; REQ-005 and hosted REQ-004/006/007 remain open.
