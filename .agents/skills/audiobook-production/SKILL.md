---
name: audiobook-production
description: Prepare and operate private PageChime audiobook generation, alignment, and export workflows.
---

# Audiobook Production

Use for book ingestion, narration generation, alignment, or preparing a PageChime book export. Read `docs/CONTENT-AND-VOICES.md`, `docs/PROJECT-MEMORY.md`, the relevant accepted requirement, and the production workflow's own current documentation before handling content.

## Privacy and authorization

- Process only books the owner is authorized to use. Keep source books, extracted text, recordings, voice references, and personal Drive URLs in the owner's private storage; never add them to Git, public fixtures, logs, prompts, or public issue attachments.
- Do not clone a voice without the owner's rights to the reference recording. Do not upload book text/audio to an external service without explicit authorization.
- Existing provider/cost policy wins. PageChime's documented Google speech spend limit is $0 and its provider guard must not be bypassed. An open-source local model may run only in a runtime the owner has authorized.
- Never accept legal terms, sign in, grant Google Drive access, choose a billing option, or activate a paid runtime on the owner's behalf. If Colab or Drive presents an account/terms/permission checkpoint, leave it to the owner and resume only after their action.

## Evidence and resumability

- Distinguish notebook/code prepared, dependencies installed, model loaded, audio generated, audio listened to, Drive save verified, alignment checked, export imported, and reader playback verified. Report only stages with direct evidence.
- Prefer the official Qwen3-TTS repository/model documentation and pinned compatible dependencies. Recheck model/runtime requirements before execution. Free Colab GPUs are availability- and quota-limited; never promise uninterrupted runtime or guarantee a particular GPU.
- Keep a manifest as the source of truth for work state. A segment is complete only after its audio file is fully written, readable, and its manifest record is committed. Resume by matching stable book/chapter/segment identity and source/settings hashes; do not overwrite a mismatched or existing artifact without inspecting it.
- Save segment outputs and manifest updates in private Drive as work progresses. Use bounded retries for recoverable failures; retain errors and stop on repeated failures, low storage, or uncertain partial writes.
- Preserve source order and the mapping from original text to normalized text to generated audio. Flag extraction uncertainty for review; never invent missing prose to fill gaps.

## Alignment and PageChime export

- Qwen3-TTS generation does not itself prove word-level alignment. Use forced alignment or acoustic timestamps against the actual output and exact spoken text; retain unmatched words and silence gaps rather than inventing timings.
- Check timestamps for ordering, bounds, word/text coverage, and chapter offsets. Record the alignment tool/version and whether results are estimated or manually reviewed.
- Build the PageChime manifest from the current repository schema and validator. Include stable book/chapter/segment IDs, source/text/audio hashes, order, durations, relative paths, timing status, and generation status. Keep private content out of Git.
- Existing PageChime reader ingestion has explicit book and cue contracts; verify the current import path before claiming compatibility. A generated sidecar alone does not mean the reader consumes it.
- Do not modify `main`, production deploys, or live catalog capabilities as part of audiobook preparation without a separate explicit owner instruction.

## iPad handoff

Keep routine controls in notebook forms/widgets instead of requiring Python edits. Give the owner a short Safari workflow for upload/select, voice/sample review, start/resume, progress, and Drive access. Clearly identify any step requiring their account interaction.

## Colab runtime and interruption recovery

- Before model loading, confirm the active runtime reports CUDA and its actual GPU; a GPU selection in notebook settings alone is not evidence. Prefer a free T4 when Colab assigns one. Never upgrade the account or select a paid runtime.
- If the owner has completed the Google account/terms/Drive authorization checkpoint, continue with the notebook's Drive mount. If `drive.mount()` times out or raises `mount failed`, capture the cell error and runtime identity. Allow at most one retry after correcting/restarting the runtime; if it fails again, stop and record Drive as unavailable. Do not keep rerunning the authorization loop or claim any output was saved.
- Keep setup stages distinct: dependency installation does not prove imports work; CUDA detection does not prove the model loads; model loading does not prove audio generation or Drive persistence. Verify each stage from cell output and inspect the resulting audio before describing it as a usable narration sample.
- A British English VoiceDesign prompt is only a target. Assess the generated sample for pronunciation, prosody, artifacts, pacing and accent; label the accent unverified until listening confirms it.
