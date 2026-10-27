import fixture from "./book.json";
import type { Book } from "../../packages/core/src/index";

export const repairedBook: Book = structuredClone(fixture);
repairedBook.chapters[0].segments[0].text = "A mean";
repairedBook.chapters[0].segments[1].text =
  "ingful moment. We can walked home safely.";
repairedBook.chapters[0].segments[1].continuesPreviousWord = true;
const typo = repairedBook.chapters[0].segments[1].text.indexOf("walked") + 4;
repairedBook.chapters[0].segments[1].readingEdits = [
  { from: typo, to: typo + 2, text: "" },
];

export const longBook = structuredClone(fixture);
longBook.chapters[0].segments[0].text = Array.from(
  { length: 34 },
  (_, i) =>
    `Moment ${i + 1}. Give your intention a small place in the day. A little time can make room for a new beginning.`,
).join(" ");
longBook.chapters[0].segments[1].text =
  "The final paragraph is here. Every word deserves its place on the page.";
export const untimedBook = structuredClone(fixture);
untimedBook.chapters.forEach((c) => {
  c.segments = [];
});
export const mixedBook = structuredClone(fixture);
mixedBook.chapters[1].segments = [];
