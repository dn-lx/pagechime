"""Encode and verify one full private recording after every chunk is complete."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--recording", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--author", required=True)
    args = parser.parse_args()
    helpers = runpy.run_path(str(Path(__file__).with_name("record-voice-book.py")))
    plan = json.loads(args.plan.read_text())
    settings = json.loads((args.recording / "settings.json").read_text())
    if settings["planSha256"] != hashlib.sha256(args.plan.read_bytes()).hexdigest():
        raise ValueError("The narration plan changed")
    fingerprint = hashlib.sha256(json.dumps(settings, sort_keys=True).encode()).hexdigest()
    files, chapters, at = [], [], 0.0
    for ci, chapter in enumerate(plan["chapters"]):
        start = at
        for ii, chunk in enumerate(chapter["chunks"]):
            path = args.recording / "chunks" / f"{ci+1:02}-{ii+1:04}-{chunk['sha256'][:12]}.wav"
            cached = helpers["cached_chunk"](path, chunk["sha256"], fingerprint)
            if not cached:
                raise ValueError("A full recording cannot be created from missing chunks")
            checked = helpers["inspect_wav"](path)
            if abs(checked["duration"] - cached["duration"]) > 0.001:
                raise ValueError("A chunk duration differs from its checkpoint")
            files.append(path)
            at += checked["duration"]
        chapters.append({"title": chapter["title"], "start": start, "end": at})
    if len(files) != plan["chunkCount"]:
        raise ValueError("Incomplete narration coverage")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    playlist = args.recording / "full-recording.concat.txt"
    playlist.write_text("\n".join("file '" + str(p.resolve()) + "'" for p in files) + "\n")
    temporary = args.output.with_suffix(".partial.mp3")
    subprocess.run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(playlist),
        "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000",
        "-codec:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1",
        "-metadata", "title=" + args.title,
        "-metadata", "artist=" + args.author,
        "-metadata", "album=" + settings["engine"] + " narration",
        str(temporary),
    ], check=True)
    # Decode the actual deliverable from beginning to end, not just its header.
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(temporary),
                    "-f", "null", "-"], check=True)
    actual = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
        "default=noprint_wrappers=1:nokey=1", str(temporary),
    ], text=True))
    if abs(actual - at) > 0.25:
        raise ValueError("The encoded recording duration does not match its chunks")
    temporary.replace(args.output)
    report = {"engine": settings["engine"], "sourceTextSha256": plan["textSha256"],
              "chunkCount": len(files), "wordCount": plan["wordCount"],
              "chapters": chapters, "duration": actual,
              "sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
              "bytes": args.output.stat().st_size,
              "verification": "all source chunks present and hash-verified; full MP3 decoded"}
    args.output.with_suffix(".json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "chapters"}))


if __name__ == "__main__":
    main()
