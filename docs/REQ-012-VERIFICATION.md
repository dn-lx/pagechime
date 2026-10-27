# REQ-012 verification

The deliverable restores supplied Manifest editions and Emma audio, adds real word cues, repairs catalog caching and prepares matching British Neural2. Work stays directly on develop. Main and the Netlify outer access gate are unchanged. Version impact is a later minor release; no release bump/tag.

## Inputs and timing

Unmodified source ZIP contains 237-page page-matched and cozy interactive PDFs, Kindle/fixed-layout EPUBs, font licences and proofreading notes. Original M4B metadata identifies Roxie Nafousi / Manifest in Action, Kokoro bf_emma, 19 chapters,13,682.328 seconds. Private recovered library:1,136 passages,207,752 characters,37,139 usable acoustic word cues from37,476 source words. Per-chapter audit90.91–100%,99.1% overall. Unmatched words are retained without proportional fabricated cues. Alignment estimates need listening acceptance, especially headings/index/back matter.

Actual book passes shared schema and lossless pagination at budgets30/90/180/360 for all19 chapters. Browser private-book acceptance checks opening, chapter10, chapter19, live highlighted word visibility, both PDFs, guest library, responsive overflow, axe and page errors. Text mode has word highlighting; source PDFs have page following.

## Private source and negative paths

Migration20261024072446 and isolated pagechime-library v1 applied/deployed to Me+ only. New key table RLS true, no anon/authenticated privileges; bucket private with24MiB file cap. Version7e6afd6087edca77f985476fab4019017651843388c6f4d23cc2e24e29d0bdca contains27 files/87,289,918 bytes; current.json atomically points at it. Fresh restore downloaded every object and checked size/SHA256.

Live authorization: anonymous401, unknown401, read-only build GET200/POST403, upload GET403. Temporary upload key deleted; subsequent request401. Final counts:1 build key/0 upload keys. No unrelated user, storage-policy or Auth changes. Netlify’s current plan requires secret scopes Builds/Functions/Runtime, excluding Post processing. The repaired key is confirmed secret with only a branch-deploy value; build-only scope requests had not persisted. Deploy builds require the source automatically, so an unavailable connection cannot publish an empty shelf.

Deterministic tests cover manifest bounds/digests/path traversal, capability scopes/expiry/rate/outage, build origin/redirect/hash/size/symlink failures, network-first catalog, cache unavailable/quota, account offline fallback, online denial, failed replacement installation, word gaps/Unicode/notes/legacy contracts, edition/credit addresses and offline SSML/cost/mark mapping. Synthetic fixtures contain no private text/media. Native HTML updates classes/messages without replacing text or losing selections. Mixed-cue live browser test verifies uncued passages still advance pages and show no invented word highlight.

## Review and limits

Independent reviewer /root/guest_security_review completed read-only sensitive-path review against ae75d8b;12 targeted tests passed after fixes. Initial findings (upload-only read, gateway config, mixed-cue clock, failed precache replacement) are resolved. Local final checks:36 unit/contracts;50 fixture browser cases passed,2 private-book checks skipped in that fixture run and passed separately on the actual book. Workspace/server types, Next export, Expo Android/iOS Hermes exports and563/900KiB shell budget passed. Actual opening/middle/ending/PDF desktop/mobile screenshots inspected. Commit/deploy evidence is maintained in Current Handoff.

Neural2 offline preflight only: British female en-GB-Neural2-A/.95,233,050 billable characters,1,149 bounded requests,$3.7288 conservative full estimate before quota;110-word audition$0.0094. No credentials/API synthesis, billed requests or actual Google tone audition are claimed. Owner supplied project project-89a9b506-ff91-4cd1-a2d; the later $0 policy pauses all Google requests. British emotion controls unsupported by the documented Neural2 styles are not sent.

Next/Expo exports are not physical-device or signed-app acceptance. Existing Netlify team gate blocks unauthenticated inner hosted UI; local browser and live capability/backend results do not claim hosted member login/media routing. Keep remaining runtime criteria open.

## Source publication and hosted blocker

Develop source99992b6cae14f0eeed5c7f52d356ca8875023e69 passes all five GitHub suites (Application40077190791; Security40077190777; reliability40077190810; stack40077190793; version40077190778). Netlify branch-deploy6adc68a6b6aa5a0945c70a3c failed while building, exit2; previous develop deploy stays live. The owner later supplied the log proving the missing build connection. Authenticated dashboard and metadata checks confirmed that Builds-only upserts had not persisted on this plan. See the repaired connection below. No main changes.

