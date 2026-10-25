# REQ-015 — Free voice auditions delivered only to the owner

## Accepted scope

Generate Qwen3-TTS, Chatterbox and Piper on the same original 32-word passage. Keep Kokoro unchanged. Latest owner direction: offer the samples here only; do not add small clips to the website. A full recording must be created before upload. No full-book generation has started, and no new narrator has been chosen.

## Completed evidence

- Three real CPU-generated MP3s delivered as PageChime-Qwen3-TTS-sample.mp3, PageChime-Chatterbox-sample.mp3 and PageChime-Piper-sample.mp3. All three saves succeeded with local identity applied.
- Qwen3-TTS1.7B VoiceDesign:13.36s; Chatterbox Nano:12.08s; Piper en_GB-cori-high:11.587s. Full immutable model revisions, model licences, generation times, raw/MP3 hashes and audio QA are in [voice-auditions-20261025.json](../voice-auditions-20261025.json).
- Reproduction: [scripts/voice-audition.py](../../scripts/voice-audition.py), using separate Python environments and already downloaded local weights. Actual generation succeeded for all engines. The OS seccomp boundary denies connect/sendto/sendmsg/sendmmsg before runtime imports; the denied-connect check returned EPERM. ONNX telemetry and Hugging Face telemetry are explicitly disabled.
- All final raw clips have zero clipped PCM samples and decode correctly. Offline faster-whisper tiny.en transcripts match all Qwen/Chatterbox words after ignoring punctuation. Piper's article “A” was transcribed as “and”; this is an unresolved automated-listening ambiguity, not a verified text substitution. No human listening or accent-quality claim is made. Delivery MP3s use mono24kHz/64kbps and the same loudness normalization.
- Qwen uses an original fictional adult British-female narrator description. Chatterbox uses that synthetic Qwen output as reference, not a human recording; its native Perth watermark remains. Piper's Cori model card describes UK English female and public-domain LibriVox recordings. Model metadata reports Apache-2.0, MIT and MIT respectively; the separately installed Piper engine is GPL-3.0.

## Source and delivery boundaries

Only the offline preparation script, provenance and continuity documentation are retained in source. No audio clip, sample UI, client data, service-worker change or sample browser test is being published. The abandoned local preview was removed after owner steering; its failed QA is not release evidence. Generated preview build directories are archived outside the repository. No private book content, credentials, microphone, Google synthesis, paid API, analytics, backend or hosting-access changes.

Official references: [Qwen](https://github.com/QwenLM/Qwen3-TTS), [Chatterbox](https://github.com/resemble-ai/chatterbox), [Piper](https://github.com/OHF-voice/piper1-gpl), [Cori model card](https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_GB/cori/high/MODEL_CARD). Qwen package0.1.1 with Transformers4.57.3; Chatterbox source5de7a54aa4e5e2baadb0182dde554908b48b85c2 with Transformers5.2.0; both use CPU Torch2.6.0. Piper package1.8.0.

No app version bump. Main and hosted app remain unchanged. Future full-book preparation must retain separate acoustic timings and follow the owner's approval/upload instruction; these samples provide no full-book timing acceptance.
