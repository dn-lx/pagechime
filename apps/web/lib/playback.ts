"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  type Book,
  type Progress,
  clamp,
  adjacentListeningChapter,
  firstListeningChapter,
  skipListeningPosition,
  segmentAt,
} from "@pagechime/core";
import type { ReaderStorage } from "./storage";
export function usePlayback(
  notify: (s: string) => void,
  storage: ReaderStorage,
) {
  const { readSaved, writeSaved } = storage;
  const [book, setBook] = useState<Book | null>(null),
    [chapter, setChapter] = useState(0),
    [time, setTime] = useState(0),
    [page, setPageState] = useState(1),
    [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false),
    [rate, setRateState] = useState(1),
    [sleep, setSleep] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null),
    current = useRef<Book | null>(null),
    ci = useRef(0),
    requestedTime = useRef(0),
    pageRef = useRef(1),
    generation = useRef(0),
    deadline = useRef(0),
    saveAt = useRef(0),
    loadRef = useRef<(i: number, t?: number, play?: boolean, b?: Book) => void>(
      () => {},
    );
  const save = useCallback(() => {
    const b = current.current,
      a = audio.current;
    if (!a || !b) return;
    const p: Progress = {
      chapter: ci.current,
      time: a.currentTime || 0,
      page: pageRef.current,
      updated: Date.now(),
      reading: readSaved<Progress | null>("progress." + b.id, null)?.reading,
    };
    writeSaved("progress." + b.id, p);
  }, []);
  const load = useCallback(
    (index: number, position = 0, autoplay = false, newBook?: Book) => {
      const b = newBook || current.current,
        a = audio.current;
      if (!b || !a) return;
      const i = clamp(index, 0, b.chapters.length - 1),
        ch = b.chapters[i],
        t = clamp(position, 0, Math.max(0, ch.duration - 0.01));
      save();
      a.pause();
      pageRef.current =
        ch.segments[segmentAt(ch.segments, t)]?.page || ch.firstPage || 1;
      setPageState(pageRef.current);
      if (newBook) {
        current.current = b;
        setBook(b);
      }
      ci.current = i;
      setChapter(i);
      setTime(t);
      requestedTime.current = t;
      setFailed(false);
      const token = ++generation.current;
      setLoading(true);
      const ready = () => {
        if (token !== generation.current) return;
        a.currentTime = requestedTime.current;
        setTime(requestedTime.current);
        setLoading(false);
        save();
      };
      a.addEventListener("loadedmetadata", ready, { once: true });
      a.src = ch.audio;
      a.load();
      if (autoplay)
        a.play().catch(() => {
          if (token === generation.current) {
            setLoading(false);
            notify("Tap play to start listening.");
          }
        });
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: ch.title,
          artist: b.author,
          album: b.title,
          artwork: b.cover ? [{ src: b.cover }] : [],
        });
      }
    },
    [notify, save],
  );
  loadRef.current = load;
  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    audio.current = a;
    const events: { [name: string]: () => void } = {
      timeupdate: () => {
        setTime(a.currentTime);
        if (Date.now() - saveAt.current > 1000) {
          saveAt.current = Date.now();
          save();
        }
        if (
          "mediaSession" in navigator &&
          a.duration &&
          Number.isFinite(a.duration)
        ) {
          try {
            navigator.mediaSession.setPositionState({
              duration: a.duration,
              position: clamp(a.currentTime, 0, a.duration),
              playbackRate: a.playbackRate,
            });
          } catch {}
        }
      },
      play: () => setPlaying(true),
      pause: () => {
        setPlaying(false);
        save();
      },
      canplay: () => setLoading(false),
      waiting: () => setLoading(true),
      error: () => {
        setLoading(false);
        setFailed(true);
        notify(
          "The audio could not load. Check your connection and try play again.",
        );
      },
      ended: () => {
        save();
        const b = current.current;
        const next = b && adjacentListeningChapter(b.chapters, ci.current, 1);
        if (b && next !== null && next !== undefined)
          loadRef.current(next, 0, true);
        else {
          setPlaying(false);
          notify("You’ve reached the end of the book.");
        }
      },
    };
    Object.entries(events).forEach(([k, v]) => a.addEventListener(k, v));
    const stop = () => save();
    window.addEventListener("pagehide", stop);
    return () => {
      save();
      Object.entries(events).forEach(([k, v]) => a.removeEventListener(k, v));
      window.removeEventListener("pagehide", stop);
      a.pause();
      a.src = "";
      audio.current = null;
    };
  }, [notify, save]);
  const toggle = useCallback(() => {
    const a = audio.current;
    if (!a || !current.current) return;
    if (a.paused) {
      if (a.error) a.load();
      a.play().catch(() =>
        notify(
          "Audio is unavailable. Please check the file or your connection.",
        ),
      );
    } else a.pause();
  }, [notify]);
  const seek = useCallback(
    (t: number) => {
      const a = audio.current,
        b = current.current;
      if (!a || !b) return;
      const v = clamp(t, 0, b.chapters[ci.current].duration);
      requestedTime.current = v;
      try {
        a.currentTime = v;
        setTime(v);
        save();
      } catch {
        notify("Audio is still loading. Try again in a moment.");
      }
    },
    [notify, save],
  );
  const skip = useCallback(
    (seconds: number) => {
      const b = current.current,
        a = audio.current;
      if (!b || !a) return;
      const p = skipListeningPosition(
        b.chapters,
        ci.current,
        a.currentTime,
        seconds,
      );
      if (p.chapter === ci.current) seek(p.time);
      else loadRef.current(p.chapter, p.time, !a.paused);
    },
    [seek],
  );
  const open = useCallback((b: Book, startOver = false) => {
    const p = startOver
      ? null
      : readSaved<Progress | null>("progress." + b.id, null);
    loadRef.current(
      p?.chapter ?? firstListeningChapter(b.chapters),
      p?.time || 0,
      false,
      b,
    );
    if (p?.page) {
      pageRef.current = clamp(p.page, 1, b.pageCount);
      setPageState(pageRef.current);
    }
  }, []);
  const setRate = useCallback((value: number) => {
    const v = clamp(value, 0.5, 2);
    setRateState(v);
    if (audio.current) {
      audio.current.defaultPlaybackRate = v;
      audio.current.playbackRate = v;
    }
    writeSaved("rate", v);
  }, []);
  useEffect(() => {
    setRate(readSaved("rate", 1));
  }, [setRate]);
  const setSleepTimer = useCallback(
    (minutes: number) => {
      deadline.current = minutes ? Date.now() + minutes * 60000 : 0;
      setSleep(minutes * 60);
      if (minutes) notify(`Playback will pause in ${minutes} minutes.`);
    },
    [notify],
  );
  useEffect(() => {
    const check = () => {
      if (!deadline.current) return;
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setSleep(left);
      if (!left) {
        deadline.current = 0;
        audio.current?.pause();
        notify("Sleep timer finished. Your place is saved.");
      }
    };
    const id = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [notify]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => {
        audio.current?.play().catch(() => {});
      },
      pause: () => audio.current?.pause(),
      seekbackward: () => skip(-10),
      seekforward: () => skip(10),
      previoustrack: () => {
        const b = current.current,
          previous = b && adjacentListeningChapter(b.chapters, ci.current, -1);
        if (previous !== null && previous !== undefined)
          loadRef.current(previous, 0, true);
      },
      nexttrack: () => {
        const b = current.current;
        const next = b && adjacentListeningChapter(b.chapters, ci.current, 1);
        if (next !== null && next !== undefined) loadRef.current(next, 0, true);
      },
      seekto: (d) => {
        if (d.seekTime !== undefined) seek(d.seekTime);
      },
    };
    Object.entries(handlers).forEach(([k, v]) => {
      try {
        navigator.mediaSession.setActionHandler(k as MediaSessionAction, v!);
      } catch {}
    });
    return () =>
      Object.keys(handlers).forEach((k) => {
        try {
          navigator.mediaSession.setActionHandler(
            k as MediaSessionAction,
            null,
          );
        } catch {}
      });
  }, [seek, skip]);
  const close = useCallback(() => {
    save();
    audio.current?.pause();
    current.current = null;
    setBook(null);
  }, [save]);
  const clock = useCallback(() => audio.current?.currentTime ?? 0, []);
  return {
    clock,
    book,
    chapter,
    previousChapter: book
      ? adjacentListeningChapter(book.chapters, chapter, -1)
      : null,
    nextChapter: book
      ? adjacentListeningChapter(book.chapters, chapter, 1)
      : null,
    time,
    page,
    setPage: (value: number) => {
      pageRef.current = clamp(value, 1, current.current?.pageCount || 1);
      setPageState(pageRef.current);
      save();
    },
    playing,
    loading,
    failed,
    rate,
    sleep,
    load,
    toggle,
    seek,
    skip,
    open,
    close,
    setRate,
    setSleepTimer,
    pause: () => audio.current?.pause(),
    setVolume: (v: number) => {
      if (audio.current) audio.current.volume = clamp(v, 0, 1);
    },
  };
}
export type Playback = ReturnType<typeof usePlayback>;
