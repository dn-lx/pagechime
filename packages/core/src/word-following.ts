import type { Segment, WordCue, ReadingEdit } from "./index";
import {
  readingHighlights,
  readingDisplay,
  type ReadingFragment,
} from "./reading";

/** The most recent cue; gaps are retained rather than filled with guessed speech. */
export function wordCueIndex(words: readonly WordCue[], time: number) {
  let lo = 0,
    hi = words.length - 1,
    found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (words[mid].start <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
export function activeWord(segment: Segment | undefined, time: number) {
  if (!segment?.words?.length) return null;
  const cue = segment.words[wordCueIndex(segment.words, time)];
  return cue && time < cue.end ? cue : null;
}
export function narrationOffset(segment: Segment | undefined, time: number) {
  if (!segment) return 0;
  if (segment.words?.length)
    return segment.words[wordCueIndex(segment.words, time)]?.from ?? 0;
  return Math.min(
    segment.text.length - 1,
    Math.max(
      0,
      Math.floor(
        ((time - segment.start) / Math.max(0.01, segment.end - segment.start)) *
          segment.text.length,
      ),
    ),
  );
}
/** Split on annotation/cue boundaries without changing any original text or offsets. */
export function narrationParts(
  fragment: ReadingFragment,
  notes: Parameters<typeof readingHighlights>[1],
  words: readonly WordCue[] = [],
  edits: readonly ReadingEdit[] = [],
) {
  const display = readingDisplay(fragment, edits);
  const displayBoundary = (source: number) =>
    display.boundaries[source - fragment.start];
  let offset = 0;
  const highlights = readingHighlights(fragment, notes).map((part) => {
    const range = {
      start: offset,
      end: offset + part.text.length,
      highlighted: part.highlighted,
    };
    offset = range.end;
    return range;
  });
  const cues = words.filter(
    (w) => w.from < fragment.end && w.to > fragment.start,
  );
  const boundaries = [
    ...new Set([
      0,
      fragment.text.length,
      ...highlights.flatMap((h) => [h.start, h.end]),
      ...cues.flatMap((w) => [
        Math.max(0, w.from - fragment.start),
        Math.min(fragment.text.length, w.to - fragment.start),
      ]),
    ]),
  ].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1],
      cue = cues.find(
        (w) => w.from <= fragment.start + start && w.to >= fragment.start + end,
      );
    return {
      text: display.text.slice(
        displayBoundary(fragment.start + start),
        displayBoundary(fragment.start + end),
      ),
      highlighted: highlights.some(
        (h) => h.highlighted && h.start <= start && h.end >= end,
      ),
      wordFrom: cue?.from,
    };
  });
}
