# Pagechime identity plan

## Requirement and current evidence

REQ-008: the user selected Pagechime and requested the name everywhere with one development environment. Continue existing draft PR #3 on feature/netlify-development targeting dev. Existing Netlify site73688a4b-90ab-4eac-be6d-ef305f33ebc3 was renamed in place to pagechime; same team and privacy verified. Repository is now dn-lx/pagechime, verified with the same ID1431335742. Production remains paused; domains and new infrastructure are outside this change.

## Affected contracts and order

1. Update web/mobile visible branding, PWA/Expo labels and workspace scopes/imports/lockfile together; adjust the longer wordmark at narrow widths.
2. Update maintained docs and the canonical project skill; regenerate its Claude adapter. Keep historical branch/SHA evidence intact.
3. Preserve local persistence namespaces, native app identifiers and live database/API names. The name change does not require a data migration or authentication change.
4. Rename existing external resources only. Read back project/repository identity, privacy, branch and PR continuity. Repository administration is unavailable through the connector; the user completed its manual rename, and canonical identity/PR continuity were verified.
5. Run types/unit/starter/docs checks, full web and native exports, browser workflows/accessibility, responsive wordmark geometry and screenshots. Independent review covers compatibility and external writes; inspect the exact pushed-head CI.

## Compatibility, privacy and rollback

Legacy leaf.* keys and app.dnlx.leaf identifiers deliberately stay stable. Browser storage and cookies are origin-bound: the new Netlify hostname cannot automatically read any previous hostname's local imports/caches. No successful hosted deployment or signed native install is verified; server data remains in the same Me+ tables. Do not clear storage or assign old anonymous imports to an account. API/schema and access checks are unchanged. Avoid old-host redirects, which could point at a re-claimed Netlify name.

A code revert restores labels without changing user data. Netlify name rollback is possible only if its old name remains available. No production deployment, database migration, telemetry or new dependency is part of this rename. The name and CSS changes should not materially alter the performance budget.

## Evidence

Netlify ID/team/privacy and GitHub ID/canonical-name/PR continuity readbacks passed. Types,14 unit/core tests,93 starter checks,22 desktop/mobile browser checks, full web/native exports and the550KiB/900KiB budget pass. Sign-in/library screenshots were inspected; wordmark geometry passed at320–1440px without collisions/overflow/page errors. The renamed PDF bridge rendered both fixture pages in Chromium. Independent review found no blocker. Physical native-device layout remains unverified. See Current Handoff and PR #3.
