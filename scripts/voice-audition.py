"""Generate one short, original audition from already downloaded local weights.

Run each engine with its own environment. Network connections are denied at the
OS syscall boundary before importing model runtimes, including native telemetry.
No private book input, cloud API, microphone or real-person voice is used.
"""

import argparse
import ctypes
import errno
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import time
import wave

TEXT = (
    "Make yourself comfortable. A good book gives us room to pause, notice, "
    "and begin again. Take a steady breath, turn the page, and let the next "
    "idea arrive in its own time."
)
DESCRIPTION = (
    "An adult British woman with a warm, clear, natural voice. Calm and "
    "gently expressive audiobook narration, unhurried with thoughtful pauses. "
    "A standard southern British English accent, without theatrical delivery."
)


def deny_network():
    """Fail closed if Linux seccomp cannot prohibit all outbound connections."""
    lib = ctypes.CDLL("libseccomp.so.2", use_errno=True)
    lib.seccomp_init.argtypes = [ctypes.c_uint32]
    lib.seccomp_init.restype = ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    lib.seccomp_syscall_resolve_name.restype = ctypes.c_int
    lib.seccomp_rule_add.argtypes = [
        ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint
    ]
    lib.seccomp_load.argtypes = [ctypes.c_void_p]
    lib.seccomp_release.argtypes = [ctypes.c_void_p]
    context = lib.seccomp_init(0x7FFF0000)  # SCMP_ACT_ALLOW
    if not context:
        raise RuntimeError("Cannot initialize offline network boundary")
    try:
        # Block connection-oriented traffic and connectionless telemetry.
        for name in (b"connect", b"sendto", b"sendmsg", b"sendmmsg"):
            syscall = lib.seccomp_syscall_resolve_name(name)
            if syscall < 0 or lib.seccomp_rule_add(
                context, 0x00050000 | errno.EPERM, syscall, 0
            ) != 0:
                raise RuntimeError("Cannot configure offline network boundary")
        if lib.seccomp_load(context) != 0:
            raise RuntimeError("Cannot enforce offline network boundary")
    finally:
        lib.seccomp_release(context)
    os.environ.update(
        HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
        HF_HUB_DISABLE_TELEMETRY="1", DO_NOT_TRACK="1",
    )
    if importlib.util.find_spec("onnxruntime"):
        import onnxruntime
        onnxruntime.disable_telemetry_events()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("engine", choices=("qwen", "chatterbox", "piper"))
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--reference", type=Path)
    args = parser.parse_args()
    if not args.model.exists():
        parser.error("Download the official model weights before offline inference")
    deny_network()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    print(f"Generating {args.engine} on CPU, with network access denied", flush=True)
    if args.engine == "piper":
        from piper import PiperVoice, SynthesisConfig
        voice = PiperVoice.load(args.model, use_cuda=False)
        with wave.open(str(args.output), "wb") as output:
            voice.synthesize_wav(
                TEXT, output, SynthesisConfig(length_scale=1.18, volume=0.9)
            )
    else:
        import torch
        import soundfile as sf
        torch.set_num_threads(6)
        torch.manual_seed(1337)
        if args.engine == "qwen":
            from qwen_tts import Qwen3TTSModel
            model = Qwen3TTSModel.from_pretrained(
                str(args.model), device_map="cpu", dtype=torch.bfloat16,
                attn_implementation="sdpa",
            )
            wavs, sr = model.generate_voice_design(
                text=TEXT, language="English", instruct=DESCRIPTION,
                max_new_tokens=750,
            )
            sf.write(args.output, wavs[0], sr, subtype="PCM_16")
        else:
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            model = ChatterboxTurboTTS.from_local(
                args.model, device="cpu", nano=True,
            )
            # Only a locally generated synthetic reference; no human cloning.
            options = {"audio_prompt_path": str(args.reference)} if args.reference else {}
            wav = model.generate(TEXT, **options)
            sf.write(args.output, wav.squeeze().numpy(), model.sr, subtype="PCM_16")
    with wave.open(str(args.output)) as output:
        duration = output.getnframes() / output.getframerate()
        sample_rate = output.getframerate()
    metadata = {
        "engine": args.engine, "text": TEXT, "duration": duration,
        "sampleRate": sample_rate, "cpuSeconds": round(time.monotonic() - started, 2),
        "wavSha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
        "referenceSha256": hashlib.sha256(args.reference.read_bytes()).hexdigest()
        if args.reference else None,
        "network": "denied by seccomp during inference",
    }
    args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata), flush=True)


if __name__ == "__main__":
    main()
