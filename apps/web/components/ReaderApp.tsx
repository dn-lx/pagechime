"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  Fragment,
} from "react";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmarks,
  BookmarkSimple,
  Check,
  CaretRight,
  Clock,
  DownloadSimple,
  Headphones,
  Leaf,
  List,
  MagnifyingGlass,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  SpeakerHigh,
  Sun,
  TextAa,
  UploadSimple,
  X,
  ArrowsOut,
  FilePdf,
  ArrowCounterClockwise,
  ArrowClockwise,
  DeviceMobile,
  Trash,
} from "@phosphor-icons/react";
import {
  type Book,
  type Bookmark,
  type Chapter,
  type Progress,
  clamp,
  formatTime,
  globalPosition,
  listeningLength,
  segmentAt,
  narrationPosition,
  validateBook,
  validateTimedBook,
} from "@pagechime/core";
import { materialize, type StoredBook } from "../lib/storage";
import { useAccount } from "../lib/account";
import { type ReaderNote } from "@pagechime/core";
import AccountPanel from "./AccountPanel";
import Modal from "./Modal";
import { usePlayback, type Playback } from "../lib/playback";
import { pdfLibrary } from "../lib/pdf";
import Reader, {
  type AnnotationDraft,
  type ReadingLocation,
} from "./BookReader";
const spring = { type: "spring" as const, stiffness: 280, damping: 30 };
function IconButton({
  label,
  onClick,
  children,
  active = false,
  className = "",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "selected" : ""} ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Cover({ book, small = false }: { book: Book; small?: boolean }) {
  return (
    <div
      className={`book-cover ${small ? "small" : ""}`}
      aria-label={`${book.title} cover`}
    >
      <div className="cover-spine" />
      <span className="cover-eyebrow">{book.author.toUpperCase()}</span>
      <div className="cover-name">
        {book.id === "manifest" ? (
          <>
            MANIFEST
            <br />
            <span>IN ACTION</span>
          </>
        ) : (
          book.title
        )}
      </div>
      <div className="cover-rule" />
      <span className="cover-subtitle">
        {book.subtitle || "A little time, a good book."}
      </span>
      <span className="cover-edition">{book.author}</span>
    </div>
  );
}
function AudioBars({ playing }: { playing: boolean }) {
  return (
    <span
      className={`audio-bars ${playing ? "playing" : ""}`}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
export default function ReaderApp() {
  const { account, isGuest, requestAccount, storage, logout, syncMessage } =
    useAccount();
  const {
    readSaved,
    writeSaved,
    getLocalBooks,
    putLocalBook,
    deleteLocalBook,
    cacheName,
  } = storage;
  const [notes, setNotes] = useState<ReaderNote[]>(() =>
    readSaved("notes", []),
  );
  const [noteText, setNoteText] = useState("");
  const [noteDraft, setNoteDraft] = useState<AnnotationDraft | null>(null);
  const [editingNote, setEditingNote] = useState<ReaderNote | null>(null);
  const [books, setBooks] = useState<Book[]>([]),
    [boot, setBoot] = useState(true),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [readerKey, setReaderKey] = useState(0),
    [drawer, setDrawer] = useState(false),
    [narrow, setNarrow] = useState(false),
    [modal, setModal] = useState(""),
    [theme, setTheme] = useState("paper"),
    [bookmarks, setBookmarks] = useState<Bookmark[]>([]),
    [tab, setTab] = useState<"chapters" | "marks">("chapters"),
    [notice, setNotice] = useState(""),
    [offlineBusy, setOfflineBusy] = useState(""),
    [offlineIds, setOfflineIds] = useState<string[]>([]),
    [installed, setInstalled] = useState(false);
  const prompt = useRef<(Event & { prompt: () => Promise<void> }) | null>(null),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    objects = useRef<string[]>([]);
  const notify = useCallback((text: string) => {
    setNotice(text);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setNotice(""), 4500);
  }, []);
  const p = usePlayback(notify, storage);
  const readingLocation = useRef<ReadingLocation | null>(null);
  const reportReadingPosition = useCallback((location: ReadingLocation) => {
    readingLocation.current = location;
  }, []);
  useEffect(() => {
    const query = matchMedia("(max-width: 767px)");
    const changed = () => {
      setNarrow(query.matches);
      if (!query.matches) setDrawer(false);
    };
    changed();
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  function openModal(name: string) {
    setDrawer(false);
    setModal(name);
  }
  const loadBooks = useCallback(async () => {
    setBoot(true);
    setError("");
    const localPromise = getLocalBooks()
      .then((records) => records.map(materialize))
      .catch(() => {
        notify("Local library storage is unavailable in this browser.");
        return [] as Book[];
      });
    let entries: Book[] = [],
      onlineFailed = false,
      libraryError = "";
    try {
      const r = await fetch("/library.json", { cache: "no-store" });
      if (!r.ok) throw Error("The library could not load.");
      let data: { books: { url: string }[] };
      try {
        data = await r.json();
      } catch {
        throw Error(
          "The library returned an unreadable response. Reload Pagechime and retry.",
        );
      }
      if (!data || !Array.isArray(data.books))
        throw Error(
          "The shared library catalog is incomplete. Please retry shortly.",
        );
      const results = await Promise.allSettled(
        (data.books || []).map(async (x: { url: string }) => {
          const u = new URL(x.url, location.href);
          if (u.origin !== location.origin)
            throw Error("A library file has an invalid address.");
          const res = await fetch(u);
          if (!res.ok) throw Error("A book could not load.");
          return validateBook(await res.json());
        }),
      );
      entries = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value as Book] : [],
      );
      if (results.some((r) => r.status === "rejected")) {
        onlineFailed = true;
        notify(
          "Some books could not load. Your saved imports are still available.",
        );
      }
    } catch (error) {
      onlineFailed = true;
      libraryError =
        error instanceof Error
          ? error.message
          : "The shared library could not load.";
      notify(
        isGuest
          ? "The shared library could not load. Please retry."
          : "The online library is unavailable. Your saved imports are still available.",
      );
    }
    const locals = await localPromise;
    locals.forEach((b) =>
      objects.current.push(b.pdf, ...b.chapters.map((c) => c.audio)),
    );
    setBooks([...entries, ...locals]);
    if (onlineFailed && !entries.length && !locals.length)
      setError(
        libraryError ||
          (isGuest
            ? "Check your connection and retry the shared library."
            : "Check your connection and retry, or add a book from your device."),
      );
    setBoot(false);
  }, [notify]);
  useEffect(() => {
    loadBooks();
    setTheme(readSaved("theme", "paper"));
    setBookmarks(readSaved("bookmarks", []));
    const handler = (e: Event) => {
      e.preventDefault();
      prompt.current = e as Event & { prompt: () => Promise<void> };
      setInstalled(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (!isGuest && "caches" in window)
      caches
        .open(cacheName)
        .then(async (cache) => {
          const keys = await cache.keys();
          setOfflineIds([
            ...new Set(
              keys
                .filter((k) => new URL(k.url).pathname.endsWith("/.complete"))
                .map((k) => /\/books\/([^/]+)\//.exec(k.url)?.[1])
                .filter(Boolean) as string[],
            ),
          ]);
        })
        .catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      objects.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [loadBooks]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeSaved("theme", theme);
  }, [theme]);
  const open = useCallback(
    (b: Book) => {
      p.open(b);
      setReading(true);
      setDrawer(false);
      setTab("chapters");
    },
    [p.open],
  );
  const addMark = useCallback(
    (location?: Partial<Bookmark>) => {
      if (isGuest) {
        openModal("join");
        return;
      }
      if (!p.book) return;
      const ch = p.book.chapters[p.chapter],
        seg = ch.segments[segmentAt(ch.segments, p.time)];
      const mark: Bookmark = {
        id: crypto.randomUUID(),
        bookId: p.book.id,
        chapter: p.chapter,
        time: p.time,
        page: p.page,
        text: seg?.text || ch.title,
        created: Date.now(),
        ...location,
      };
      const next = [mark, ...bookmarks];
      if (!writeSaved("bookmarks", next)) {
        notify("Your bookmark could not be saved. Please try again.");
        return;
      }
      setBookmarks(next);
      notify("A little bookmark, right here.");
    },
    [p.book, p.chapter, p.time, p.page, bookmarks, notify],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        el.closest(
          'input,textarea,select,button,[contenteditable="true"],dialog',
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        openModal("search");
        return;
      }
      if (!reading || !p.book) return;
      if (e.code === "Space") {
        e.preventDefault();
        p.toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reading, p.book, p.toggle, p.skip, addMark]);
  async function chooseNarration(kind: "kokoro" | "google" | "piper") {
    if (!p.book) {
      notify("Open a book to choose its narration.");
      return;
    }
    const base =
      books.find((b) => b.id === (p.book!.sourceBookId || p.book!.id)) ||
      p.book;
    try {
      let next = base;
      if (kind !== "kokoro") {
        const address =
          kind === "google"
            ? base.alternateNarration
            : base.preparedNarrations?.piper;
        if (!address) return;
        const url = new URL(address, location.href);
        if (
          url.origin !== location.origin ||
          !url.pathname.startsWith("/books/")
        )
          throw Error();
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw Error();
        next = validateBook(await response.json());
        if (
          next.narration !== kind ||
          (kind === "piper"
            ? next.id !== `${base.id}-piper` || next.sourceBookId !== base.id
            : next.id !== base.id)
        )
          throw Error();
      }
      if (next.id === p.book.id) {
        setModal("");
        return;
      }
      const visible =
        readingLocation.current?.bookId === p.book.id
          ? readingLocation.current
          : null;
      const position = narrationPosition(
        p.book,
        p.chapter,
        p.time,
        next,
        visible?.anchor,
      );
      if (!position.matched) {
        notify(
          "This passage is not available in that narration. Your reading place was kept.",
        );
        return;
      }
      if (visible) writeSaved("view." + next.id, visible.mode);
      p.load(position.chapter, position.time, p.playing, next, {
        anchor: position.reading,
        follow: visible?.follow ?? true,
        preserve: true,
      });
      setReaderKey((k) => k + 1);
      setReading(true);
      setModal("");
    } catch {
      notify("This narration could not open. Please try again.");
    }
  }
  async function offline(b: Book) {
    if (isGuest) {
      openModal("join");
      return;
    }
    if (b.local) {
      notify("Imported books are already saved on this device.");
      return;
    }
    if (!("caches" in window)) {
      notify(
        "Offline storage needs a supported browser and a secure connection.",
      );
      return;
    }
    setOfflineBusy("Starting…");
    const added: string[] = [];
    let downloadCache: Cache | null = null;
    try {
      const cache = await caches.open(cacheName);
      downloadCache = cache;
      if (offlineIds.includes(b.id)) {
        const keys = await cache.keys();
        await Promise.all(
          keys
            .filter((k) =>
              new URL(k.url).pathname.startsWith(`/books/${b.id}/`),
            )
            .map((k) => cache.delete(k)),
        );
        setOfflineIds((x) => x.filter((v) => v !== b.id));
        notify("Offline copy removed. Your bookmarks are kept.");
        return;
      }
      const urls = [
        `/books/${b.id}/book.json`,
        b.pdf,
        ...(b.cover ? [b.cover] : []),
        ...b.chapters.map((c) => c.audio),
      ];
      for (let i = 0; i < urls.length; i++) {
        setOfflineBusy(`Saving ${i + 1} of ${urls.length}`);
        const response = await fetch(urls[i]);
        if (
          !response.ok ||
          response.redirected ||
          response.headers.get("content-type")?.includes("text/html")
        )
          throw new Error("A book file could not be saved.");
        if (!(await cache.match(urls[i]))) added.push(urls[i]);
        await cache.put(urls[i], response);
      }
      const library = await fetch("/library.json");
      if (library.ok) await cache.put("/library.json", library);
      await cache.put(`/books/${b.id}/.complete`, new Response("ready"));
      setOfflineIds((x) => [...x, b.id]);
      notify("The whole book is saved for offline reading and listening.");
    } catch {
      if (downloadCache)
        await Promise.all(added.map((url) => downloadCache!.delete(url)));
      notify(
        "Offline saving could not finish. Check your connection or available storage and retry.",
      );
    } finally {
      setOfflineBusy("");
    }
  }
  async function removeBook(b: Book) {
    if (
      !confirm(`Remove “${b.title}” and its imported files from this device?`)
    )
      return;
    try {
      await deleteLocalBook(b.id);
      if (p.book?.id === b.id) {
        p.close();
        setReading(false);
      }
      setBooks((x) => x.filter((v) => v.id !== b.id));
      URL.revokeObjectURL(b.pdf);
      b.chapters.forEach((c) => URL.revokeObjectURL(c.audio));
      notify("Book removed from this device.");
    } catch {
      notify("The book could not be removed. Please try again.");
    }
  }
  const sidebar = (
    <>
      <button
        className="brand"
        onClick={() => {
          setReading(false);
          setDrawer(false);
        }}
        aria-label="Pagechime library"
      >
        <Leaf size={30} weight="duotone" />
        <span>
          Pagechime<span className="brand-dot">.</span>
        </span>
      </button>
      <p className="nav-label">YOUR LITTLE CORNER</p>
      <button
        className={`nav-item ${!reading ? "active" : ""}`}
        onClick={() => {
          setReading(false);
          setDrawer(false);
        }}
      >
        <BookOpen />
        My library<span className="count">{books.length}</span>
      </button>
      <button className="nav-item" onClick={() => openModal("search")}>
        <MagnifyingGlass />
        Find a passage<kbd>⌘ K</kbd>
      </button>
      {reading && p.book && (
        <div className="book-navigation">
          <div className="sidebar-book">
            <span>NOW OPEN</span>
            <strong>{p.book.title}</strong>
            <p>{p.book.author}</p>
          </div>
          <div className="sidebar-tabs">
            <button
              className={tab === "chapters" ? "on" : ""}
              onClick={() => setTab("chapters")}
            >
              Contents
            </button>
            <button
              className={tab === "marks" ? "on" : ""}
              onClick={() => setTab("marks")}
            >
              Bookmarks
            </button>
          </div>
          {tab === "chapters" ? (
            <nav aria-label="Book chapters" className="chapters">
              {p.book.chapters.map((ch, i) => (
                <button
                  key={i}
                  aria-current={i === p.chapter ? "true" : undefined}
                  className={i === p.chapter ? "current" : ""}
                  onClick={() => {
                    writeSaved("follow." + p.book!.id, true);
                    p.load(i, 0, p.playing);
                    setReaderKey((k) => k + 1);
                    setDrawer(false);
                  }}
                >
                  <span className="chapter-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    {ch.title}
                    <small>
                      {ch.skipByDefault
                        ? "Reference · tap to open"
                        : listeningLength(ch.duration)}
                    </small>
                  </span>
                  {i === p.chapter ? (
                    <AudioBars playing={p.playing} />
                  ) : (
                    <CaretRight size={13} />
                  )}
                </button>
              ))}
            </nav>
          ) : (
            <div className="marks-list">
              {bookmarks.filter((m) => m.bookId === p.book?.id).length ? (
                bookmarks
                  .filter((m) => m.bookId === p.book?.id)
                  .map((m) => (
                    <div className="mark" key={m.id}>
                      <button
                        onClick={() => {
                          writeSaved(
                            "view." + m.bookId,
                            m.reading ? "text" : "pdf",
                          );
                          if (m.reading)
                            writeSaved("progress." + m.bookId, {
                              ...readSaved("progress." + m.bookId, {}),
                              chapter: m.chapter,
                              time: m.time,
                              page: m.page,
                              reading: m.reading,
                              updated: Date.now(),
                            });
                          writeSaved("follow." + m.bookId, false);
                          p.load(m.chapter, m.time, false);
                          p.setPage(m.page);
                          setReaderKey((k) => k + 1);
                          setDrawer(false);
                        }}
                      >
                        <BookmarkSimple weight="fill" />
                        <span>
                          {m.text.slice(0, 95)}
                          <small>
                            Page {m.page} · {formatTime(m.time)}
                          </small>
                        </span>
                      </button>
                      <IconButton
                        label="Remove bookmark"
                        onClick={() => {
                          const next = bookmarks.filter((x) => x.id !== m.id);
                          setBookmarks(next);
                          writeSaved("bookmarks", next);
                        }}
                      >
                        <X size={14} />
                      </IconButton>
                    </div>
                  ))
              ) : (
                <p className="quiet-note">
                  Save a line you want to come back to. Use the bookmark button
                  while reading.
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="sidebar-bottom">
        <button
          className="nav-item"
          onClick={() => {
            setDrawer(false);
            openModal(isGuest ? "join" : "notes");
          }}
        >
          <TextAa />
          My notes <span className="count">{notes.length}</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setDrawer(false);
            if (isGuest) requestAccount();
            else openModal("account");
          }}
        >
          <Leaf />
          {account?.displayName || "Guest reader · Sign in"}
        </button>
        {syncMessage && (
          <p className="quiet-note" role="status">
            {syncMessage}
          </p>
        )}
        <button
          className="install-link"
          onClick={() => {
            if (isGuest) requestAccount();
            else void logout();
          }}
        >
          {isGuest ? "Sign in or create an account" : "Sign out"}
        </button>
        <button
          className="nav-item add-book"
          onClick={() => openModal(isGuest ? "join" : "import")}
        >
          <Plus />
          Add a book
        </button>
        <div className="sidebar-foot">
          <span>A little time for yourself.</span>
          <IconButton
            label={theme === "night" ? "Use paper theme" : "Use night theme"}
            onClick={() => setTheme(theme === "night" ? "paper" : "night")}
          >
            {theme === "night" ? <Sun /> : <Moon />}
          </IconButton>
        </div>
        <button
          className="install-link"
          onClick={() => {
            if (prompt.current) prompt.current.prompt();
            else openModal("install");
          }}
        >
          <DeviceMobile size={16} />
          {installed ? "Pagechime is installed" : "Take Pagechime with you"}
          <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
  return (
    <MotionConfig reducedMotion="user">
      {modal === "join" && (
        <Modal title="Keep your place" onClose={() => setModal("")}>
          <p>
            Guests can read and listen. Sign in or create an account to save
            bookmarks, notes, reading progress and offline books.
          </p>
          <button className="primary-button" onClick={requestAccount}>
            Sign in or create an account <ArrowRight />
          </button>
          <p className="quiet-note">
            Your guest reading place lasts only for this visit. Sign in to add
            your own books.
          </p>
        </Modal>
      )}
      {modal === "account" && !isGuest && (
        <Modal title="Your reading account" onClose={() => setModal("")}>
          <AccountPanel />
        </Modal>
      )}
      {modal === "notes" && !isGuest && (
        <Modal
          title="Your notes"
          onClose={() => {
            setModal("");
            setEditingNote(null);
            setNoteText("");
            setNoteDraft(null);
          }}
          wide
        >
          <p className="quiet-note">A thought to keep, just for you.</p>
          {(p.book || editingNote) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!noteText.trim()) return;
                const n: ReaderNote = editingNote
                  ? { ...editingNote, body: noteText.trim() }
                  : {
                      id: crypto.randomUUID(),
                      bookId: p.book!.id,
                      chapter: p.chapter,
                      page: p.page,
                      time: p.time,
                      body: noteText.trim(),
                      created: Date.now(),
                      ...(noteDraft || {}),
                      kind: "note",
                    };
                const next = [n, ...notes.filter((x) => x.id !== n.id)];
                if (!writeSaved("notes", next)) {
                  notify(
                    "Your note could not be saved. Your text is still here.",
                  );
                  return;
                }
                setNotes(next);
                setNoteText("");
                setEditingNote(null);
                setNoteDraft(null);
                notify("Your thought has been saved.");
              }}
              className="note-form"
            >
              {typeof (noteDraft?.quote || editingNote?.quote) === "string" &&
                (noteDraft?.quote || editingNote?.quote) && (
                  <blockquote className="note-quotation">
                    {noteDraft?.quote || editingNote?.quote}
                  </blockquote>
                )}
              <label>
                {editingNote ? "Edit your note" : `A note on page ${p.page}`}
                <textarea
                  aria-label="Your note"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  maxLength={10000}
                  required
                  rows={4}
                />
              </label>
              <button className="primary-button" type="submit">
                Save note
              </button>
              {editingNote && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNote(null);
                    setNoteText("");
                  }}
                >
                  Cancel editing
                </button>
              )}
            </form>
          )}
          <div className="notes-list">
            {notes.length ? (
              notes.map((n) => (
                <article className="note-card" key={n.id}>
                  <small>
                    {books.find((b) => b.id === n.bookId)?.title || "Your book"}{" "}
                    · Page {n.page}
                  </small>
                  {typeof n.quote === "string" &&
                    n.quote &&
                    n.kind !== "highlight" && (
                      <blockquote className="note-quotation">
                        {n.quote}
                      </blockquote>
                    )}
                  {n.kind === "highlight" && (
                    <span className="note-kind">HIGHLIGHT</span>
                  )}
                  <p>{n.body}</p>
                  <div>
                    <button
                      onClick={() => {
                        const b = books.find((b) => b.id === n.bookId);
                        if (b) {
                          open(b);
                          p.load(n.chapter, n.time, false, b);
                          p.setPage(n.page);
                          if (n.segment !== undefined) {
                            writeSaved("view." + n.bookId, "text");
                            writeSaved("follow." + n.bookId, false);
                            writeSaved("progress." + n.bookId, {
                              ...readSaved("progress." + n.bookId, {}),
                              chapter: n.chapter,
                              time: n.time,
                              page: n.page,
                              reading: {
                                chapter: n.chapter,
                                segment: n.segment,
                                offset: n.offset || 0,
                              },
                              updated: Date.now(),
                            });
                          }
                          setReaderKey((k) => k + 1);
                          setModal("");
                        }
                      }}
                    >
                      Open page
                    </button>
                    <button
                      onClick={() => {
                        setEditingNote(n);
                        setNoteText(n.body);
                      }}
                    >
                      Edit note
                    </button>
                    <button
                      onClick={() => {
                        const next = notes.filter((x) => x.id !== n.id);
                        writeSaved("notes", next);
                        setNotes(next);
                      }}
                    >
                      Delete note
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="quiet-note">
                Open a book and save your first thought here.
              </p>
            )}
          </div>
        </Modal>
      )}
      <div
        className={`app-shell ${p.book ? "has-player" : ""} ${reading ? "is-reading" : ""}`}
      >
        {!narrow && <aside className="sidebar">{sidebar}</aside>}
        {narrow && drawer && (
          <Modal
            title="Your library"
            className="library-drawer"
            closeLabel="Close library menu"
            onClose={() => setDrawer(false)}
          >
            {sidebar}
          </Modal>
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="topbar-left">
              <button
                type="button"
                aria-label="Open library menu"
                aria-haspopup="dialog"
                aria-expanded={drawer}
                className="icon-button mobile-menu"
                onClick={() => setDrawer(true)}
              >
                <List />
              </button>
              <span className="breadcrumb">
                MY LIBRARY
                {reading && (
                  <>
                    <CaretRight size={12} />
                    <span>{p.book?.title}</span>
                  </>
                )}
              </span>
            </div>
            <div className="topbar-right">
              <button
                className="voice-menu-button"
                onClick={() => openModal("voices")}
                aria-label="Choose narration voice"
              >
                <Headphones size={16} />
                <span>Voice</span>
              </button>
              <span className="topbar-note">
                <span className="status-dot" />A place to slow down
              </span>
              <IconButton
                label="Reading help"
                onClick={() => openModal("help")}
              >
                <Headphones />
              </IconButton>
            </div>
          </header>
          <AnimatePresence mode="wait" initial={false}>
            {reading && p.book ? (
              <motion.main
                key="reader"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="reader-main"
              >
                <Reader
                  key={p.book.id + readerKey}
                  p={p}
                  onReadingPosition={reportReadingPosition}
                  addMark={addMark}
                  notes={notes}
                  theme={theme}
                  onTheme={setTheme}
                  onAnnotate={(draft, kind) => {
                    if (isGuest) {
                      openModal("join");
                      return;
                    }
                    if (kind === "note") {
                      setNoteDraft(draft);
                      setEditingNote(null);
                      setNoteText("");
                      openModal("notes");
                      return;
                    }
                    const highlight: ReaderNote = {
                      id: crypto.randomUUID(),
                      bookId: p.book!.id,
                      body: draft.quote,
                      created: Date.now(),
                      kind,
                      ...draft,
                    };
                    const next = [highlight, ...notes];
                    if (!writeSaved("notes", next)) {
                      notify(
                        "Your highlight could not be saved. Please try again.",
                      );
                      return;
                    }
                    setNotes(next);
                    notify("A sentence to keep. Highlight saved.");
                  }}
                  offline={() => offline(p.book!)}
                  offlineLabel={
                    (isGuest ? "Sign in to save offline" : "") ||
                    offlineBusy ||
                    (offlineIds.includes(p.book.id)
                      ? "Remove offline copy"
                      : "Save offline")
                  }
                  isOffline={offlineIds.includes(p.book.id)}
                />
              </motion.main>
            ) : (
              <motion.main
                className="library-main"
                key="library"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="library-intro">
                  <div>
                    <p className="eyebrow">
                      <span className="small-line" />
                      READ A LITTLE. FEEL A LITTLE MORE.
                    </p>
                    <h1>
                      Your next
                      <br />
                      quiet <em>moment.</em>
                    </h1>
                    <p className="intro-copy">
                      A good book, a familiar voice.
                      <br />
                      Pick up wherever life left you.
                    </p>
                  </div>
                  <div className="intro-ornament" aria-hidden="true">
                    <svg viewBox="0 0 160 160">
                      <path
                        d="M27 133C62 89 63 52 128 25M68 90C31 82 35 54 35 54c35-3 49 7 44 26M93 61c-3-28 9-42 9-42s24 19 12 32M54 111c41 8 60-8 60-8S86 84 65 97"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <circle cx="112" cy="124" r="3" />
                    </svg>
                    <span>
                      MAKE ROOM
                      <br />
                      FOR YOURSELF
                    </span>
                  </div>
                </div>
                <div className="section-heading">
                  <div>
                    <h2>On your bookshelf</h2>
                    <span>
                      {books.length} {books.length === 1 ? "book" : "books"} ·
                      Yours to get lost in
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => openModal(isGuest ? "join" : "import")}
                  >
                    <Plus size={17} />
                    Add a book
                  </button>
                </div>
                {boot ? (
                  <div
                    className="book-skeleton"
                    role="status"
                    aria-label="Loading library"
                  >
                    <span />
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                ) : error ? (
                  <div className="error-box" role="alert">
                    <h3>Let’s try opening that again.</h3>
                    <p>{error}</p>
                    <button className="primary-button" onClick={loadBooks}>
                      Retry library
                    </button>
                  </div>
                ) : books.length ? (
                  <div className="book-grid">
                    {books.map((b, i) => {
                      const saved = readSaved<Progress | null>(
                        "progress." + b.id,
                        null,
                      );
                      const percent =
                        saved && b.duration
                          ? clamp(
                              (globalPosition(
                                b.chapters,
                                saved.chapter,
                                saved.time,
                              ) /
                                b.duration) *
                                100,
                              0,
                              100,
                            )
                          : 0;
                      return (
                        <motion.article
                          className={`featured-book ${i ? "secondary-book" : ""}`}
                          key={b.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06, duration: 0.35 }}
                        >
                          <div className="cover-stage" onClick={() => open(b)}>
                            <div className="cover-shadow" />
                            <motion.div
                              whileHover={{ rotate: -3, y: -7 }}
                              transition={spring}
                            >
                              <Cover book={b} />
                            </motion.div>
                            <div className="cover-caption">
                              <Headphones size={15} />
                              READ & LISTEN
                            </div>
                          </div>
                          <div className="featured-info">
                            <span className="book-category">
                              {b.local
                                ? "YOUR PERSONAL LIBRARY"
                                : "A PRACTICE IN POSSIBILITY"}
                            </span>
                            <h3>{b.title}</h3>
                            <p className="book-author">by {b.author}</p>
                            <p className="book-description">
                              {b.description ||
                                "Some pages are better with a little company. Read and listen at your own pace."}
                            </p>
                            <div className="book-facts">
                              <span>
                                <BookOpen />
                                {b.pageCount} pages
                              </span>
                              <span>
                                <Clock />
                                {listeningLength(b.duration)}
                              </span>
                              <span>
                                <Headphones />
                                {b.chapters.length} chapters
                              </span>
                            </div>
                            {saved && (
                              <div className="library-progress">
                                <div>
                                  <span>Your place is waiting</span>
                                  <span>{Math.round(percent)}%</span>
                                </div>
                                <progress max="100" value={percent} />
                              </div>
                            )}
                            <div className="book-actions">
                              <button
                                className="primary-button"
                                onClick={() => open(b)}
                              >
                                {saved ? "Continue reading" : "Open book"}
                                <ArrowRight size={18} />
                              </button>
                              <button
                                className="round-play"
                                aria-label={`Listen to ${b.title}`}
                                onClick={() => {
                                  open(b);
                                  p.load(
                                    saved?.chapter || 0,
                                    saved?.time || 0,
                                    true,
                                    b,
                                  );
                                }}
                              >
                                <Play weight="fill" />
                              </button>
                              {b.local && (
                                <IconButton
                                  label={`Remove ${b.title}`}
                                  onClick={() => removeBook(b)}
                                >
                                  <Trash />
                                </IconButton>
                              )}
                            </div>
                            <span className="voice-note">
                              <span className="status-dot" />
                              {b.voice || "Your audio, your pace"}
                            </span>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-library">
                    <BookOpen size={48} weight="thin" />
                    <h3>Every shelf starts with one book.</h3>
                    <p>
                      Add a PDF and its audio to make a little space for
                      reading.
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => openModal(isGuest ? "join" : "import")}
                    >
                      <Plus />
                      Add your first book
                    </button>
                  </div>
                )}
                <div className="library-footer">
                  <div>
                    <Leaf size={20} />
                    <p>
                      No rush. No reading streaks.
                      <br />
                      <span>Just you and the next page.</span>
                    </p>
                  </div>
                  <span>
                    {isGuest
                      ? "Sign in to save your reading place."
                      : "Your place, saved just for you."}
                  </span>
                </div>
              </motion.main>
            )}
          </AnimatePresence>
        </div>
        {p.book && <Player p={p} onOpen={() => setReading(true)} />}
        <AnimatePresence>
          {notice && (
            <motion.div
              role="status"
              aria-live="polite"
              className="toast"
              initial={{ opacity: 0, y: 12, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 8, x: "-50%" }}
            >
              <Check size={17} />
              {notice}
            </motion.div>
          )}
        </AnimatePresence>
        {modal === "import" && !isGuest && (
          <ImportModal
            onClose={() => setModal("")}
            onAdded={(b) => {
              objects.current.push(b.pdf, ...b.chapters.map((c) => c.audio));
              setBooks((x) => [...x, b]);
              setModal("");
              notify("Your book is on the shelf.");
            }}
          />
        )}
        {modal === "search" && (
          <SearchModal
            books={books}
            onClose={() => setModal("")}
            onSelect={(b, i, t) => {
              p.open(b);
              writeSaved("follow." + b.id, true);
              p.load(i, t, false, b);
              setReaderKey((k) => k + 1);
              setReading(true);
              setModal("");
              setDrawer(false);
            }}
          />
        )}
        {modal === "voices" && (
          <Modal title="A voice to read with" onClose={() => setModal("")}>
            <p className="muted voice-intro">
              British English. A woman’s voice. A little slower, with room to
              breathe.
            </p>
            <div className="voice-choices">
              <button
                className="voice-choice"
                onClick={() => void chooseNarration("kokoro")}
                disabled={!p.book}
              >
                <Headphones size={23} />
                <div>
                  <strong>Kokoro · Emma</strong>
                  <p>Warm, gently paced narration</p>
                  <span>
                    {!p.book?.narration || p.book.narration === "kokoro"
                      ? "Selected · ready to listen"
                      : "Choose this narration"}
                  </span>
                </div>
                {p.book &&
                  (!p.book.narration || p.book.narration === "kokoro") && (
                    <Check size={20} />
                  )}
              </button>
              <button
                className="voice-choice"
                disabled={
                  !books.find(
                    (b) => b.id === (p.book?.sourceBookId || p.book?.id),
                  )?.preparedNarrations?.piper
                }
                onClick={() => void chooseNarration("piper")}
              >
                <Headphones size={23} />
                <div>
                  <strong>Piper · Cori</strong>
                  <p>British English · female</p>
                  <span>
                    {p.book?.narration === "piper"
                      ? "Selected · ready to listen"
                      : books.find(
                            (b) =>
                              b.id === (p.book?.sourceBookId || p.book?.id),
                          )?.preparedNarrations?.piper
                        ? "Choose this narration"
                        : "Not enabled"}
                  </span>
                </div>
                {p.book?.narration === "piper" && <Check size={20} />}
              </button>
              <button
                className="voice-choice"
                disabled={
                  !books.find((b) => b.id === p.book?.id)?.alternateNarration
                }
                onClick={() => void chooseNarration("google")}
              >
                <Headphones size={23} />
                <div>
                  <strong>Google Neural2</strong>
                  <p>British English · female</p>
                  <span>
                    {p.book?.narration === "google"
                      ? "Selected · ready to listen"
                      : books.find((b) => b.id === p.book?.id)
                            ?.alternateNarration
                        ? "Choose this narration"
                        : "Not enabled"}
                  </span>
                </div>
              </button>
            </div>
            <p className="muted voice-intro">
              Switching voices resumes at the nearest matching passage.
            </p>
          </Modal>
        )}
        {modal === "help" && (
          <Modal title="A little reading room" onClose={() => setModal("")}>
            <div className="help-copy">
              <p>
                Read the clean text or switch to the original PDF. With Follow
                audio on, Pagechime keeps your passage and page with the
                narrator. Books with word timings also highlight the spoken
                word.
              </p>
              <p>
                Tap Fullscreen for more reading space, then Exit to return. The
                player’s 10s buttons move back or forward ten seconds. Normal
                listening skips sections marked Reference; you can open them
                from Contents at any time.
              </p>
              <p>
                Use a passage’s play button to listen from there. Select text to
                highlight or make a note. Add bookmarks for thoughts you want to
                return to.
              </p>
              <div className="shortcut-list">
                <span>
                  Play / pause<kbd>Space</kbd>
                </span>
                <span>
                  Previous / next reading page<kbd>← / →</kbd>
                </span>
                <span>
                  Bookmark this moment<kbd>B</kbd>
                </span>
                <span>
                  Find a passage<kbd>⌘ / Ctrl K</kbd>
                </span>
              </div>
              <p className="muted">
                {isGuest
                  ? "You’re reading as a guest. Sign in or create an account to save bookmarks, notes, your reading place and offline books."
                  : "Your bookmarks, notes and reading place are private to your account. Imported book files stay on this device."}
              </p>
            </div>
          </Modal>
        )}
        {modal === "install" && (
          <Modal
            title="A little closer to your next page"
            onClose={() => setModal("")}
          >
            <div className="help-copy">
              <p>
                Install this website from your browser for a full-screen reading
                room.
              </p>
              <p>
                <strong>iPhone or iPad:</strong> Open in Safari, tap Share, then
                Add to Home Screen.
              </p>
              <p>
                <strong>Android or desktop:</strong> Choose Install app or Add
                to Home Screen from the browser menu.
              </p>
              <p className="muted">
                Once installed, open Pagechime from your home screen. Sign in to
                save books for offline reading.
              </p>
            </div>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
function Player({ p, onOpen }: { p: Playback; onOpen: () => void }) {
  const host = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = host.current,
      shell = element?.closest<HTMLElement>(".app-shell");
    if (!element || !shell) return;
    const measure = () =>
      shell.style.setProperty(
        "--player",
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--player");
    };
  }, []);
  const b = p.book!,
    ch = b.chapters[p.chapter];
  return (
    <section ref={host} className="player" aria-label="Audiobook player">
      <button
        className="player-book"
        onClick={onOpen}
        aria-label="Open current book"
      >
        <div className="mini-cover">
          <BookOpen size={24} />
        </div>
        <div>
          <strong>{b.title}</strong>
          <span>{ch.title}</span>
        </div>
        <AudioBars playing={p.playing} />
      </button>
      <div className="player-center">
        <div className="playback-buttons">
          <IconButton
            label="Previous audio chapter"
            disabled={p.previousChapter === null}
            onClick={() =>
              p.previousChapter !== null &&
              p.load(p.previousChapter, 0, p.playing)
            }
          >
            <SkipBack size={18} weight="fill" />
          </IconButton>
          <button
            className="skip-button"
            aria-label="Back 10 seconds"
            onClick={() => p.skip(-10)}
          >
            <ArrowCounterClockwise />
            <span>10s</span>
          </button>
          <button
            className={`play-button ${p.loading ? "is-loading" : ""}`}
            aria-label={p.playing ? "Pause narration" : "Play narration"}
            onClick={p.toggle}
          >
            {p.playing ? (
              <Pause weight="fill" size={23} />
            ) : (
              <Play weight="fill" size={23} />
            )}
          </button>
          <button
            className="skip-button"
            aria-label="Forward 10 seconds"
            onClick={() => p.skip(10)}
          >
            <ArrowClockwise />
            <span>10s</span>
          </button>
          <IconButton
            label="Next audio chapter"
            disabled={p.nextChapter === null}
            onClick={() =>
              p.nextChapter !== null && p.load(p.nextChapter, 0, p.playing)
            }
          >
            <SkipForward size={18} weight="fill" />
          </IconButton>
        </div>
        <div className="seek-row">
          <time>{formatTime(p.time)}</time>
          <input
            aria-label="Chapter playback position"
            type="range"
            min="0"
            max={ch.duration || 1}
            step="0.1"
            value={clamp(p.time, 0, ch.duration || 1)}
            onChange={(e) => p.seek(Number(e.target.value))}
            style={
              {
                "--filled": `${(p.time / (ch.duration || 1)) * 100}%`,
              } as React.CSSProperties
            }
          />
          <time>{formatTime(ch.duration)}</time>
        </div>
      </div>
      <div className="player-options">
        <label className="speed-control">
          <span className="sr-only">Playback speed</span>
          <select
            aria-label="Playback speed"
            value={p.rate}
            onChange={(e) => p.setRate(Number(e.target.value))}
          >
            {[0.75, 0.85, 1, 1.15, 1.25, 1.5, 2].map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
        <label className={`timer-control ${p.sleep ? "on" : ""}`}>
          <Clock size={18} />
          <select
            aria-label="Sleep timer"
            value={p.sleep ? "active" : "0"}
            onChange={(e) => {
              if (e.target.value !== "active")
                p.setSleepTimer(Number(e.target.value));
            }}
          >
            <option value="0">Sleep timer</option>
            {p.sleep > 0 && (
              <option value="active">{formatTime(p.sleep)} left</option>
            )}
            {[5, 15, 30, 60].map((m) => (
              <option value={m} key={m}>
                {m} minutes
              </option>
            ))}
            {p.sleep > 0 && <option value="0">Cancel timer</option>}
          </select>
        </label>
        <label className="volume-control">
          <SpeakerHigh size={19} />
          <input
            aria-label="Volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            defaultValue="1"
            onChange={(e) => p.setVolume(Number(e.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
function SearchModal({
  books,
  onClose,
  onSelect,
}: {
  books: Book[];
  onClose: () => void;
  onSelect: (b: Book, i: number, t: number) => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const found: {
      book: Book;
      chapter: number;
      time: number;
      text: string;
      page: number;
    }[] = [];
    for (const b of books)
      for (const [i, c] of b.chapters.entries())
        for (const s of c.segments)
          if (s.text.toLowerCase().includes(q.toLowerCase())) {
            found.push({
              book: b,
              chapter: i,
              time: s.start,
              text: s.text,
              page: s.page,
            });
            if (found.length >= 30) return found;
          }
    return found;
  }, [q, books]);
  return (
    <Modal title="Find a passage" onClose={onClose} wide>
      <div className="search-field">
        <MagnifyingGlass />
        <input
          autoFocus
          aria-label="Search book text"
          placeholder="A word, a thought, a little inspiration…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="search-results">
        {q.length < 2 ? (
          <p className="quiet-note">
            Search the narrated text in your library.
          </p>
        ) : results.length ? (
          results.map((r, i) => (
            <button key={i} onClick={() => onSelect(r.book, r.chapter, r.time)}>
              <span>
                {r.book.title} · Page {r.page}
              </span>
              <p>
                {r.text.slice(0, 240)}
                {r.text.length > 240 ? "…" : ""}
              </p>
              <Headphones size={17} />
            </button>
          ))
        ) : (
          <p className="quiet-note">No passages found. Try a different word.</p>
        )}
      </div>
    </Modal>
  );
}
async function audioDuration(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const a = new Audio();
      a.preload = "metadata";
      const timer = setTimeout(() => {
        a.src = "";
        reject(
          new Error(
            `Could not read “${file.name}”. Choose a supported audio file.`,
          ),
        );
      }, 12000);
      a.onloadedmetadata = () => {
        clearTimeout(timer);
        const n = a.duration;
        a.src = "";
        Number.isFinite(n) && n > 0
          ? resolve(n)
          : reject(new Error("The audio duration could not be read."));
      };
      a.onerror = () => {
        clearTimeout(timer);
        a.src = "";
        reject(new Error(`“${file.name}” is not a supported audio file.`));
      };
      a.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
function ImportModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (b: Book) => void;
}) {
  const {
    storage: { readSaved, writeSaved, putLocalBook },
  } = useAccount();
  const [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [pdf, setPdf] = useState<File | null>(null),
    [audio, setAudio] = useState<File[]>([]),
    [timing, setTiming] = useState<File | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pdf || !audio.length) {
      setError("Choose a PDF and at least one audio file.");
      return;
    }
    try {
      setBusy("Opening your PDF…");
      const lib = await pdfLibrary(),
        doc = await lib.getDocument({
          data: new Uint8Array(await pdf.arrayBuffer()),
          isEvalSupported: false,
        }).promise;
      const count = doc.numPages;
      await doc.destroy();
      const files = [...audio].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
      let chapters: Chapter[] = [];
      if (timing) {
        if (timing.size > 3 * 1024 * 1024)
          throw new Error("Choose a timing JSON file smaller than 3 MB.");
        chapters = validateTimedBook(
          JSON.parse(await timing.text()),
          files.map((f) => f.name),
          count,
        );
      } else {
        for (let i = 0; i < files.length; i++) {
          setBusy(`Reading audio ${i + 1} of ${files.length}…`);
          chapters.push({
            title:
              files.length === 1
                ? "Full audiobook"
                : files[i].name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
            file: files[i].name,
            audio: files[i].name,
            duration: await audioDuration(files[i]),
            segments: [],
          });
        }
      }
      const ordered = chapters.map(
        (c) => files.find((f) => f.name === c.file)!,
      );
      const book: Book = {
        id: "local-" + crypto.randomUUID(),
        title:
          title.trim() || pdf.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " "),
        author: author.trim() || "Personal library",
        pageCount: count,
        pdf: "",
        chapters,
        duration: chapters.reduce((n, c) => n + c.duration, 0),
        local: true,
        voice: "Your audio · your pace",
      };
      setBusy("Saving your book…");
      const record: StoredBook = {
        book,
        pdf,
        audio: ordered.map((f) => ({ name: f.name, blob: f })),
      };
      await putLocalBook(record);
      onAdded(materialize(record));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The book could not be saved. Check your files and device storage.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <Modal
      title="Make room for another book"
      onClose={busy ? () => {} : onClose}
    >
      <form className="import-form" onSubmit={submit}>
        <p className="muted">
          Bring a PDF and its narration. Your files stay on this device.
        </p>
        <div className="form-columns">
          <label>
            Book title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Taken from the PDF name if left empty"
            />
          </label>
          <label>
            Author
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>
        <label className="file-picker">
          <FilePdf size={24} />
          <span>
            Book PDF<small>{pdf?.name || "Choose one PDF file"}</small>
          </span>
          <input
            aria-label="Book PDF"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setPdf(e.target.files?.[0] || null)}
          />
        </label>
        <label className="file-picker">
          <Headphones size={24} />
          <span>
            Narration
            <small>
              {audio.length
                ? `${audio.length} audio file${audio.length > 1 ? "s" : ""} selected`
                : "One full audiobook or ordered chapter files"}
            </small>
          </span>
          <input
            aria-label="Narration audio files"
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg"
            multiple
            onChange={(e) => setAudio(Array.from(e.target.files || []))}
          />
        </label>
        <details>
          <summary>Have a timed read-along file?</summary>
          <p className="muted">
            Optional JSON timings enable passage highlighting and automatic
            pages. Without it, turn the PDF pages manually.
          </p>
          <label>
            Timing JSON
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Timing JSON"
              onChange={(e) => setTiming(e.target.files?.[0] || null)}
            />
          </label>
        </details>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <button className="primary-button" type="submit" disabled={!!busy}>
          {busy || "Add to my bookshelf"}
          {!busy && <Plus size={18} />}
        </button>
      </form>
    </Modal>
  );
}
