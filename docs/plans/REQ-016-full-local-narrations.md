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

Full generation, complete output decoding, final private saves and delivery are pending. Later app integration is separate and must retain exact new voice timings and existing reader security boundaries. REQ-014 hosted verification remains separately blocked by Netlify sign-in.
