"""Prepare a private, loss-checked narration plan from an owner-provided EPUB.

This writes no website content. Page markers are excluded before joining inline
text so a printed page break cannot split a spoken word. Body chapters follow
the EPUB spine; navigation/front matter and chapters beyond --last-spine stay
out of the continuous listening recording.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import zipfile
import xml.etree.ElementTree as ET

EPUB_TYPE = "{http://www.idpf.org/2007/ops}type"
BLOCKS = {"h1", "h2", "h3", "h4", "p", "li", "td", "dt", "dd"}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blocks_from_body(body):
    output, current = [], []
    page, first_page = 1, 1

    def flush():
        nonlocal current
        value = re.sub(r"\s+", " ", "".join(current)).strip()
        if value:
            output.append({"text": value, "page": first_page, "endPage": page})
        current = []

    def add(value):
        nonlocal first_page
        if value:
            if not current:
                first_page = page
            current.append(value)

    def walk(node):
        nonlocal page
        if "pagebreak" in node.get(EPUB_TYPE, "").split():
            label = node.get("title", "")
            if label.isdigit():
                page = int(label)
            return
        block = node.tag.split("}")[-1] in BLOCKS
        if block:
            flush()
        add(node.text)
        for child in node:
            walk(child)
            add(child.tail)
        if block:
            flush()

    walk(body)
    flush()
    return output


def chunks_from_blocks(blocks, max_words=60, max_chars=390):
    chunks, words, pages = [], [], []

    def flush():
        nonlocal words, pages
        if words:
            text = " ".join(words)
            chunks.append({"text": text, "sha256": sha(text.encode()),
                           "words": len(words), "page": pages[0], "endPage": pages[-1]})
        words, pages = [], []

    for block in blocks:
        for word in block["text"].split():
            if words and (len(words) >= max_words or len(" ".join(words)) + len(word) + 1 > max_chars):
                flush()
            words.append(word)
            pages.append(block["page"])
            if len(" ".join(words)) >= 240 and re.search(r"[.!?][\"'’”)]?$", word):
                flush()
        # Prefer real paragraph boundaries once a useful amount of speech fits.
        if len(" ".join(words)) >= 180:
            flush()
    flush()
    expected = [word for block in blocks for word in block["text"].split()]
    actual = [word for chunk in chunks for word in chunk["text"].split()]
    if actual != expected:
        raise ValueError("Narration chunking lost, duplicated or changed source words")
    return chunks


def prepare(epub_bytes, last_spine=None):
    with zipfile.ZipFile(io.BytesIO(epub_bytes)) as epub:
        container = ET.fromstring(epub.read("META-INF/container.xml"))
        package_path = next(n.get("full-path") for n in container.iter() if n.tag.endswith("rootfile"))
        if ".." in PurePosixPath(package_path).parts:
            raise ValueError("Unsafe EPUB package path")
        package = ET.fromstring(epub.read(package_path))
        ns = {"o": "http://www.idpf.org/2007/opf"}
        items = {n.get("id"): n.get("href") for n in package.findall("o:manifest/o:item", ns)}
        chapters = []
        for entry in package.findall("o:spine/o:itemref", ns):
            name = items[entry.get("idref")]
            if name.startswith("chapter-") and name.endswith(".xhtml"):
                if ".." in PurePosixPath(name).parts:
                    raise ValueError("Unsafe EPUB chapter path")
                content = ET.fromstring(epub.read(str(PurePosixPath(package_path).parent / name)))
                body = next(n for n in content.iter() if n.tag.endswith("}body"))
                blocks = blocks_from_body(body)
                title = next((b["text"] for b in blocks if b["text"]), name)
                chunks = chunks_from_blocks(blocks)
                if not chunks:
                    raise ValueError("An included chapter contains no narration")
                chapters.append({"title": title, "spine": name, "blocks": blocks, "chunks": chunks})
            if name == last_spine:
                break
        if last_spine and (not chapters or chapters[-1]["spine"] != last_spine):
            raise ValueError("Requested final body chapter was not found")
    text_digest = sha(json.dumps([[b["text"] for b in c["blocks"]] for c in chapters],
                                 ensure_ascii=False, separators=(",", ":")).encode())
    return {"version": 1, "epubSha256": sha(epub_bytes), "textSha256": text_digest,
            "chapters": chapters, "chunkCount": sum(len(c["chunks"]) for c in chapters),
            "wordCount": sum(x["words"] for c in chapters for x in c["chunks"])}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--epub-name", required=True)
    parser.add_argument("--last-spine")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with zipfile.ZipFile(args.bundle) as bundle:
        info = bundle.getinfo(args.epub_name)
        if info.file_size > 50_000_000:
            parser.error("EPUB exceeds the preparation size limit")
        plan = prepare(bundle.read(info), args.last_spine)
    plan["bundleSha256"] = sha(args.bundle.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in plan.items() if k != "chapters"}))
