export type WordCue = { start: number; end: number; from: number; to: number };
/** Deletion-only reading repairs retain original text, cues and saved offsets. */
export type ReadingEdit = { from: number; to: number; text: string };
export type Segment = {
  start: number;
  end: number;
  page: number;
  text: string;
  words?: WordCue[];
  continuesPreviousWord?: boolean;
  readingEdits?: ReadingEdit[];
};
export type Chapter = {
  id?: string;
  skipByDefault?: boolean;
  title: string;
  audio: string;
  file?: string;
  duration: number;
  firstPage?: number;
  segments: Segment[];
};
export type Book = {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  description?: string;
  voice?: string;
  pageCount: number;
  pdf: string;
  cover?: string;
  chapters: Chapter[];
  duration: number;
  timing?: string;
  local?: boolean;
  narration?: "kokoro" | "google" | "piper";
  preparedNarrations?: { piper?: string };
  sourceBookId?: string;
  alternateNarration?: string;
  editions?: {
    label: string;
    kind: "pdf" | "epub";
    url: string;
    pageCount?: number;
  }[];
  timingProvenance?: string;
  credits?: string;
};
export type Progress = {
  chapter: number;
  time: number;
  page: number;
  updated: number;
  view?: "text" | "pdf";
  follow?: boolean;
  reading?: import("./reading").ReadingAnchor;
};
export type Bookmark = {
  id: string;
  bookId: string;
  chapter: number;
  time: number;
  page: number;
  text: string;
  created: number;
  reading?: import("./reading").ReadingAnchor;
};
export const palette = {
  background: "#f5f3ec",
  paper: "#fffefb",
  ink: "#292e24",
  muted: "#73786b",
  accent: "#65704f",
  accentSoft: "#e9eddf",
  border: "#dfdfd3",
  terra: "#b46d48",
};
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Number(v) : min));
export function formatTime(seconds: number, long = false) {
  const n = Math.floor(Math.max(0, Number(seconds) || 0));
  const h = Math.floor(n / 3600),
    m = Math.floor((n % 3600) / 60),
    s = n % 60;
  return h || long
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
export function listeningLength(seconds: number) {
  if (!(seconds > 0)) return "Audio included";
  const h = Math.floor(seconds / 3600),
    m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}
export function segmentAt(segments: Segment[], time: number) {
  if (!segments?.length || time < segments[0].start) return -1;
  let lo = 0,
    hi = segments.length - 1;
  while (lo < hi) {
    const m = Math.ceil((lo + hi) / 2);
    if (segments[m].start <= time) lo = m;
    else hi = m - 1;
  }
  return lo;
}
export function globalPosition(
  chapters: Chapter[],
  chapter: number,
  time: number,
) {
  return (
    chapters.slice(0, chapter).reduce((n, x) => n + x.duration, 0) +
    clamp(time, 0, chapters[chapter]?.duration || 0)
  );
}
export function locatePosition(chapters: Chapter[], time: number) {
  let remaining = clamp(
    time,
    0,
    chapters.reduce((n, x) => n + x.duration, 0),
  );
  for (let i = 0; i < chapters.length; i++) {
    if (remaining < chapters[i].duration || i === chapters.length - 1)
      return { chapter: i, time: remaining };
    remaining -= chapters[i].duration;
  }
  return { chapter: 0, time: 0 };
}
/** References stay directly accessible while ordinary listening follows the main text. */
export function adjacentListeningChapter(
  chapters: Chapter[],
  from: number,
  direction: 1 | -1,
): number | null {
  for (let i = from + direction; i >= 0 && i < chapters.length; i += direction)
    if (!chapters[i].skipByDefault) return i;
  return null;
}
export function firstListeningChapter(chapters: Chapter[]) {
  return adjacentListeningChapter(chapters, -1, 1) ?? 0;
}
export function skipListeningPosition(
  chapters: Chapter[],
  chapter: number,
  time: number,
  seconds: number,
) {
  if (!chapters.length) return { chapter: 0, time: 0 };
  let index = Math.trunc(clamp(chapter, 0, chapters.length - 1)),
    remaining =
      clamp(time, 0, chapters[index].duration) +
      (Number.isFinite(seconds) ? seconds : 0);
  while (remaining < 0) {
    const previous = adjacentListeningChapter(chapters, index, -1);
    if (previous === null) return { chapter: index, time: 0 };
    index = previous;
    remaining += chapters[index].duration;
  }
  while (remaining >= chapters[index].duration) {
    const next = adjacentListeningChapter(chapters, index, 1);
    if (next === null)
      return { chapter: index, time: chapters[index].duration };
    remaining -= chapters[index].duration;
    index = next;
  }
  return { chapter: index, time: remaining };
}
export function validateTimedBook(
  data: unknown,
  audioNames: string[],
  pageCount: number,
): Chapter[] {
  const d = data as { chapters?: Array<Record<string, unknown>> };
  if (!d || !Array.isArray(d.chapters) || !d.chapters.length)
    throw new Error("The timing file needs a chapters list.");
  return d.chapters.map((chapter, i) => {
    if (
      chapter.skipByDefault !== undefined &&
      typeof chapter.skipByDefault !== "boolean"
    )
      throw Error("Chapter skip preference must be true or false.");
    const file = String(chapter.file || chapter.audio || "")
      .split("/")
      .pop()!;
    if (!audioNames.includes(file))
      throw new Error(
        `Choose the audio file “${file || `chapter ${i + 1}`}” too.`,
      );
    const duration = Number(chapter.duration);
    if (!(duration > 0) || !Number.isFinite(duration))
      throw new Error("Each timed chapter needs a positive duration.");
    if (chapter.segments !== undefined && !Array.isArray(chapter.segments))
      throw Error("Chapter passages must be a list.");
    let previous = -1;
    const source = (chapter.segments || []) as Segment[];
    const segments = source.map((s, segmentIndex) => {
      const start = Number(s.start),
        end = Number(s.end),
        page = Number(s.page);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        start < previous ||
        end <= start ||
        end > duration + 0.2 ||
        !Number.isInteger(page) ||
        page < 1 ||
        page > pageCount ||
        typeof s.text !== "string" ||
        !s.text.trim()
      )
        throw new Error("A passage has an invalid time, page number or text.");
      previous = end;
      if (
        s.continuesPreviousWord !== undefined &&
        (typeof s.continuesPreviousWord !== "boolean" ||
          (s.continuesPreviousWord &&
            (!segmentIndex ||
              source[segmentIndex - 1].continuesPreviousWord === true ||
              !/[\p{L}\p{N}]$/u.test(source[segmentIndex - 1].text) ||
              !/^[\p{L}\p{N}]/u.test(s.text))))
      )
        throw Error("A continued word needs adjacent source fragments.");
      let repairEnd = 0;
      if (s.readingEdits !== undefined) {
        if (!Array.isArray(s.readingEdits) || s.readingEdits.length > 100)
          throw Error("Reading repairs must be a bounded list.");
        for (const edit of s.readingEdits) {
          if (
            !edit ||
            !Number.isSafeInteger(edit.from) ||
            !Number.isSafeInteger(edit.to) ||
            edit.from < repairEnd ||
            edit.to <= edit.from ||
            edit.to > s.text.length ||
            edit.text !== ""
          )
            throw Error("A reading repair has invalid source offsets.");
          repairEnd = edit.to;
        }
      }
      let words: WordCue[] | undefined;
      if (s.words !== undefined) {
        if (!Array.isArray(s.words) || s.words.length > s.text.length)
          throw Error("Word timing data is invalid.");
        let previousTime = start,
          previousOffset = 0;
        words = s.words.map((w) => {
          if (
            !w ||
            !Number.isFinite(w.start) ||
            !Number.isFinite(w.end) ||
            w.start < previousTime - 0.001 ||
            w.start < start ||
            w.end <= w.start ||
            w.end > end + 0.001 ||
            !Number.isSafeInteger(w.from) ||
            !Number.isSafeInteger(w.to) ||
            w.from < previousOffset ||
            w.to <= w.from ||
            w.to > s.text.length ||
            !s.text.slice(w.from, w.to).trim()
          )
            throw Error("A word has invalid audio timing or text offsets.");
          previousTime = w.end;
          previousOffset = w.to;
          return { start: w.start, end: w.end, from: w.from, to: w.to };
        });
      }
      return {
        start,
        end,
        page,
        text: s.text,
        ...(words ? { words } : {}),
        ...(s.continuesPreviousWord !== undefined
          ? { continuesPreviousWord: s.continuesPreviousWord }
          : {}),
        ...(s.readingEdits
          ? { readingEdits: s.readingEdits.map((e) => ({ ...e })) }
          : {}),
      };
    });
    return {
      ...(chapter.skipByDefault !== undefined
        ? { skipByDefault: chapter.skipByDefault as boolean }
        : {}),
      title: String(chapter.title || `Chapter ${i + 1}`),
      file,
      audio: file,
      duration,
      segments,
    };
  });
}
export function validateBook(value: unknown): Book {
  const b = value as Book;
  if (
    !b ||
    typeof b.id !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(b.id) ||
    typeof b.author !== "string" ||
    typeof b.pdf !== "string" ||
    !b.pdf ||
    typeof b.title !== "string" ||
    !Array.isArray(b.chapters) ||
    !b.chapters.length ||
    !Number.isInteger(b.pageCount) ||
    b.pageCount < 1 ||
    b.chapters.some(
      (c) =>
        !c ||
        typeof c.audio !== "string" ||
        !c.audio ||
        (c.file !== undefined && typeof c.file !== "string") ||
        (c.firstPage !== undefined &&
          (!Number.isInteger(c.firstPage) ||
            c.firstPage < 1 ||
            c.firstPage > b.pageCount)),
    )
  )
    throw new Error("This book file is incomplete.");
  if (b.sourceBookId !== undefined &&
      (typeof b.sourceBookId !== "string" || !/^[A-Za-z0-9_-]+$/.test(b.sourceBookId)))
    throw Error("A narration has an invalid source book.");
  if (b.preparedNarrations !== undefined &&
      (!b.preparedNarrations || typeof b.preparedNarrations !== "object" ||
       Array.isArray(b.preparedNarrations) ||
       Object.entries(b.preparedNarrations).some(([kind, url]) =>
         kind !== "piper" || typeof url !== "string" ||
         !url.startsWith(`/books/${b.id}/`) ||
         !/^\/books\/[A-Za-z0-9_-]+\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(url))))
    throw Error("A prepared narration has an invalid address.");
  if (
    b.editions !== undefined &&
    (!Array.isArray(b.editions) ||
      b.editions.length > 8 ||
      b.editions.some(
        (e) =>
          !e ||
          typeof e.label !== "string" ||
          e.label.length > 80 ||
          !["pdf", "epub"].includes(e.kind) ||
          typeof e.url !== "string" ||
          (e.pageCount !== undefined &&
            (!Number.isInteger(e.pageCount) ||
              e.pageCount < 1 ||
              e.pageCount > b.pageCount)) ||
          !e.url.startsWith(`/books/${b.id}/`) ||
          e.url.split("/").some((part) => part === "." || part === "..") ||
          !e.url.endsWith("." + e.kind) ||
          !/^\/books\/[A-Za-z0-9_-]+\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:pdf|epub)$/.test(
            e.url,
          ),
      ))
  )
    throw Error("A book edition has an invalid address.");
  if (
    b.credits !== undefined &&
    (typeof b.credits !== "string" ||
      !b.credits.startsWith(`/books/${b.id}/`) ||
      b.credits.split("/").some((part) => part === "." || part === "..") ||
      !/^\/books\/[A-Za-z0-9_-]+\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.txt$/.test(
        b.credits,
      ))
  )
    throw Error("Book credits have an invalid address.");
  const chapters = validateTimedBook(
    b,
    b.chapters.map((c) => (c.file || c.audio).split("/").pop()!),
    b.pageCount,
  ).map((c, i) => ({
    ...c,
    audio: b.chapters[i].audio,
    firstPage: b.chapters[i].firstPage || c.segments[0]?.page || 1,
  }));
  return {
    ...b,
    chapters,
    duration: chapters.reduce((n, c) => n + c.duration, 0),
  };
}

export * from "./reader-account";
export * from "./narration-position";

export * from "./reading";
export * from "./word-following";

export * from "./account-details";
export * from "./shared-book";
