# Pagechime · Read & Listen

A quiet reading room for the web, iOS and Android. Read the original PDF or a comfortable text view while British female narration follows the page. Start with Manifest; bring more books as PDFs and audio.

Built with **Next.js 16**, **Expo 58 / React Native**, TypeScript and the engineering foundation from [Agent Project Starter](https://github.com/dn-lx/agent-project-starter).

## Run locally

Node 24 and npm 11 are recommended.

```sh
npm ci
npm run prepare:assets
# Web authentication uses the Netlify API function; see docs/READER-ACCOUNTS.md.
# For native development:
npm run dev:mobile
```

The public repository contains application code and a small original test fixture. The full Manifest PDF, transcript and narration are private build inputs and are intentionally excluded from Git. A clean checkout starts with an empty shelf after account sign-in; use **Add a book** to import a PDF and audio. See [account/deployment setup](docs/READER-ACCOUNTS.md) for the first administrator and Netlify development configuration.

## What is included

- Responsive library, reading view, original PDF, passage highlighting and page following.
- Chapters, seeking, playback speed, account-owned bookmarks, notes and synced reading progress, paper/night themes and reduced motion.
- Explicit offline downloads on the web, including audio range requests; imported books stay on the device.
- Native Expo audio, local PDF rendering, file imports and bundled book support. Background playback is configured; device testing is required before store release. Native sleep timer requires Pagechime to remain open.
- Kokoro Emma narration is prepared for the private Manifest library. Google Neural2 is shown as **Setup needed** until separately generated; no Google credentials are included in either client.

## Project layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js website, static export and PWA |
| `apps/mobile` | Expo native iOS / Android application |
| `packages/core` | Shared book schema, timing, seeking and validation |
| `scripts` | Asset preparation, optional voice generation and verification |
| `tests` | Original fixtures, core and browser tests, starter tooling tests |

UI uses Newsreader / DM Sans on web, native editorial serif typography, warm paper and olive colors, and restrained Motion / native animations. Data and timing are shared; UI is adapted to each platform.

## Private book inputs

See [content preparation](docs/CONTENT-AND-VOICES.md) for the book format, complete Manifest ingestion and Google setup. Do not add generated book files to this public repository.

```sh
npm run build
npm run build:mobile
```

Web output is `apps/web/out`. Native exports are JavaScript/asset bundles, **not signed APKs or IPAs**. Follow [native delivery](docs/NATIVE-DELIVERY.md) for EAS builds and device checks.

## Verification and delivery

```sh
npm run check
npm run build
npm run check:budget
npx playwright install chromium
npm run test:e2e
npm run build:mobile
node scripts/test-starter.mjs
```

CI builds without private content and tests using the original fixture. See [verification evidence](docs/PAGECHIME-VERIFICATION.md), [project memory](docs/PROJECT-MEMORY.md), and [operations](docs/OPERATIONS-RECOVERY.md). All current implementation stays on `develop`. Changes reach `main` only after the owner explicitly requests promotion when development is complete.
