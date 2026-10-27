# Content and voice preparation

Book media/text are private build inputs. Public Git contains code and original test fixtures only. Keep credentials and books outside Git. Guests can read/listen to the packaged shared library; accounts enable personal saves, imports and offline copies.

## Restored Manifest edition

The supplied All-Editions bundle contains two 237-page PDFs (page-matched and cozy interactive), reflowable Kindle EPUB, fixed-layout EPUB, proofreading notes and font licences. These are reconstructed user-supplied editions, not a claim of publisher-identical page images. Original inputs are preserved. The complete M4B contains 19 chapters, 13,682.328 seconds, Kokoro `bf_emma`, British English female at a gently slower pace.

Preparation requires ffmpeg/ffprobe, PyMuPDF, plus an isolated alignment environment. The word alignment dependency never ships in the reader. Install CPU PyTorch/torchaudio from the official CPU wheel index before `requirements-alignment.txt`.

```sh
python scripts/restore-manifest.py --bundle /private/Manifest-in-Action-All-Editions.zip --audio /private/manifest.m4b --work /private/manifest-work
python scripts/align-book.py --source /private/manifest-work/source.json --cache /private/manifest-work/alignment
node scripts/bundle-mobile-book.mjs
```

Known EPUB text is forced-aligned to the actual Emma audio using faster-whisper/stable-ts `base.en`. Current audit: 37,139 usable word cues; chapter coverage 90.91–100%. Zero-duration/unmatched words remain visible without invented timings. Word timing is an acoustic estimate, not studio annotation; short headings/index entries need particular care. Text mode highlights real word intervals, keeps silence gaps, follows pages and preserves note/selection offsets. Original/cozy PDF modes follow the source page; they do not draw word overlays on PDF glyphs.

## Durable private develop assets

`pagechime-library` is an isolated capability-authenticated Edge Function. The private bucket is `pagechime-library-develop`. No storage policies grant anonymous or account access. Hashed capabilities are in `book_reader_library_keys`: read-only `build`, expiring upload-only `upload`. There is no privileged client key. File manifests bind immutable version/path, SHA256, size and MIME type; `current.json` changes only after all objects exist. Builds verify every downloaded digest and reject outside origins/paths, redirects, oversized bodies and symlinks.

Owner seeding uses `scripts/seed-private-library.mjs` with endpoint/upload capability in its environment, then deletes the temporary upload capability. Never log bearer or signed URLs. Re-running an upload of existing immutable objects is intentionally denied; use verified inputs/new version or review the incomplete version explicitly. Netlify stores the separate build capability as a secret in build scope, branch-deploy context only, with `PAGECHIME_LIBRARY_URL` and `PAGECHIME_LIBRARY_REQUIRED=1`. A missing or failed configured source fails the build instead of publishing an empty shelf. Clean source-only CI uses original fixtures, without private book content or keys.

## Optional word cue contract

Each segment may have `words: [{start,end,from,to}]`: chapter seconds and original UTF-16 offsets. Cues are bounded, ordered and non-overlapping. Legacy passage-only imports still work. Optional editions list bounded same-book PDF/EPUB URLs. See shared validation and `word-following.ts`.

## Google Neural2 — paused under the $0 policy

Owner-selected Google Cloud project: `project-89a9b506-ff91-4cd1-a2d`. The owner reports finishing the API setup. Billing/API status and authentication cannot be read back in this session; the console and Cloud Shell remain unavailable. Maximum approved Google spend is **$0**. No Google synthesis has run.

`scripts/google-narration.py` now blocks Google requests at CLI entry, credential acquisition and the actual HTTP wrapper. `--check`, `--generate`, cached chunks, environment settings and a large `--max-cost-usd` do not override this pause. Only offline preflight remains available. Changing the policy requires a later explicit owner instruction and review. Existing Emma playback and other prepared local audio make no Google API calls.

```sh
# Offline only: estimates potential work without credentials or API calls.
python scripts/google-narration.py --book apps/web/public/books/manifest/book.json
python scripts/google-narration.py --book apps/web/public/books/manifest/book.json --sample
```

This code guard controls Pagechime’s own preparation path, not the Cloud account or other applications. For provider-level prevention of Text-to-Speech usage, disable that API in the selected Google project. Existing/other resource charges are outside this local guard. The agent has not changed billing or disabled the provider API. Google bills use beyond its free allowance. Alerts-only budgets are notifications; current spend caps cover selected other services, omit Cloud Text-to-Speech and can bill in-flight overages. Do not treat those controls as a $0 guarantee. Sources checked 2026-10-24: [pricing](https://cloud.google.com/text-to-speech/pricing), [spend-cap coverage and limitations](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps), [disable Text-to-Speech](https://docs.cloud.google.com/text-to-speech/docs/get-started#disable_the_cloud_text-to-speech_api).

The retained offline preparation design targets British female `en-GB-Neural2-A`, rate `0.95`, matching Emma’s text and accent. Any future authorization should start with listening to a short audition (optionally compare F). Emotional quality needs listening; Google’s documented Neural2 emotion styles for specific US voices do not support the British setup. Each voice has its own word timing track. Existing optional metadata links prepared recordings only after all chapters succeed; no client does on-demand cloud synthesis.

Historical potential full-book estimate before free quota: 233,050 billable characters, 1,149 requests, $3.7288; short audition $0.0094. These are offline estimates, **not authorized charges**. The Google audio/voice selection and live synthesis acceptance remain open while the zero-spend pause is in force.

## Piper Cori

Complete British female Piper narration is packaged as17 chapters,715 source-bound passages and ~3h26m audio. Exact chunk boundaries drive passage following; no Kokoro word cues are reused. A separate manifest-piper identity isolates progress, bookmarks and notes. Voice switching resumes at the nearest matching passage. Original PDF/Kokoro/editions remain available. Private immutable asset version94da1b70b50c4009a99e2bb11dc94c3d2a02e4b2a4c4a815fad56cfa7bf2334f has45 referenced files/187,054,263bytes, verified by a fresh hash restore. Existing24MiB file and256MiB total limits remain unchanged; temporary upload/build capabilities are expired. Qwen/Chatterbox are incomplete and the compute workspace became unavailable; they are not website recordings. No Google provider requests.
