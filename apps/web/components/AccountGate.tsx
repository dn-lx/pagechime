"use client";
import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  Leaf,
  ArrowRight,
  Headphones,
  BookOpen,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import {
  readerClient,
  readerDetailsError,
  ReaderSync,
  ReaderApiError,
  type ReaderSession,
  type CloudItem,
} from "@pagechime/core";
import {
  createGuestStorage,
  createReaderStorage,
  type ReaderStorage,
} from "../lib/storage";
import { AccountContext } from "../lib/account";
const api = readerClient("/api/reader");
// Keep the original storage keys so a branding update preserves sessions and pending logout.
const remembered = "leaf.reader.session";
async function workerScope(
  account: string | null,
  expiresAt?: string,
  valid: () => boolean = () => true,
) {
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) return;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await navigator.serviceWorker.register("/sw.js");
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => {
        readyTimer = setTimeout(
          () => reject(Error("Offline storage is unavailable.")),
          5000,
        );
      }),
    ]);
  } catch (error) {
    if (navigator.serviceWorker.controller) throw error;
    return; // A tab without a controlling worker can read normally over the network.
  } finally {
    if (readyTimer) clearTimeout(readyTimer);
  }
  if (!navigator.serviceWorker.controller)
    await new Promise<void>((resolve) => {
      const done = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", done);
        resolve();
      };
      navigator.serviceWorker.addEventListener("controllerchange", done);
      setTimeout(done, 3000);
    });
  if (!valid()) return;
  const worker = navigator.serviceWorker.controller;
  if (worker)
    await new Promise<void>((resolve, reject) => {
      const channel = new MessageChannel(),
        timer = setTimeout(
          () =>
            reject(
              Error("Offline storage could not be prepared. Please reload."),
            ),
          5000,
        );
      channel.port1.onmessage = () => {
        clearTimeout(timer);
        resolve();
      };
      worker.postMessage({ type: "reader-account", account, expiresAt }, [
        channel.port2,
      ]);
    });
}
export default function AccountGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ReaderSession | null>(null),
    [storage, setStorage] = useState<ReaderStorage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [syncMessage, setSyncMessage] = useState(""),
    [invite, setInvite] = useState(""),
    [busy, setBusy] = useState(false),
    [guest, setGuest] = useState(false),
    [register, setRegister] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const activeId = useRef<string | null>(null),
    generation = useRef(0);
  const engine = useRef<ReaderSync | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearSyncTimer() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  async function enter(s: ReaderSession, offline = false) {
    const attempt = ++generation.current;
    setGuest(false);
    activeId.current = s.account.id;
    engine.current?.close();
    clearSyncTimer();
    const scopedApi = readerClient("/api/reader", () => null, s.account.id);
    let store: ReaderStorage;
    const sync = new ReaderSync(
      scopedApi,
      (p) => store.writeSaved("outbox", p, true),
      createReaderStorage(s.account.id).readSaved("outbox", {}),
      (message, status) => {
        setSyncMessage(message);
        if (status === 401 && attempt === generation.current)
          void logout(attempt);
      },
    );
    store = createReaderStorage(s.account.id, (key, value, previous) => {
      if (key === "bookmarks" || key === "notes") {
        const prefix = key === "bookmarks" ? "bookmark." : "note.",
          next = value as { id: string }[],
          old = (previous || []) as { id: string }[];
        for (const item of next)
          if (
            JSON.stringify(item) !==
            JSON.stringify(old.find((x) => x.id === item.id))
          )
            sync.change(prefix + item.id, item as Record<string, unknown>);
        for (const item of old)
          if (!next.some((x) => x.id === item.id))
            sync.change(prefix + item.id, null);
      } else if (key.startsWith("progress."))
        sync.change(key, { ...(value as object), bookId: key.slice(9) });
      else return;
      if (!timer.current)
        timer.current = setTimeout(() => {
          timer.current = null;
          void sync.flush().then(() => {
            if (!sync.error) setSyncMessage("");
          });
        }, 1500);
    });
    engine.current = sync;
    if (!offline)
      await sync.start((items: CloudItem[]) => {
        for (const [kind, local] of [
          ["bookmark.", "bookmarks"],
          ["note.", "notes"],
        ]) {
          const existing = store.readSaved<{ id: string }[]>(local, []),
            map = new Map(existing.map((x) => [x.id, x]));
          for (const row of items.filter((x) => x.key.startsWith(kind))) {
            const id = row.key.slice(kind.length);
            if (row.value) map.set(id, row.value as { id: string });
            else map.delete(id);
          }
          store.writeSaved(local, [...map.values()], true);
        }
        for (const row of items.filter((x) => x.key.startsWith("progress.")))
          if (row.value) store.writeSaved(row.key, row.value, true);
      });
    if (attempt !== generation.current) return;
    await workerScope(
      s.account.id,
      s.expiresAt,
      () => attempt === generation.current,
    );
    if (attempt !== generation.current) return;
    localStorage.setItem(remembered, JSON.stringify(s));
    localStorage.removeItem("leaf.reader.logged-out");
    activeId.current = s.account.id;
    setStorage(store);
    setSession(s);
    setLoading(false);
    if (offline)
      setSyncMessage("Offline · your changes will sync when you reconnect.");
  }
  useEffect(() => {
    const fragment = new URLSearchParams(location.hash.slice(1)),
      code = fragment.get("invite");
    if (code) {
      setInvite(code);
      history.replaceState(null, "", location.pathname);
    }
    const initial = generation.current;
    (async () => {
      try {
        if (localStorage.getItem("leaf.reader.logged-out")) {
          await revoke();
        }
        const restored = await api<ReaderSession>("/me");
        if (initial !== generation.current) return;
        await enter(restored);
      } catch (e) {
        if (initial !== generation.current) return;
        let saved: ReaderSession | null = null;
        try {
          saved = JSON.parse(localStorage.getItem(remembered) || "null");
        } catch {}
        if (
          !navigator.onLine &&
          saved &&
          Date.parse(saved.expiresAt) > Date.now() &&
          !localStorage.getItem("leaf.reader.logged-out")
        ) {
          try {
            await enter(saved, true);
            return;
          } catch {}
        }
        if (e instanceof ReaderApiError && e.status === 401) {
          localStorage.removeItem(remembered);
          await workerScope(null).catch(() => {});
        }
        setLoading(false);
      }
    })();
    const online = () => {
      if (engine.current)
        engine.current
          .flush()
          .then(() => setSyncMessage(engine.current?.error || ""));
    };
    window.addEventListener("online", online);
    const retry = setInterval(online, 15000);
    const changed = (e: StorageEvent) => {
      if (e.key !== remembered) return;
      let next = null;
      try {
        next = JSON.parse(e.newValue || "null")?.account?.id;
      } catch {}
      if (next !== activeId.current) {
        generation.current++;
        engine.current?.close();
        clearSyncTimer();
        activeId.current = null;
        setSession(null);
        setGuest(false);
        setStorage(null);
        void workerScope(null);
        setError("Your account changed in another tab. Please sign in again.");
      }
    };
    window.addEventListener("storage", changed);
    return () => {
      engine.current?.close();
      clearSyncTimer();
      window.removeEventListener("online", online);
      clearInterval(retry);
      window.removeEventListener("storage", changed);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const attempt = generation.current;
    const verify = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const s = await api<ReaderSession>("/me");
        if (attempt !== generation.current) return;
        if (s.account.id !== session.account.id) {
          engine.current?.close();
          clearSyncTimer();
          activeId.current = null;
          setSession(null);
          setStorage(null);
          await workerScope(null);
        }
      } catch (e) {
        if (
          e instanceof ReaderApiError &&
          e.status === 401 &&
          attempt === generation.current
        )
          await logout(attempt);
      }
    };
    const expiry = setTimeout(
      () => {
        void logout(attempt);
      },
      Math.max(0, Date.parse(session.expiresAt) - Date.now()),
    );
    const poll = setInterval(() => {
      void verify();
    }, 60000);
    window.addEventListener("focus", verify);
    document.addEventListener("visibilitychange", verify);
    return () => {
      clearTimeout(expiry);
      clearInterval(poll);
      window.removeEventListener("focus", verify);
      document.removeEventListener("visibilitychange", verify);
    };
  }, [session]);
  async function revoke() {
    try {
      await api("/logout", "POST", {});
      localStorage.removeItem("leaf.reader.logged-out");
    } catch (e) {
      if (e instanceof ReaderApiError && e.status === 401)
        localStorage.removeItem("leaf.reader.logged-out");
      else throw e;
    }
  }
  async function logout(expected = generation.current) {
    if (expected !== generation.current) return;
    generation.current++;
    setBusy(true);
    engine.current?.close();
    clearSyncTimer();
    // Unmount the reader before clearing the worker so playback and object URLs stop.
    activeId.current = null;
    setSession(null);
    setGuest(false);
    setStorage(null);
    try {
      localStorage.removeItem(remembered);
    } catch {}
    try {
      localStorage.setItem("leaf.reader.logged-out", "1");
    } catch {
      setError(
        "Signed out here. Please reconnect to finish revoking this session.",
      );
    }
    await workerScope(null).catch(() => {});
    try {
      await revoke();
    } catch {}
    setSyncMessage("");
    setBusy(false);
  }
  function requestAccount() {
    generation.current++;
    setGuest(false);
    setStorage(null);
    setError("");
    setRegister(false);
    setLoading(false);
  }
  async function enterGuest() {
    const attempt = ++generation.current;
    setBusy(true);
    engine.current?.close();
    clearSyncTimer();
    try {
      localStorage.removeItem(remembered);
      localStorage.setItem("leaf.reader.logged-out", "1");
    } catch {}
    activeId.current = null;
    setSession(null);
    setError("");
    setSyncMessage("");
    try {
      await revoke();
      await workerScope(null, undefined, () => attempt === generation.current);
      if (attempt !== generation.current) return;
      setStorage(createGuestStorage());
      setGuest(true);
    } catch {
      if (attempt === generation.current)
        setError(
          "Guest reading could not open because sign-out cleanup did not finish. Check your connection and try again.",
        );
    } finally {
      if (attempt === generation.current) {
        setLoading(false);
        setBusy(false);
      }
    }
  }
  if ((session || guest) && storage)
    return (
      <AccountContext.Provider
        value={{
          account: session?.account ?? null,
          isGuest: guest,
          requestAccount,
          storage,
          logout,
          syncMessage,
          keepLocalChanges: async () => {
            await engine.current?.keepLocalChanges();
            setSyncMessage(engine.current?.error || "");
          },
        }}
      >
        {children}
      </AccountContext.Provider>
    );
  return (
    <main className="account-page">
      <div className="account-art" aria-hidden="true">
        <div className="account-orbit" />
        <Leaf weight="duotone" size={64} />
        <p>
          A little time.
          <br />
          <em>A world within.</em>
        </p>
        <span>
          <BookOpen /> Read at your pace <Headphones /> Listen a little closer
        </span>
      </div>
      <section className="account-panel">
        <div className="account-wordmark">
          <Leaf weight="duotone" /> Pagechime.
        </div>
        <p className="eyebrow">YOUR READING SPACE</p>
        <h1>
          {loading
            ? "Settling you in…"
            : invite || register
              ? "Make yourself at home."
              : "Welcome back."}
        </h1>
        <p className="account-intro">
          {invite || register
            ? "Choose your account details. Your books, thoughts and little bookmarks will have a place of their own."
            : "Your next chapter is waiting. Sign in to pick up where you left off."}
        </p>
        {!loading && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              const data = new FormData(e.currentTarget);
              const invalid = readerDetailsError(
                String(data.get("username") || ""),
                String(data.get("password") || ""),
                invite || register
                  ? String(data.get("displayName") || "")
                  : undefined,
              );
              if (invalid) {
                setError(invalid);
                return;
              }
              setBusy(true);
              try {
                if (localStorage.getItem("leaf.reader.logged-out"))
                  await revoke();
                const creating = !!invite || register;
                const received = await api<ReaderSession>(
                  invite ? "/activate" : register ? "/register" : "/login",
                  "POST",
                  {
                    username: data.get("username"),
                    password: data.get("password"),
                    displayName: data.get("displayName"),
                    invite,
                  },
                );
                if (creating) {
                  setInvite("");
                  setRegister(false);
                }
                try {
                  await enter(received);
                } catch (error) {
                  if (creating)
                    throw Error(
                      "Your account was created, but the reader could not open. Sign in to try again.",
                    );
                  throw error;
                }
                setInvite("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {(invite || register) && (
              <label>
                Your name
                <input
                  name="displayName"
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </label>
            )}
            <label>
              Username or email
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                minLength={3}
                maxLength={254}
                required
              />
            </label>
            <label htmlFor="reader-password">Password</label>
            <div className="password-field">
              <input
                id="reader-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  invite || register ? "new-password" : "current-password"
                }
                minLength={12}
                maxLength={256}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeSlash size={22} /> : <Eye size={22} />}
                <span>{showPassword ? "Hide" : "Show"}</span>
              </button>
            </div>
            {(invite || register) && (
              <p className="account-hint">
                Use at least 12 characters for your password. An email address
                is used only to sign in; email recovery is not available yet.
              </p>
            )}
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              {busy
                ? "A moment…"
                : invite || register
                  ? "Create my account"
                  : "Enter my library"}
              <ArrowRight />
            </button>
          </form>
        )}
        <div className="account-options">
          {!invite && !loading && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRegister((v) => !v);
                setError("");
                setShowPassword(false);
              }}
            >
              {register
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </button>
          )}
          <button
            type="button"
            className="guest-button"
            disabled={busy}
            onClick={() => void enterGuest()}
          >
            Continue as guest <ArrowRight />
          </button>
          <p className="account-hint">
            Guests can read and listen. Create an account to save bookmarks,
            notes, reading progress and offline books.
          </p>
          {invite && (
            <p className="account-hint">
              Your invitation is private and can be used once.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
