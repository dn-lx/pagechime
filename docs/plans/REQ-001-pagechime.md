# Pagechime implementation plan

## Outcome
A calm read-and-listen library, starting with the user's complete Manifest PDF and narration. Next.js web and Expo native share book data/timing logic, with platform-specific accessible controls.

## Evidence and boundaries
- The user supplied dn-lx/book-reader, initially empty; GitHub read/write capability verified through connector.
- dn-lx/agent-project-starter is the requested engineering foundation; its prod/dev flow is retained.
- Manifest narration already exists as 19 chapters with source-chunk durations, enabling passage-level timing. Page cues are mapped to the original PDF; no claim of word-level forced alignment.
- Public GitHub code excludes full book text/media. Private Site and local mobile build inputs contain them.
- Initial storage is on-device; no cross-device account/sync service or analytics.

## Sequence
1. Bootstrap starter and bind feature branch/draft PR to REQ-001–004.
2. Prepare shared book data, runtime validation and timing functions.
3. Implement Next.js library, reader, PDF canvas, audio, persistence and imports.
4. Implement Expo native library/reader/audio and local PDF viewer; bundle private assets only in local build inputs.
5. Verify unit/types/browser flows, mobile bundles, desktop/mobile screenshots, negative paths and review independently.
6. Promote via dev/prod workflow under the user's deployment request; deploy a private Site from the reviewed source and record revision/rollback instructions.

## Verification
Timing/seek/schema tests; Next build; Expo Android/iOS export; browser desktop/mobile, PDF render, playback/chapter boundaries, bookmarks/reload, import errors, reduced-motion and offline behavior. Inspect screenshots and console/network evidence. Keep native-device/signing verification distinct from JS bundle checks.

## Recovery
Source/data format is additive. Books and assets are unmodified source copies, except one oversized audio file is compressed to meet static-host per-file limits. Roll back to a known private Site version; device storage remains compatible with schema v1. No data migration or irreversible payment.
