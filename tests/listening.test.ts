import test from "node:test";
import assert from "node:assert/strict";
import {
  adjacentListeningChapter,
  firstListeningChapter,
  skipListeningPosition,
  validateBook,
  type Chapter,
} from "../packages/core/src/index";
const chapters: Chapter[] = [true, false, true, false, true].map(
  (skipByDefault, i) => ({
    title: `Part ${i + 1}`,
    audio: `/books/demo/${i + 1}.wav`,
    duration: 8,
    skipByDefault,
    segments: [],
  }),
);
test("normal listening skips reference chapters without reordering or removing explicit destinations", () => {
  assert.equal(firstListeningChapter(chapters), 1);
  assert.equal(adjacentListeningChapter(chapters, 1, 1), 3);
  assert.equal(adjacentListeningChapter(chapters, 3, -1), 1);
  assert.equal(adjacentListeningChapter(chapters, 3, 1), null);
  assert.equal(adjacentListeningChapter(chapters, 1, -1), null);
  assert.deepEqual(skipListeningPosition(chapters, 1, 2, 10), {
    chapter: 3,
    time: 4,
  });
  assert.deepEqual(skipListeningPosition(chapters, 3, 4, -10), {
    chapter: 1,
    time: 2,
  });
  assert.deepEqual(skipListeningPosition(chapters, 1, 1, -10), {
    chapter: 1,
    time: 0,
  });
  assert.deepEqual(skipListeningPosition(chapters, 3, 7, 10), {
    chapter: 3,
    time: 8,
  });
  assert.deepEqual(skipListeningPosition(chapters, 2, 2, 1), {
    chapter: 2,
    time: 3,
  });
  assert.equal(chapters.length, 5);
});
test("legacy books and all-reference books remain usable; malformed skip flags are rejected", () => {
  assert.equal(
    firstListeningChapter(chapters.map(({ skipByDefault, ...c }) => c)),
    0,
  );
  assert.equal(
    firstListeningChapter(chapters.map((c) => ({ ...c, skipByDefault: true }))),
    0,
  );
  assert.deepEqual(skipListeningPosition([], 0, 0, 10), {
    chapter: 0,
    time: 0,
  });
  const book = {
    id: "demo",
    title: "Demo",
    author: "Test",
    pdf: "/books/demo/book.pdf",
    pageCount: 1,
    chapters,
  };
  assert.equal(validateBook(book).chapters[0].skipByDefault, true);
  assert.throws(
    () =>
      validateBook({
        ...book,
        chapters: [{ ...chapters[0], skipByDefault: "yes" }],
      }),
    /skip preference/,
  );
});
