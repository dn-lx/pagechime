"use client";
import { useEffect, useRef, useState } from "react";

const phoneReaderQuery =
  "(max-width: 767px), (pointer: coarse) and (max-height: 550px)";

export function useReaderFullscreen() {
  const [active, setActive] = useState(false);
  const [notice, setNotice] = useState("");
  const ownsFullscreen = useRef(false);
  const wantsFullscreen = useRef(false);
  const mounted = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const changed = () => {
      if (ownsFullscreen.current && !document.fullscreenElement) {
        ownsFullscreen.current = false;
        wantsFullscreen.current = false;
        setActive(false);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.fullscreenElement &&
        !document.querySelector("dialog[open]")
      ) {
        wantsFullscreen.current = false;
        setActive(false);
      }
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
  const exit = async () => {
    if (ownsFullscreen.current && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        return;
      }
    }
    ownsFullscreen.current = false;
    wantsFullscreen.current = false;
    setNotice("");
    setActive(false);
  };
  const enter = async (onBookOpen = false) => {
    const fullWindow = matchMedia(phoneReaderQuery).matches;
    if (wantsFullscreen.current || (onBookOpen && !fullWindow)) return;
    wantsFullscreen.current = true;
    setNotice("");
    setActive(true);
    // The phone layout stays active when the browser suspends the tab.
    if (fullWindow || pending.current) return;
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
      if (!mounted.current || !wantsFullscreen.current) {
        await document.exitFullscreen();
        return;
      }
      ownsFullscreen.current = true;
    } catch {
      if (mounted.current && wantsFullscreen.current)
        setNotice(
          "This browser uses a full-window reading view. Tap Exit to return.",
        );
    } finally {
      pending.current = false;
    }
  };
  return {
    active,
    notice,
    enterOnBookOpen: () => enter(true),
    exit,
    toggle: () => (active ? exit() : enter()),
  };
}
