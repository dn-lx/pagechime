import { test } from "node:test";
import { execFileSync } from "node:child_process";
test("offline narration tools preserve word offsets, validate real marks and bound Google requests", () => {
  execFileSync("python3", ["tests/narration_python.py"], { stdio: "pipe" });
});

import assert from "node:assert/strict";
import fixture from "./fixtures/book.json";
import {
  narrationPosition,
  validateBook,
  type Book,
} from "../packages/core/src/index";

test("voice switching maps text and page across different chapter boundaries", () => {
  const original = validateBook(fixture);
  const target: Book = {
    ...original,
    chapters: [
      {
        ...original.chapters[0],
        segments: original.chapters
          .flatMap((c) => c.segments)
          .map((s, i) => ({ ...s, start: i * 5, end: i * 5 + 5 })),
      },
    ],
  };
  const position = narrationPosition(
    original,
    1,
    original.chapters[1].segments[0].start,
    target,
  );
  assert.equal(position.chapter, 0);
  assert.equal(
    target.chapters[0].segments.find((s) => s.start === position.time)?.text,
    original.chapters[1].segments[0].text,
  );
  assert.deepEqual(
    narrationPosition({ ...original, chapters: [] }, 0, 0, {
      ...target,
      chapters: [],
    }),
    {
      chapter: 0,
      time: 0,
      reading: { chapter: 0, segment: 0, offset: 0 },
      matched: false,
    },
  );
});
test("prepared voice metadata rejects foreign origins, book namespaces and traversal", () => {
  for (const address of [
    "https://outside.test/piper.json",
    "/books/other/piper.json",
    "/books/demo/../piper.json",
    "/books/demo/piper.json?key=x",
    "/books/demo/%2e%2e/piper.json",
  ]) {
    assert.throws(() =>
      validateBook({ ...fixture, preparedNarrations: { piper: address } }),
    );
  }
  assert.equal(
    validateBook({
      ...fixture,
      preparedNarrations: { piper: "/books/demo/piper/book.json" },
    }).preparedNarrations?.piper,
    "/books/demo/piper/book.json",
  );
});

test("voice changes retain a visible character offset across split passages and round trips", () => {
  const source = validateBook(fixture);
  source.chapters[0].segments[0].text =
    "A repeated phrase. This is the exact place to keep reading safely.";
  source.chapters[0].segments[1].text =
    "A repeated phrase. Another paragraph follows.";
  const split = source.chapters[0].segments[0].text.indexOf("exact");
  const target: Book = {
    ...source,
    chapters: [
      {
        ...source.chapters[0],
        segments: [
          {
            start: 0,
            end: 2,
            page: 1,
            text: source.chapters[0].segments[0].text.slice(0, split),
          },
          {
            start: 2,
            end: 4,
            page: 1,
            text: source.chapters[0].segments[0].text.slice(split),
          },
          { ...source.chapters[0].segments[1], start: 4, end: 6 },
          ...source.chapters[1].segments.map((s, i) => ({
            ...s,
            start: 6 + i,
            end: 7 + i,
          })),
        ],
      },
    ],
  };
  const anchor = {
    chapter: 0,
    segment: 0,
    offset: source.chapters[0].segments[0].text.indexOf("place"),
  };
  const mapped = narrationPosition(source, 1, 5, target, anchor);
  assert.equal(mapped.reading.segment, 1);
  assert.equal(
    target.chapters[0].segments[1].text.slice(
      mapped.reading.offset,
      mapped.reading.offset + 5,
    ),
    "place",
  );
  assert.equal(
    mapped.time,
    2,
    "uncued speech seeks to its real passage boundary",
  );
  const back = narrationPosition(
    target,
    mapped.chapter,
    mapped.time,
    source,
    mapped.reading,
  );
  assert.deepEqual(back.reading, anchor);
});

test("voice position matching ignores punctuation and joined source-page word splits", () => {
  const source = validateBook(fixture);
  source.chapters[0].segments[0].text = "A quiet mean";
  source.chapters[0].segments[1].text =
    "ingful moment is here. Keep reading this sentence.";
  source.chapters[0].segments[1].continuesPreviousWord = true;
  const target: Book = {
    ...source,
    chapters: [
      {
        ...source.chapters[0],
        segments: [
          {
            start: 0,
            end: 8,
            page: 1,
            text: "A quiet meaningful moment is here: keep reading this sentence.",
          },
        ],
      },
    ],
  };
  const anchor = { chapter: 0, segment: 1, offset: 3 };
  const mapped = narrationPosition(source, 0, 0, target, anchor);
  assert.equal(
    target.chapters[0].segments[0].text.slice(
      mapped.reading.offset,
      mapped.reading.offset + 3,
    ),
    "ful",
  );
});

test("unrecorded source sections do not claim a matching narration position", () => {
  const source = validateBook(fixture);
  source.chapters[0].segments[0].text =
    "An index of unrelated references and bibliography entries unavailable in the narrative recording.";
  const target: Book = { ...source, chapters: [{ ...source.chapters[1] }] };
  assert.equal(
    narrationPosition(source, 0, 0, target, {
      chapter: 0,
      segment: 0,
      offset: 8,
    }).matched,
    false,
  );
});
