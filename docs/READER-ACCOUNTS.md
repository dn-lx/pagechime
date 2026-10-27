# Reader accounts and Netlify development setup

Updated 2026-10-24. Accounts are standalone rows in the Me+ project; no `auth.users` identity is created or required.

## Account data

`book_reader_accounts` holds a normalized unique username or email identifier, display name, salted PBKDF2-SHA256 password hash, active flag, reader/admin role and session generation. Passwords require at least 12 characters. `book_reader_sessions` stores SHA256 hashes of random 256-bit bearer tokens with a seven-day absolute expiry. Account access changes and session creation lock the same row; pausing/restoring access invalidates older sessions.

`book_reader_state` stores account-owned bookmark, note and progress records. Optional reading anchors and quotation/highlight ranges use this same JSON state; legacy records remain accepted. Edge Function v3 validates the additive fields without schema/grant changes. The authenticated session supplies ownership; a client-supplied account binding also rejects stale-tab writes. Updates compare revisions; null tombstones preserve deletions across devices. Pending edits and their original revisions survive offline reloads. Conflicts keep the local copy and offer **Keep changes from this device** in account settings. Cloud changes load when signing in/reopening the reader; this is not realtime collaboration. Imported book files stay on the device.

Web uses a secure HttpOnly host-only cookie through the Netlify function. Expo stores its token in SecureStore. Passwords are never persisted on the device. Logout clears private UI/audio first and revokes the server session. If offline, the browser retains the HttpOnly token plus a local logout intent; Expo retains a separate SecureStore revocation token. Retry happens before a new sign-in. The BFF deliberately avoids clearing cookies in delayed responses that could overwrite a newer login in another tab; a revoked cookie has no server authority.

Browser/Expo device data and offline book caches are scoped by account ID. The web worker persists client scopes with absolute expiry and clears matching scopes on logout. Online access is rechecked on foreground and every minute; saved offline access lasts only until the existing session expiry. Account disabling cannot be detected by a disconnected device until it reconnects. Existing pre-account local data is preserved without automatically assigning it to a new reader.

All five tables enable RLS and revoke PUBLIC/anon/authenticated grants. RPCs are security invoker with empty search paths and service-role-only execution. The dedicated `book-reader-api` function validates custom sessions itself (`verify_jwt=false`); its built-in service-role environment stays on the server. It is independent of other Me+ apps. Login uses global, username and best-effort gateway-IP rate budgets; registration adds stricter global and IP budgets; IP values are HMAC hashed. Expired rate/session/invite cleanup uses indexed batches of 500.

## First administrator

One owner-only administrator activation invitation was prepared on 2026-10-24 and supplied privately. It is single use and expires after 48 hours; the owner must choose the username/password. No owner account or password was created automatically. Do not create a second invitation unless the first has expired or has been deliberately invalidated.

For a future replacement, generate a private activation file outside the repository:

```sh
node scripts/create-reader-invite.mjs https://your-reader.netlify.app /tmp/reader-invite.json
```

The file is created exclusively with owner-only permissions. Apply its `sql` in Me+ using the connected SQL tool or dashboard, then privately open `activationUrl` to choose a username and password. Do not commit the file, paste its raw token into GitHub, or send it to others. The invitation expires in 48 hours and is single use. Subsequent reader invitations and access pausing are available in the administrator's web account panel. Native accepts the same private invitation link in its account creation form.

Readers can register publicly with a username or an email identifier; registration always creates a reader and cannot select an administrator role. Email identifiers are normalized but are not verified addresses and no email is sent. Password reset/self-service password change remains unavailable. Both web and native provide explicit show/hide password controls and field validation. If creation succeeds but initial state sync fails, the form switches to sign-in recovery instead of attempting duplicate creation.

Guests may open the shared packaged catalog and read/listen online. They cannot import books, save bookmarks/notes/highlights, persist reading progress/preferences or download offline copies. Guest reading/appearance state is held in memory only, discarded on exit and never migrated into an account. No guest sync engine or account cache is opened. Web guest entry requires confirmed revocation and worker-scope clearing; failed cleanup leaves the gate closed with a retryable error. Native guest APIs reject personal requests.

