# REQ-018 — Complete improved Kokoro publication

## Requirement

Owner request on 2026-10-27: merge develop into main first, then change/upload the complete improved recording. Preserve private content and existing synchronized editions. This task does not claim new word alignment, native signing, provider synthesis or completion of the separate Qwen/Chatterbox work.

## Verified current state

- PR #5 merged develop → main as 0.2.0 at e272781f76b8d089e9abc7ce824f327216d71c16 after application, browser, exports, budget, policy and blocking security checks passed. The tracked REQ-005 native-tooling advisory remains non-blocking. Netlify deployment was held with [skip netlify].
- Supabase Me+ wbqnctrvxohxwiaignhg; isolated private bucket pagechime-library-develop. Current base version94da1b70b50c4009a99e2bb11dc94c3d2a02e4b2a4c4a815fad56cfa7bf2334f has45 files/187,054,263 bytes.
- The downloaded base archive contains44 non-catalog assets. Every staged original matches its declared SHA256 and size.
- Improved input Manifest-in-Action-Kokoro-Emma-Improved.mp3 is104,735,561 bytes/13,091.904 seconds. No saved chapter/passage/word timing accompanies it.
- Six MP3 parts split at measured silence intervals preserve every encoded audio packet in order; the concatenated packet hash equals the input. Every part fully decoded. Combined duration13,091.904s; largest new part19,214,829 bytes. No re-encoding.
- Prepared immutable version2b728601497d21e7361778a7f3a8240eccfe2a819da2d57e987b66577051e94d has52 files/291,793,012 bytes (278.28MiB); the largest file remains20,492,125 bytes.
- Netlify pagechime73688a4b-90ab-4eac-be6d-ef305f33ebc3 now verifies team protection on all deploys. Current production deploy remains6adbe0d674ba4dbeb313e0b2.
- The previous Supabase browser session expired. The available Supabase connector has no Storage upload operation; direct dashboard file upload requires renewed browser sign-in. Existing Netlify branch build secret is write-only, so production needs its own read-only build capability.

## Affected contracts

- The improved edition is a separate catalog identity manifest-improved. Six listening parts are not presented as semantic chapter boundaries. It uses the retained237-page PDF with manual navigation, no invented text timings and no borrowed voice cues.
- Audio-only navigation retains the manually chosen PDF page through loads, seeks, automatic advance and reloads. Existing timed-book navigation remains covered.
- Library API and build restore allow320MiB aggregate; the24MiB per-file,256-file, MIME/path/origin/digest/redirect limits and capability authorization remain.
- Production uses PAGECHIME_PRODUCTION_LIBRARY_KEY in Netlify Builds scope, separate from the existing development secret; endpoint/required-source flags are public configuration.
- No database schema migration, payments, analytics or Google synthesis. No book media/text or keys enter public Git.

## Ordered implementation

1. [x] Owner-approved develop → main promotion and ancestry synchronization.
2. [x] Validate base archive, split the improved source losslessly and stage the new catalog.
3. [ ] Pass code checks for bounded aggregate growth, production-secret isolation and manual PDF behavior; inspect desktop/mobile evidence.
4. [ ] Deploy the backwards-compatible library function from the verified source.
5. [ ] Renew signed-in Supabase dashboard access; freshly verify the base current.json, upload every object under the new version prefix and verify object metadata.
6. [ ] Publish the pointer only after complete-object verification. Retain the previous version and pointer for recovery.
7. [ ] Configure a dedicated read-only production build capability/secret after private perimeter verification. Never print credentials or signed URLs.
8. [ ] Trigger a develop build and require fresh SHA256 restore of all52 assets. Promote the verified source through develop → main and verify production revision, catalog, audio beginning/end, range/seek and manual PDF persistence.

## Verification strategy

- Audio: exact encoded-packet sequence equality and complete decoding of all six outputs; declared duration/size/path/hash checks.
- Unit/negative paths:320MiB accepted, one byte above rejected before download, individual24MiB cap retained, production refuses the development credential and missing required source.
- Browser: untimed fixture on desktop/mobile, PDF page preserved across previous/next/automatic advance and reload; reading/follow controls correctly disabled; inspect screenshot and console errors.
- Existing suite: account boundaries, timed voice anchors, library security, web/mobile exports, bundle budget and security scans.
- External: current pointer/base readback, staged object count/sizes, fresh private build digest restore, ready deploy/source match and authenticated playback/UI checks.
- Independent review pass: inspect actor → dashboard or capability → private object path/current pointer; retain RLS/no-public-storage policies, existing JWT/custom-capability enforcement and server-only secrets. Report any unavailable verification.

## Migration / recovery

Deploy the compatible function/restore limit before publishing the larger catalog. Old catalog and application remain compatible. Stage immutable objects before the atomic pointer switch; reconcile any partial upload rather than retrying blindly. Preserve the prior current.json and version. If fresh build verification fails, stop promotion and restore the prior pointer through the signed-in Storage UI; never overwrite old immutable audio. A failed Netlify build does not publish; fix source forward through develop → main. No irreversible data operation is planned.

## Open decisions

The source has no acoustic timings. Use the existing supported PDF/manual-reading mode for this edition; accurate synchronized reading is future alignment work. Browser authentication is the remaining user-dependent step.

## Completion evidence

Staging audio and hash evidence exists locally; source, CI, function/version, catalog pointer and deploy evidence will be recorded here as each step completes. Do not report the upload or production runtime as complete before those checks.
