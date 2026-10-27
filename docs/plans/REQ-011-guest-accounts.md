# Guest reading and account creation

Accepted 2026-10-24: guests can read/listen without personal saved features; readers can create an account for bookmarks, notes, highlights, saved progress and offline copies. Repair the screenshot's email-shaped username rejection and add show/hide password controls.

## Verified starting point

- Develop 70ed06788626fd248dfb7cf5fd82c506d3b1b1e0; no open PR. All work stays directly on develop; main is unchanged.
- AccountGate requires sign-in/invitation before mounting the reader. The API and database reject @ in usernames; the form does not explain this restriction and has no password reveal control.
- The live database has zero accounts and one unused owner invitation. Preserve it. No Pagechime-specific spec is registered in private.resolve_specs; repository requirements and standalone-reader contracts govern.
- Device state, service-worker caches, native imports and API state are currently account scoped. Guests must never inherit an account scope or start sync.

## Delivery sequence

1. Add shared username/email validation. Relax only the isolated account username check, retaining unique normalized identifiers and all RLS/grants. Existing usernames/sessions remain valid.
2. Add rate-limited public reader registration; role is always reader. Keep admin invitations and custom opaque sessions. Give creation validation useful errors; keep login failures generic.
3. Add web/native guest entry, account creation and password reveal. Guest device state is memory/session-only; personal writes, cloud sync and offline downloads remain unavailable. Clear guest state on account transitions.
4. Generate a server-side allowlist from the packaged shared catalog. Guest GET/HEAD may read only those exact media paths; unlisted files stay authenticated. The worker must use network-only reads for guests and never another account's caches.
5. Test valid/email registration, invite activation, duplicates/rate limits/role injection, anonymous personal-data denial, guest/member transitions, mobile forms, reveal controls and lack of guest persistence. Run web/native types/exports, browser/accessibility checks and budget checks; inspect desktop/mobile screenshots.
6. Obtain independent security review, apply the additive migration and deploy the dedicated API before publishing the develop website. Verify live registration/session/data isolation with disposable test accounts and preserve the owner's invitation. No main promotion or outer Netlify privacy change.

## Compatibility and limits

No analytics or new dependencies. Preserve leaf.* storage keys, native IDs, API/table names and existing invitation behavior. The outer Netlify gate remains in place during development. Private book inputs are still absent from this checkout; shared-book tests use original fixtures. Guests use the shared packaged catalog; importing personal books requires an account. Guest state is never assigned to a later account. Device/signing tests remain separate from exports.

Recovery is forward-compatible: if registration needs containment, disable its public endpoint while retaining email-aware login and existing accounts. Do not re-tighten the database constraint after email identifiers exist or restore a backend that rejects them.
