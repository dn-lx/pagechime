import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  segmentAt,
  globalPosition,
  locatePosition,
  validateBook,
  validateTimedBook,
} from "../packages/core/src/index";
const book = JSON.parse(
  readFileSync(new URL("./fixtures/book.json", import.meta.url), "utf8"),
);
test("passage selection and chapter seeking preserve boundary behavior", () => {
  const c = validateBook(book).chapters;
  assert.equal(segmentAt(c[0].segments, -1), -1);
  assert.equal(segmentAt(c[0].segments, 0), 0);
  assert.equal(segmentAt(c[0].segments, 3.99), 0);
  assert.equal(segmentAt(c[0].segments, 4), 1);
  assert.deepEqual(locatePosition(c, 8), { chapter: 1, time: 0 });
  assert.deepEqual(locatePosition(c, 100), { chapter: 1, time: 8 });
  assert.equal(globalPosition(c, 1, 2), 10);
  assert.equal(globalPosition(c, 1, -2), 8);
});
test("timing imports reject overlap, out-of-range pages, missing audio and invalid duration", () => {
  for (const mutate of [
    (b: any) => (b.chapters[0].segments[1].start = 2),
    (b: any) => (b.chapters[0].segments[0].page = 3),
    (b: any) => (b.chapters[0].duration = Infinity),
    (b: any) => (b.chapters[0].segments[0].text = ""),
  ]) {
    const b = structuredClone(book);
    mutate(b);
    assert.throws(() => validateTimedBook(b, ["1.wav", "2.wav"], 2));
  }
  assert.throws(
    () => validateTimedBook(book, ["2.wav"], 2),
    /Choose the audio/,
  );
  assert.throws(() => validateBook({}), /incomplete/);
});
test("loaded books use the sum of validated chapter durations", () => {
  assert.equal(validateBook({ ...book, duration: 999 }).duration, 16);
});
test("rejects malformed library entries before rendering them", () => {
  for (const change of [
    { author: undefined },
    { pdf: null },
    { id: "../bad" },
    { chapters: [{ audio: undefined }] },
  ])
    assert.throws(() => validateBook({ ...book, ...change }), /incomplete/);
});
