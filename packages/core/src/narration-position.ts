import { segmentAt, type Book } from "./index";

/** New recordings have their own sections and timestamps. Resume at a real
 * passage boundary, with text overlap resolving nearby page candidates. */
export function narrationPosition(source: Book, chapter: number, time: number, target: Book) {
  const active = source.chapters[chapter];
  const current = active?.segments[segmentAt(active.segments, time)];
  const page = current?.page ?? active?.firstPage ?? 1;
  const tokens = (text: string) => text.toLocaleLowerCase("en").match(/[\p{L}\p{N}]+/gu) ?? [];
  const vocabulary = new Set(tokens(current?.text ?? ""));
  const candidates = target.chapters.flatMap((c, ci) => c.segments.map(s => ({
    chapter: ci, time: s.start, distance: Math.abs(s.page - page),
    overlap: tokens(s.text).filter(w => vocabulary.has(w)).length,
  })));
  const nearest = Math.min(...candidates.map(c => c.distance));
  const best = candidates.filter(c => c.distance <= nearest + 1)
    .sort((a, b) => b.overlap - a.overlap || a.distance - b.distance)[0];
  return best ? { chapter: best.chapter, time: best.time } : { chapter: 0, time: 0 };
}
