import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AccessibilityInfo,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useAudioPlayerStatus,
  createAudioPlayer,
  setAudioModeAsync,
} from "expo-audio";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import * as Picker from "expo-document-picker";
import * as FS from "expo-file-system/legacy";
import {
  type Book,
  type Bookmark,
  type Progress,
  type ReadingAnchor,
  type ReadingSelection,
  clamp,
  formatTime,
  globalPosition,
  listeningLength,
  segmentAt,
  validateTimedBook,
  adjacentListeningChapter,
  firstListeningChapter,
  skipListeningPosition,
} from "@pagechime/core";
import { catalog } from "./assets/catalog.generated";
import NativePdf from "./NativePdf";
import BookText from "./BookText";
import ReaderAccountGate, { useReaderAccount } from "./ReaderAccount";
import type { ReaderNote } from "@pagechime/core";
type Entry = {
  book: Book;
  audio: (number | string)[];
  pdf: number | string;
  cover?: number;
};
type IconName = React.ComponentProps<typeof Feather>["name"];
const paper = {
  bg: "#f5f3ec",
  paper: "#fffefb",
  ink: "#292e24",
  muted: "#686e60",
  accent: "#65704f",
  soft: "#e9eddf",
  line: "#ddded2",
};
const night = {
  bg: "#232820",
  paper: "#2c3228",
  ink: "#eef0e7",
  muted: "#bcc3b2",
  accent: "#b7c69c",
  soft: "#3d4833",
  line: "#48513f",
};
function Button({
  icon,
  label,
  onPress,
  styles: s,
  active = false,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        active && s.iconActive,
        pressed && s.pressed,
        disabled && { opacity: 0.35 },
      ]}
    >
      <Feather
        name={icon}
        size={21}
        color={active ? s.colors.accent : s.colors.ink}
      />
    </Pressable>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <ReaderAccountGate>
        <PagechimeApp />
      </ReaderAccountGate>
    </SafeAreaProvider>
  );
}
function PagechimeApp() {
  const {
    session,
    isGuest,
    storageId,
    requestAccount,
    read,
    store,
    api,
    logout,
    syncMessage,
    keepLocalChanges,
  } = useReaderAccount();
  const [notes, setNotes] = useState<ReaderNote[]>([]),
    [noteText, setNoteText] = useState(""),
    [editingNote, setEditingNote] = useState<ReaderNote | null>(null);
  const [noteDraft, setNoteDraft] = useState<ReadingSelection | null>(null);
  const readingAnchors = useRef<Record<string, ReadingAnchor>>({});
  const [readingKey, setReadingKey] = useState(0);
  useEffect(() => {
    read<ReaderNote[]>("notes", []).then(setNotes);
  }, [read]);
  const insets = useSafeAreaInsets(),
    { width } = useWindowDimensions();
  const [theme, setTheme] = useState("paper"),
    [books, setBooks] = useState<Entry[]>(catalog),
    [entry, setEntry] = useState<Entry | null>(null),
    [reading, setReading] = useState(false),
    [chapter, setChapter] = useState(0),
    [page, setPage] = useState(1),
    [mode, setMode] = useState<"text" | "pdf">("text"),
    [follow, setFollow] = useState(true),
    [rate, setRate] = useState(1),
    [textSize, setTextSize] = useState(22),
    [marks, setMarks] = useState<Bookmark[]>([]),
    [progress, setProgress] = useState<Record<string, Progress>>({}),
    [sheet, setSheet] = useState(""),
    [reduce, setReduce] = useState(false),
    [toast, setToast] = useState(""),
    [loadError, setLoadError] = useState(""),
    [ready, setReady] = useState(false),
    [sleep, setSleep] = useState(0);
  useEffect(() => {
    if (sheet !== "notes") setNoteDraft(null);
  }, [sheet]);
  const colors = theme === "night" ? night : paper,
    s = useMemo(() => makeStyles(colors), [colors]);
  const fade = useRef(new Animated.Value(1)).current,
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    paragraphY = useRef<Record<number, number>>({}),
    lastSaved = useRef(0),
    sleepDeadline = useRef(0),
    pending = useRef<{
      time: number;
      play: boolean;
      duration: number;
      token: number;
      playerId: string;
    } | null>(null),
    current = useRef<{ entry: Entry | null; chapter: number }>({
      entry: null,
      chapter: 0,
    }),
    loadToken = useRef(0),
    loadRef = useRef<
      (
        i: number,
        t?: number,
        play?: boolean,
        e?: Entry,
        preserveReading?: boolean,
      ) => void
    >(() => {});
  const [player, setPlayer] = useState(() =>
      createAudioPlayer(null, {
        updateInterval: 100,
        keepAudioSessionActive: true,
      }),
    ),
    status = useAudioPlayerStatus(player);
  useEffect(
    () => () => {
      player.remove();
    },
    [player],
  );
  const ch = entry?.book.chapters[chapter],
    index = ch ? segmentAt(ch.segments, status.currentTime) : -1,
    active = ch?.segments[index];
  useEffect(() => {
    (async () => {
      const [local, p, m, t, r] = await Promise.all([
        read<Entry[]>("books", []),
        read<Record<string, Progress>>("progress", {}),
        read<Bookmark[]>("marks", []),
        read("theme", "paper"),
        read("rate", 1),
      ]);
      setBooks([...catalog, ...local]);
      setProgress(p);
      for (const [id, place] of Object.entries(p))
        if (place.reading) readingAnchors.current[id] = place.reading;
      setMarks(m);
      setTheme(t);
      setRate(r);
      setReady(true);
    })();
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() =>
      setLoadError("Background audio could not be configured on this device."),
    );
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const save = useCallback(async () => {
    const e = current.current.entry;
    if (!e) return;
    const c = current.current.chapter,
      p: Progress = {
        chapter: c,
        time: player.currentTime || 0,
        page,
        view: mode,
        follow,
        updated: Date.now(),
      };
    setProgress((old) => {
      p.reading = readingAnchors.current[e.book.id] || old[e.book.id]?.reading;
      const next = { ...old, [e.book.id]: p };
      store("progress", next);
      return next;
    });
  }, [player, page, mode, follow]);
  useEffect(() => {
    if (
      !entry ||
      !status.isLoaded ||
      status.id !== player.id ||
      pending.current
    )
      return;
    if (Date.now() - lastSaved.current > 1500) {
      lastSaved.current = Date.now();
      save();
    }
  }, [status.currentTime, status.isLoaded, entry, save]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") save();
    });
    return () => sub.remove();
  }, [save]);
  const load = useCallback(
    (i: number, t = 0, play = false, e?: Entry, preserveReading = false) => {
      const next = e || current.current.entry;
      if (!next) return;
      save();
      const c = clamp(i, 0, next.book.chapters.length - 1),
        chapterData = next.book.chapters[c];
      current.current = { entry: next, chapter: c };
      setEntry(next);
      setChapter(c);
      if (!preserveReading || follow)
        setPage(chapterData.segments[0]?.page || chapterData.firstPage || 1);
      if (!preserveReading) setFollow(true);
      setLoadError("");
      paragraphY.current = {};
      if (!preserveReading)
        setMode(chapterData.segments.length ? "text" : "pdf");
      const target = clamp(t, 0, chapterData.duration || 1e9);

      const token = ++loadToken.current;
      try {
        player.pause();
        const source = next.audio[c];
        const nextPlayer = createAudioPlayer(
          typeof source === "number" ? source : { uri: source },
          { updateInterval: 100, keepAudioSessionActive: true },
        );
        pending.current = {
          time: target,
          play,
          duration: chapterData.duration,
          token,
          playerId: nextPlayer.id,
        };
        player.setActiveForLockScreen(false);
        setPlayer(nextPlayer);
        nextPlayer.setPlaybackRate(rate);
        nextPlayer.setActiveForLockScreen(true, {
          title: chapterData.title,
          artist: next.book.author,
          albumTitle: next.book.title,
        });
      } catch {
        setLoadError("This audio file could not be opened.");
        pending.current = null;
      }
      if (!reduce && !preserveReading) {
        fade.setValue(0);
        Animated.timing(fade, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }).start();
      }
      setTimeout(() => {
        if (token === loadToken.current && pending.current) {
          setLoadError("Audio is taking longer to load. Tap play to retry.");
          pending.current = null;
        }
      }, 12000);
    },
    [save, player, rate, reduce, fade, follow],
  );
  loadRef.current = load;
  useEffect(() => {
    const wait = pending.current;
    const fresh = player.currentStatus;
    if (
      !wait ||
      !fresh.isLoaded ||
      fresh.id !== wait.playerId ||
      player.id !== wait.playerId
    )
      return;
    pending.current = null;
    player
      .seekTo(wait.time)
      .then(() => {
        if (wait.token === loadToken.current && wait.play) player.play();
      })
      .catch(() => {
        if (wait.token === loadToken.current)
          setLoadError(
            "The saved audio position could not be restored. Tap play to continue.",
          );
      });
  }, [status.isLoaded, status.duration, status.id, chapter, entry, player]);
  useEffect(() => {
    if (!status.didJustFinish || pending.current || status.id !== player.id)
      return;
    const e = current.current.entry,
      c = current.current.chapter;
    const next = e && adjacentListeningChapter(e.book.chapters, c, 1);
    if (next !== null && next !== undefined)
      loadRef.current(next, 0, true, undefined, true);
    else if (e) {
      save();
      setToast("The last page. Thank you for making time.");
    }
  }, [status.didJustFinish, status.id, player, save]);
  useEffect(() => {
    if (!follow || !active) return;
    setPage(active.page);
    if (mode === "text" && paragraphY.current[index] !== undefined)
      scroll.current?.scrollTo({
        y: Math.max(0, paragraphY.current[index] - 70),
        animated: !reduce,
      });
  }, [index, follow, active, mode, reduce]);
  function open(e: Entry) {
    const p = progress[e.book.id];
    loadRef.current(
      p?.chapter ?? firstListeningChapter(e.book.chapters),
      p?.time || 0,
      false,
      e,
    );
    if (
      p?.page &&
      (p.view === "pdf" || !e.book.chapters[p.chapter || 0].segments.length)
    ) {
      setPage(clamp(p.page, 1, e.book.pageCount));
      setFollow(false);
      setMode("pdf");
    }
    if (p?.reading && p.view !== "pdf") setFollow(false);
    setReadingKey((k) => k + 1);
    setReading(true);
    Haptics.selectionAsync().catch(() => {});
  }
  function toggle() {
    if (!entry) return;
    setLoadError("");
    try {
      if (status.playing) player.pause();
      else player.play();
    } catch {
      setLoadError("Playback could not start. Please reopen the chapter.");
    }
  }
  function seek(t: number) {
    player
      .seekTo(clamp(t, 0, status.duration || ch?.duration || 1e9))
      .catch(() => setLoadError("The audio is still loading."));
  }
  function skip(seconds: number) {
    if (!entry) return;
    const target = skipListeningPosition(
      entry.book.chapters,
      chapter,
      status.currentTime,
      seconds,
    );
    if (target.chapter === chapter) seek(target.time);
    else loadRef.current(target.chapter, target.time, status.playing);
  }
  function stepChapter(direction: 1 | -1) {
    if (!entry) return;
    const next = adjacentListeningChapter(
      entry.book.chapters,
      chapter,
      direction,
    );
    if (next !== null) loadRef.current(next, 0, status.playing);
  }
  function bookmark() {
    if (isGuest) {
      setSheet("join");
      return;
    }
    if (!entry || !ch) return;
    const readingAnchor =
      mode === "text" ? readingAnchors.current[entry.book.id] : undefined;
    const readingSegment = readingAnchor
      ? entry.book.chapters[readingAnchor.chapter]?.segments[
          readingAnchor.segment
        ]
      : undefined;
    const m: Bookmark = {
        id: String(Date.now()),
        bookId: entry.book.id,
        chapter: readingAnchor?.chapter ?? chapter,
        time: readingSegment?.start ?? status.currentTime,
        page: readingSegment?.page ?? page,
        text: readingSegment?.text || active?.text || ch.title,
        reading: readingAnchor,
        created: Date.now(),
      },
      next = [m, ...marks];
    setMarks(next);
    store("marks", next);
    setToast("A little bookmark, right here.");
    Haptics.selectionAsync().catch(() => {});
  }
  useEffect(() => {
    const check = () => {
      if (!sleepDeadline.current) return;
      const left = Math.max(
        0,
        Math.ceil((sleepDeadline.current - Date.now()) / 1000),
      );
      setSleep(left);
      if (!left) {
        sleepDeadline.current = 0;
        player.pause();
        setToast("Sleep timer finished. Your place is saved.");
      }
    };
    const timer = setInterval(check, 1000),
      sub = AppState.addEventListener("change", check);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [player]);
  function setSleepTimer(minutes: number) {
    sleepDeadline.current = minutes ? Date.now() + minutes * 60000 : 0;
    setSleep(minutes * 60);
    setSheet("");
  }
  function changeRate(v: number) {
    setRate(v);
    player.setPlaybackRate(v);
    store("rate", v);
    setSheet("");
  }
  function turn(p: number) {
    setFollow(false);
    setMode("pdf");
    setPage(clamp(p, 1, entry?.book.pageCount || 1));
  }
  function updatePageCount(n: number) {
    if (!entry || entry.book.pageCount === n) return;
    const next = { ...entry, book: { ...entry.book, pageCount: n } };
    setEntry(next);
    setBooks((old) => {
      const list = old.map((e) => (e.book.id === next.book.id ? next : e));
      store(
        "books",
        list.filter((e) => e.book.local),
      );
      return list;
    });
  }
  const styleText = {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: textSize,
    lineHeight: textSize * 1.85,
    color: colors.ink,
  };
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style={theme === "night" ? "light" : "dark"} />
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My library"
          onPress={() => {
            save();
            setReading(false);
          }}
          style={s.brand}
        >
          {width >= 500 && (
            <Feather name="feather" size={25} color={colors.accent} />
          )}
          <Text
            style={s.logo}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            Pagechime<Text style={{ color: colors.accent }}>.</Text>
          </Text>
        </Pressable>
        <View style={s.row}>
          {reading && (
            <Button
              icon="list"
              label="Book contents"
              styles={s}
              onPress={() => setSheet("chapters")}
            />
          )}
          <Button
            icon={theme === "night" ? "sun" : "moon"}
            label="Change reading theme"
            styles={s}
            onPress={() => {
              const t = theme === "night" ? "paper" : "night";
              setTheme(t);
              store("theme", t);
            }}
          />
          <Button
            icon="user"
            label="My account"
            styles={s}
            onPress={() => setSheet("account")}
          />
          <Button
            icon="plus"
            label="Add a book"
            styles={s}
            onPress={() => setSheet(isGuest ? "join" : "import")}
          />
        </View>
      </View>
      {!ready ? (
        <View style={s.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.muted}>Opening your reading room…</Text>
        </View>
      ) : !reading ? (
        <ScrollView
          contentContainerStyle={[
            s.library,
            { paddingBottom: entry ? 180 + insets.bottom : 40 },
          ]}
        >
          <Text style={s.eyebrow}>READ A LITTLE. FEEL A LITTLE MORE.</Text>
          <Text style={[s.hero, { fontSize: width > 700 ? 66 : 54 }]}>
            Your next{`\n`}quiet <Text style={s.heroAccent}>moment.</Text>
          </Text>
          <Text style={s.intro}>
            A good book, a familiar voice.{`\n`}Pick up wherever life left you.
          </Text>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>On your bookshelf</Text>
            <Text style={s.small}>
              {books.length} {books.length === 1 ? "book" : "books"}
            </Text>
          </View>
          {books.length ? (
            books.map((e) => {
              const b = e.book,
                p = progress[b.id],
                percent =
                  p && b.duration
                    ? Math.round(
                        (globalPosition(b.chapters, p.chapter, p.time) /
                          b.duration) *
                          100,
                      )
                    : 0;
              return (
                <View
                  key={b.id}
                  style={[
                    s.feature,
                    width > 700 && { flexDirection: "row", gap: 32 },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${b.title}`}
                    onPress={() => open(e)}
                    style={[s.coverStage, width > 700 && { width: 280 }]}
                  >
                    <View style={s.bookCover}>
                      <Text style={s.coverAuthor}>
                        {b.author.toUpperCase()}
                      </Text>
                      <Text style={s.coverTitle}>
                        {b.id === "manifest" ? "MANIFEST\nIN ACTION" : b.title}
                      </Text>
                      <View style={s.coverLine} />
                      <Text style={s.coverSubtitle}>
                        {b.subtitle || "A little time, a good book."}
                      </Text>
                      <Text style={s.coverFoot}>READ & LISTEN</Text>
                    </View>
                  </Pressable>
                  <View style={s.bookInfo}>
                    <Text style={s.eyebrow}>
                      {b.local
                        ? "YOUR PERSONAL LIBRARY"
                        : "A PRACTICE IN POSSIBILITY"}
                    </Text>
                    <Text style={s.bookTitle}>{b.title}</Text>
                    <Text style={s.author}>by {b.author}</Text>
                    <Text style={s.description}>
                      {b.description ||
                        "Some pages are better with a little company. Read and listen at your own pace."}
                    </Text>
                    <View style={s.facts}>
                      <Text style={s.small}>{b.pageCount} pages</Text>
                      <Text style={s.small}>{listeningLength(b.duration)}</Text>
                      <Text style={s.small}>{b.chapters.length} chapters</Text>
                    </View>
                    {p && (
                      <View style={s.progressBlock}>
                        <View style={s.spaceBetween}>
                          <Text style={s.small}>Your place is waiting</Text>
                          <Text style={s.small}>{percent}%</Text>
                        </View>
                        <View style={s.progressTrack}>
                          <View
                            style={[
                              s.progressFill,
                              { width: `${clamp(percent, 0, 100)}%` },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [s.primary, pressed && s.pressed]}
                      onPress={() => open(e)}
                    >
                      <Text style={s.primaryText}>
                        {p ? "Continue reading" : "Open book"}
                      </Text>
                      <Feather
                        name="arrow-right"
                        size={18}
                        color={colors.paper}
                      />
                    </Pressable>
                    {b.local && (
                      <Button
                        icon="trash-2"
                        label={`Remove ${b.title}`}
                        styles={s}
                        onPress={() =>
                          Alert.alert(
                            "Remove this book?",
                            "Its imported files will be removed from this device.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Remove",
                                style: "destructive",
                                onPress: async () => {
                                  const next = books.filter(
                                    (x) => x.book.id !== b.id,
                                  );
                                  if (
                                    !(await store(
                                      "books",
                                      next.filter((x) => x.book.local),
                                    ))
                                  )
                                    return;
                                  if (current.current.entry?.book.id === b.id) {
                                    player.pause();
                                    pending.current = null;
                                    loadToken.current++;
                                    current.current = {
                                      entry: null,
                                      chapter: 0,
                                    };
                                    setEntry(null);
                                    setReading(false);
                                  }
                                  setBooks(next);
                                  await FS.deleteAsync(
                                    FS.documentDirectory +
                                      `reader-${storageId}/books/` +
                                      b.id +
                                      "/",
                                    { idempotent: true },
                                  ).catch(() =>
                                    setToast(
                                      "Book removed. Some files could not be cleared.",
                                    ),
                                  );
                                },
                              },
                            ],
                          )
                        }
                      />
                    )}
                    <Text style={s.voice}>
                      {b.voice || "Your audio · your pace"}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={s.empty}>
              <Feather name="book-open" size={40} color={colors.accent} />
              <Text style={s.sectionTitle}>
                Every shelf starts with one book.
              </Text>
              <Text style={s.description}>
                Add a PDF and its narration to begin.
              </Text>
              <Pressable
                style={s.primary}
                onPress={() => setSheet(isGuest ? "join" : "import")}
              >
                <Text style={s.primaryText}>Add your first book</Text>
              </Pressable>
            </View>
          )}
          <View style={s.footer}>
            <Feather name="feather" size={20} color={colors.accent} />
            <Text style={s.footerText}>
              No rush. No reading streaks.{`\n`}Just you and the next page.
            </Text>
          </View>
          <Text style={[s.small, { textAlign: "center", marginTop: 20 }]}>
            Your reading place stays on this device.
          </Text>
        </ScrollView>
      ) : entry && ch ? (
        <Animated.View
          style={[
            s.reader,
            { opacity: fade, paddingBottom: entry ? 157 + insets.bottom : 0 },
          ]}
        >
          <View style={s.readerTop}>
            <Text style={s.eyebrow}>
              {String(
                (progress[entry.book.id]?.reading?.chapter ?? chapter) + 1,
              ).padStart(2, "0")}{" "}
              / {String(entry.book.chapters.length).padStart(2, "0")} CHAPTERS
            </Text>
            <Text style={s.readerTitle}>{entry.book.title}</Text>
            <Text style={s.small}>
              {entry.book.title} · {entry.book.author}
            </Text>
          </View>
          <View style={s.toolbar}>
            <View style={s.segmented}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mode === "text" }}
                style={[s.segment, mode === "text" && s.segmentOn]}
                onPress={() => setMode("text")}
              >
                <Text style={s.segmentLabel}>Reading</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mode === "pdf" }}
                style={[s.segment, mode === "pdf" && s.segmentOn]}
                onPress={() => setMode("pdf")}
              >
                <Text style={s.segmentLabel}>Original PDF</Text>
              </Pressable>
            </View>
            <View style={s.row}>
              <Button
                icon="bookmark"
                label="Bookmark this moment"
                styles={s}
                onPress={bookmark}
              />
            </View>
          </View>
          <View style={s.pageWrap}>
            {mode === "pdf" ? (
              <NativePdf
                key={entry.book.id}
                source={entry.pdf}
                page={page}
                onCount={updatePageCount}
              />
            ) : entry.book.chapters.some((c) => c.segments.length) ? (
              <BookText
                key={entry.book.id + ":" + readingKey}
                book={entry.book}
                chapter={chapter}
                time={status.currentTime}
                follow={follow}
                onFollow={setFollow}
                theme={theme}
                onTheme={(t) => {
                  setTheme(t);
                  void store("theme", t);
                }}
                initialAnchor={
                  readingAnchors.current[entry.book.id] ||
                  progress[entry.book.id]?.reading
                }
                notes={notes}
                onNoText={(sourcePage) => {
                  setFollow(false);
                  setPage(sourcePage);
                  setMode("pdf");
                }}
                onListen={(target, t) => {
                  if (target !== chapter) load(target, t, true);
                  else {
                    seek(t);
                    player.play();
                  }
                  setFollow(true);
                }}
                onAnchor={(a) => {
                  readingAnchors.current[entry.book.id] = a;
                  if (!follow)
                    setPage(
                      entry.book.chapters[a.chapter]?.segments[a.segment]
                        ?.page || page,
                    );
                  setProgress((old) => {
                    const previous = old[entry.book.id] || {
                      chapter,
                      time: pending.current?.time ?? status.currentTime,
                      page,
                      updated: Date.now(),
                    };
                    const next = {
                      ...old,
                      [entry.book.id]: {
                        ...previous,
                        reading: a,
                        updated: Date.now(),
                      },
                    };
                    void store("progress", next);
                    return next;
                  });
                }}
                onAnnotate={(draft, kind) => {
                  if (isGuest) {
                    setSheet("join");
                    return;
                  }
                  if (kind === "note") {
                    setNoteDraft(draft);
                    setNoteText("");
                    setEditingNote(null);
                    setSheet(isGuest ? "join" : "notes");
                    return;
                  }
                  const highlight: ReaderNote = {
                    id:
                      Date.now().toString(36) +
                      "-" +
                      Math.random().toString(36).slice(2),
                    bookId: entry.book.id,
                    body: draft.quote,
                    created: Date.now(),
                    kind,
                    ...draft,
                  };
                  const next = [highlight, ...notes];
                  void store("notes", next).then((ok) => {
                    if (ok) {
                      setNotes(next);
                      setToast("A sentence to keep. Highlight saved.");
                    }
                  });
                }}
              />
            ) : (
              <View style={s.empty}>
                <Text style={s.description}>
                  This book has no timed transcript. Read the original PDF and
                  turn the pages at your own pace.
                </Text>
                <Pressable style={s.primary} onPress={() => setMode("pdf")}>
                  <Text style={s.primaryText}>Open original PDF</Text>
                </Pressable>
              </View>
            )}
          </View>
          {mode === "pdf" && (
            <View style={s.pageNav}>
              <Button
                icon="chevron-left"
                label="Previous PDF page"
                styles={s}
                disabled={page <= 1}
                onPress={() => turn(page - 1)}
              />
              <Text style={s.small}>
                Page {page} of {entry.book.pageCount}
              </Text>
              <Button
                icon="chevron-right"
                label="Next PDF page"
                styles={s}
                disabled={page >= entry.book.pageCount}
                onPress={() => turn(page + 1)}
              />
              {ch.segments.length > 0 && (
                <Pressable
                  style={[s.follow, follow && s.followOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: follow }}
                  onPress={() => setFollow(!follow)}
                >
                  <Text
                    style={[
                      s.small,
                      { color: follow ? colors.accent : colors.muted },
                    ]}
                  >
                    {follow ? "● Follow audio" : "Follow audio"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>
      ) : null}
      {entry && ch && (
        <View style={[s.player, { paddingBottom: insets.bottom + 9 }]}>
          <View style={s.playerTop}>
            <Pressable style={{ flex: 1 }} onPress={() => setReading(true)}>
              <Text numberOfLines={1} style={s.playerTitle}>
                {entry.book.title}
              </Text>
              <Text numberOfLines={1} style={s.small}>
                {ch.title}
              </Text>
            </Pressable>
            <Pressable
              style={s.rateButton}
              accessibilityLabel="Playback speed"
              onPress={() => setSheet("rate")}
            >
              <Text style={s.rateText}>{rate}×</Text>
            </Pressable>
            <Button
              icon="clock"
              label={sleep ? `Sleep timer ${formatTime(sleep)}` : "Sleep timer"}
              styles={s}
              active={sleep > 0}
              onPress={() => setSheet("sleep")}
            />
            <Button
              icon="bookmark"
              label="Saved bookmarks"
              styles={s}
              onPress={() => setSheet("marks")}
            />
          </View>
          {loadError ? (
            <Pressable onPress={() => load(chapter, status.currentTime, true)}>
              <Text style={s.errorText}>{loadError}</Text>
            </Pressable>
          ) : null}
          <View style={s.playerControls}>
            <Button
              icon="skip-back"
              label="Previous chapter"
              styles={s}
              disabled={
                adjacentListeningChapter(entry.book.chapters, chapter, -1) ===
                null
              }
              onPress={() => stepChapter(-1)}
            />
            <Pressable
              style={s.skip}
              accessibilityRole="button"
              accessibilityLabel="Back 10 seconds"
              onPress={() => skip(-10)}
            >
              <Feather name="rotate-ccw" size={25} color={colors.muted} />
              <Text style={s.skipNumber}>10s</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                status.playing ? "Pause narration" : "Play narration"
              }
              onPress={toggle}
              style={s.bigPlay}
            >
              {status.isBuffering ? (
                <ActivityIndicator color={colors.paper} />
              ) : (
                <Feather
                  name={status.playing ? "pause" : "play"}
                  size={23}
                  color={theme === "night" ? "#273120" : colors.paper}
                />
              )}
            </Pressable>
            <Pressable
              style={s.skip}
              accessibilityRole="button"
              accessibilityLabel="Forward 10 seconds"
              onPress={() => skip(10)}
            >
              <Feather name="rotate-cw" size={25} color={colors.muted} />
              <Text style={s.skipNumber}>10s</Text>
            </Pressable>
            <Button
              icon="skip-forward"
              label="Next chapter"
              styles={s}
              disabled={
                adjacentListeningChapter(entry.book.chapters, chapter, 1) ===
                null
              }
              onPress={() => stepChapter(1)}
            />
          </View>
          <View style={s.seekRow}>
            <Text style={s.time}>{formatTime(status.currentTime)}</Text>
            <Slider
              accessibilityLabel="Chapter playback position"
              style={{ flex: 1, height: 22 }}
              minimumValue={0}
              maximumValue={status.duration || ch.duration || 1}
              value={status.currentTime}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.accent}
              onSlidingComplete={seek}
            />
            <Text style={s.time}>
              {formatTime(status.duration || ch.duration)}
            </Text>
          </View>
        </View>
      )}
      {toast && (
        <View
          accessibilityRole="alert"
          style={[s.toast, { bottom: entry ? 170 + insets.bottom : 30 }]}
        >
          <Feather name="check" size={17} color={colors.paper} />
          <Text style={s.toastText}>{toast}</Text>
        </View>
      )}
      <Modal
        visible={!!sheet}
        transparent
        animationType={reduce ? "none" : "slide"}
        onRequestClose={() => setSheet("")}
      >
        <View style={s.sheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Close dialog"
            onPress={() => setSheet("")}
          />
          <View
            style={[
              s.sheet,
              { paddingBottom: insets.bottom + 20, maxHeight: "87%" },
            ]}
          >
            <View style={s.sheetHandle} />
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>
                {sheet === "notes"
                  ? "Your notes"
                  : sheet === "account"
                    ? "Your account"
                    : sheet === "chapters"
                      ? "Contents"
                      : sheet === "marks"
                        ? "Your bookmarks"
                        : sheet === "sleep"
                          ? "A little rest"
                          : sheet === "voices"
                            ? "A voice to read with"
                            : sheet === "rate"
                              ? "Find your pace"
                              : "Make room for another book"}
              </Text>
              <Button
                icon="x"
                label="Close dialog"
                styles={s}
                onPress={() => setSheet("")}
              />
            </View>
            {sheet === "chapters" && entry && (
              <FlatList
                data={entry.book.chapters}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item, index: i }) => (
                  <Pressable
                    style={[s.chapterRow, chapter === i && s.chapterSelected]}
                    onPress={() => {
                      load(i, 0, status.playing);
                      setReading(true);
                      setSheet("");
                    }}
                  >
                    <Text style={s.chapterNo}>
                      {String(i + 1).padStart(2, "0")}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.chapterText}>{item.title}</Text>
                      <Text style={s.small}>
                        {listeningLength(item.duration)}
                      </Text>
                    </View>
                    <Feather
                      name={chapter === i ? "volume-2" : "chevron-right"}
                      size={17}
                      color={colors.accent}
                    />
                  </Pressable>
                )}
              />
            )}{" "}
            {sheet === "marks" && (
              <ScrollView>
                {marks.filter((m) => m.bookId === entry?.book.id).length ? (
                  marks
                    .filter((m) => m.bookId === entry?.book.id)
                    .map((m) => (
                      <View key={m.id} style={s.bookmarkRow}>
                        <Pressable
                          style={{ flex: 1 }}
                          onPress={() => {
                            if (m.reading)
                              readingAnchors.current[m.bookId] = m.reading;
                            load(m.chapter, m.time, false);
                            setReadingKey((k) => k + 1);
                            setPage(m.page);
                            setFollow(false);
                            setMode(m.reading ? "text" : "pdf");
                            setReading(true);
                            setSheet("");
                          }}
                        >
                          <Text style={s.markText}>{m.text.slice(0, 140)}</Text>
                          <Text style={s.small}>
                            Page {m.page} · {formatTime(m.time)}
                          </Text>
                        </Pressable>
                        <Button
                          icon="x"
                          label="Remove bookmark"
                          styles={s}
                          onPress={() => {
                            const next = marks.filter((x) => x.id !== m.id);
                            setMarks(next);
                            store("marks", next);
                          }}
                        />
                      </View>
                    ))
                ) : (
                  <Text style={s.description}>
                    Save a thought you want to return to with the bookmark
                    button.
                  </Text>
                )}
              </ScrollView>
            )}
            {sheet === "sleep" && (
              <View>
                <Text style={s.description}>
                  Pause after a little listening. Keep Pagechime open for the
                  timer to pause on time.
                </Text>
                {[0, 5, 15, 30, 60].map((m) => (
                  <Pressable
                    key={m}
                    style={s.rateOption}
                    onPress={() => setSleepTimer(m)}
                  >
                    <Text style={s.chapterText}>
                      {m ? `${m} minutes` : "Turn off timer"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {sheet === "voices" && (
              <View style={{ gap: 16, paddingBottom: 20 }}>
                <Text style={s.description}>
                  British English. A woman’s voice. Your own pace.
                </Text>
                <View style={[s.chapterRow, s.chapterSelected]}>
                  <Feather name="headphones" size={23} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.chapterText}>Kokoro · Emma</Text>
                    <Text style={s.small}>Selected · ready to listen</Text>
                  </View>
                  <Feather name="check" size={20} color={colors.accent} />
                </View>
                <View
                  style={s.chapterRow}
                  accessibilityLabel="Google Neural2, not enabled"
                >
                  <Feather name="headphones" size={23} color={colors.muted} />
                  <View>
                    <Text style={s.chapterText}>Google Neural2</Text>
                    <Text style={s.small}>
                      British English · female · not enabled
                    </Text>
                  </View>
                </View>
                <Text style={s.description}>
                  Emma’s narration is ready to play. Google narration can be
                  added as a prepared recording.
                </Text>
              </View>
            )}
            {sheet === "rate" && (
              <View style={s.rates}>
                {[0.75, 0.85, 1, 1.15, 1.25, 1.5, 2].map((v) => (
                  <Pressable
                    key={v}
                    style={[s.rateOption, rate === v && s.chapterSelected]}
                    onPress={() => changeRate(v)}
                  >
                    <Text style={s.chapterText}>
                      {v}×{v === 1 ? " · Recorded pace" : ""}
                    </Text>
                    {rate === v && (
                      <Feather name="check" size={18} color={colors.accent} />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
            {sheet === "notes" && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={s.muted}>A thought to keep, just for you.</Text>
                {(entry || editingNote) && (
                  <>
                    {noteDraft?.quote && (
                      <Text
                        style={[
                          s.description,
                          { fontStyle: "italic", marginTop: 16 },
                        ]}
                      >
                        {noteDraft.quote}
                      </Text>
                    )}
                    <TextInput
                      accessibilityLabel="Your note"
                      multiline
                      value={noteText}
                      onChangeText={setNoteText}
                      maxLength={10000}
                      placeholder="What would you like to remember?"
                      placeholderTextColor={colors.muted}
                      style={{
                        minHeight: 120,
                        borderWidth: 1,
                        borderColor: colors.line,
                        borderRadius: 10,
                        color: colors.ink,
                        padding: 15,
                        marginVertical: 18,
                        textAlignVertical: "top",
                      }}
                    />
                    <Pressable
                      style={s.primary}
                      onPress={async () => {
                        if (!noteText.trim()) return;
                        const n: ReaderNote = editingNote
                          ? { ...editingNote, body: noteText.trim() }
                          : {
                              id:
                                Date.now().toString(36) +
                                "-" +
                                Math.random().toString(36).slice(2),
                              bookId: entry!.book.id,
                              chapter,
                              page,
                              time: player.currentTime || 0,
                              body: noteText.trim(),
                              created: Date.now(),
                              ...(noteDraft || {}),
                              kind: "note",
                            };
                        const next = [n, ...notes.filter((x) => x.id !== n.id)];
                        if (await store("notes", next)) {
                          setNotes(next);
                          setNoteText("");
                          setEditingNote(null);
                          setNoteDraft(null);
                          setToast("Your thought has been saved.");
                        }
                      }}
                    >
                      <Text style={s.primaryText}>Save note</Text>
                    </Pressable>
                  </>
                )}
                {notes.map((n) => (
                  <View
                    key={n.id}
                    style={{
                      paddingVertical: 18,
                      borderBottomWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    <Text style={s.muted}>
                      Page {n.page} ·{" "}
                      {books.find((b) => b.book.id === n.bookId)?.book.title ||
                        "Your book"}
                    </Text>
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 16,
                        lineHeight: 25,
                        marginVertical: 12,
                      }}
                    >
                      {n.body}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 24 }}>
                      <Pressable
                        onPress={() => {
                          const e = books.find((b) => b.book.id === n.bookId);
                          if (e) {
                            if (n.segment !== undefined)
                              readingAnchors.current[n.bookId] = {
                                chapter: n.chapter,
                                segment: n.segment,
                                offset: n.offset || 0,
                              };
                            load(n.chapter, n.time, false, e);
                            setReadingKey((k) => k + 1);
                            setPage(n.page);
                            setMode(n.segment !== undefined ? "text" : "pdf");
                            setFollow(false);
                            setReading(true);
                            setSheet("");
                          }
                        }}
                      >
                        <Text style={s.muted}>Open page</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingNote(n);
                          setNoteText(n.body);
                        }}
                      >
                        <Text style={s.muted}>Edit note</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          const next = notes.filter((x) => x.id !== n.id);
                          if (await store("notes", next)) setNotes(next);
                        }}
                      >
                        <Text style={s.muted}>Delete note</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            {(sheet === "join" || (sheet === "account" && isGuest)) && (
              <View>
                <Text style={s.sheetTitle}>Keep your place</Text>
                <Text style={s.description}>
                  Guests can read and listen. Sign in or create an account to
                  save bookmarks, notes and reading progress. Your guest reading
                  place lasts only for this visit. Importing your own books
                  requires an account.
                </Text>
                <Pressable style={s.primary} onPress={requestAccount}>
                  <Text style={s.primaryText}>
                    Sign in or create an account
                  </Text>
                </Pressable>
              </View>
            )}
            {sheet === "account" && session && (
              <ScrollView>
                <Text style={s.sheetTitle}>{session.account.displayName}</Text>
                <Pressable onPress={() => setSheet(isGuest ? "join" : "notes")}>
                  <Text style={[s.muted, { paddingVertical: 15 }]}>
                    My notes →
                  </Text>
                </Pressable>
                <Pressable onPress={() => setSheet("voices")}>
                  <Text style={[s.muted, { paddingVertical: 15 }]}>
                    Narration voice →
                  </Text>
                </Pressable>
                <Text style={s.muted}>@{session.account.username}</Text>
                <Text style={[s.muted, { marginVertical: 18 }]}>
                  Your bookmarks, notes and reading place belong to your
                  account. Imported files stay on this device.
                </Text>
                {!!syncMessage && <Text style={s.muted}>{syncMessage}</Text>}
                {syncMessage.includes("another device") && (
                  <Pressable
                    onPress={() => {
                      void keepLocalChanges().catch((e) => setToast(e.message));
                    }}
                  >
                    <Text style={[s.muted, { paddingVertical: 15 }]}>
                      Keep changes from this device
                    </Text>
                  </Pressable>
                )}
                {session.account.role === "admin" && (
                  <Text style={s.muted}>
                    Manage invitations and library access on the website.
                  </Text>
                )}
                <Pressable
                  style={s.primary}
                  onPress={() => {
                    void logout();
                  }}
                >
                  <Text style={s.primaryText}>Sign out</Text>
                </Pressable>
              </ScrollView>
            )}
            {sheet === "import" && !isGuest && (
              <ImportBook
                styles={s}
                accountId={storageId}
                onAdded={async (e) => {
                  const next = [...books, e];
                  if (
                    !(await store(
                      "books",
                      next.filter((x) => x.book.local),
                    ))
                  )
                    return false;
                  setBooks(next);
                  setSheet("");
                  setToast("Your book is on the shelf.");
                  return true;
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
async function duration(uri: string) {
  const p = createAudioPlayer({ uri }, { updateInterval: 100 });
  try {
    return await new Promise<number>((resolve, reject) => {
      const t = setTimeout(() => {
        sub.remove();
        reject(Error("This audio file could not be read."));
      }, 12000);
      const sub = p.addListener("playbackStatusUpdate", (s) => {
        if (s.isLoaded && s.duration > 0) {
          clearTimeout(t);
          sub.remove();
          resolve(s.duration);
        }
      });
    });
  } finally {
    p.remove();
  }
}
function ImportBook({
  accountId,
  styles: s,
  onAdded,
}: {
  styles: ReturnType<typeof makeStyles>;
  onAdded: (e: Entry) => Promise<boolean>;
  accountId: string;
}) {
  const [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [pdf, setPdf] = useState<Picker.DocumentPickerAsset | null>(null),
    [audio, setAudio] = useState<Picker.DocumentPickerAsset[]>([]),
    [timing, setTiming] = useState<Picker.DocumentPickerAsset | null>(null),
    [pages, setPages] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function pick(kind: "pdf" | "audio" | "timing") {
    try {
      const r = await Picker.getDocumentAsync({
        type:
          kind === "pdf"
            ? "application/pdf"
            : kind === "audio"
              ? "audio/*"
              : "application/json",
        multiple: kind === "audio",
        copyToCacheDirectory: true,
      });
      if (r.canceled) return;
      if (kind === "pdf") {
        setPdf(r.assets[0]);
        setPages(0);
        if (!title) setTitle(r.assets[0].name.replace(/\.pdf$/i, ""));
      } else if (kind === "audio")
        setAudio(
          r.assets.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true }),
          ),
        );
      else setTiming(r.assets[0]);
    } catch {
      setError("The file picker could not open. Please try again.");
    }
  }
  async function submit() {
    if (!pdf || !audio.length || !pages) {
      setError("Choose a PDF and narration, and wait for the PDF page count.");
      return;
    }
    setBusy("Saving your book…");
    setError("");
    let createdFolder = "";
    try {
      const id = "local-" + Date.now(),
        folder = FS.documentDirectory + `reader-${accountId}/books/` + id + "/";
      createdFolder = folder;
      await FS.makeDirectoryAsync(folder, { intermediates: true });
      await FS.copyAsync({ from: pdf.uri, to: folder + "book.pdf" });
      let chapters: Book["chapters"] = [];
      if (timing)
        chapters = validateTimedBook(
          JSON.parse(await FS.readAsStringAsync(timing.uri)),
          audio.map((a) => a.name),
          pages,
        );
      else
        for (let i = 0; i < audio.length; i++) {
          setBusy(`Reading audio ${i + 1} of ${audio.length}…`);
          chapters.push({
            title: audio[i].name.replace(/\.[^.]+$/, ""),
            file: audio[i].name,
            audio: audio[i].name,
            duration: await duration(audio[i].uri),
            segments: [],
          });
        }
      const files: string[] = [];
      for (let i = 0; i < chapters.length; i++) {
        const f = audio.find((a) => a.name === chapters[i].file)!;
        const uri =
          folder + String(i + 1) + "." + (f.name.split(".").pop() || "mp3");
        await FS.copyAsync({ from: f.uri, to: uri });
        files.push(uri);
      }
      const book: Book = {
        id,
        title: title.trim() || pdf.name,
        author: author.trim() || "Personal library",
        pdf: folder + "book.pdf",
        pageCount: pages,
        chapters,
        duration: chapters.reduce((n, c) => n + c.duration, 0),
        local: true,
        voice: "Your audio · your pace",
      };
      const saved = await onAdded({ book, pdf: book.pdf, audio: files });
      if (!saved)
        throw Error(
          "Your book could not be saved. Free some storage and try again.",
        );
    } catch (e) {
      if (createdFolder)
        await FS.deleteAsync(createdFolder, { idempotent: true }).catch(
          () => {},
        );
      setError(
        e instanceof Error
          ? e.message
          : "The book could not be saved. Check device storage.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={s.description}>
        Bring a PDF and its narration. Your files stay on this device.
      </Text>
      <Text style={s.fieldLabel}>Book title</Text>
      <TextInput
        style={s.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Book title"
        placeholderTextColor={s.colors.muted}
      />
      <Text style={s.fieldLabel}>Author</Text>
      <TextInput
        style={s.input}
        value={author}
        onChangeText={setAuthor}
        placeholder="Optional"
        placeholderTextColor={s.colors.muted}
      />
      <Pressable style={s.fileButton} onPress={() => pick("pdf")}>
        <Feather name="file-text" size={23} color={s.colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.chapterText}>Book PDF</Text>
          <Text style={s.small}>
            {pdf
              ? `${pdf.name}${pages ? ` · ${pages} pages` : " · Reading pages…"}`
              : "Choose one PDF"}
          </Text>
        </View>
      </Pressable>
      {pdf && pages === 0 && (
        <View style={{ width: 100, height: 1, opacity: 0 }}>
          <NativePdf
            key={pdf.uri}
            source={pdf.uri}
            page={1}
            onCount={setPages}
            onError={setError}
          />
        </View>
      )}
      <Pressable style={s.fileButton} onPress={() => pick("audio")}>
        <Feather name="headphones" size={23} color={s.colors.accent} />
        <View>
          <Text style={s.chapterText}>Narration</Text>
          <Text style={s.small}>
            {audio.length
              ? `${audio.length} audio files selected`
              : "Choose a full audiobook or chapter files"}
          </Text>
        </View>
      </Pressable>
      <Pressable style={s.fileButton} onPress={() => pick("timing")}>
        <Feather name="clock" size={23} color={s.colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={s.chapterText}>Timing JSON · optional</Text>
          <Text style={s.small}>
            {timing?.name || "Enables passage highlighting and automatic pages"}
          </Text>
        </View>
      </Pressable>
      <Text style={s.small}>
        Without timings, turn the original PDF pages manually while listening.
      </Text>
      {error && (
        <Text accessibilityRole="alert" style={s.errorText}>
          {error}
        </Text>
      )}
      <Pressable
        disabled={!!busy}
        style={[s.primary, { marginTop: 20 }, busy && { opacity: 0.5 }]}
        onPress={submit}
      >
        <Text style={s.primaryText}>{busy || "Add to my bookshelf"}</Text>
        <Feather name="plus" size={18} color={s.colors.paper} />
      </Pressable>
    </ScrollView>
  );
}
function makeStyles(c: typeof paper) {
  return {
    colors: c,
    ...StyleSheet.create({
      root: { flex: 1, backgroundColor: c.bg },
      header: {
        height: 64,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: c.line,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      brand: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        flexShrink: 1,
        marginRight: 8,
      },
      logo: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 26,
        letterSpacing: -1,
        flexShrink: 1,
        color: c.ink,
      },
      row: { flexDirection: "row", alignItems: "center" },
      iconButton: {
        height: 44,
        width: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 22,
      },
      iconActive: { backgroundColor: c.soft },
      pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
      library: {
        padding: 25,
        maxWidth: 1100,
        width: "100%",
        alignSelf: "center",
      },
      eyebrow: {
        fontSize: 9,
        letterSpacing: 1.5,
        fontWeight: "600",
        color: c.accent,
      },
      hero: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        lineHeight: 59,
        letterSpacing: -2,
        color: c.ink,
        marginTop: 23,
      },
      heroAccent: { fontStyle: "italic", color: c.accent },
      intro: {
        fontSize: 12,
        lineHeight: 21,
        color: c.muted,
        marginTop: 18,
        marginBottom: 38,
      },
      sectionHead: {
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderColor: c.line,
      },
      sectionTitle: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 25,
        color: c.ink,
      },
      small: { fontSize: 10, color: c.muted, lineHeight: 17 },
      muted: { fontSize: 13, color: c.muted },
      feature: {
        marginTop: 23,
        paddingBottom: 30,
        borderBottomWidth: 1,
        borderColor: c.line,
      },
      coverStage: {
        height: 289,
        backgroundColor: "#e9e6dc",
        borderRadius: 9,
        alignItems: "center",
        justifyContent: "center",
      },
      bookCover: {
        height: 224,
        width: 158,
        backgroundColor: "#b46d48",
        borderRadius: 3,
        padding: 18,
        alignItems: "center",
        transform: [{ rotate: "-5deg" }],
        boxShadow: "8px 12px 23px rgba(75,51,30,0.2)",
      },
      coverAuthor: {
        fontSize: 7,
        letterSpacing: 1.2,
        color: "#f8eedc",
        textAlign: "center",
      },
      coverTitle: {
        fontSize: 25,
        fontWeight: "600",
        letterSpacing: -1,
        color: "#f8eedc",
        textAlign: "center",
        lineHeight: 27,
        marginTop: 27,
      },
      coverLine: {
        height: 1,
        width: 35,
        backgroundColor: "#f8eedc",
        marginTop: 17,
        marginBottom: 12,
      },
      coverSubtitle: {
        fontSize: 8,
        lineHeight: 13,
        textAlign: "center",
        color: "#f8eedc",
      },
      coverFoot: {
        fontSize: 6,
        letterSpacing: 1.2,
        color: "#f8eedc",
        marginTop: "auto",
      },
      bookInfo: { paddingTop: 24, flex: 1, alignItems: "flex-start" },
      bookTitle: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 32,
        letterSpacing: -0.8,
        color: c.ink,
        marginTop: 12,
      },
      author: { fontSize: 12, color: c.muted, marginTop: 8 },
      description: {
        fontSize: 12,
        lineHeight: 22,
        color: c.muted,
        marginTop: 14,
        marginBottom: 17,
      },
      facts: { flexDirection: "row", gap: 19 },
      primary: {
        minHeight: 46,
        borderRadius: 6,
        backgroundColor: c.accent,
        paddingHorizontal: 20,
        paddingVertical: 13,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 25,
        marginTop: 21,
      },
      primaryText: { color: c.paper, fontSize: 12, fontWeight: "600" },
      voice: { fontSize: 9, color: c.muted, marginTop: 13 },
      progressBlock: { alignSelf: "stretch", marginTop: 18 },
      spaceBetween: { flexDirection: "row", justifyContent: "space-between" },
      progressTrack: {
        height: 3,
        backgroundColor: c.line,
        borderRadius: 3,
        marginTop: 6,
      },
      progressFill: { height: 3, backgroundColor: c.accent, borderRadius: 3 },
      footer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        paddingTop: 24,
      },
      footerText: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 15,
        fontStyle: "italic",
        lineHeight: 21,
        color: c.muted,
      },
      empty: { padding: 30, gap: 17, alignItems: "center" },
      loading: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      },
      reader: { flex: 1 },
      readerTop: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
      readerTitle: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 31,
        lineHeight: 36,
        letterSpacing: -0.7,
        color: c.ink,
        marginTop: 10,
        marginBottom: 8,
      },
      toolbar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginHorizontal: 16,
        paddingVertical: 9,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: c.line,
      },
      segmented: {
        flexDirection: "row",
        backgroundColor: c.line,
        borderRadius: 6,
        padding: 3,
      },
      segment: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: 4 },
      segmentOn: { backgroundColor: c.paper },
      segmentLabel: { fontSize: 10, color: c.ink },
      pageWrap: {
        flex: 1,
        margin: 16,
        marginBottom: 0,
        backgroundColor: c.paper,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 3,
        overflow: "hidden",
        maxWidth: 760,
        alignSelf: "center",
        width: "92%",
      },
      readingPaper: { paddingHorizontal: 19, paddingVertical: 27 },
      passage: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderLeftWidth: 2,
        borderColor: "transparent",
        borderRadius: 3,
        marginBottom: 20,
      },
      spoken: { backgroundColor: c.soft, borderLeftColor: c.accent },
      passageHeading: {
        fontFamily: undefined,
        fontSize: 12,
        letterSpacing: 1.2,
        fontWeight: "600",
        lineHeight: 21,
      },
      chapterEnd: { paddingVertical: 28, alignItems: "center" },
      nextChapter: {
        paddingTop: 20,
        borderTopWidth: 1,
        borderColor: c.line,
        flexDirection: "row",
        alignItems: "center",
        gap: 20,
      },
      nextTitle: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 23,
        color: c.ink,
        marginTop: 8,
      },
      pageNav: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
        minHeight: 48,
      },
      follow: { padding: 8, borderRadius: 5, marginLeft: 4 },
      followOn: { backgroundColor: c.soft },
      player: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: c.paper,
        borderTopWidth: 1,
        borderColor: c.line,
        paddingTop: 10,
        paddingHorizontal: 21,
      },
      playerTop: { flexDirection: "row", alignItems: "center", gap: 8 },
      playerTitle: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 17,
        color: c.ink,
      },
      rateButton: { padding: 11 },
      rateText: { fontSize: 12, fontWeight: "600", color: c.ink },
      playerControls: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 4,
      },
      bigPlay: {
        width: 52,
        height: 52,
        backgroundColor: c.accent,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
      },
      skip: {
        width: 48,
        height: 48,
        gap: 2,
        alignItems: "center",
        justifyContent: "center",
      },
      skipNumber: {
        fontSize: 11,
        fontWeight: "600",
        color: c.muted,
      },
      seekRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 3,
      },
      time: { fontSize: 9, color: c.muted, fontVariant: ["tabular-nums"] },
      errorText: {
        fontSize: 11,
        lineHeight: 18,
        color: "#b34f3e",
        paddingVertical: 8,
      },
      toast: {
        position: "absolute",
        left: 20,
        right: 20,
        backgroundColor: c.ink,
        borderRadius: 8,
        padding: 13,
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
      },
      toastText: { fontSize: 12, lineHeight: 18, color: c.paper, flex: 1 },
      sheetBackdrop: {
        flex: 1,
        backgroundColor: "#18211680",
        justifyContent: "flex-end",
      },
      sheet: {
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        backgroundColor: c.paper,
        paddingHorizontal: 23,
        paddingTop: 10,
        minHeight: 200,
      },
      sheetHandle: {
        height: 4,
        width: 34,
        borderRadius: 3,
        backgroundColor: c.line,
        alignSelf: "center",
        marginBottom: 12,
      },
      sheetHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 17,
      },
      sheetTitle: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 26,
        color: c.ink,
        flex: 1,
      },
      chapterRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        padding: 14,
        borderRadius: 7,
        minHeight: 64,
      },
      chapterSelected: { backgroundColor: c.soft },
      chapterNo: { fontSize: 10, color: c.muted, width: 20 },
      chapterText: { fontSize: 13, lineHeight: 21, color: c.ink },
      bookmarkRow: {
        flexDirection: "row",
        gap: 10,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: c.line,
      },
      markText: {
        fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
        fontSize: 18,
        lineHeight: 27,
        color: c.ink,
        marginBottom: 7,
      },
      rates: { paddingBottom: 8 },
      rateOption: {
        padding: 16,
        borderRadius: 6,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      fieldLabel: {
        fontSize: 11,
        color: c.ink,
        marginBottom: 7,
        marginTop: 12,
      },
      input: {
        minHeight: 45,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.bg,
        padding: 11,
        fontSize: 13,
        color: c.ink,
      },
      fileButton: {
        marginTop: 17,
        minHeight: 74,
        borderRadius: 6,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: c.line,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
      },
    }),
  };
}
