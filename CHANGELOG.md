# Changelog

## [Unreleased]

- Clarify guest reading-place limits and update reading help for word highlighting, fullscreen, 10-second controls and reference skipping. Keep installation guidance focused on home-screen and offline reading. Intended impact: patch; develop only.

- Rejoin verified page-end word fragments and support minimal reading-only text repairs with source-offset maps, keeping existing quotes, highlights and acoustic cues stable. Original editions and recordings remain intact.

- Drain account changes made during an in-flight save and clear stale sync timers when switching accounts, so edits sync promptly without a reload.

- Let short reading pages use smaller word counts and hide edition-download chrome during fullscreen, preventing mobile Manifest lines from falling below the visible page while preserving text and reading anchors.

- Add real reader fullscreen with an explicit exit and full-window fallback, legible 10-second rewind/forward controls, and responsive page/player spacing. Ordinary listening starts at the introduction and skips reference sections while Contents retains every chapter and saved positions. Intended impact: patch within ongoing development; develop only.

- Keep a selected audio position when chapter metadata arrives after an early seek, including slow connections. Intended impact: patch.

- Repair the develop deployment’s private-library connection, retain required asset verification, and identify missing build settings by name. Intended impact: patch; no production promotion.

- Enforce the owner’s $0 Google policy before credentials or network calls; retain Emma playback and offline preflight. Remember the selected PDF edition across chapter changes/reloads, rejecting unlisted saved URLs. Intended impact: patch within the current development work; no main promotion.

- Restore the private Manifest editions/narration library through verified development build assets, add optional acoustic word-following cues, and repair stale/failing catalog cache behavior. Prepare matching British Neural2 audition and word-mark synthesis with explicit credentials/cost controls. Intended impact: next minor release; main remains unchanged.

- Use develop for all Pagechime implementation and development deployment. Main promotion requires a later explicit owner instruction; CI and branch guards follow this policy.

Added an interactive text reader for web and Expo with reflowable pages, typography/paper/sepia/night controls, exact quotation notes/highlights and reading anchors independent of narration. Original PDF remains available; synced reading places and manual PDF pages restore correctly. Intended version impact: next minor release (0.2.0).

Renamed the product to Pagechime across website/mobile branding, install labels, workspace packages and project guidance. Renamed the existing Netlify development project in place to pagechime; kept one development environment, existing storage namespaces and native application IDs. The existing GitHub repository is now dn-lx/pagechime.

Added standalone Me+ username/password accounts, invitation/admin access controls, private notes, account-scoped bookmarks/progress and offline sync; Next/Expo sign-in and logout; server-side sessions and protected Netlify media/API configuration. Development deployment awaits Netlify CLI/network setup. Intended version impact: next minor release (0.2.0); no production release made.

## [0.1.0] - 2026-10-23

Initial Pagechime read-and-listen application: Next.js website and Expo native iOS/Android source, shared book timing/schema, complete private Manifest narration, original PDF and text reading, chapters, seeking, speed, bookmarks, saved progress, paper/night themes, offline web downloads and local book imports. British female Kokoro voice is ready in private book inputs; Google Neural2 remains a visible setup option with a local generation preflight. Built on Agent Project Starter. Native exports are verified separately from signing/device/store release.
