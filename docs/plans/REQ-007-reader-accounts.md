# Reader accounts and development delivery

Accepted 2026-10-23: deploy the development branch to Netlify; use standalone username/password accounts in Me+ tables, without requiring Supabase Auth users. Bookmarks, notes and reading state belong to the signed-in reader across web and Expo. The working name is pending; the user rejected Foliohush/Liltfolio.

## Boundaries

- Existing Me+ Supabase project: wbqnctrvxohxwiaignhg, eu-central-1. Inspect schema before additive changes. Do not modify Me+ auth.users, profiles or unrelated data.
- Stable book_reader_* tables hold custom accounts (salted password hashes only), active access status, expiring hashed sessions, bookmarks, notes, reading progress, invites and login rate limits.
- Exposed-schema tables enable RLS and revoke anon/authenticated access. A dedicated server-side API validates opaque reader sessions and ownership on every operation. No service-role key reaches Next/Expo.
- PBKDF2-HMAC-SHA256 with 600,000 iterations and random salts through Web Crypto; minimum password length and bounded inputs. Login uses generic errors and atomic account/IP rate limits.
- Web sessions use secure HttpOnly host-only cookies through a Netlify function. Native sessions use SecureStore and the same Me+ API. Logout/account disable revokes sessions; bookmarks/notes cannot be read or changed by another account.
- Protect original PDF, transcript, metadata and audio at the actual Netlify request boundary, rather than hiding controls. Netlify development project is initially owner-private.
- Namespace device data and offline caches by reader account; clear active private state on logout. Preserve existing local data without automatically assigning it to an arbitrary new user.
- Admin provisioning uses expiring, single-use setup/invitation links so users choose their own password. Do not email/message invitations automatically.

## Sequence

1. Bind this plan, branch and draft PR; preserve production PR #2 as paused draft.
2. Implement and independently review account/session/schema and API code, then add isolated tables and a new Edge Function in Me+.
3. Add web/mobile sign-in, scoped persistence, notes and admin access management. Configure Netlify static build, API proxy and protected-book edge guard.
4. Verify hashing/session expiry/rate limits/IDOR/CSRF and anonymous Data API denial; browser sign-in/logout, user switching, notes/bookmarks and offline isolation; types/builds/native exports.
5. Merge to dev after checks. Deploy a Netlify development version and verify access/media/account flows. No prod promotion or store submission.

## External state

Netlify team don-alex-perera; development site 73688a4b-90ab-4eac-be6d-ef305f33ebc3 named pagechime, owner-private by default. No deploy uploaded yet. Netlify connector can manage projects but offers no upload/Git-link operation; CLI login or an authenticated browser action may be needed after the candidate is ready.

ChatGPT Site appgprj_6adb96d58e38819192c282543ada4aed is unused/unpublished; user selected Netlify instead. The complete MP3/M4B were successfully uploaded to the owner's Google Drive after making full-length copies below the connector's 100 MiB transfer limit; originals remain in the execution output.
