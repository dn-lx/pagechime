# REQ-019 — Reusable books and admin publishing

Owner confirmed 2026-10-28: Manifest is visible. They create PDFs/audio and want to upload many books to a shared library. Work stays on develop; main and its deployment stay unchanged.

## Outcome and contracts

- A versioned PageChime book description pairs a title/author, PDF editions with individual page counts, and ordered audio tracks. No timing is invented; ordinary uploads use manual PDF navigation.
- Admins select files on mobile/desktop, review order and details, upload privately, and publish after every declared digest is verified. Readers/guests see published books at runtime without a site rebuild. Existing packaged Manifest and personal imports remain supported.
- A separate private bucket and service-only RLS table hold immutable assets and draft/published metadata. Existing reader sessions enforce admin authority. The Netlify server uses the existing build capability for backend access; no privileged credential reaches clients. Draft files are never served to readers.
- Initial bounds: 8 PDFs, 64 tracks, optional cover; 50 MiB per object, 400 MiB shared-library reservation quota and 3 unfinished drafts per owner. These are capacity controls, not a fixed book-count limit. Large recordings should be exported as ordered parts. No paid provider or plan change.

## Delivery order

1. Implement/validate the reusable format and additive schema; preserve old catalog contracts.
2. Add capability-protected shared API, admin-only preparation/verification/publication, bounded signed uploads and stable media routing.
3. Add the admin uploader and runtime catalog merge, including retry/error/loading behavior and per-edition PDF page counts.
4. Verify contract/security/negative paths and desktop/mobile upload → publish → fresh reader → play/PDF; inspect screenshots and budget.
5. Apply additive backend schema/function; deploy develop and verify the same hosted path. Record limitations precisely.

## Verification and recovery

Test forged roles, absent/expired sessions/capabilities, draft isolation, malformed paths/types/digests, incomplete publication, bounded uploads and quota/concurrent reservation. Preserve private visitor gate, existing account data, static assets and paid-speech block. Source checks and runtime evidence precede completion. Schema is additive; unfinished drafts stay hidden and old clients keep the static catalog. Fix forward on develop; do not promote main or replace old immutable files.

## State

Implementation passes60 Node tests/types,84 browser cases/4 private-asset skips, web build and574/900KiB budget. Desktop/mobile publishing tests use the actual API, BFF and reader path with isolated synthetic storage. The final upload-review layout collapses file selection and was checked on desktop/mobile; the focused tests passed after that change.

Applied additive remote migrations20261028195551 (shared_reader_books) and20261028195810 (shared_book_owner_index); local filenames match returned history. RLS and denied anon/authenticated table/RPC access are verified. A rolled-back database test proved prepare, incomplete/partial rejection, complete publication and published-request replay; no test book row remains. Security advisor reports only the expected INFO for RLS with no client policies on the service-only table. Function pagechime-shared-library v1 is ACTIVE and its five files were read back against source; it rejects missing capability auth. No test book row remains. First bucket creation and hosted upload acceptance remain pending.

## Hosted checkpoint — 2026-10-29

Source2b76a9347b6e7fa98e0938dcfc384bfc7fda22ec is deployed as ready develop branch deploy6ae254bee65dedda6c007dd1 (library/reader functions plus media edge). CI40759632632 passed application checks,84 browser cases/4 private skips, web/native exports and574/900KiB budget; all blocking policy/security checks passed. Tracked REQ-005 tooling advisory remains separate. The committed tree matched the locally checked files exactly.

The protected hosted /api/library/catalog returned200 with {books:[],next:null}, verifying Netlify's server-only capability path to the live service. The existing packaged Manifest catalog is retained. No shared book row or dynamic bucket has been created; first real upload/publish remains unverified on the hosted system. Netlify and PageChime browser login are required for that acceptance. The secure PageChime sign-in request was interrupted before success could be verified, and the refreshed browser now shows the Netlify team gate. Main e272781f and production deploy6adbe0d674ba4dbeb313e0b2 remain unchanged. Do not mark REQ-019 complete from source-only or catalog-read checks.
