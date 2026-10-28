"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowsOut,
  ArrowsIn,
  BookmarkSimple,
  BookOpen,
  Check,
  DownloadSimple,
  FilePdf,
  Headphones,
  Highlighter,
  Leaf,
  NotePencil,
  Pause,
  Play,
  TextAa,
  X,
} from "@phosphor-icons/react";
import {
  clamp,
  paginateReading,
  readingAnchorAt,
  readingAppearance,
  readingPageAt,
  readingWordBudget,
  readingProgress,
  readingParagraphs,
  readingDisplay,
  narrationParts,
  narrationOffset,
  activeWord,
  segmentAt,
  adjacentListeningChapter,
  type Bookmark,
  type Progress,
  type ReaderNote,
  type ReadingAnchor,
  type ReadingAppearance,
  type ReadingFragment,
} from "@pagechime/core";
import { useAccount } from "../lib/account";
import type { Playback } from "../lib/playback";
import { PdfPage } from "./PdfPage";
import { useReaderFullscreen } from "../lib/reader-fullscreen";
import Modal from "./Modal";

export type AnnotationDraft = {
  quote: string;
  chapter: number;
  page: number;
  time: number;
  segment: number;
  offset: number;
  endSegment: number;
  endOffset: number;
};
export type ReadingLocation = {
  bookId: string;
  anchor: ReadingAnchor;
  follow: boolean;
  mode: "text" | "pdf";
};
type Props = {
  onReadingPosition: (location: ReadingLocation) => void;
  p: Playback;
  addMark: (location?: Partial<Bookmark>) => void;
  notes: ReaderNote[];
  onAnnotate: (draft: AnnotationDraft, kind: "note" | "highlight") => void;
  theme: string;
  onTheme: (theme: string) => void;
  offline: () => void;
  offlineLabel: string;
  isOffline: boolean;
};
function markedText(
  fragment: ReadingFragment,
  notes: ReaderNote[],
  segment: import("@pagechime/core").Segment,
  current: number | undefined,
) {
  return narrationParts(
    fragment,
    notes,
    segment.words,
    segment.readingEdits,
  ).map((part, i) => {
    const text =
      part.wordFrom === undefined ? (
        part.text
      ) : (
        <span
          data-word-from={part.wordFrom}
          className={part.wordFrom === current ? "spoken-word" : undefined}
        >
          {part.text}
        </span>
      );
    return part.highlighted ? (
      <mark key={i}>{text}</mark>
    ) : (
      <span key={i}>{text}</span>
    );
  });
}

