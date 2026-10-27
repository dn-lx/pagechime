# MCP and Connector Setup

External tool access is host-specific. This repository records capability requirements only; credentials and private tokens stay outside Git.

## Project MCP profile

| Capability | Status | Typical provider/tool | Project provider | Purpose |
| --- | --- | --- | --- | --- |
| Source control / PRs / CI | Required | GitHub | GitHub | Branches, diffs, pull requests, CI and workflow evidence |
| Public web research / crawl | Optional | Firecrawl | Firecrawl | Read public documentation and references |
| Current library/API docs | Required | Context7 / official docs | Official documentation via Firecrawl | Verify PDF.js and browser APIs |
| Database/auth/storage | Required | Supabase | Me+ Supabase, isolated custom reader tables | Standalone accounts and private notes/progress |
| Hosting/deployments | Required | Netlify | Netlify pagechime | One existing development site; CLI deploy connection pending |
| Browser/computer verification | Required | Playwright / browser tooling | Playwright and Chromium | Desktop/mobile end-to-end, accessibility and screenshot checks |
| Code relationships | Optional | Graphify / code graph | Graphify | Define during integration |
| Runtime observability | Not used | Sentry / vendor equivalent | — | Not used |
| Product analytics/flags | Not used | PostHog / vendor equivalent | — | Not used |
| Payments | Not used | Stripe / equivalent | — | Not used |
| Transactional email | Not used | Resend / equivalent | — | Not used |
| Documents/business files | Required | Google Drive | Google Drive | Owner-private full MP3/M4B downloads |
| Issue/project management | Optional | GitHub / Linear / Jira | GitHub | Define during integration |

## Verification before use

Before relying on any connector: discover it in the current host, perform a harmless read, verify account/project/environment identity, verify permissions, then perform only the authorized write.

## Security rules

- Never commit API keys, OAuth tokens, passwords, certificates, service-role keys or private connector config.
- Prefer least privilege and read-only investigation.
- A development branch does not prove external data isolation.
- Record material external writes in `docs/CURRENT-HANDOFF.md`.
- For auth, data, payments, privileged functions or secrets, use the security-boundary-review skill.
