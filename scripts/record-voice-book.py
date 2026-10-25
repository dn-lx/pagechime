"""Resumable, offline CPU narration of a private, loss-checked book plan.

Each process loads one model once. Every chunk is committed atomically with a
source hash, voice/settings fingerprint and audio hash. Completed chunks are
verified on resume. Neither book text nor audio belongs in the source repo.
"""

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import runpy
import subprocess
import time
import wave


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(path)


def inspect_wav(path):
    with wave.open(str(path)) as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError("Expected mono PCM16 narration")
        rate, frames = audio.getframerate(), audio.getnframes()
        raw = audio.readframes(frames)
    if not frames or len(raw) != frames * 2:
        raise ValueError("Empty or invalid generated narration")
    import numpy as np
    samples = np.frombuffer(raw, dtype="<i2").astype("float32") / 32768
    if not np.isfinite(samples).all():
        raise ValueError("Invalid generated narration")
    peak = float(abs(samples).max())
    rms = float(np.sqrt(np.mean(samples * samples)))
    if rms < 0.0001:
        raise ValueError("Generated narration is silent")
    return {"duration": frames / rate, "sampleRate": rate, "peak": peak,
            "rms": rms, "sha256": digest(path.read_bytes())}


def cached_chunk(path, source_hash, fingerprint):
    marker = path.with_suffix(".json")
    if not marker.exists() or not path.exists():
        return None
    record = json.loads(marker.read_text())
    if record.get("sourceSha256") != source_hash or record.get("fingerprint") != fingerprint:
        raise ValueError("Existing audio belongs to different text or narrator settings")
    if digest(path.read_bytes()) != record.get("sha256"):
        raise ValueError("A completed narration chunk failed its integrity check")
    return record


