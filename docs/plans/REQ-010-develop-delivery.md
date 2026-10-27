# Develop-only Pagechime delivery

Owner instruction, 2026-10-24: create a develop branch deploy; do all subsequent work on develop until explicitly asked to merge into main.

## Verified starting point

- Latest complete reader source: 1db560129f6769c1c52f9d8737c120817f12098c, merged PR #4; all recorded workflow suites passed.
- Existing Netlify project pagechime (73688a4b-90ab-4eac-be6d-ef305f33ebc3) has no deploy and was not Git-linked.
- Authenticated Netlify browser access and existing GitHub app access work.
- Private prepared book inputs are absent from the current Windows workspace. Public source supports an empty importable library.

## Sequence and acceptance

1. Create develop from verified source; preserve main and historical branches. Close superseded release PR #2 without merging.
2. Align branch policy, maintained guidance, CI and release guard with develop/main. Allow direct integration task binding only through explicit policy; retain default branch/PR validation for other users of the tooling.
3. Run relevant deterministic checks and inspect the final diff. New workflow runs must correspond to the actual final develop SHA.
4. Link the existing development Netlify project to develop, retain team privacy, enable develop branch deploy and verify a real ready branch deploy and source revision.
5. Verify hosted sign-in/API denial and media boundaries inside the outer gate. Prepare owner-only activation; the owner chooses credentials.
6. Restore complete private book inputs, then verify all chapters/PDF/text and positive account sync. Keep hosted/full-library criteria open until their actual runtime evidence exists.
7. Continue remaining native/advisory verification where available. Do not promote main, publish stores or run paid Google synthesis.

## Compatibility and recovery

No application/schema/auth contract change. Keep existing project/backend/native/storage IDs. Main remains untouched. Netlify production-context terminology on this dedicated development project is not authorization to promote the main Git branch. A failed build publishes nothing; fix forward. Do not remove the outer private gate while application/media checks are pending.

Workflow-only change; no release version or tag is created. No analytics or performance-relevant client change.

## Verified development deployment

Develop branch-deploy 6adbe48e6d265f521861abbc is ready at https://develop--pagechime.netlify.app on 724444ec6cc5c34e38cc58af19e66cbf159e4c0a. One API function and one media edge function are included. Private team access remains enabled, and main still points to 2396458e46609beb8c448221a647491fb90363c9. Source f99a2b2 passed all five workflow suites. No complete private-library, successful hosted account or native-device verification is claimed; the execution environment is unavailable and the owner must activate the initial administrator account.
