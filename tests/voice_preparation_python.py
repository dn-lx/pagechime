"""No-model tests of narration text fidelity and safe checkpoint reuse."""
import hashlib
import io
import json
from pathlib import Path
import runpy
import tempfile
import unittest
import wave
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
prepare = runpy.run_path(str(ROOT / "scripts/prepare-voice-book.py"))
record = runpy.run_path(str(ROOT / "scripts/record-voice-book.py"))


def epub():
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("META-INF/container.xml", '<container><rootfiles><rootfile full-path="EPUB/book.opf"/></rootfiles></container>')
        archive.writestr("EPUB/book.opf", '''<package xmlns="http://www.idpf.org/2007/opf"><manifest>
          <item id="nav" href="nav.xhtml"/><item id="a" href="chapter-1.xhtml"/>
          <item id="b" href="chapter-2.xhtml"/><item id="index" href="chapter-3.xhtml"/>
          </manifest><spine><itemref idref="nav"/><itemref idref="a"/>
          <itemref idref="b"/><itemref idref="index"/></spine></package>''')
        for name, text in [("chapter-1", "A quiet start."), ("chapter-2", "One more page."), ("chapter-3", "Index")]:
            archive.writestr(f"EPUB/{name}.xhtml", f'<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>{name}</h1><p>{text}</p></body></html>')
    return output.getvalue()


class VoicePreparation(unittest.TestCase):
    def test_pagebreak_does_not_split_a_word_or_add_a_page_number(self):
        body = ET.fromstring('<body xmlns:epub="http://www.idpf.org/2007/ops"><p>A note on comp<span epub:type="pagebreak" title="2">2</span>assion.</p><p>Next paragraph.</p></body>')
        blocks = prepare["blocks_from_body"](body)
        self.assertEqual([b["text"] for b in blocks], ["A note on compassion.", "Next paragraph."])
        self.assertEqual(blocks[0]["endPage"], 2)

    def test_chunk_boundaries_preserve_every_source_word_in_order(self):
        blocks = [{"text": " ".join(f"word{i}." if i % 17 == 0 else f"word{i}" for i in range(550)), "page": 3}]
        chunks = prepare["chunks_from_blocks"](blocks)
        self.assertEqual(" ".join(c["text"] for c in chunks).split(), blocks[0]["text"].split())
        self.assertTrue(all(c["words"] <= 60 and len(c["text"]) <= 390 for c in chunks))

    def test_spine_order_and_end_boundary_exclude_navigation_and_references(self):
        plan = prepare["prepare"](epub(), "chapter-2.xhtml")
        self.assertEqual([c["spine"] for c in plan["chapters"]], ["chapter-1.xhtml", "chapter-2.xhtml"])
        self.assertEqual(plan["chunkCount"], 2)

    def test_missing_requested_boundary_fails_instead_of_silently_truncating(self):
        with self.assertRaises(ValueError):
            prepare["prepare"](epub(), "chapter-99.xhtml")

    def test_incomplete_audio_is_not_accepted_as_a_checkpoint(self):
        with tempfile.TemporaryDirectory() as temporary:
            p = Path(temporary) / "audio.wav"
            p.write_bytes(b"partial")
            self.assertIsNone(record["cached_chunk"](p, "source", "voice"))

    def test_truncated_waveform_is_rejected_even_if_its_header_claims_full_length(self):
        with tempfile.TemporaryDirectory() as temporary:
            p = Path(temporary) / "audio.wav"
            with wave.open(str(p), "wb") as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(24000)
                audio.writeframes(b"\x01\x10" * 24000)
            p.write_bytes(p.read_bytes()[:-500])
            with self.assertRaises(ValueError):
                record["inspect_wav"](p)

    def test_resume_rejects_changed_voice_changed_source_and_corrupt_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            p = Path(temporary) / "audio.wav"
            p.write_bytes(b"completed-audio")
            metadata = {"sourceSha256": "source", "fingerprint": "voice", "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
            record["atomic_json"](p.with_suffix(".json"), metadata)
            self.assertEqual(record["cached_chunk"](p, "source", "voice"), metadata)
            for source, voice in [("different", "voice"), ("source", "different")]:
                with self.assertRaises(ValueError):
                    record["cached_chunk"](p, source, voice)
            p.write_bytes(b"corrupt")
            with self.assertRaises(ValueError):
                record["cached_chunk"](p, "source", "voice")


if __name__ == "__main__":
    unittest.main()
