# REQ-017 — Keep ebook position synchronized with transport and voice changes

Owner reports playback chapter changes leave the ebook behind, while changing voices moves the reading location. Playback load previously retained a saved detached reading anchor. Voice changes used unordered text overlap near a PDF page and then restored stale target-voice history.

Implement a shared ordered source-text/UTF-16 anchor mapping across voice chunk/chapter boundaries, retaining deletion-only reading repairs and real cue/passage timestamps. Pass explicit reading navigation through playback load/seek, covering previous/next, cross-chapter skips, Contents and automatic chapter advancement. Opening a saved book still restores its manual reading anchor. Ordinary play/pause in the same chapter does not cancel independent reading. Explicit playback navigation resumes following.

Report the actual visible text anchor to the voice chooser; override stale target-voice history with the mapped anchor and preserve following/view state. Without fine acoustic cues, start audio at a real passage boundary and retain the requested text anchor until following catches up. Never fabricate word timings. Keep independent voice IDs, saved annotations and account/guest boundaries unchanged.

Verify exact offsets and round trips through repeated text, changed punctuation and page-split words; desktop/mobile playback navigation after manual browsing, automatic chapter changes and voice changes against stale saved history. Reuse full fixture regression/type/build/performance checks and inspect screenshots. Patch within0.1.0, develop only; Google $0 block, production and private published audio stay unchanged. No analytics/provider calls or backend changes.

Qwen/Chatterbox status checked separately: saved Library version1 checkpoints retain38/43 of715 sections. Prior host's local caches/models are absent here, and no narrator process is currently running. No progress claim beyond those durable checkpoints.

## Verification

Local51 Node checks, web/native/server types and strict docs/agent-stack pass. Complete browser suite80 passes/4 private-book skips; ten focused desktop/mobile tests cover transport after manual browsing, automatic changes, saved manual places, voice round trips and stale target history. Screenshots inspected at both sizes; original layout, themes and geometry retained. Exact-position mapping benchmark for ~220k source characters:92ms on this host. Web export succeeds;568KiB/900KiB shell budget. Direct live-reader browser check reaches the existing Netlify team-protection sign-in; no gate/account changes. Remote CI/deploy verification follows publication.

Checkpoint restoration verified all38 Qwen and43 Chatterbox WAV hashes against their accepted JSON markers. Models/runtime packages are absent; no running synthesis claim.
