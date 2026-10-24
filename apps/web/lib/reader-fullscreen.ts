"use client";
import { useEffect, useRef, useState } from "react";

export function useReaderFullscreen() {
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState("");
  const ownsFullscreen = useRef(false);
  const mounted = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const changed = () => {
      if (ownsFullscreen.current && !document.fullscreenElement) {
        ownsFullscreen.current = false;
        setActive(false);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement)
        setActive(false);
    };
    document.addEventListener("fullscreenchange", changed);
    document.addEventListener("keydown", key);
    return () => {
      mounted.current = false;
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("keydown", key);
      if (ownsFullscreen.current && document.fullscreenElement)
        void document.exitFullscreen().catch(() => {});
    };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("focus-reading", active);
    return () => document.body.classList.remove("focus-reading");
  }, [active]);
  const toggle = async () => {
    if (pending.current) return;
    setNotice("");
    if (active) {
      if (ownsFullscreen.current && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          return;
        }
      }
      ownsFullscreen.current = false;
      setActive(false);
      return;
    }
    // Request directly from the tap, before any awaited work consumes activation.
    pending.current = true;
    try {
      if (
        !document.documentElement.requestFullscreen ||
        !document.fullscreenEnabled
      )
        throw Error("Fullscreen unavailable");
      await document.documentElement.requestFullscreen({
        navigationUI: "hide",
      });
      if (!mounted.current) {
        await document.exitFullscreen();
        return;
      }
      ownsFullscreen.current = true;
    } catch {
      if (mounted.current)
        setNotice(
          "This browser uses a full-window reading view. Tap Exit to return.",
        );
    } finally {
      pending.current = false;
    }
    if (mounted.current) setActive(true);
  };
  return { active, notice, toggle };
}
