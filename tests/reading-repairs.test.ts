import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { repairBookReading } from "../scripts/apply-reading-repairs.mjs";

test("build reading repairs require the exact source and preserve all original fields", () => {
  const book = {
    id: "example",
    chapters: [
      {
        audio: "one.wav",
        segments: [
          { text: "A mean", start: 0, end: 1, page: 1 },
          {
            text: "ingful moment. We can walked home.",
            start: 1,
            end: 2,
            page: 2,
          },
        ],
      },
    ],
  };
  const original = structuredClone(book);
  const from = book.chapters[0].segments[1].text.indexOf("walked") + 4;
  const plan = {
    id: "example",
    sourceTextSha256: createHash("sha256")
      .update(
        JSON.stringify(book.chapters.map((c) => c.segments.map((s) => s.text))),
      )
      .digest("hex"),
    joins: [{ chapter: 0, segment: 1 }],
    deletions: [{ chapter: 0, segment: 1, from, to: from + 2 }],
  };
  const repaired = repairBookReading(book, plan);
  assert.deepEqual(book, original);
  assert.equal(repaired.chapters[0].segments[1].continuesPreviousWord, true);
  assert.deepEqual(repaired.chapters[0].segments[1].readingEdits, [
    { from, to: from + 2, text: "" },
  ]);
  assert.deepEqual(repairBookReading(repaired, plan), repaired);
  for (const chapter of repaired.chapters)
    for (const segment of chapter.segments) {
      delete segment.continuesPreviousWord;
      delete segment.readingEdits;
    }
  assert.deepEqual(repaired, original);
  assert.equal(repairBookReading({ ...book, id: "other" }, plan), null);
  assert.equal(
    repairBookReading(book, { ...plan, sourceTextSha256: "changed" }),
    null,
  );
});
