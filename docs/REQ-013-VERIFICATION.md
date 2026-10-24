# REQ-013 verification

Verified2026-10-24. Runtime source[68c7d253](https://github.com/dn-lx/pagechime/commit/68c7d2539800d76e75c7a47e80a64af70d536591), develop only. Netlify deploy6add25a2e13c9e100daf0beb is ready at https://develop--pagechime.netlify.app/. Main remains2396458e46609beb8c448221a647491fb90363c9. The acceptance checkpoint updates documentation and rounds a private-test seek to the input’s0.1s step; runtime code is unchanged.

## Behavior and evidence

- Real document fullscreen from a direct gesture, explicit Exit, Escape/browser-exit cleanup and a usable full-window fallback. Measured player height uses an independent112px minimum; narrow/wide transitions cannot ratchet it down. Actual mobile Introduction has no hidden page overflow with the8-word minimum budget.
- Visible Back10s/Forward10s labels,44px touch targets,52px play, exact10s seeks and media-session/native parity. Light/night accessibility and PDF navigation geometry pass.
- Optional validated reference flags skip8 front/back sections in ordinary opening/listening. All19 chapters,237 PDF pages, direct Contents selections and saved locations remain available.
- Account timer refs clear across all engine-close lifecycles. Edits/new keys queued during in-flight saves drain promptly, retaining revisions and respecting close/error. Fixture IP isolation models separate browser contexts without weakening production or per-context rate limits.

| Check | Result |
| --- | --- |
| Types, unit/contracts, docs/agent validation |45 tests pass; all workspace/server types and validators pass |
| Full fixture desktop/mobile browser suite |64 pass;2 private cases intentionally skipped |
| Actual private book desktop/mobile |2 pass; all5 word joins, fullscreen geometry, active words, beginning/middle/end and both PDFs |
| Web production export and performance |Pass; compressed JS/CSS/fonts653/900KiB |
| Private-content native exports |Android and iOS pass; not signed/device/store acceptance |
| Independent review |Auth/security17; overlay36; final build-overlay16; all5 joins across380 budget checks; no unresolved material finding |
| Hosted develop browser |Guest catalog1book; Chapter5 default; full-window fallback/Exit; page/player bounds; Emma advances14s with active word and pauses; no overflow or alert |

All5 source CI suites passed: [Application40135204610](https://github.com/dn-lx/pagechime/actions/runs/40135204610), [Agent reliability40135204599](https://github.com/dn-lx/pagechime/actions/runs/40135204599), [Version40135204587](https://github.com/dn-lx/pagechime/actions/runs/40135204587), [Security40135204604](https://github.com/dn-lx/pagechime/actions/runs/40135204604), [Agent stack40135204590](https://github.com/dn-lx/pagechime/actions/runs/40135204590). Known native-tooling advisories remain non-blocking REQ-005; this is not a claim that every advisory is resolved. Hosted Chrome lacks fullscreen permission, so its fallback was verified; actual API success is separately covered by local desktop/mobile browser checks. Screenshots from both actual-book viewports and hosted develop were visually inspected. Hosted logs returned40 browser-extension metadata errors and no other warnings/errors; these extension messages are separate from PageChime.

## Minimal editorial repairs

The supplied122-photo album had two OCR comparisons and bounded prose/PDF review. Five ordinary PDF page-end hyphenations were split into two words in reflowed text. Explicit continuation flags join only those verified pairs and keep them on one reading page. One optional grammar repair removes an extra letter in displayed reading text. Original source text, recordings, acoustic cues, chapter indices and source UTF-16 offsets are unchanged. Display-to-source maps preserve legacy highlights and newly selected corrected quotations. Validation currently allows deletion-only edits and two-part joins; it rejects expanded replacements, overlap/bad offsets and continuation chains.

No definite missing clause was identified, so no new sentence was generated. Eleven independently transcribed uncued runs contained all expected words, supporting timing-gap diagnosis for those samples only. This is not an exhaustive audiobook proofread. Existing Emma audio stays intact; Google requests remain hard-blocked under the owner’s$0 policy.

## Private build boundary

Published library version remains0e4a2bc8f8faf3292e231cd8fd2ce50e330cc8f075c021b9ecb755c4350824ae,27 verified files. Automatic approval review rejected re-uploading the private book to Supabase because that disclosure destination lacked explicit authorization. The action was not retried: current pointer unchanged,0 recent objects. Temporary upload capability was expired immediately; subsequent401 and active uploads0.

The safer completed path uses scripts/book-reading-repairs.json, containing only identifiers, indices, a source-text hash and deletion offsets. prepare-assets applies this reviewed metadata to the local build copy after hash-verified restoration; changed source text is left unchanged. The plan is idempotent and retains every original source/cue field. No private book text/photos, tokens or signed URLs enter Git. Existing read-only build configuration, team-login gate and production branch policy are unchanged.