export default function BookReader({
  p,
  onReadingPosition,
  addMark,
  notes,
  onAnnotate,
  theme,
  onTheme,
  offline,
  offlineLabel,
  isOffline,
}: Props) {
  const {
    storage: { readSaved, writeSaved },
  } = useAccount();
  const book = p.book!,
    audioChapter = book.chapters[p.chapter];
  const audioIndex = segmentAt(audioChapter.segments, p.time);
  const request =
    p.readingRequest?.bookId === book.id ? p.readingRequest : null;
  const savedPlace = readSaved<Progress | null>(
    "progress." + book.id,
    null,
  )?.reading;
  const initialPlace = request?.anchor ?? savedPlace;
  const [follow, setFollow] = useState(
    book.timing === "audio-only"
      ? false
      : (request?.follow ?? readSaved("follow." + book.id, !initialPlace)),
  );
  const [appearance, setAppearance] = useState(() =>
    readingAppearance(readSaved("reading.appearance", null)),
  );
  const [anchor, setAnchor] = useState<ReadingAnchor>(() =>
    initialPlace &&
    Number.isInteger(initialPlace.chapter) &&
    initialPlace.chapter >= 0 &&
    initialPlace.chapter < book.chapters.length
      ? initialPlace
      : { chapter: p.chapter, segment: Math.max(0, audioIndex), offset: 0 },
  );
  const readingChapter = clamp(anchor.chapter, 0, book.chapters.length - 1),
    chapter = book.chapters[readingChapter];
  const previousReadingChapter = useRef(readingChapter);
  const [mode, setMode] = useState<"text" | "pdf">(() => {
    const saved = readSaved(
      "view." + book.id,
      chapter.segments.length ? "text" : "pdf",
    );
    return saved === "pdf" || !chapter.segments.length ? "pdf" : "text";
  });
  const [pdfEdition, setPdfEdition] = useState(() => {
    const saved = readSaved<unknown>("pdf.edition." + book.id, null);
    return typeof saved === "string" &&
      (saved === book.pdf ||
        book.editions?.some((e) => e.kind === "pdf" && e.url === saved))
      ? saved
      : book.pdf;
  });
  const { isGuest } = useAccount();
  const pdfPageCount =
    book.editions?.find((e) => e.url === pdfEdition)?.pageCount ||
    book.pageCount;
  useEffect(() => {
    if (mode === "pdf" && p.page > pdfPageCount) p.setPage(pdfPageCount);
  }, [pdfEdition, pdfPageCount, mode, p.page]);
  useEffect(() => {
    writeSaved("pdf.edition." + book.id, pdfEdition);
  }, [book.id, pdfEdition]);
  const [size, setSize] = useState({ width: 650, height: 560 });
  const {
    active: focus,
    toggle: toggleFullscreen,
    notice: fullscreenNotice,
  } = useReaderFullscreen();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [selection, setSelection] = useState<AnnotationDraft | null>(null);
  const paper = useRef<HTMLDivElement>(null),
    prose = useRef<HTMLElement>(null),
    touch = useRef<{ x: number; y: number } | null>(null);
  const budget = readingWordBudget(
    size.width,
    size.height,
    appearance.size,
    appearance.leading,
  );
  const pages = useMemo(
    () => paginateReading(chapter.segments, budget),
    [chapter.segments, budget],
  );
  const pageIndex = readingPageAt(pages, anchor.segment, anchor.offset);
  const visible = pages[pageIndex];
  const chapterNotes = notes.filter(
    (n) => n.bookId === book.id && n.chapter === readingChapter,
  );
  useEffect(() => {
    const el = paper.current;
    if (!el) return;
    const resize = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    return () => observer.disconnect();
  }, [mode, appearance.width]);
  const [, setWordClock] = useState(p.time);
  useEffect(() => {
    let frame = 0,
      previous = "";
    const sample = () => {
      const time = p.clock(),
        index = segmentAt(audioChapter.segments, time),
        cue = activeWord(audioChapter.segments[index], time);
      const key = index + ":" + (cue?.from ?? "gap");
      if (key !== previous) {
        previous = key;
        setWordClock(time);
      }
      if (p.playing) frame = requestAnimationFrame(sample);
    };
    if (p.playing) sample();
    else setWordClock(p.time);
    return () => cancelAnimationFrame(frame);
  }, [
    p.playing,
    p.chapter,
    p.clock,
    p.playing ? null : p.time,
    audioChapter,
    request?.id,
  ]);
  const trackingTime = p.loading || !p.playing ? p.time : p.clock();
  const trackingIndex = segmentAt(audioChapter.segments, trackingTime);
  const activeIndex = readingChapter === p.chapter ? trackingIndex : -1;
  const spoken = audioChapter.segments[trackingIndex];
  const currentWord =
    readingChapter === p.chapter ? activeWord(spoken, trackingTime) : null;
  const spokenOffset = narrationOffset(spoken, trackingTime);
  const narratorPage = readingPageAt(
    pages,
    Math.max(0, trackingIndex),
    spokenOffset,
  );
  const pendingFollow = useRef<ReadingAnchor | null>(
    request?.preserve ? request.anchor : null,
  );
  useEffect(() => {
    if (!request) return;
    pendingFollow.current = request.preserve ? request.anchor : null;
    setAnchor(request.anchor);
    setFollow(request.follow);
  }, [request?.id, book.id]);
  useEffect(() => {
    onReadingPosition({
      bookId: book.id,
      anchor:
        follow && !pendingFollow.current
          ? {
              chapter: p.chapter,
              segment: Math.max(0, trackingIndex),
              offset: spokenOffset,
            }
          : anchor,
      follow,
      mode,
    });
  }, [
    book.id,
    anchor,
    follow,
    mode,
    p.chapter,
    trackingIndex,
    spokenOffset,
    onReadingPosition,
  ]);
  useEffect(() => {
    if (follow && !p.loading && book.timing !== "audio-only") {
      const pending = pendingFollow.current;
      if (
        pending &&
        pending.chapter === p.chapter &&
        pending.segment === trackingIndex &&
        spokenOffset < pending.offset
      )
        return;
      pendingFollow.current = null;
      setAnchor({
        chapter: p.chapter,
        segment: Math.max(0, trackingIndex),
        offset: spokenOffset,
      });
      const page = spoken?.page || audioChapter.firstPage || 1;
      if (p.page !== page) p.setPage(page);
    }
  }, [
    p.chapter,
    trackingIndex,
    narratorPage,
    book.timing,
    follow,
    request?.id,
    p.loading,
    pendingFollow.current ? spokenOffset : undefined,
  ]);
  useEffect(() => {
    if (!chapter.segments.length) {
      setMode("pdf");
      if (
        previousReadingChapter.current !== readingChapter &&
        book.timing !== "audio-only"
      )
        p.setPage(chapter.firstPage || 1);
    }
    previousReadingChapter.current = readingChapter;
  }, [readingChapter, chapter.segments, book.timing]);
  useEffect(() => {
    writeSaved("view." + book.id, mode);
    writeSaved("follow." + book.id, follow);
  }, [book.id, mode, follow]);
  useEffect(() => {
    writeSaved("reading.appearance", appearance);
  }, [appearance]);
  useEffect(() => {
    setAppearance((a) => ({
      ...a,
      surface:
        theme === "night"
          ? "night"
          : a.surface === "night"
            ? "paper"
            : a.surface,
    }));
  }, [theme]);
  useEffect(() => {
    paper.current?.scrollTo({ top: 0 });
    setSelection(null);
  }, [pageIndex, readingChapter]);
  useEffect(() => {
    if (
      !follow ||
      mode !== "text" ||
      !currentWord ||
      !paper.current ||
      !prose.current
    )
      return;
    const word = prose.current.querySelector<HTMLElement>(
      `[data-segment="${trackingIndex}"] [data-word-from="${currentWord.from}"]`,
    );
    if (!word) return;
    const bounds = paper.current.getBoundingClientRect(),
      target = word.getBoundingClientRect();
    if (target.bottom > bounds.bottom - 24)
      paper.current.scrollTop += target.bottom - bounds.bottom + 24;
    else if (target.top < bounds.top + 24)
      paper.current.scrollTop += target.top - bounds.top - 24;
  }, [
    follow,
    mode,
    currentWord?.from,
    trackingIndex,
    pageIndex,
    readingChapter,
  ]);
  function remember(next: ReadingAnchor) {
    setAnchor(next);
    const old = readSaved<Progress | null>("progress." + book.id, null);
    writeSaved("progress." + book.id, {
      ...old,
      chapter: p.chapter,
      time: p.time,
      page: p.page,
      reading: next,
      updated: Date.now(),
    });
  }
  function turn(direction: number) {
    setFollow(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    if (mode === "pdf") {
      p.setPage(clamp(p.page + direction, 1, pdfPageCount));
      return;
    }
    const next = pageIndex + direction;
    if (next >= 0 && next < pages.length)
      remember(readingAnchorAt(pages, next, readingChapter));
    else {
      const target = adjacentListeningChapter(
        book.chapters,
        readingChapter,
        direction < 0 ? -1 : 1,
      );
      if (target === null) return;
      const segs = book.chapters[target].segments,
        last = Math.max(0, segs.length - 1);
      remember({
        chapter: target,
        segment: direction < 0 ? last : 0,
        offset:
          direction < 0 ? Math.max(0, (segs[last]?.text.length || 1) - 1) : 0,
      });
    }
  }

  const first = visible?.fragments[0];
  function bookmark() {
    if (mode === "pdf" || !first) {
      addMark();
      return;
    }
    const seg = chapter.segments[first.segment];
    addMark({
      chapter: readingChapter,
      time: seg.start,
      page: seg.page,
      text: first.text,
      reading: readingAnchorAt(pages, pageIndex, readingChapter),
    } as Partial<Bookmark>);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        document.querySelector("dialog[open]") ||
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        turn(e.key === "ArrowRight" ? 1 : -1);
      }
      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.metaKey) bookmark();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });
  function chooseSurface(surface: ReadingAppearance["surface"]) {
    setAppearance((a) => ({ ...a, surface }));
    onTheme(surface === "night" ? "night" : "paper");
  }
  function captureSelection() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount || !prose.current) {
      setSelection(null);
      return;
    }
    const range = s.getRangeAt(0);
    if (
      !prose.current.contains(range.startContainer) ||
      !prose.current.contains(range.endContainer)
    )
      return;
    const part = (node: Node, offset: number) => {
      const el = (
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node.parentElement
      )?.closest<HTMLElement>("[data-fragment]");
      if (!el) return null;
      const r = document.createRange();
      r.selectNodeContents(el);
      r.setEnd(node, offset);
      return {
        segment: Number(el.dataset.segment),
        offset: el.dataset.offsets
          ? JSON.parse(el.dataset.offsets)[r.toString().length]
          : Number(el.dataset.start) + r.toString().length,
      };
    };
    const start = part(range.startContainer, range.startOffset),
      end = part(range.endContainer, range.endOffset);
    const quote = s.toString().trim();
    if (!start || !end || !quote || quote.length > 2000) {
      setSelection(null);
      return;
    }
    const seg = chapter.segments[start.segment];
    setFollow(false);
    setSelection({
      quote,
      chapter: readingChapter,
      page: seg.page,
      time: seg.start,
      segment: start.segment,
      offset: start.offset,
      endSegment: end.segment,
      endOffset: end.offset,
    });
  }
  const previousDisabled =
    mode === "pdf"
      ? p.page <= 1
      : pageIndex === 0 &&
        adjacentListeningChapter(book.chapters, readingChapter, -1) === null;
  const nextDisabled =
    mode === "pdf"
      ? p.page >= pdfPageCount
      : pageIndex >= pages.length - 1 &&
        adjacentListeningChapter(book.chapters, readingChapter, 1) === null;
  return (
    <section
      className="ebook-reader"
      data-surface={appearance.surface}
      data-width={appearance.width}
      aria-label="Interactive book reader"
    >
      <div className="ebook-heading">
        <div>
          <p className="eyebrow">YOUR READING ROOM</p>
          <h1>{book.title}</h1>
          <p>
            <span className="reader-chapter-title">{chapter.title}</span>
            <span>·</span> Chapter {readingChapter + 1} of{" "}
            {book.chapters.length}
          </p>
        </div>
        <div className="ebook-actions">
          <button
            className="icon-button"
            aria-label="Bookmark this moment"
            title="Bookmark this moment"
            onClick={bookmark}
          >
            <BookmarkSimple />
          </button>
          <button
            className="fullscreen-button"
            aria-label={focus ? "Exit fullscreen" : "Enter fullscreen"}
            aria-pressed={focus}
            onClick={() => void toggleFullscreen()}
          >
            {focus ? <ArrowsIn /> : <ArrowsOut />}
            <span>{focus ? "Exit" : "Fullscreen"}</span>
          </button>
        </div>
      </div>
      {focus && fullscreenNotice && (
        <p className="fullscreen-notice" role="status">
          {fullscreenNotice}
        </p>
      )}
      <div className="ebook-tools">
        <div className="view-switch" aria-label="Reading view">
          <button
            aria-pressed={mode === "text"}
            className={mode === "text" ? "active" : ""}
            onClick={() => setMode("text")}
            disabled={!chapter.segments.length}
          >
            <BookOpen size={16} />
            Reading
          </button>
          <button
            aria-pressed={mode === "pdf"}
            className={mode === "pdf" ? "active" : ""}
            onClick={() => setMode("pdf")}
          >
            <FilePdf size={16} />
            Original PDF
          </button>
        </div>
        {mode === "pdf" && book.editions?.some((e) => e.kind === "pdf") && (
          <label className="edition-choice">
            Edition
            <select
              aria-label="PDF edition"
              value={pdfEdition}
              onChange={(e) => setPdfEdition(e.target.value)}
            >
              {!book.editions.some(
                (e) => e.kind === "pdf" && e.url === book.pdf,
              ) && <option value={book.pdf}>Page-matched PDF</option>}
              {book.editions
                .filter((e) => e.kind === "pdf")
                .map((e) => (
                  <option key={e.url} value={e.url}>
                    {e.label}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="ebook-tool-actions">
          <button
            className={`ebook-follow ${follow ? "is-following" : ""}`}
            aria-label={follow ? "Following audio" : "Follow audio"}
            aria-pressed={follow}
            disabled={!chapter.segments.length}
            onClick={() => {
              pendingFollow.current = null;
              setFollow(!follow);
            }}
          >
            <Headphones size={16} />
            <span>{follow ? "Following audio" : "Follow audio"}</span>
          </button>
          <button
            className="appearance-trigger"
            aria-label="Reading appearance"
            aria-haspopup="dialog"
            aria-expanded={appearanceOpen}
            onClick={() => setAppearanceOpen(true)}
          >
            <TextAa size={23} />
            <span>Appearance</span>
          </button>
          {appearanceOpen && (
            <Modal
              title="Make yourself comfortable."
              className="appearance-panel"
              closeLabel="Close reading appearance"
              onClose={() => setAppearanceOpen(false)}
              footer={
                <button
                  className="primary-button"
                  onClick={() => setAppearanceOpen(false)}
                >
                  Done
                </button>
              }
            >
              <p>Set the page to your pace.</p>
              <div className="appearance-size">
                <span>Text size</span>
                <button
                  aria-label="Smaller text"
                  disabled={appearance.size <= 17}
                  onClick={() =>
                    setAppearance((a) => ({ ...a, size: a.size - 1 }))
                  }
                >
                  A−
                </button>
                <output aria-label="Reading text size">
                  {appearance.size}
                </output>
                <button
                  aria-label="Larger text"
                  disabled={appearance.size >= 32}
                  onClick={() =>
                    setAppearance((a) => ({ ...a, size: a.size + 1 }))
                  }
                >
                  A+
                </button>
              </div>
              <fieldset>
                <legend>Typeface</legend>
                <div>
                  {(["serif", "sans"] as const).map((font) => (
                    <button
                      key={font}
                      aria-pressed={appearance.font === font}
                      onClick={() => setAppearance((a) => ({ ...a, font }))}
                    >
                      {font === "serif" ? "Book serif" : "Clean sans"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Line spacing</legend>
                <div>
                  {[1.5, 1.75, 2].map((leading, i) => (
                    <button
                      key={leading}
                      aria-pressed={appearance.leading === leading}
                      onClick={() => setAppearance((a) => ({ ...a, leading }))}
                    >
                      {["Compact", "Comfort", "Airy"][i]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Page width</legend>
                <div>
                  {(["comfortable", "wide"] as const).map((width) => (
                    <button
                      key={width}
                      aria-pressed={appearance.width === width}
                      onClick={() => setAppearance((a) => ({ ...a, width }))}
                    >
                      {width === "wide" ? "Wide" : "Comfortable"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Page colour</legend>
                <div>
                  {(["paper", "sepia", "night"] as const).map((surface) => (
                    <button
                      className={`surface-${surface}`}
                      key={surface}
                      aria-pressed={appearance.surface === surface}
                      onClick={() => chooseSurface(surface)}
                    >
                      {surface[0].toUpperCase() + surface.slice(1)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </Modal>
          )}
          <button
            className="icon-button ebook-download"
            aria-label={offlineLabel}
            title={offlineLabel}
            onClick={offline}
            disabled={
              offlineLabel.startsWith("Saving") ||
              offlineLabel.startsWith("Starting")
            }
            aria-pressed={isOffline}
          >
            <DownloadSimple />
          </button>
        </div>
      </div>
      {mode === "pdf" ? (
        <div className="reading-page pdf-page">
          <PdfPage url={pdfEdition} page={p.page} />
        </div>
      ) : (
        <div
          className="ebook-paper"
          ref={paper}
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
          onTouchStart={(e) => {
            touch.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
          }}
          onTouchEnd={(e) => {
            const t = touch.current;
            touch.current = null;
            if (!t || window.getSelection()?.toString()) return;
            const dx = e.changedTouches[0].clientX - t.x,
              dy = e.changedTouches[0].clientY - t.y;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.7)
              turn(dx < 0 ? 1 : -1);
            else captureSelection();
          }}
        >
          <header className="ebook-running-head">
            <span>{book.title}</span>
            <Leaf size={16} />
          </header>
          <article
            ref={prose}
            className={`ebook-prose font-${appearance.font}`}
            aria-label="Book text"
            style={
              {
                fontSize: appearance.size,
                lineHeight: appearance.leading,
              } as CSSProperties
            }
          >
            {pageIndex === 0 && (
              <div className="ebook-chapter-opening">
                <span>
                  CHAPTER {String(readingChapter + 1).padStart(2, "0")}
                </span>
                <h2>{chapter.title}</h2>
                <div />
              </div>
            )}
            {readingParagraphs(visible).map((group) => {
              const f = group[0];
              const spoken = group.some((part) => part.segment === activeIndex);
              return (
                <p
                  key={`${f.segment}-${f.start}`}
                  className={`passage ebook-passage ${f.heading ? "passage-heading" : ""} ${spoken ? "spoken" : ""}`}
                  aria-current={spoken ? "true" : undefined}
                >
                  <button
                    className="passage-listen"
                    aria-label={`Listen from: ${f.text.slice(0, 95)}`}
                    title="Listen from here"
                    onClick={() => {
                      p.load(
                        readingChapter,
                        chapter.segments[f.segment].start,
                        true,
                      );
                      setFollow(true);
                    }}
                  >
                    <Play size={13} weight="fill" />
                  </button>
                  {group.map((f) => (
                    <span
                      key={`${f.segment}-${f.start}`}
                      data-fragment="true"
                      data-segment={f.segment}
                      data-start={f.start}
                      data-offsets={
                        chapter.segments[f.segment].readingEdits?.length
                          ? JSON.stringify(
                              readingDisplay(
                                f,
                                chapter.segments[f.segment].readingEdits,
                              ).offsets,
                            )
                          : undefined
                      }
                    >
                      {markedText(
                        f,
                        chapterNotes,
                        chapter.segments[f.segment],
                        f.segment === trackingIndex
                          ? currentWord?.from
                          : undefined,
                      )}
                    </span>
                  ))}
                </p>
              );
            })}
            {pageIndex === pages.length - 1 && (
              <div
                className="ebook-chapter-ending"
                role="separator"
                aria-label={
                  readingChapter === book.chapters.length - 1
                    ? "End of book"
                    : "End of chapter"
                }
              >
                <span />
                <Leaf size={18} />
                <span />
              </div>
            )}
          </article>
          <footer className="ebook-running-foot">
            <span>PAGECHIME</span>
            <span>{pageIndex + 1}</span>
          </footer>
        </div>
      )}
      {selection && (
        <div
          className="quotation-actions"
          role="region"
          aria-label="Selected quotation"
        >
          <p>“{selection.quote}”</p>
          <div>
            <button
              onClick={() => {
                onAnnotate(selection, "highlight");
                setSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <Highlighter size={18} />
              Highlight
            </button>
            <button
              onClick={() => {
                onAnnotate(selection, "note");
                setSelection(null);
              }}
            >
              <NotePencil size={18} />
              Add note
            </button>
            <button
              className="icon-button"
              aria-label="Dismiss selection"
              onClick={() => {
                setSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}
      <nav
        className="ebook-page-navigation"
        aria-label={mode === "pdf" ? "PDF pages" : "Reading pages"}
      >
        <button
          className="ebook-page-turn"
          aria-label={
            mode === "pdf" ? "Previous PDF page" : "Previous reading page"
          }
          disabled={previousDisabled}
          onClick={() => turn(-1)}
        >
          <ArrowLeft size={19} />
          <span>Previous</span>
        </button>
        <div className="ebook-page-status">
          {mode === "pdf" ? (
            <label>
              Page{" "}
              <input
                aria-label="PDF page number"
                type="number"
                min={1}
                max={pdfPageCount}
                value={p.page}
                onChange={(e) => {
                  setFollow(false);
                  p.setPage(clamp(Number(e.target.value), 1, pdfPageCount));
                }}
              />{" "}
              of {pdfPageCount}
            </label>
          ) : (
            <>
              <span aria-live="polite">
                Page {pageIndex + 1} of {Math.max(1, pages.length)}
              </span>
              <small>
                in this chapter ·{" "}
                {readingProgress(
                  book.chapters,
                  readingAnchorAt(pages, pageIndex, readingChapter),
                )}
                % through the book
              </small>
            </>
          )}
        </div>
        <button
          className="ebook-page-turn"
          aria-label={mode === "pdf" ? "Next PDF page" : "Next reading page"}
          disabled={nextDisabled}
          onClick={() => turn(1)}
        >
          <span>Next</span>
          <ArrowRight size={19} />
        </button>
      </nav>
      {!follow && mode === "text" && (
        <button className="ebook-resume" onClick={() => setFollow(true)}>
          <Headphones size={16} />
          Return to the narrator
          <ArrowRight size={15} />
        </button>
      )}
      {!!book.editions?.length && (
        <details className="book-editions">
          <summary>Book editions & downloads</summary>
          <p>
            Read here with adjustable text, or keep an edition for your
            preferred reader. The cozy PDF also includes the workbook fields.
          </p>
          <div>
            {book.editions.map((edition) =>
              isGuest ? (
                <button key={edition.url} onClick={offline}>
                  {edition.label} · Sign in to download
                </button>
              ) : (
                <a key={edition.url} href={edition.url} download>
                  {edition.label} <DownloadSimple size={16} />
                </a>
              ),
            )}
          </div>
          {book.credits && (
            <a href={book.credits} target="_blank" rel="noreferrer">
              Font credits
            </a>
          )}
        </details>
      )}
      {mode === "text" && first && (
        <div className="ebook-tip">
          <span>Select a sentence to keep it.</span>
          <button
            onClick={() => {
              const f = first,
                s = chapter.segments[f.segment];
              onAnnotate(
                {
                  quote: f.text.slice(0, 2000),
                  chapter: readingChapter,
                  page: s.page,
                  time: s.start,
                  segment: f.segment,
                  offset: f.start,
                  endSegment: f.segment,
                  endOffset: Math.min(f.end, f.start + 2000),
                },
                "note",
              );
            }}
          >
            <NotePencil size={16} />
            Make a note
          </button>
        </div>
      )}
    </section>
  );
}
