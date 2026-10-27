# Interactive Pagechime reader

## Outcome and current evidence

REQ-009 turns the existing timed chapter text into an interactive book. Current dev a47df70 includes the complete reader/account foundation; PR #3 is merged and its feature branches removed. Original PDF remains an optional view. No production release or new hosting project is included.

## Contracts and implementation order

1. Add a shared lossless text pagination/reading-anchor model, splitting long passages without dropping text and preserving passage/time identity. Page count reflects the current reading layout, independently of source PDF page numbers.
2. Isolate the web book reader: paper page, running chapter/title, restrained page transitions, previous/next pages, keyboard/swipe access, appearance controls and explicit narration follow state. Use existing brand typography/icons/dependencies. Let unusually tall content scroll within its page rather than clip it.
3. Preserve manual reading anchors across reflow/reload and audio saves using an optional nested field in existing progress JSON. Store quotations/highlights as existing account-owned notes with optional metadata; no new database grants/schema or credentials.
4. Give Expo the same text pagination/anchor model and native reader controls, selection/annotation actions and appearance preferences. Export both platforms; do not represent exports as signed/device-tested apps.
5. Verify core boundaries, actual full-book text coverage, browser primary/negative flows, accessibility, desktop/mobile screenshots and budget. Independent review covers data compatibility and any external writes.
6. Reconcile deployment against the existing Netlify site, now named pagechime (same ID/privacy verified). Current workspace blocks Netlify with proxy403; user was asked to apply the allowlist. After networking/CLI authorization works, deploy private inputs from dev and verify account/media protection before opening reader access.

## Compatibility and risk

Retain legacy persistence/native IDs and deployed backend endpoint/schema. Escape all selected/book text through React text nodes, enforce note size, and scope selection to the active book. Old progress/notes without new metadata continue to work. Pagination must never lose or duplicate text, and a reflow must use a text anchor rather than an obsolete numeric page. Preserve failed writes and existing auth/logout isolation. Reverting the reader leaves compatible progress/notes in place. No new telemetry, paid voice generation or dependency is required.

## Evidence

Implemented in PR #4. Shared lossless coverage verifies all986 Manifest passages at four layouts. Twenty unit/contracts, fourteen new browser/selection/restore checks plus existing reader/account flows, both full-content native exports, Next/types/budget and independent review pass; see docs/PAGECHIME-VERIFICATION.md for exact scope and device limits. Final-head CI is required before dev merge. REQ-004/006/007 hosted acceptance remains separate until real deployment is verified.
