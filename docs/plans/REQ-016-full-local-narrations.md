# REQ-016 — Three complete local narrations

## Outcome and boundaries

Owner requests full Qwen, Chatterbox and Piper recordings; British female preferred, any available voice accepted if necessary. Work is private preparation only. Keep Kokoro, accounts, app/runtime, main, hosting gate and Google zero-spend policy unchanged. No short samples on the website. Narrate the main source spine from introduction through epilogue, preserving all narrative words; skip cover, navigation, acknowledgement/source/index/notes/back-cover material in normal listening as requested earlier.

## Verified inputs

Recovered supplied edition archive through Library. Bundle SHA256923a8f487c7bcf7c23526744acc575c1d92a0f16df463bd162df417a26d658f2; Kindle EPUB SHA2566ff59e28a1df11c20a16015246f2e81e6a67cc59e02f3972abd1f939b849f19a. Generated private plan:36,025 words,715 chunks,9 logical narrative chapters. Chunking verifies exact source-word order; page markers are removed before joining inline text so page-end split words are spoken together. Plan source-text SHA256124eecb58612a5dc558368164cb03092ac00f6f6a01528b2f2b1dd11c2c37720. No private source text belongs in this plan document or Git.

## Implementation order

1. Prepare private text/chapters and validate lossless chunking. Complete.
2. Reuse isolated local model environments, offline syscall boundary and synthetic reference. Qwen Base0.6B revision5d83992436eae1d760afd27aff78a71d676296fc; Chatterbox Nano71ccd1d0081b430592cea481f4307e764e07bc64; Piper Cori5041a7a49ae5b3a0f30e6837769eb03fdbb231bd. Qwen is from the same model family as the audition, with its designed voice reused as reference for consistency. Chatterbox retains native watermarking. No real-person reference.
3. Generate hash-bound WAV chunks atomically; verify every cached chunk on resume. One worker per output folder, cooperative pause/thread controls, bounded source lengths and waveform/duration checks. Three concurrent models exceeded comfortable working memory; schedule within8CPU/8GiB rather than blindly spawning workers.
4. Save private chapter/chunk checkpoints durably during this multi-hour CPU task. Do not claim work will continue after this session without a verified persistent execution service.
5. After all715 chunks per engine exist, hash-verify, concatenate in source order, encode the full MP3, decode from beginning to end and compare duration with source chunks. Save the three final private audio deliverables. No old acoustic timing track applies to a new voice.

## Verification and current evidence

Seven no-model preparation tests cover page-break word joins, lossless bounded chunks, spine order/reference boundary, missing boundary failures, incomplete checkpoint rejection changed/corrupt checkpoint rejection and truncated waveform rejection. Actual first two generated chunks per engine were transcribed offline: Qwen similarity1.000/0.9825, Chatterbox0.9818/0.9649, Piper0.9818/0.9217. Scores are automatic word-sequence comparisons and can include recognition errors; no full-book or human-listening acceptance is claimed.

Current partial private chunks are under /workspace/scratch/452ae38be48c/full-recordings/{qwen,chatterbox,piper}. Source/preparation code is safe for develop; private text, reference/cache/generated audio and Library identity stay outside Git. All waveform caches are reproducible from public model revisions and the owner archive, but regeneration is expensive, so retain checkpoints. No schema, app storage, analytics or hosting-access change. Tooling-only patch within0.1.0; no release/main promotion.

## Remaining acceptance

The three-engine request remains open for Chatterbox generation, full-output decoding, private save and delivery. Qwen and Piper are complete for the current PageChime edition; Qwen's browser playback and text-follow are verified on develop. Accent/naturalness still needs a human listening review, and no full proofread is claimed. Do not promote the code to main without separate owner approval.

## Piper publication follow-up

Owner explicitly authorizes completed Piper on the existing develop website. All715 chunks were generated;17 unclear takes were repaired and checked by independent offline recognition. Final MP3 fully decoded:12,397.920s,99,183,679bytes,SHA2560143e1a3c84fcc63e7c77fd8a125db8cc40459a88cf01a235756e550e865611b. This is automated acoustic screening, not a human proofread.

Package seventeen <=18min MP3 chapters under existing private limits; exact chunk passage times, no inherited word cues. PDF offset7 matches narrative headings. Distinct manifest-piper identity preserves separate saved positions/bookmarks/notes, with nearest-passage switching. Traverse declared voice manifests through the existing exact-path guest allowlist. New immutable private version94da1b70b50c4009a99e2bb11dc94c3d2a02e4b2a4c4a815fad56cfa7bf2334f has45 files/187,054,263bytes; fresh complete hash restore verified. Both temporary capabilities expired; existing read-only Netlify build capability retained. Private media never belongs in Git.

Before the compute outage,48 Node checks, web build,4 targeted fixture browser checks and4 real-book browser checks passed across desktop/mobile. All17 encoded files fully decoded. Voice-menu contrast and mobile copy were corrected. The environment became unavailable before source synchronization; equivalent website changes and regression tests were recovered through GitHub MCP and require current remote CI. Develop only; preserve main, hosting gate, Google $0 block and original Kokoro.

## Qwen3-TTS and PageChime integration — current status (2026-11-18)

The completed Qwen3-TTS Studio run supersedes the earlier partial local Qwen checkpoint for the PageChime edition: 18 chapters, 197 source segments and 13,062.82 seconds. The complete master decoded successfully. Its PageChime export has 20 size-bounded MP3 tracks, 229 passages and 36,219 estimated word cues; text reconstruction, hashes, ordering, bounds and reader schema checks passed. Estimated acoustic coverage is 96.2% overall and 47.93% for the index. Seventeen PDF page transitions remain provisional and two cues crossing track boundaries were omitted. This is not a full human listening review or proofread.

The private library was published as immutable version 36237ab930429a1de47ac46ed61232b85300684bf96cd63874edee3940179010, preserving Kokoro and Piper; all 66 files were restored and hash-checked. Temporary Qwen upload/build capabilities expired. Qwen selection, playback progress and visible word-follow are verified on develop. Source SHA, deployment and remaining acceptance details are in docs/CURRENT-HANDOFF.md. The owner separately authorized the shared Supabase catalog publication; GitHub main and the production website deployment were not changed.

Chatterbox remains incomplete at its last persisted local checkpoint (at least70 chunks); no worker is running. Finish Chatterbox generation, full decode, private save and delivery if the broader three-engine request remains active. Keep the $0 Google-spend policy.