Google Cloud new-project console navigation returned Site Unavailable in the cloud browser. No project was created; no credentials or billing were changed. The offline setup remains ready for a connected owner project.

## Owner zero-spend update and PDF edition restore

2026-10-24: The owner requires no Google billing. Google requests are now blocked before CLI source/credential access and at the credential/HTTP helpers. Large CLI budgets, cached chunks and environment settings do not enable requests. Offline estimates remain available; existing prepared Emma audio remains playable. This verifies Pagechime’s own path, not the Google account’s external bill or other applications. No Google request was made for verification.

The packaged PDF edition choice is account-local, survives chapter changes/reload and falls back to the current book.pdf for unlisted saved addresses. Guest settings remain in memory. Four desktop/mobile cases pass edition restore, rejected outside URL/no request, PDF/voice/theme/axe/overflow. Dialog screenshots were inspected. Current workspace/server types,36 Node unit/contracts including6 Python synthetic checks, Next export, Android/iOS Hermes exports and563/900KiB shell pass. Independent reviewer /root/guest_security_review found no material findings and independently ran6 Python/3 targeted Node tests. No backend/provider mutation. Source changes remain develop-only; the separate hosted access blocker remains.

Zero-spend/edition implementation source: `04b1399eaca1bd4c1ae276722949e44d8ef26678`, develop only. The commit intentionally skips Netlify while the existing private build-log/source-connection blocker remains. GitHub’s current-head checks are the authority for CI status; no hosted publication or external Google billing guarantee is claimed.

## Repaired develop connection and hosted evidence

2026-10-24: Independent review preceded saving the same read-only private-library capability in Netlify’s minimum supported secret scopes Builds/Functions/Runtime, with Post processing excluded and branch-deploy context only. Getter and UI confirm secret metadata and one value/context. Only develop has branch deployments enabled; no production value, client prefix, plan upgrade or Google request. The public endpoint/required flag are committed under context.develop.environment. Asset verification remains required.

Source0ef9efd5ec884453a93afdff2454934ac589f61b deployed successfully as6adc8f9361ac54958f02fa9d (develop/branch-deploy, state ready, reader function/media edge present). Local connected build verifies27 files/version7e6afd6087ed…, 36 unit/contracts/typechecks pass, 563/900KiB shell, no credential matches across tracked source and82 generated files. Authenticated hosted guest acceptance confirms one Manifest book,19 chapters, Emma time advancing, active word rendering, chapter10 and both237-page PDF editions rendering without error. Google voice is disabled/Not enabled. Team protection stays enabled. This does not establish member login, native-device acceptance or all HTTP negative-path checks.

Four CI suites passed at0ef9efd; Application40088076109 caught a pre-existing early-seek metadata race in both mixed-cue viewport cases (50 other browser cases passed;2 private cases skipped). The follow-up preserves the latest requested time when metadata arrives. Real-media-gated regression fails both viewports before the fix and passes after; all8 targeted word cases pass after deterministic browser-frame observation of the brief word cue. Independent review has no material findings. Publication and exact-source CI/deploy results are recorded below.

## Final runtime publication

Source6e38106e49e7141390d6b1530e8fe25d63c432d9 is ready in Netlify deploy6adc929cc4e8e1686f1b482d, develop/branch-deploy, media edge present and no deploy error. Final hosted reload/guest entry again shows the recovered library. Chapter19 opens; earlier hosted checks at the repair source cover chapter10, real audio progression, active words and both rendered editions. Final local actual-book browser acceptance passes2/2 on desktop/mobile with the new source, including first/middle/last chapters, real word following, both PDFs, axe/overflow and page-error checks. Word regression suite8/8, unit/contracts36/36, types/Next/budget and credential output scan pass. No new Google calls, production or access-gate change. Screenshot of final guest library inspected.

All five exact-source GitHub suites pass at6e38106: Application40088967739, Security40088967700, reliability40088967723, stack40088967737, version40088967750. Application includes36 unit/contracts,54 fixture browser passes (2 private cases intentionally skipped there and passed separately with the actual book), web export/budget and Expo Android/iOS Hermes exports. The known native-tooling advisory remains tracked separately by REQ-005; no claim that every advisory subjob is green. The following documentation-only checkpoint skips a redundant Netlify rebuild; runtime stays at the verified source above.
