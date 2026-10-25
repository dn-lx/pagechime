import { test } from "node:test";
import { execFileSync } from "node:child_process";
test("offline narration tools preserve word offsets, validate real marks and bound Google requests", () => {
  execFileSync("python3", ["tests/narration_python.py"], { stdio: "pipe" });
});

import assert from "node:assert/strict";
import fixture from "./fixtures/book.json";
import { narrationPosition, validateBook, type Book } from "../packages/core/src/index";

test("voice switching maps text and page across different chapter boundaries", () => {
  const original = validateBook(fixture);
  const target: Book = { ...original, chapters: [{ ...original.chapters[0],
    segments: original.chapters.flatMap(c => c.segments).map((s, i) => ({ ...s, start: i * 5, end: i * 5 + 5 })),
  }] };
  const position = narrationPosition(original, 1, original.chapters[1].segments[0].start, target);
  assert.equal(position.chapter, 0);
  assert.equal(target.chapters[0].segments.find(s => s.start === position.time)?.text,
    original.chapters[1].segments[0].text);
  assert.deepEqual(narrationPosition({ ...original, chapters: [] }, 0, 0, { ...target, chapters: [] }), { chapter: 0, time: 0 });
});
test("prepared voice metadata rejects foreign origins, book namespaces and traversal", () => {
  for (const address of ["https://outside.test/piper.json", "/books/other/piper.json", "/books/demo/../piper.json", "/books/demo/piper.json?key=x", "/books/demo/%2e%2e/piper.json"]) {
    assert.throws(() => validateBook({ ...fixture, preparedNarrations: { piper: address } }));
  }
  assert.equal(validateBook({ ...fixture, preparedNarrations: { piper: "/books/demo/piper/book.json" } }).preparedNarrations?.piper, "/books/demo/piper/book.json");
});
