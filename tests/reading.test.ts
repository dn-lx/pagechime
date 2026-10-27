import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paginateReading,
  readingPageAt,
  readingAnchorAt,
  readingAppearance,
  readingProgress,
  readingWordBudget,
  readingParagraphs,
  readingDisplay,
  narrationParts,
  validateTimedBook,
  type Segment,
} from "../packages/core/src/index";
const segment = (text: string, page = 1): Segment => ({
  text,
  page,
  start: 0,
  end: 10,
});
test("verified page-end word joins stay on one page without moving source text or anchors", () => {
  const segments = [
    segment("A small beginning makes room for a mean"),
    {
      ...segment("ingful moment. Another complete sentence follows.", 2),
      continuesPreviousWord: true,
    },
  ];
  for (const budget of [8, 9, 10, 15, 40]) {
    const pages = paginateReading(segments, budget);
    const joined = pages.find((p) =>
      p.fragments.some((f) => f.segment === 1 && f.start === 0),
    )!;
    assert.ok(
      joined.fragments.some(
        (f) => f.segment === 0 && f.end === segments[0].text.length,
      ),
    );
    assert.ok(
      readingParagraphs(joined).some((group) =>
        group
          .map((f) => f.text)
          .join("")
          .includes("meaningful"),
      ),
    );
    for (const [i, s] of segments.entries())
      assert.equal(
        pages
          .flatMap((p) => p.fragments)
          .filter((f) => f.segment === i)
          .map((f) => f.text)
          .join(""),
        s.text,
      );
  }
});
test("minimal display repairs preserve source selection offsets, notes and acoustic cue identities", () => {
  const text = "We can walked home safely.";
  const edits = [{ from: 11, to: 13, text: "" }];
  const f = { segment: 0, start: 0, end: text.length, text, heading: false };
  const display = readingDisplay(f, edits);
  assert.equal(display.text, "We can walk home safely.");
  assert.equal(
    display.offsets[display.text.indexOf("home")],
    text.indexOf("home"),
  );
  assert.equal(display.offsets["We can walk".length], 13);
  const from = text.indexOf("safely"),
    to = from + 6;
  const parts = narrationParts(
    f,
    [{ segment: 0, offset: from, endOffset: to, quote: "safely" }],
    [{ start: 1, end: 2, from, to }],
    edits,
  );
  assert.equal(parts.map((p) => p.text).join(""), display.text);
  assert.equal(
    parts
      .filter((p) => p.highlighted)
      .map((p) => p.text)
      .join(""),
    "safely",
  );
  assert.equal(parts.find((p) => p.wordFrom === from)?.text, "safely");
  assert.throws(() => readingDisplay(f, [{ from: 3, to: 6, text: "could" }]));
});
test("reading repair metadata is validated and cannot join the first passage", () => {
  const input = (segments: Segment[]) => ({
    chapters: [{ audio: "one.wav", duration: 30, segments }],
  });
  const a = segment("A mean"),
    b = {
      ...segment("ingful moment."),
      start: 10,
      end: 20,
      continuesPreviousWord: true,
    };
  assert.equal(
    validateTimedBook(input([a, b]), ["one.wav"], 1)[0].segments[1]
      .continuesPreviousWord,
    true,
  );
  for (const edit of [
    { from: -1, to: 1, text: "" },
    { from: 1, to: 999, text: "" },
    { from: 1, to: 1, text: "" },
  ])
    assert.throws(() =>
      validateTimedBook(
        input([{ ...a, readingEdits: [edit] }]),
        ["one.wav"],
        1,
      ),
    );
  assert.throws(() =>
    validateTimedBook(
      input([{ ...a, readingEdits: [{ from: 0, to: 1, text: "expanded" }] }]),
      ["one.wav"],
      1,
    ),
  );
  assert.throws(() =>
    validateTimedBook(
      input([a, b, { ...b, start: 20, end: 30 }]),
      ["one.wav"],
      1,
    ),
  );
  assert.throws(() =>
    validateTimedBook(
      input([{ ...a, continuesPreviousWord: true }]),
      ["one.wav"],
      1,
    ),
  );
  assert.throws(() =>
    validateTimedBook(
      input([
        {
          ...a,
          readingEdits: [
            { from: 0, to: 3, text: "" },
            { from: 2, to: 4, text: "" },
          ],
        },
      ]),
      ["one.wav"],
      1,
    ),
  );
});
test("short reader viewports paginate below thirty words instead of forcing hidden lines", () => {
  const budget = readingWordBudget(300, 180, 22, 1.75);
  assert.ok(budget >= 8 && budget < 30);
  assert.ok(readingWordBudget(650, 600, 22, 1.75) > budget);
  const original = "A complete sentence belongs on the page. ".repeat(5);
  const pages = paginateReading([segment(original)], budget);
  assert.equal(
    pages
      .flatMap((p) => p.fragments)
      .map((f) => f.text)
      .join(""),
    original,
  );
  assert.ok(pages.length > 1);
});
test("reading pagination preserves every character and passage identity through long Unicode paragraphs", () => {
  const segments = [
    segment("  FIRST CHAPTER  "),
    segment(
      "A quiet café. A new beginning — every word matters. 🌿\n".repeat(130),
    ),
    segment("The last word.\n\n", 237),
  ];
  for (const budget of [8, 30, 90, 210, 360]) {
    const pages = paginateReading(segments, budget);
    for (let i = 0; i < segments.length; i++)
      assert.equal(
        pages
          .flatMap((p) => p.fragments)
          .filter((f) => f.segment === i)
          .map((f) => f.text)
          .join(""),
        segments[i].text,
      );
    assert.ok(pages.every((p) => p.fragments.length));
    for (let i = 0; i < pages.length; i++) {
      const a = readingAnchorAt(pages, i, 3);
      assert.equal(readingPageAt(pages, a.segment, a.offset), i);
      assert.equal(a.chapter, 3);
    }
  }
});
test("a reading anchor returns to the same passage after font or viewport reflow", () => {
  const segments = [
    segment("One step at a time. ".repeat(200)),
    segment("A last sentence."),
  ];
  const narrow = paginateReading(segments, 40),
    wide = paginateReading(segments, 170);
  const anchor = readingAnchorAt(narrow, 7, 0),
    page = wide[readingPageAt(wide, anchor.segment, anchor.offset)];
  assert.ok(
    page.fragments.some(
      (f) =>
        f.segment === anchor.segment &&
        f.start <= anchor.offset &&
        f.end > anchor.offset,
    ),
  );
  assert.equal(readingPageAt([], 0), 0);
  assert.deepEqual(readingAnchorAt([], 0, 2), {
    chapter: 2,
    segment: 0,
    offset: 0,
  });
});
test("appearance values are bounded and reading progress uses text rather than chapter count", () => {
  assert.equal(
    readingAppearance({ size: 999, leading: 7, font: "serif" }).size,
    32,
  );
  assert.equal(readingAppearance({ size: NaN }).size, 22);
  assert.equal(readingAppearance({ leading: 7 }).leading, 1.75);
  const chapters = [
    {
      title: "One",
      audio: "1",
      duration: 10,
      segments: [segment("a".repeat(90))],
    },
    {
      title: "Two",
      audio: "2",
      duration: 10,
      segments: [segment("b".repeat(10))],
    },
  ];
  assert.equal(
    readingProgress(chapters, { chapter: 1, segment: 0, offset: 0 }),
    90,
  );
  assert.equal(
    readingProgress(chapters, { chapter: 1, segment: 0, offset: 10 }),
    100,
  );
});
test("cross-passage highlights merge safely and preserve rendered text", async () => {
  const { readingHighlights } = await import("../packages/core/src/reading");
  const fragment = {
    segment: 2,
    start: 5,
    end: 15,
    text: "abcdefghij",
    heading: false,
  };
  const pieces = readingHighlights(fragment, [
    {
      segment: 1,
      offset: 0,
      endSegment: 2,
      endOffset: 8,
      quote: "across paragraphs",
    },
    { segment: 2, offset: 7, endOffset: 12, quote: "overlap" },
  ]);
  assert.equal(pieces.map((p) => p.text).join(""), fragment.text);
  assert.deepEqual(pieces, [
    { text: "abcdefg", highlighted: true },
    { text: "hij", highlighted: false },
  ]);
});
test("native book markup escapes source text, quoted highlights and titles", async () => {
  const { bookTextHtml } = await import("../apps/mobile/book-text-html");
  const malicious = '<img src=x onerror="alert(1)"> & a quiet beginning';
  const page = paginateReading([segment(malicious)], 80)[0];
  const html = bookTextHtml(
    page,
    "<script>bad</script>",
    0,
    true,
    readingAppearance(null),
    [],
    0,
    {
      paper: "#fffefb",
      ink: "#292e24",
      muted: "#5c6254",
      line: "#ddded2",
      accent: "#65704f",
      highlight: "#f4e5ab",
      soft: "#e9eddf",
    },
  );
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;script&gt;bad"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<script>bad"));
});
