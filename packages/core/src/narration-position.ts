import { segmentAt, type Book } from "./index";
import { readingDisplay, type ReadingAnchor } from "./reading";
import { narrationOffset } from "./word-following";

type Span = {
  start: number;
  end: number;
  chapter: number;
  segment: number;
  page: number;
  offsets: number[];
};
function corpus(book: Book) {
  const pieces: string[] = [],
    spans: Span[] = [];
  let at = 0;
  book.chapters.forEach((chapter, ci) =>
    chapter.segments.forEach((segment, si) => {
      const display = readingDisplay(
        { text: segment.text, start: 0, end: segment.text.length },
        segment.readingEdits,
      );
      const letters: string[] = [],
        offsets: number[] = [];
      for (const match of display.text.matchAll(/[\p{L}\p{N}]/gu)) {
        const normalized = match[0].normalize("NFKC").toLowerCase();
        letters.push(normalized);
        for (let i = 0; i < normalized.length; i++)
          offsets.push(display.offsets[match.index]);
      }
      const text = letters.join("");
      if (text.length) {
        spans.push({
          start: at,
          end: at + text.length,
          chapter: ci,
          segment: si,
          page: segment.page,
          offsets,
        });
        pieces.push(text);
        at += text.length;
      }
    }),
  );
  return { text: pieces.join(""), spans };
}
function spanAt(spans: Span[], position: number) {
  let lo = 0,
    hi = spans.length - 1;
  while (lo < hi) {
    const middle = (lo + hi) >> 1;
    if (spans[middle].end <= position) lo = middle + 1;
    else hi = middle;
  }
  return spans[lo];
}
/** Match ordered source text across different chapter/passage boundaries.
 * Character offsets refer to original text, including deletion-only repairs.
 * Audio seeks use real word cues or a real passage start, never invented cues. */
export function narrationPosition(
  source: Book,
  chapter: number,
  time: number,
  target: Book,
  visible?: ReadingAnchor,
) {
  const active = source.chapters[chapter];
  const index = active ? segmentAt(active.segments, time) : -1;
  const sourceAnchor = visible ?? {
    chapter,
    segment: Math.max(0, index),
    offset: narrationOffset(active?.segments[index], time),
  };
  const from = corpus(source),
    to = corpus(target);
  const sourceSpan = from.spans.find(
    (s) =>
      s.chapter === sourceAnchor.chapter && s.segment === sourceAnchor.segment,
  );
  const page = sourceSpan?.page ?? active?.firstPage ?? 1;
  const local =
    sourceSpan?.offsets.findIndex((offset) => offset >= sourceAnchor.offset) ??
    -1;
  const point = sourceSpan
    ? sourceSpan.start + (local < 0 ? sourceSpan.offsets.length - 1 : local)
    : 0;
  let matched: number | undefined;
  if (sourceSpan) {
    search: for (const radius of [80, 40, 20, 10]) {
      const windows = [
        [
          Math.max(0, point - radius),
          Math.min(from.text.length, point + radius),
        ],
        [point, Math.min(from.text.length, point + radius * 2)],
        [Math.max(0, point - radius * 2), point + 1],
      ];
      for (const [start, end] of windows) {
        const text = from.text.slice(start, end);
        if (text.length < Math.min(20, from.text.length)) continue;
        const candidates: {
          position: number;
          pageDistance: number;
          orderDistance: number;
        }[] = [];
        let at = to.text.indexOf(text);
        while (at >= 0 && candidates.length < 1000) {
          const position = at + point - start;
          const span = spanAt(to.spans, position);
          if (span)
            candidates.push({
              position,
              pageDistance: Math.abs(span.page - page),
              orderDistance: Math.abs(
                position / Math.max(1, to.text.length) -
                  point / Math.max(1, from.text.length),
              ),
            });
          at = to.text.indexOf(text, at + 1);
        }
        candidates.sort(
          (a, b) =>
            a.pageDistance - b.pageDistance ||
            a.orderDistance - b.orderDistance,
        );
        if (candidates.length) {
          matched = candidates[0].position;
          break search;
        }
      }
    }
  }
  const span =
    matched !== undefined
      ? spanAt(to.spans, matched)
      : [...to.spans].sort(
          (a, b) => Math.abs(a.page - page) - Math.abs(b.page - page),
        )[0];
  const reading: ReadingAnchor = span
    ? {
        chapter: span.chapter,
        segment: span.segment,
        offset:
          matched === undefined
            ? 0
            : span.offsets[
                Math.max(
                  0,
                  Math.min(span.offsets.length - 1, matched - span.start),
                )
              ],
      }
    : { chapter: 0, segment: 0, offset: 0 };
  const segment = target.chapters[reading.chapter]?.segments[reading.segment];
  const cue = segment?.words?.find((w) => w.to > reading.offset);
  return {
    chapter: reading.chapter,
    time: cue?.start ?? segment?.start ?? 0,
    reading,
    matched: matched !== undefined,
  };
}
