# Guest reading and account creation verification

2026-10-24; dn-lx/pagechime, direct develop implementation based on 70ed06788626fd248dfb7cf5fd82c506d3b1b1e0. Main is not a delivery target. Plan: docs/plans/REQ-011-guest-accounts.md.

## Deterministic evidence

| Check | Result |
| --- | --- |
| npm run check | Pass: all workspace/server types, 26 tests, documentation and agent-policy validators |
| npm run build | Pass: Next static export and account-aware service worker |
| npm run check:budget | Pass: compressed shell 643 KiB / 900 KiB |
| npm run test:e2e | Pass: 44 desktop/mobile cases; real API/BFF fixture, worker and original book fixtures |
| npm run build:mobile | Pass: Android/iOS Hermes exports; not signed-device verification |
| Independent accounts/guest-library test run | Pass: 17/17; git diff --check clean |

The test loader uses node --import tsx, avoiding the tsx CLI's unnecessary Unix-socket IPC in managed environments. Browser fixture faults originate in the fixture backend so worker requests are exercised rather than silently bypassing page-level mocks.

## Rendered browser evidence

Desktop 1440×1000 and iPhone 13 Chromium emulation exercised guest reading and blocked bookmarks/offline/imports, email signup, show/hide password (value preserved), login, saved notes, account isolation, failed sign-out cleanup, and created-account recovery after initial sync failure. Existing private notes, two-tab logout, offline/reconnect, worker restart, playback/PDF/import, reading anchors and quotation cases remain green.

Inspected final create-account screenshots at both sizes and guest-reader screenshots. Password control, labels, spacing and actions are visible without horizontal overflow/clipping. Sign-in and signup axe WCAG checks pass; existing reader/theme accessibility checks remain green. Existing reader/text/native-bridge pageerror assertions pass. New error/outage paths are explicitly asserted. Screenshots/traces are generated under test-results and uploaded by Application CI, not committed as book assets.

## Independent security review

Read-only reviewer /root/guest_security_review received requirement, repository rules and final diff without the implementer's transcript. Reviewed public registration/invitations, normalized identifiers and SQL, role/rate/session/cookie boundaries, guest storage and imports, worker caches, generated media allowlist and edge enforcement. Findings about failed guest cleanup, initial-sync recovery and temporary guest imports were repaired and re-reviewed. Final review: no unresolved material findings; targeted 17/17 checks passed. Reviewer did not claim independent native-device or live Netlify routing verification.

## Live backend evidence

Applied migration 20261024051920_guest_reader_accounts.sql and deployed isolated book-reader-api v3 (verify_jwt=false retained; custom opaque session authentication remains enforced). Existing RLS/grants and unrelated Me+ apps were not changed.

Positive live HTTP verification passed: public email registration; normalized uppercase email login; duplicate rejection; role injection still yields reader; admin denial; anonymous personal-state denial; account-binding/data isolation; logout and token revocation. Four disposable verification accounts were removed, including two created before an incomplete test payload was corrected. Final SQL readback: 0 accounts, 0 state rows, 1 usable owner administrator invitation. No owner credentials were chosen or stored; invitation preserved.

## Hosted and native limits

Source 2c519bc569167b45bf2689ba316cf16289f38993 is ready in Netlify branch-deploy 6adc50a3d4d1a00283bfc9c0 at https://develop--pagechime.netlify.app. Current Handoff records CI and later checkpoint status. Both unauthenticated HTTP and a fresh cloud browser reach the development host’s existing team gate. The unauthenticated development host returns the existing outer Netlify team gate (401 HTML), so it is not evidence of inner media routing or a successful hosted form submission. Keep that distinction: local rendered browser tests plus live backend HTTP tests verify the changes, while signed-in hosted edge GET/HEAD/Range/encoded-path acceptance remains open. Access settings were not changed; current readback protects non-production deploys.

Private original Manifest build inputs remain absent. A clean Git build has an empty shared shelf and member import support. Do not claim complete Manifest media delivery, signed native builds, physical iOS/Android testing, email verification/recovery, or main promotion.
