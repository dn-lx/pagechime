# Changelog

## [Unreleased]

## [0.2.0] - 2026-10-27

- Promote the Pagechime web and native source from develop to main under the owner's explicit approval on 2026-10-27.
- Add standalone reader accounts, guest reading/listening, private notes and account-scoped bookmarks and reading progress.
- Add reflowable ebook pages, exact quotation notes and highlights, durable reading anchors, typography controls and paper, sepia and night themes.
- Improve fullscreen reading, centered playback controls, 10-second seeking, early-seek handling and reference-section skipping while retaining complete Contents.
- Synchronize ebook navigation with playback and preserve the visible source-text position when changing between narration layouts.
- Add the complete Piper Cori narration with independent passage timings while retaining Kokoro Emma and its acoustic word cues.
- Restore private book assets through a capability-protected, hash-verified immutable library; keep book text, media and credentials outside public Git.
- Apply verified reading-only word joins and minimal editorial repairs while preserving source editions, quotation offsets and timing anchors.
- Repair account save races and stale sync timers, PDF edition persistence, short-screen dialogs, mobile reading space and night-theme contrast.
- Add private resumable local voice preparation; incomplete Qwen and Chatterbox recordings remain outside the website catalog.
- Enforce the owner's Google synthesis budget of $0 before provider credentials or network requests.
- Keep web/native exports separate from signed device/store acceptance. The tracked Expo native-tooling advisory remains open under REQ-005; the blocking web audit passes.

## [0.1.0] - 2026-10-23

Initial Pagechime read-and-listen application: Next.js website and Expo native iOS/Android source, shared book timing/schema, complete private Manifest narration, original PDF and text reading, chapters, seeking, speed, bookmarks, saved progress, paper/night themes, offline web downloads and local book imports. British female Kokoro voice is ready in private book inputs; Google Neural2 remains a visible setup option with a local generation preflight. Built on Agent Project Starter. Native exports are verified separately from signing/device/store release.
