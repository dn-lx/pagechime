import type { Chapter, Segment, ReadingEdit } from "./index";

/** Offsets refer to original passage text, independently of layout page numbers. */
export type ReadingAnchor = {
  chapter: number;
  segment: number;
  offset: number;
};
export type ReadingFragment = {
  segment: number;
  start: number;
  end: number;
  text: string;
  heading: boolean;
  joinPrevious?: boolean;
};
export type ReadingPage = { fragments: ReadingFragment[] };
export type ReadingAppearance = {
  size: number;
  font: "serif" | "sans";
  leading: number;
  width: "comfortable" | "wide";
  surface: "paper" | "sepia" | "night";
};
export const defaultAppearance: ReadingAppearance = {
  size: 22,
  font: "serif",
  leading: 1.75,
  width: "comfortable",
  surface: "paper",
};
export function readingAppearance(
  value: Partial<ReadingAppearance> | null,
): ReadingAppearance {
  const v = value || {};
  return {
    size: Number.isFinite(v.size) ? Math.max(17, Math.min(32, v.size!)) : 22,
    font: v.font === "sans" ? "sans" : "serif",
    leading: [1.5, 1.75, 2].includes(v.leading!) ? v.leading! : 1.75,
    width: v.width === "wide" ? "wide" : "comfortable",
    surface:
      v.surface === "night" || v.surface === "sepia" ? v.surface : "paper",
  };
}
export function readingWordBudget(
  width: number,
  height: number,
  size: number,
  leading: number,
) {
  const lines = Math.max(3, (height - 100) / (size * leading));
  const words = Math.max(3, (width - 72) / (size * 0.48 * 6));
  return Math.max(8, Math.min(360, Math.floor(lines * words * 0.82)));
}
/** Lossless pagination; unusually tall rendered pages may scroll rather than clip. */
export function paginateReading(
  segments: Segment[],
  wordBudget = 180,
): ReadingPage[] {
  const budget = Math.max(
    8,
    Math.floor(Number.isFinite(wordBudget) ? wordBudget : 180),
  );
  const pages: ReadingPage[] = [];
  let fragments: ReadingFragment[] = [],
    used = 0;
  const flush = () => {
    if (fragments.length) pages.push({ fragments });
    fragments = [];
    used = 0;
  };
  segments.forEach((segment, index) => {
    const words = [...segment.text.matchAll(/\S+\s*/gu)];
    if (!words.length) return;
    let start = 0,
      word = 0;
    const heading =
      !segment.continuesPreviousWord &&
      segment.text.length < 95 &&
      segment.text === segment.text.toUpperCase();
    while (word < words.length) {
      if (used >= budget || (heading && budget - used < 15 && fragments.length))
        flush();
      let count = Math.min(words.length - word, Math.max(1, budget - used));
      // Keep a source-page hyphenation pair on one reading page. Both source
      // fragments and their offsets remain intact for notes and acoustic cues.
      if (
        segments[index + 1]?.continuesPreviousWord &&
        word + count === words.length &&
        used + count >= budget
      ) {
        if (count > 1) count--;
        else if (used) {
          flush();
          continue;
        }
      }
      const last = words[word + count - 1];
      const end =
        word + count === words.length
          ? segment.text.length
          : last.index! + last[0].length;
      fragments.push({
        segment: index,
        start,
        end,
        text: segment.text.slice(start, end),
        heading,
        ...(start === 0 && segment.continuesPreviousWord
          ? { joinPrevious: true }
          : {}),
      });
      used +=
        count +
        (end === segment.text.length &&
        segments[index + 1]?.continuesPreviousWord
          ? 0
          : 5);
      word += count;
      start = end;
      if (word < words.length) flush();
    }
  });
  flush();
  return pages;
}
/** Group only explicitly verified word continuations, never infer prose joins. */
export function readingParagraphs(page: ReadingPage | undefined) {
  const groups: ReadingFragment[][] = [];
  for (const fragment of page?.fragments || []) {
    const previous = groups.at(-1);
    if (
      fragment.joinPrevious &&
      previous?.at(-1)?.segment === fragment.segment - 1
    )
      previous.push(fragment);
    else groups.push([fragment]);
  }
  return groups;
}

