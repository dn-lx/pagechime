# REQ-018 — Complete improved Kokoro publication

## Current scope — 2026-10-28

The owner now requires work only on develop and no changes to main. PR #7 is closed without merging and its approval label is removed. Existing Manifest in Action catalog restoration is now verified: develop source d0f5090e98883e4ee260fa29ae99d5b530ba795b, ready branch deploy6ae24564449c3378cbf38061. Fresh build log verifies all45 files from version94da1b70b50c. Hosted guest catalog shows Kokoro3h48m/19chapters and Piper3h27m/17chapters; both opening narrations, Kokoro final-track playback/end seek, first/last PDF pages and reading text were checked. Blocking source CI passes; REQ-005 advisory remains separately tracked. Main e272781f and production deploy6adbe0d674ba4dbeb313e0b2 remain unchanged. The complete improved recording remains pending upload; the historical production-preparation details below do not authorize further promotion.

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
- The Supabase app connection is healthy; the file-upload browser still shows sign-in. Direct Storage upload requires renewed browser authentication.
- Library function pagechime-library v2 is ACTIVE and exactly matches the four verified source files from57b53f39472321a554b168dd31aa26504193292c. The only function change is the320MiB aggregate bound; custom capability authorization/verify_jwt=false are retained.
- Dedicated PAGECHIME_PRODUCTION_LIBRARY_KEY is configured as a write-only production secret with the plan's minimum Builds/Functions/Runtime scopes, excluding Post processing; code consumes it only during builds. Its capability is read-only build scope. Setup-only capabilities were expired. Key-table RLS and denied anon/authenticated SELECT remain verified.

## Affected contracts

- The improved edition is a separate catalog identity manifest-improved. Six listening parts are not presented as semantic chapter boundaries. It uses the retained237-page PDF with manual navigation, no invented text timings and no borrowed voice cues.
- Audio-only navigation retains the manually chosen PDF page through loads, seeks, automatic advance and reloads. Existing timed-book navigation remains covered.
- Library API and build restore allow320MiB aggregate; the24MiB per-file,256-file, MIME/path/origin/digest/redirect limits and capability authorization remain.
- Production uses PAGECHIME_PRODUCTION_LIBRARY_KEY in Netlify's minimum Builds/Functions/Runtime scopes (no Post processing), separate from the existing development secret; endpoint/required-source flags are public configuration.
- No database schema migration, payments, analytics or Google synthesis. No book media/text or keys enter public Git.

## Ordered implementation

1. [x] Owner-approved develop → main promotion and ancestry synchronization.
2. [x] Validate base archive, split the improved source losslessly and stage the new catalog.
3. [ ] Pass code checks for bounded aggregate growth, production-secret isolation and manual PDF behavior; inspect desktop/mobile evidence.
4. [x] Deploy the backwards-compatible library function from the verified source; v2 readback matches all source bytes.
5. [ ] Renew signed-in Supabase dashboard access; freshly verify the base current.json, upload every object under the new version prefix and verify object metadata.
6. [ ] Publish the pointer only after complete-object verification. Retain the previous version and pointer for recovery.
7. [x] Configure a dedicated read-only production build capability/secret after private perimeter verification. Secret flag, production context and minimum server scopes were read back; credentials are not recorded.
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

Source57b53f39472321a554b168dd31aa26504193292c passes53 Node tests/types,82 browser cases/4 private skips, web/native exports and568/900KiB budget; blocking security/policy checks pass. CI40529737177 contains desktop/mobile manual-PDF evidence. Mobile rendering was inspected; the desktop capture caught a transient loading frame, so the regression now waits for completed PDF rendering before its final screenshot. A fresh run will provide the replacement capture. The audio-only corpus uses the real test server/worker/auth path.

Workspace maintenance removed temporary staging; the saved source was recovered and the52-file bundle was reproduced with the identical version2b728601497d21e7361778a7f3a8240eccfe2a819da2d57e987b66577051e94d. All source audio packet and complete-decoding checks passed again. No new Storage version or pointer has been uploaded; fresh build restoration and hosted playback remain pending browser authentication.

## Reproduction metadata

The following metadata permits rebuilding the six lossless listening parts from the same supplied MP3; it contains no book text, audio or credentials.

```json
{
  "sourceSha256": "bd44f8c0baa7099c5bf41e9e94fb8a51c569c78fc5c89728d683e21f92674fc8",
  "sourceAudioPacketHash": "SHA256=1fd2de9cd565ad56331af3d67dd09f34fab12a8a09c1f00993fb4c743e1739c9",
  "cutTargetsSeconds": [
    2399,
    4799.415,
    7201.225,
    9598.89,
    11999
  ],
  "parts": [
    {
      "file": "part-01.mp3",
      "duration": 2399.016
    },
    {
      "file": "part-02.mp3",
      "duration": 2400.408
    },
    {
      "file": "part-03.mp3",
      "duration": 2401.824
    },
    {
      "file": "part-04.mp3",
      "duration": 2397.648
    },
    {
      "file": "part-05.mp3",
      "duration": 2400.12
    },
    {
      "file": "part-06.mp3",
      "duration": 1092.888
    }
  ]
}
```