The build validates catalog references and generates an ignored server-side exact-path media allowlist. Anonymous GET/HEAD is allowed only for shared catalog references. Other media still requires an active account, and all media responses remain private/no-store. Guest worker media requests go to the network without reading account caches. The outer Netlify team gate remains enabled for development.

## Deploy the development version

The existing Netlify project pagechime (73688a4b-90ab-4eac-be6d-ef305f33ebc3), team don-alex-perera, is now Git-linked to dn-lx/pagechime. The production branch is reserved as main; develop is the sole enabled branch-deploy branch. Work and deploy development only on develop until the owner explicitly asks to promote main.

The initial develop-source deployment is ready with the reader function and media edge guard. The dedicated branch URL is https://develop--pagechime.netlify.app. Exact deploy IDs, context, source revisions and remaining live-browser checks are recorded in docs/CURRENT-HANDOFF.md. Team-login protection stays enabled on development deployments; this task does not alter access settings.

The root netlify.toml builds with npm run build and publishes apps/web/out. It bundles the HttpOnly-cookie BFF and media guard over /books/* and /library.json. A push to develop triggers its branch deploy. Do not publish main or create another Netlify project.

Private Manifest files are ignored build inputs and were not inherited by the current Windows workspace. A clean Git build starts with an empty shelf that supports local imports; it must not be called complete Manifest delivery. Restore the prepared PDF, cover, chapter audio and timing JSON using docs/CONTENT-AND-VOICES.md before verifying the complete book. Never commit those private assets to public Git.

Authenticated Netlify dashboard and existing GitHub authorization worked in this session; the former cloud CLI/network blocker is no longer the setup path. The execution environment later became unavailable during live-reader verification, so a ready deploy does not establish successful account/media/browser behavior.

## Verification evidence and remaining hosted checks

- 14 unit/core tests cover salted hashing, ownership, account binding, expiry/logout, access revocation, invitations, input/rate limits, CAS, CSRF/cookie/media boundaries, durable outbox conflicts, status-preserving HTTP errors and delayed-cookie races.
- 22 desktop/mobile browser cases cover reading/PDF/audio/imports and account login, notes CRUD/fresh-browser sync, user switching, offline reload/reconnect, worker termination, two-tab logout, expiry, storage failure and revocation retry. Screenshots inspected; axe passes the sign-in and existing reader/library states.
- All TypeScript checks, Next export, Expo Android/iOS Hermes exports, performance budget and 93 starter checks pass locally. Native device/signing/store verification remains pending.
- Both reader migrations applied to Me+. Rolled-back live SQL checks verify invite reuse denial, CAS, session generation invalidation, anon SELECT denial, authenticated RPC denial and 10,000-character Unicode notes. No fixture accounts remain. Security advisor INFO for RLS without policies is intentional deny-by-default; unused-index INFO is expected for new tables. No unrelated Me+ advisor changes were made.
- [Hosted backend contract run](https://github.com/dn-lx/pagechime/actions/runs/40007820279) passed actual `/me` 401, `/state` 401, malformed login 400, and unknown-user login 401, exercising the live function/database without credentials or private reads.

Still required: successful real-account HTTP login/state flows, actual Netlify edge routing and file access (including anonymous GET/HEAD/Range and encoded-path cases inside the outer team gate), the final deploy URL/revision, and native device checks. Never treat the outer Netlify login page as proof that the reader guard works. See `docs/SECURITY-REVIEW.md` for the separate Expo tooling advisory.

## Pagechime compatibility

The same Netlify project is now pagechime. Retain the legacy leaf.* device-storage/cache namespaces, native app.dnlx.leaf identifiers, custom account tables and deployed book-reader-api endpoint. These stable internal identities preserve account data and installed-app upgrade paths. Host-only cookies and device-only browser imports/caches are bound to the original hostname and do not migrate to a renamed Netlify origin; sign in again to restore server-synced notes/bookmarks. No successful old-origin deploy has been verified.
