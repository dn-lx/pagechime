# REQ-014 — Dismissible reader settings and overlay audit

Verified locally and in GitHub CI 2026-10-25. Development only; main promotion remains owner-controlled.

## Findings and changes

- Appearance was an anchored `details` disclosure with no Close/Done control, outside-tap dismissal or Escape support. Replace it with the shared native dialog, preserving immediate appearance changes, narration and reading anchors.
- Shared dialogs treated clicks on their own padding as backdrop clicks. Dismiss only when a pointer gesture begins and ends outside the dialog rectangle; selections/drags beginning inside remain safe.
- Scrollable dialogs could move their close control out of reach. Keep the 44px Close control in a fixed header and settings Done in a fixed footer; only the body scrolls, with contained overscroll.
- Native dialog focus is contained and restored to the opener. Give each dialog a unique accessible title. The mobile library now uses this same dialog rather than exposing an off-screen sidebar to keyboard navigation; modal handoffs close the drawer, and resizing restores the desktop sidebar. Preserve minimum space for chapter/bookmark controls so the footer cannot overlap them.
- Escape in a dialog no longer also leaves fallback fullscreen.
- A later primary-button style hard-coded the light-theme background while the night-theme text remained dark. Use the existing theme token for the background, fixing the contrast of Done and other primary actions.

The shared behavior covers appearance, reading help, voices, search, join/import, notes/accounts and the mobile library. Inline book-edition/import disclosures remain inline. No database, account/session, private content, narration, analytics or hosting-access changes.

## Verification

- `npm run check`: 45 unit/contracts pass; workspace/server types and documentation/agent checks pass. Final documentation checks are repeated before publication.
- Clean `npm run build` and `npm run check:budget`: pass, 566/900 KiB compressed shell. Intermediate repeated builds retained obsolete chunks; removing only generated `.next`/`out` before the final build restored an accurate clean-build measurement.
- Complete desktop/mobile browser suite: 74 pass, 2 private-book cases intentionally skipped because private inputs are absent in this checkout. Existing account, reading/annotation, PDF, offline, chapter, transport and word-following regressions pass.
- Ten new overlay cases cover Close/Done/outside/Escape, focus restoration, retained appearance/playback time, continued narration, no dismissal from padding/drag, 320x480 scrolling with reachable controls, night axe contrast, fallback fullscreen Escape ordering, mobile drawer focus/close/handoff and desktop resizing.
- Existing appearance regression now uses the explicit Close button. A follow-up drawer check verifies header bounds after keyboard traversal with book navigation present. Screenshots at desktop, narrow mobile, night and short-screen settings were visually inspected; new overlay flows report no page errors or horizontal overflow.

## Delivery and limits

Published through GitHub MCP to `develop` at [2a6771305b5d249cace0704476f73bdc085ad526](https://github.com/dn-lx/pagechime/commit/2a6771305b5d249cace0704476f73bdc085ad526). [Application CI 40162568905](https://github.com/dn-lx/pagechime/actions/runs/40162568905) passes on that source: 45 unit/contracts, types, build/budget 566/900 KiB, 74 browser passes/2 private-input skips and both iOS/Android exports. Agent/version policy, Linux/Windows quality evidence, dependency audit, gitleaks and semgrep checks pass. The pre-existing non-blocking native-tooling advisory remains tracked in REQ-005. Main remains `2396458e46609beb8c448221a647491fb90363c9`.

A final source/diff review found no further blocker within this overlay repair. The hosted deploy/source revision and hosted interactions remain unverified; the available Netlify metadata identifies only earlier deploys. The cloud browser currently reaches the existing Netlify team sign-in gate, so hosted interaction checks require an authenticated browser; local browser evidence exercises the production export. Do not remove or weaken the gate for testing. This change does not claim native-device or positive live-account acceptance. Google requests remain blocked under the owner's $0 policy. No new voice model or paid service was configured.