/** Display text plus a UTF-16 boundary map back to the untouched source text. */
export function readingDisplay(
  fragment: Pick<ReadingFragment, "text" | "start" | "end">,
  edits: readonly ReadingEdit[] = [],
) {
  let text = "",
    cursor = fragment.start;
  const offsets = [cursor];
  const boundaries = [0];
  const raw = (end: number) => {
    while (cursor < end) {
      text += fragment.text[cursor - fragment.start];
      offsets.push(++cursor);
      boundaries[cursor - fragment.start] = text.length;
    }
  };
  for (const edit of edits) {
    if (edit.to <= cursor || edit.from >= fragment.end) continue;
    raw(Math.max(cursor, edit.from));
    const from = Math.max(cursor, edit.from),
      to = Math.min(fragment.end, edit.to);
    if (edit.text !== "") throw Error("Only deletion repairs are supported.");
    for (let source = from; source <= to; source++)
      boundaries[source - fragment.start] = text.length;
    offsets[offsets.length - 1] = to;
    cursor = to;
  }
  raw(fragment.end);
  return { text, offsets, boundaries };
}
export function readingPageAt(
  pages: ReadingPage[],
  segment: number,
  offset = 0,
) {
  const i = pages.findIndex((p) =>
    p.fragments.some(
      (f) => f.segment === segment && offset >= f.start && offset < f.end,
    ),
  );
  return i < 0 ? 0 : i;
}
export function readingAnchorAt(
  pages: ReadingPage[],
  page: number,
  chapter: number,
): ReadingAnchor {
  const f = pages[Math.max(0, Math.min(pages.length - 1, page))]?.fragments[0];
  return { chapter, segment: f?.segment || 0, offset: f?.start || 0 };
}

export type ReadingSelection = ReadingAnchor & {
  quote: string;
  page: number;
  time: number;
  endSegment: number;
  endOffset: number;
};
export function readingProgress(chapters: Chapter[], anchor: ReadingAnchor) {
  let total = 0,
    before = 0;
  chapters.forEach((ch, c) =>
    ch.segments.forEach((seg, i) => {
      total += seg.text.length;
      if (c < anchor.chapter || (c === anchor.chapter && i < anchor.segment))
        before += seg.text.length;
      else if (c === anchor.chapter && i === anchor.segment)
        before += Math.max(0, Math.min(seg.text.length, anchor.offset));
    }),
  );
  return total ? Math.round((before / total) * 100) : 0;
}

export function readingHighlights(
  fragment: ReadingFragment,
  notes: {
    segment?: number;
    offset?: number;
    endSegment?: number;
    endOffset?: number;
    quote?: string;
  }[],
) {
  const ranges = notes
    .flatMap((n) => {
      if (
        !Number.isInteger(n.segment) ||
        typeof n.quote !== "string" ||
        fragment.segment < n.segment! ||
        fragment.segment > (n.endSegment ?? n.segment!)
      )
        return [];
      const start = Math.max(
        fragment.start,
        fragment.segment === n.segment
          ? Number.isFinite(n.offset)
            ? n.offset!
            : 0
          : 0,
      );
      const end = Math.min(
        fragment.end,
        fragment.segment === (n.endSegment ?? n.segment)
          ? Number.isFinite(n.endOffset)
            ? n.endOffset!
            : (n.offset || 0) + n.quote.length
          : fragment.end,
      );
      return end > start
        ? [{ start: start - fragment.start, end: end - fragment.start }]
        : [];
    })
    .sort((a, b) => a.start - b.start);
  const merged: typeof ranges = [];
  for (const r of ranges) {
    const old = merged.at(-1);
    if (old && r.start <= old.end) old.end = Math.max(old.end, r.end);
    else merged.push({ ...r });
  }
  let cursor = 0;
  const chunks: { text: string; highlighted: boolean }[] = [];
  for (const r of merged) {
    if (r.start > cursor)
      chunks.push({
        text: fragment.text.slice(cursor, r.start),
        highlighted: false,
      });
    chunks.push({
      text: fragment.text.slice(r.start, r.end),
      highlighted: true,
    });
    cursor = r.end;
  }
  if (cursor < fragment.text.length)
    chunks.push({ text: fragment.text.slice(cursor), highlighted: false });
  return chunks;
}