def encode_chapter(paths, target):
    playlist = target.with_suffix(".concat.txt")
    # Internally generated paths have no quote characters.
    playlist.write_text("\n".join("file '" + str(p.resolve()) + "'" for p in paths) + "\n")
    temporary = target.with_suffix(".partial.mp3")
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(playlist),
        "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000",
        "-codec:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1", str(temporary),
    ], check=True)
    temporary.replace(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("engine", choices=("qwen", "chatterbox", "piper"))
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--reference", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    if not args.model.exists() or not 1 <= args.threads <= 8 or not 1 <= args.batch <= 4:
        parser.error("Local model, 1–8 CPU threads and batch 1–4 are required")
    if args.engine != "piper" and (not args.reference or not args.reference.is_file()):
        parser.error("The Qwen-designed synthetic reference is required")
    plan = json.loads(args.plan.read_text())
    chunks = [(ci, ii, chunk) for ci, ch in enumerate(plan["chapters"])
              for ii, chunk in enumerate(ch["chunks"])]
    if len(chunks) != plan["chunkCount"]:
        raise ValueError("Narration plan count is inconsistent")
    for _, _, chunk in chunks:
        if digest(chunk["text"].encode()) != chunk["sha256"]:
            raise ValueError("Narration plan text failed its integrity check")
    settings = {"engine": args.engine, "revision": args.revision,
                "planSha256": digest(args.plan.read_bytes()),
                "referenceSha256": digest(args.reference.read_bytes()) if args.reference else None,
                "piperLengthScale": 1.18, "piperVolume": 0.9,
                "qwenMaxTokens": 750, "pipelineVersion": 1}
    fingerprint = digest(json.dumps(settings, sort_keys=True).encode())
    args.output.mkdir(parents=True, exist_ok=True)
    # Hold the lock for this process, including model loading and finalization.
    worker_lock = (args.output / ".worker.lock").open("a")
    try:
        fcntl.flock(worker_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise RuntimeError("This narrator already has an active recording worker")
    audio_root = args.output / "chunks"
    audio_root.mkdir(exist_ok=True)
    old_settings = args.output / "settings.json"
    if old_settings.exists() and json.loads(old_settings.read_text()) != settings:
        raise ValueError("Output folder already belongs to another narration job")
    atomic_json(old_settings, settings)
    lookup = {(ci, ii): audio_root / f"{ci+1:02}-{ii+1:04}-{c['sha256'][:12]}.wav"
              for ci, ii, c in chunks}
    completed = []
    pending = []
    for ci, ii, chunk in chunks:
        cached = cached_chunk(lookup[ci, ii], chunk["sha256"], fingerprint)
        if cached:
            completed.append(cached)
        else:
            pending.append((ci, ii, chunk))
    start = time.monotonic()

    def progress(stage, **extra):
        record = {"engine": args.engine, "stage": stage,
                  "completedChunks": len(completed), "totalChunks": len(chunks),
                  "completedWords": sum(c["words"] for c in completed),
                  "totalWords": plan["wordCount"],
                  "audioSeconds": sum(c["duration"] for c in completed),
                  "runSeconds": round(time.monotonic() - start, 1),
                  "updated": time.time(), **extra}
        atomic_json(args.output / "status.json", record)
        print(json.dumps(record), flush=True)

    progress("loading")
    helper = runpy.run_path(str(Path(__file__).with_name("voice-audition.py")))
    helper["deny_network"]()
    import numpy as np
    torch = None
    if args.engine == "piper":
        import onnxruntime as ort
        from piper import PiperVoice, SynthesisConfig
        voice = PiperVoice.load(args.model, use_cuda=False)
        options = ort.SessionOptions()
        options.intra_op_num_threads = args.threads
        options.inter_op_num_threads = 1
        voice.session = ort.InferenceSession(str(args.model), sess_options=options,
                                            providers=["CPUExecutionProvider"])
        synthesis = SynthesisConfig(length_scale=1.18, volume=0.9)
    else:
        import torch
        import soundfile as sf
        torch.set_num_threads(args.threads)
        torch.set_num_interop_threads(1)
        if args.engine == "qwen":
            from qwen_tts import Qwen3TTSModel
            voice = Qwen3TTSModel.from_pretrained(
                str(args.model), device_map="cpu", dtype=torch.bfloat16,
                attn_implementation="sdpa",
            )
            prompt = voice.create_voice_clone_prompt(
                ref_audio=str(args.reference), ref_text=helper["TEXT"],
                x_vector_only_mode=False,
            )
        else:
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            voice = ChatterboxTurboTTS.from_local(args.model, device="cpu", nano=True)
            voice.prepare_conditionals(str(args.reference), exaggeration=0.0)
            original_inference = voice.t3.inference_turbo

            def bounded_inference(*positional, **keywords):
                tokens = original_inference(*positional, **keywords)
                if tokens.numel() >= 1000:
                    raise ValueError("Chatterbox reached its speech token limit")
                return tokens

            voice.t3.inference_turbo = bounded_inference
    progress("recording")
    if args.limit:
        pending = pending[:args.limit]
    batch_size = args.batch if args.engine == "qwen" else 1
    for offset in range(0, len(pending), batch_size):
        control_path = args.output / "control.json"
        control = json.loads(control_path.read_text()) if control_path.exists() else {}
        if control.get("pause"):
            progress("paused")
            return
        desired_threads = control.get("threads", args.threads)
        if not isinstance(desired_threads, int) or not 1 <= desired_threads <= 8:
            raise ValueError("Invalid CPU thread control")
        if torch is not None and torch.get_num_threads() != desired_threads:
            torch.set_num_threads(desired_threads)
        group = pending[offset:offset + batch_size]
        began = time.monotonic()
        if torch is not None:
            torch.manual_seed(1337 + group[0][0] * 10000 + group[0][1])
        if args.engine == "qwen":
            waves, sample_rate = voice.generate_voice_clone(
                text=[item[2]["text"] for item in group], language="English",
                voice_clone_prompt=prompt * len(group), non_streaming_mode=True,
                max_new_tokens=750,
            )
        else:
            waves, sample_rate = None, None
        for gi, (ci, ii, chunk) in enumerate(group):
            target = lookup[ci, ii]
            temporary = target.with_suffix(".partial.wav")
            if args.engine == "piper":
                with wave.open(str(temporary), "wb") as output:
                    voice.synthesize_wav(chunk["text"], output, synthesis)
            else:
                if args.engine == "chatterbox":
                    audio = voice.generate(chunk["text"]).squeeze().numpy()
                    sample_rate = voice.sr
                else:
                    audio = waves[gi]
                audio = np.asarray(audio, dtype="float32").squeeze()
                if audio.ndim != 1 or not np.isfinite(audio).all():
                    raise ValueError("Invalid generated speech waveform")
                peak = float(abs(audio).max())
                if peak > 0.98:
                    audio *= 0.98 / peak
                sf.write(temporary, audio, sample_rate, subtype="PCM_16")
            metadata = inspect_wav(temporary)
            # Reject silent, obviously truncated or looping output before caching.
            if not max(0.2, chunk["words"] * 0.18) <= metadata["duration"] <= chunk["words"] * 0.95 + 5:
                raise ValueError("Generated duration is implausible for this source chunk")
            if args.engine == "qwen" and metadata["duration"] >= 60:
                raise ValueError("Qwen may have reached its speech token limit")
            metadata.update({"sourceSha256": chunk["sha256"], "fingerprint": fingerprint,
                             "chapter": ci + 1, "chunk": ii + 1, "words": chunk["words"],
                             "wallSeconds": round((time.monotonic() - began) / len(group), 2)})
            temporary.replace(target)
            atomic_json(target.with_suffix(".json"), metadata)
            completed.append(metadata)
        progress("recording", chapter=group[-1][0] + 1)
        # Chapter completion is a durable checkpoint and can be saved independently.
        for ci in set(item[0] for item in group):
            chapter_paths = [lookup[ci, ii] for ii in range(len(plan["chapters"][ci]["chunks"]))]
            target = args.output / f"chapter-{ci+1:02}.mp3"
            if not target.exists() and all(p.with_suffix(".json").exists() for p in chapter_paths):
                encode_chapter(chapter_paths, target)
                progress("chapter-complete", chapter=ci + 1)
    progress("finalizing" if len(completed) == len(chunks) else "paused")
    if len(completed) == len(chunks):
        chapters = []
        at = 0.0
        for ci, chapter in enumerate(plan["chapters"]):
            records = [cached_chunk(lookup[ci, ii], c["sha256"], fingerprint)
                       for ii, c in enumerate(chapter["chunks"])]
            duration = sum(c["duration"] for c in records)
            chapters.append({"title": chapter["title"], "start": at, "duration": duration})
            at += duration
        atomic_json(args.output / "chapters.json", chapters)
        progress("chunks-complete")


if __name__ == "__main__":
    main()
