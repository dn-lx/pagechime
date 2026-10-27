import React, { useEffect, useMemo, useState, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { WebView } from "react-native-webview";
import { bookTextHtml } from "./book-text-html";
import {
  paginateReading,
  readingAnchorAt,
  readingAppearance,
  readingPageAt,
  readingProgress,
  readingWordBudget,
  segmentAt,
  activeWord,
  narrationOffset,
  type Book,
  type ReaderNote,
  type ReadingAnchor,
  type ReadingAppearance,
  type ReadingSelection,
} from "@pagechime/core";
import { useReaderAccount } from "./ReaderAccount";
type Props = {
  book: Book;
  chapter: number;
  time: number;
  follow: boolean;
  onFollow: (v: boolean) => void;
  theme: string;
  onTheme: (v: string) => void;
  initialAnchor?: ReadingAnchor;
  notes: ReaderNote[];
  onAnnotate: (draft: ReadingSelection, kind: "note" | "highlight") => void;
  onListen: (chapter: number, time: number) => void;
  onAnchor: (anchor: ReadingAnchor) => void;
  onNoText: (page: number) => void;
};
export default function BookText({
  book,
  chapter,
  time,
  follow,
  onFollow,
  theme,
  onTheme,
  initialAnchor,
  notes,
  onAnnotate,
  onListen,
  onAnchor,
  onNoText,
}: Props) {
  const { read, store } = useReaderAccount();
  const web = useRef<WebView<{}>>(null);
  const [appearance, setAppearance] = useState(() => readingAppearance(null));
  const [loaded, setLoaded] = useState(false),
    [settings, setSettings] = useState(false);
  const [frame, setFrame] = useState({ width: 340, height: 450 });
  const [anchor, setAnchor] = useState<ReadingAnchor>(
    initialAnchor &&
      Number.isInteger(initialAnchor.chapter) &&
      initialAnchor.chapter >= 0 &&
      initialAnchor.chapter < book.chapters.length
      ? initialAnchor
      : {
          chapter,
          segment: Math.max(
            0,
            segmentAt(book.chapters[chapter].segments, time),
          ),
          offset: 0,
        },
  );
  const readingChapter = anchor.chapter,
    ch = book.chapters[readingChapter],
    audioChapter = book.chapters[chapter];
  const audioIndex = segmentAt(audioChapter.segments, time),
    active = readingChapter === chapter ? audioIndex : -1;
  const [selection, setSelection] = useState<ReadingSelection | null>(null);
  const pages = useMemo(
    () =>
      paginateReading(
        ch.segments,
        readingWordBudget(
          frame.width,
          frame.height,
          appearance.size,
          appearance.leading,
        ),
      ),
    [ch, frame, appearance.size, appearance.leading],
  );
  const page = readingPageAt(pages, anchor.segment, anchor.offset),
    visible = pages[page];
  const chapterNotes = notes.filter(
    (n) => n.bookId === book.id && n.chapter === readingChapter,
  );
  const dark = theme === "night" || appearance.surface === "night";
  const c = dark
    ? {
        paper: "#292f26",
        ink: "#edf0e5",
        muted: "#bdc5b4",
        line: "#48513f",
        accent: "#b7c69c",
        highlight: "#575638",
        soft: "#3d4833",
      }
    : appearance.surface === "sepia"
      ? {
          paper: "#f5ecd9",
          ink: "#42382b",
          muted: "#685b47",
          line: "#d9cbb3",
          accent: "#65704f",
          highlight: "#e9d18f",
          soft: "#e8dfc8",
        }
      : {
          paper: "#fffefb",
          ink: "#292e24",
          muted: "#5c6254",
          line: "#ddded2",
          accent: "#65704f",
          highlight: "#f4e5ab",
          soft: "#e9eddf",
        };
  useEffect(() => {
    let alive = true;
    read("reading.appearance", null).then((v) => {
      if (alive) {
        setAppearance(readingAppearance(v));
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [read]);
  useEffect(() => {
    if (loaded) void store("reading.appearance", appearance);
  }, [appearance, loaded]);
  const spoken = audioChapter.segments[audioIndex];
  const spokenOffset = narrationOffset(spoken, time);
  const narratorPage = readingPageAt(
    pages,
    Math.max(0, audioIndex),
    spokenOffset,
  );
  useEffect(() => {
    if (follow)
      setAnchor({
        chapter,
        segment: Math.max(0, audioIndex),
        offset: spokenOffset,
      });
  }, [chapter, audioIndex, narratorPage, follow]);
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
    onAnchor(anchor);
    setSelection(null);
  }, [anchor.chapter, anchor.segment, anchor.offset, page]);
  useEffect(() => {
    if (!ch.segments.length) onNoText(ch.firstPage || 1);
  }, [readingChapter, ch.segments]);
  function turn(direction: number) {
    onFollow(false);
    if (page + direction >= 0 && page + direction < pages.length)
      setAnchor(readingAnchorAt(pages, page + direction, readingChapter));
    else if (
      readingChapter + direction >= 0 &&
      readingChapter + direction < book.chapters.length
    ) {
      const target = readingChapter + direction,
        segs = book.chapters[target].segments,
        last = Math.max(0, segs.length - 1);
      setAnchor({
        chapter: target,
        segment: direction < 0 ? last : 0,
        offset:
          direction < 0 ? Math.max(0, (segs[last]?.text.length || 1) - 1) : 0,
      });
    }
  }
  const context = encodeURIComponent(
    book.id +
      ":" +
      readingChapter +
      ":" +
      page +
      ":" +
      visible?.fragments
        .map((f) => `${f.segment}-${f.start}-${f.end}`)
        .join(","),
  );
  const html = useMemo(
    () =>
      bookTextHtml(
        visible,
        ch.title,
        readingChapter,
        page === 0,
        appearance,
        chapterNotes,
        -1,
        c,
        context,
        ch.segments,
      ),
    [visible, ch.title, readingChapter, page, appearance, notes, theme],
  );
  const cue =
    active >= 0 ? activeWord(audioChapter.segments[active], time) : null;
  const sendNarration = () =>
    web.current?.postMessage(
      JSON.stringify({
        type: "narration",
        context,
        segment: follow ? active : -1,
        from: follow ? (cue?.from ?? -1) : -1,
      }),
    );
  useEffect(() => {
    sendNarration();
  }, [context, follow, active, cue?.from]);
  const button = (
    label: string,
    icon: React.ComponentProps<typeof Feather>["name"],
    action: () => void,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={action}
      style={[s.icon, disabled && { opacity: 0.35 }]}
    >
      <Feather name={icon} size={19} color={c.accent} />
    </Pressable>
  );
  return (
    <View
      style={[s.root, { backgroundColor: c.paper }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setFrame({ width, height });
      }}
    >
      <View style={[s.head, { borderColor: c.line }]}>
        <Text
          numberOfLines={1}
          style={[s.running, { color: c.muted, flex: 1 }]}
        >
          {book.title.toUpperCase()}
        </Text>
        {button("Reading appearance", "type", () => setSettings(true))}
      </View>
      <WebView<{}>
        ref={web}
        onLoadEnd={sendNarration}
        style={{ flex: 1, backgroundColor: c.paper }}
        source={{ html, baseUrl: "https://pagechime.local/" }}
        originWhitelist={["https://pagechime.local", "about:blank"]}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(r) =>
          r.url === "https://pagechime.local/" || r.url === "about:blank"
        }
        onMessage={(event) => {
          try {
            const m = JSON.parse(event.nativeEvent.data);
            if (m.context !== context) return;
            if (
              m.type === "listen" &&
              Number.isInteger(m.segment) &&
              ch.segments[m.segment] &&
              visible?.fragments.some((f) => f.segment === m.segment)
            ) {
              onListen(readingChapter, ch.segments[m.segment].start);
              onFollow(true);
              return;
            }
            if (
              m.type !== "selection" ||
              typeof m.quote !== "string" ||
              !m.quote ||
              m.quote.length > 2000
            )
              return;
            for (const k of ["segment", "offset", "endSegment", "endOffset"])
              if (!Number.isSafeInteger(m[k]) || m[k] < 0) return;
            const start = ch.segments[m.segment],
              end = ch.segments[m.endSegment];
            if (
              !start ||
              !end ||
              m.offset > start.text.length ||
              m.endOffset > end.text.length ||
              m.endSegment < m.segment ||
              (m.endSegment === m.segment && m.endOffset < m.offset) ||
              !visible?.fragments.some(
                (f) =>
                  f.segment === m.segment &&
                  m.offset >= f.start &&
                  m.offset < f.end,
              ) ||
              !visible?.fragments.some(
                (f) =>
                  f.segment === m.endSegment &&
                  m.endOffset > f.start &&
                  m.endOffset <= f.end,
              )
            )
              return;
            onFollow(false);
            setSelection({
              chapter: readingChapter,
              quote: m.quote,
              segment: m.segment,
              offset: m.offset,
              endSegment: m.endSegment,
              endOffset: m.endOffset,
              page: start.page,
              time: start.start,
            });
          } catch {}
        }}
      />
      <View style={[s.pager, { borderColor: c.line }]}>
        {button(
          "Previous reading page",
          "arrow-left",
          () => turn(-1),
          page === 0 && readingChapter === 0,
        )}
        <View style={{ alignItems: "center" }}>
          <Text
            accessibilityLiveRegion="polite"
            style={{ fontSize: 12, color: c.ink }}
          >
            Page {page + 1} of {Math.max(1, pages.length)}
          </Text>
          <Text style={[s.small, { color: c.muted }]}>
            {readingProgress(
              book.chapters,
              readingAnchorAt(pages, page, readingChapter),
            )}
            % through the book
          </Text>
        </View>
        {button(
          "Next reading page",
          "arrow-right",
          () => turn(1),
          page === pages.length - 1 &&
            readingChapter === book.chapters.length - 1,
        )}
      </View>
      <View style={s.bottom}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: follow }}
          onPress={() => onFollow(!follow)}
          style={s.follow}
        >
          <Feather name="headphones" size={15} color={c.accent} />
          <Text style={{ color: c.accent, fontSize: 11 }}>
            {follow ? "Following audio" : "Follow audio"}
          </Text>
        </Pressable>
        {selection ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {button("Highlight selected quotation", "edit-2", () => {
              onAnnotate(selection, "highlight");
              setSelection(null);
            })}
            {button("Add note to selected quotation", "edit-3", () => {
              onAnnotate(selection, "note");
              setSelection(null);
            })}
            {button("Dismiss selected quotation", "x", () =>
              setSelection(null),
            )}
          </View>
        ) : (
          <Text style={{ color: c.muted, fontSize: 10 }}>
            Select text to keep it.
          </Text>
        )}
      </View>
      <Modal
        visible={settings}
        transparent
        animationType="fade"
        onRequestClose={() => setSettings(false)}
      >
        <View style={s.scrim}>
          <View style={[s.panel, { backgroundColor: c.paper }]}>
            <View style={s.panelHead}>
              <Text style={[s.panelTitle, { color: c.ink }]}>
                Make yourself comfortable.
              </Text>
              {button("Close reading appearance", "x", () =>
                setSettings(false),
              )}
            </View>
            <View style={s.optionRow}>
              <Text style={{ color: c.ink }}>Text size</Text>
              {button(
                "Smaller reading text",
                "minus",
                () =>
                  setAppearance((a) => ({
                    ...a,
                    size: Math.max(17, a.size - 1),
                  })),
                appearance.size <= 17,
              )}
              <Text style={{ color: c.ink }}>{appearance.size}</Text>
              {button(
                "Larger reading text",
                "plus",
                () =>
                  setAppearance((a) => ({
                    ...a,
                    size: Math.min(32, a.size + 1),
                  })),
                appearance.size >= 32,
              )}
            </View>
            {(
              [
                {
                  label: "Typeface",
                  key: "font",
                  values: ["serif", "sans"],
                  labels: ["Book serif", "Clean sans"],
                },
                {
                  label: "Line spacing",
                  key: "leading",
                  values: [1.5, 1.75, 2],
                  labels: ["Compact", "Comfort", "Airy"],
                },
                {
                  label: "Page width",
                  key: "width",
                  values: ["comfortable", "wide"],
                  labels: ["Comfortable", "Wide"],
                },
                {
                  label: "Page colour",
                  key: "surface",
                  values: ["paper", "sepia", "night"],
                  labels: ["Paper", "Sepia", "Night"],
                },
              ] as const
            ).map((option) => (
              <View key={option.key} style={{ marginTop: 20 }}>
                <Text style={{ fontSize: 12, color: c.muted, marginBottom: 8 }}>
                  {option.label}
                </Text>
                <View style={s.optionRow}>
                  {option.values.map((value, i) => (
                    <Pressable
                      key={String(value)}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: appearance[option.key] === value,
                      }}
                      style={[
                        s.option,
                        {
                          borderColor:
                            appearance[option.key] === value
                              ? c.accent
                              : c.line,
                          backgroundColor:
                            appearance[option.key] === value
                              ? c.soft
                              : undefined,
                        },
                      ]}
                      onPress={() => {
                        setAppearance(
                          (a) =>
                            ({
                              ...a,
                              [option.key]: value,
                            }) as ReadingAppearance,
                        );
                        if (option.key === "surface")
                          onTheme(value === "night" ? "night" : "paper");
                      }}
                    >
                      <Text style={{ color: c.ink, fontSize: 12 }}>
                        {option.labels[i]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSettings(false)}
              style={[s.done, { backgroundColor: c.accent }]}
            >
              <Text style={{ color: dark ? "#292e24" : "#fffefb" }}>
                Back to my book
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  head: {
    marginHorizontal: 24,
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
  },
  running: { fontSize: 8, letterSpacing: 1.3 },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  prose: { paddingHorizontal: 25, paddingTop: 22, paddingBottom: 24 },
  opening: { alignItems: "center", marginBottom: 26 },
  title: {
    fontFamily: "serif",
    fontSize: 29,
    lineHeight: 35,
    textAlign: "center",
    marginTop: 14,
  },
  paragraph: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    marginBottom: 17,
  },
  ending: { alignItems: "center", paddingVertical: 20 },
  pager: {
    borderTopWidth: 1,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 6,
  },
  small: { fontSize: 9, marginTop: 3 },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 25,
    alignItems: "center",
  },
  follow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  scrim: {
    flex: 1,
    backgroundColor: "#171e1777",
    justifyContent: "center",
    padding: 20,
  },
  panel: {
    padding: 24,
    borderRadius: 18,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  panelTitle: { fontFamily: "serif", fontSize: 26, flex: 1 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  option: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  done: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    marginTop: 25,
  },
});
