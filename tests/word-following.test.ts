import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeWord,
  narrationOffset,
  narrationParts,
  validateTimedBook,
  type Segment,
} from "../packages/core/src/index";
const segment: Segment = {
  start: 0,
  end: 3,
  page: 1,
  text: "Hello 🌿, reader.",
  words: [
    { start: 0, end: 0.5, from: 0, to: 5 },
    { start: 1, end: 1.5, from: 6, to: 9 },
    { start: 2, end: 3, from: 10, to: 17 },
  ],
};
test("word following uses acoustic cue intervals, keeps silence and seeks rather than estimating by length", () => {
  assert.equal(activeWord(segment, 0.2)?.from, 0);
  assert.equal(activeWord(segment, 0.8), null);
  assert.equal(activeWord(segment, 1.2)?.from, 6);
  assert.equal(activeWord(segment, 3), null);
  assert.equal(narrationOffset(segment, 1.7), 6);
  assert.equal(activeWord({ ...segment, words: undefined }, 1), null);
});
test("cue spans and notes preserve original Unicode text and UTF-16 offsets through page fragments", () => {
  const fragment = {
    segment: 0,
    start: 3,
    end: segment.text.length,
    text: segment.text.slice(3),
    heading: false,
  };
  const parts = narrationParts(
    fragment,
    [
      {
        segment: 0,
        offset: 4,
        endOffset: 12,
        quote: segment.text.slice(4, 12),
      },
    ],
    segment.words,
  );
  assert.equal(parts.map((p) => p.text).join(""), fragment.text);
  assert(parts.some((p) => p.highlighted && p.wordFrom !== undefined));
  assert.equal(
    parts
      .filter((p) => p.wordFrom === 6)
      .map((p) => p.text)
      .join(""),
    "🌿,",
  );
});
test("invalid word offsets and overlapping timing data are rejected, passage-only books still work", () => {
  const input = (value: Segment) => ({
    chapters: [
      { title: "Demo", audio: "one.wav", duration: 4, segments: [value] },
    ],
  });
  const valid = {
    ...segment,
    text: "Hello 🌿, reader.",
    words: segment.words!.map((w) => ({
      ...w,
      to: Math.min(w.to, segment.text.length),
    })),
  };
  assert.equal(
    validateTimedBook(input(valid), ["one.wav"], 1)[0].segments[0].words
      ?.length,
    3,
  );
  assert.equal(
    validateTimedBook(input({ ...valid, words: undefined }), ["one.wav"], 1)[0]
      .segments[0].words,
    undefined,
  );
  for (const words of [
    [{ start: 0, end: 4, from: 0, to: 5 }],
    [{ start: 0, end: 0.5, from: -1, to: 5 }],
    [{ start: 0, end: 0.5, from: 0, to: 500 }],
    [
      { start: 0, end: 1, from: 0, to: 5 },
      { start: 0.5, end: 2, from: 6, to: 9 },
    ],
  ])
    assert.throws(() =>
      validateTimedBook(input({ ...valid, words }), ["one.wav"], 1),
    );
});
test("edition and credit addresses stay within the same book and reject traversal or executable links", async () => {
  const { validateBook } = await import("../packages/core/src/index");
  const fixture = (await import("./fixtures/book.json")).default;
  assert.equal(
    validateBook({
      ...fixture,
      editions: [
        { label: "Cozy", kind: "pdf", url: "/books/demo/editions/cozy.pdf" },
      ],
      credits: "/books/demo/editions/fonts.txt",
    }).editions?.length,
    1,
  );
  for (const url of [
    "/books/another/cozy.pdf",
    "/books/demo/../cozy.pdf",
    "/books/demo/cozy.epub",
    "javascript:alert(1)",
    "https://outside.test/cozy.pdf",
  ])
    assert.throws(() =>
      validateBook({
        ...fixture,
        editions: [{ label: "Cozy", kind: "pdf", url }],
      }),
    );
  for (const credits of [
    "/books/another/fonts.txt",
    "/books/demo/../fonts.txt",
    "javascript:alert(1)",
  ])
    assert.throws(() => validateBook({ ...fixture, credits }));
});
