# REQ-013 — Reader controls and photo-verified text

Owner requests real fullscreen, clear ±10 second controls, skipping non-reading sections, missing-sentence repair against the supplied photo album and visual polish. Work stays directly on develop; no main promotion or Google synthesis.

## Evidence and boundaries

Develop7bf1c62 is the clean base; runtime6e38106 is ready. BookReader focus only toggles CSS/sidebar; player uses overlapping15/30 labels. Private27-file library remains immutable/hash-verified outside Git. Supplied album is publicly shared by its owner and contains122 source photos; downloaded inputs stay private/ignored. Existing book text/cues/PDF source and alignment cache are available locally.

## Sequence

1. Add real document fullscreen and a full-window focus fallback with explicit exit/Escape and browser fullscreenchange handling. Compact reader chrome and preserve the player.
2. Replace transport labels with legible10s controls; use10s for media-session/native parity. Add validated optional chapter skip metadata, default normal reading at the introduction and auto-advance past reference chapters; direct selections/saved positions remain available.
3. OCR/visually inspect source photos, compare to existing text and supplied editions, audit omissions before changing data. Preserve all original files and unchanged text offsets/cues; corrected or added passages get timings only when acoustically supported. Publish a new private version after independent boundary review if corrections require it; retire any temporary upload capability.
4. Verify deterministic contracts, fullscreen API/fallback/exit,10s seeks/boundaries, skipped chapter start/auto-next/direct access, mobile/desktop appearance/axe/overflow/errors and real book beginning/middle/end/PDF. Inspect screenshots. Run web/native checks and budget, independently review changes, publish develop and verify ready source/hosted reader.

## Compatibility and recovery

Optional chapter metadata defaults to ordinary playback for legacy/imported books. Do not reorder/delete chapters or alter stored chapter/segment offsets. Source book contents and photos never enter Git. No auth, analytics, billing or outer-gate changes. Roll back code/private current pointer if verification fails. Existing edition choices remain allowlisted.

## Evidence

Independent source/boundary review found no material issue;13 targeted checks passed. Initial controls/browser8 cases pass on desktop/mobile. Final layout uses measured player height and removes the inherited main-shell100vh minimum during fullscreen; the first geometry regression caught and resolved navigation behind the fixed player. Final prose-only fullscreen polish needs fresh screenshots/checks.

Owner confirms omissions in both text/audio, then asks to proceed after the exact-example question is aborted. Album122 source photos were compared with two local OCR modes. Apparent unmatched spans were predominantly OCR layout artifacts. Printed page5 was visually compared with the current key-terms chapter and matches. Eleven body runs without acoustic cues were locally transcribed with full expected-word overlap. These samples do not prove a narrated omission. No speculative book-text/audio edit is authorized by uncertain OCR; retain this criterion open.

Private publication delta: exactly8 skipByDefault reference flags in book.json. All19 chapter indices, text/word offsets, cue timing, recordings and editions stay identical. Independent review covers the immutable same-bucket publication with a20-minute upload-only capability and retirement; current upload is in progress. Current code stays on develop; source/CI/deploy evidence will follow. Version impact: patch/minor within ongoing development; update unreleased notes, no release tag.

Private version0e4a2bc8f8faf3292e231cd8fd2ce50e330cc8f075c021b9ecb755c4350824ae published:27 files/87,290,086 bytes. Fresh restore verifies all hashes. Upload-only capability expired immediately after publication; subsequent request401, active key counts1 build/0 upload; expired row retained for audit. Previous immutable version retained. New asset metadata validates19 chapters,8 references and normal start at chapter5. No text/audio/word-cue delta. Eleven independently transcribed uncued runs match all expected words, supporting timing-gap diagnosis for those samples only.

Final enhanced controls suite passes8/8, including actual fullscreen API, fallback/Escape/browser exit, PDF rendering/navigation geometry,10s seeks, reference skipping/direct access and light/night axe. Independent final review identified a measured-height/minimum feedback risk on wide→narrow→wide transitions. Decouple the player minimum at112px from measured --player, retain responsive minima, and add the resize regression before publication. Native transport spacing/play sizing now fits320px. Root is validating the final responsive fix.
