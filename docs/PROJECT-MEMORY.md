# Project Memory

## Identity

- **Project name:** Pagechime · Read & Listen
- **Purpose:** Read book pages while listening to synchronized narration.
- **Repository / owner:** dn-lx/pagechime / dn-lx.
- **Foundation:** dn-lx/agent-project-starter; preserve canonical branch and continuity policy.

## Architecture

- **Website:** Next.js 16 App Router, React, TypeScript, static export; reflowable text pages with durable anchors and optional PDF.js loaded on demand. Motion respects reduced-motion preferences. Installable PWA.
- **Native:** Expo 58 / React Native for iOS and Android; native Expo audio, platform controls, shared text pagination/anchors, selectable text in a restricted WebView and optional offline PDF.js. Native bundles are separate from signed installs.
- **Shared core:** packages/core exports typed book/chapters/passages, schema validation, seeking, timing selection and lossless reading pagination/highlights.
- **Storage:** Web IndexedDB for imported books; localStorage for progress, bookmarks/preferences; Cache Storage for explicit downloads. Native document directory plus AsyncStorage. Imported files and preferences are device local; bookmarks, notes and reading positions sync through a custom Me+ API. No analytics.
- **Hosting:** Existing private Netlify project pagechime is linked to GitHub. Only develop branch deployments are enabled; main is reserved for later explicit owner-approved promotion. Source CI and the initial development deployment pass; exact branch/runtime evidence and current environment limits are in Current Handoff. Develop builds restore hash-verified private Manifest assets from an isolated private Supabase bucket; clean source-only CI uses original fixtures.
- **Voices:** Full private Kokoro Emma British female narration with acoustic word cues. Owner-approved Google spend is $0: preparation API/credential requests are blocked, offline preflight remains available, and no client generates cloud speech. Optional future Google recordings need explicit later authorization and independent SSML word timings. See docs/CONTENT-AND-VOICES.md.

## Important paths

| Area | Path |
| --- | --- |
| Website | apps/web/ |
| Native app | apps/mobile/ |
| Shared contract | packages/core/src/index.ts |
| Tests | tests/ |
| Private web inputs | apps/web/public/books/ and library.json (ignored) |
| Private native inputs | apps/mobile/assets/books/ and generated catalog (ignored) |
| Infrastructure | .github/workflows/; apps/web/next.config.mjs |

## Commands

| Purpose | Command |
| --- | --- |
| Install | npm ci |
| Prepare clean checkout | npm run prepare:assets |
| Web / mobile development | npm run dev / npm run dev:mobile |
| Type and core checks | npm run check |
| Web / native exports | npm run build / npm run build:mobile |
| Browser / accessibility | npm run test:e2e |
| Performance | npm run check:budget |
| Starter tooling | node scripts/test-starter.mjs |

## Runtime and security boundaries

The owner currently requires direct work/deployments on develop only, with explicit later approval before main promotion. Runtime identity and rollback are recorded in Operations and Current Handoff. Me+ standalone account tables and a dedicated Edge Function verify custom opaque sessions, independently of Supabase Auth. Netlify BFF uses HttpOnly cookies; native uses SecureStore. Guests read/listen to the shared packaged catalog using an exact-path server-generated media allowlist; all personal features/imports/downloads require an account. Guest state is memory-only and never synced. Public registration accepts usernames or email identifiers and always grants reader role; admin access requires invitation. Web/native password fields offer show/hide. Other media is gated at Netlify edge requests. No privileged client credential. See docs/READER-ACCOUNTS.md. Imported data stays on-device; deleting browser/app storage removes it. Failed offline downloads and failed native imports clean up their partial files. No payments, telemetry or microphone access.

Source/tests/runtime evidence override stale documentation. See docs/CONTENT-AND-VOICES.md, docs/NATIVE-DELIVERY.md and docs/PAGECHIME-VERIFICATION.md.

## Branding compatibility

Pagechime is the accepted product name. Workspace packages use @pagechime; Expo slug is pagechime. Keep legacy leaf.* persistence keys, app.dnlx.leaf native identifiers and the live book-reader-api/book_reader_* backend identities stable so rebranding does not create separate data containers. The Netlify project was renamed in place to pagechime; no second development site is used. A hostname change requires fresh sign-in and cannot transfer browser-only imports/caches across origins.
