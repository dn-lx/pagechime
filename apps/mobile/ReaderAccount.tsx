import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  readerClient,
  readerDetailsError,
  ReaderApiError,
  ReaderNetworkError,
  ReaderSync,
  type ReaderSession,
  type CloudItem,
} from "@pagechime/core";
const BASE =
  "https://wbqnctrvxohxwiaignhg.supabase.co/functions/v1/book-reader-api";
const SESSION = "reader.session.v1";
const PENDING_LOGOUT = "reader.pending-logout.v1";
async function revokePending() {
  const token = await SecureStore.getItemAsync(PENDING_LOGOUT);
  if (!token) return;
  try {
    await readerClient(BASE, () => token)("/logout", "POST", {});
    await SecureStore.deleteItemAsync(PENDING_LOGOUT);
  } catch (e) {
    if (e instanceof ReaderApiError && e.status === 401)
      await SecureStore.deleteItemAsync(PENDING_LOGOUT);
    else throw e;
  }
}
type Scope = {
  session: ReaderSession | null;
  isGuest: boolean;
  storageId: string;
  requestAccount: () => void;
  api: ReturnType<typeof readerClient>;
  read: <T>(key: string, fallback: T) => Promise<T>;
  store: (key: string, value: unknown) => Promise<boolean>;
  logout: () => Promise<void>;
  syncMessage: string;
  keepLocalChanges: () => Promise<void>;
};
const Context = createContext<Scope | null>(null);
export function useReaderAccount() {
  const value = useContext(Context);
  if (!value) throw Error("Please sign in.");
  return value;
}
export default function ReaderAccountGate({
  children,
}: {
  children: ReactNode;
}) {
  const [scope, setScope] = useState<Omit<Scope, "syncMessage"> | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [syncMessage, setSyncMessage] = useState("");
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [invite, setInvite] = useState(""),
    [activate, setActivate] = useState(false),
    [register, setRegister] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const generation = useRef(0);
  const engine = useRef<ReaderSync | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function enter(s: ReaderSession & { token: string }, offline = false) {
    const attempt = ++generation.current;
    engine.current?.close();
    const api = readerClient(BASE, () => s.token, s.account.id),
      // Retain the original account namespace for installed-app continuity.
      prefix = `leaf.account.${s.account.id}.`;
    const read = async <T,>(key: string, fallback: T): Promise<T> => {
      try {
        return (
          JSON.parse((await AsyncStorage.getItem(prefix + key)) || "null") ??
          fallback
        );
      } catch {
        return fallback;
      }
    };
    const raw = async (key: string, value: unknown) => {
      await AsyncStorage.setItem(prefix + key, JSON.stringify(value));
    };
    let writes = Promise.resolve();
    const sync = new ReaderSync(
      api,
      (p) => {
        const data = JSON.stringify(p);
        writes = writes
          .then(() => AsyncStorage.setItem(prefix + "outbox", data))
          .catch(() =>
            setSyncMessage(
              "Device storage is unavailable. Keep the app open to sync.",
            ),
          );
      },
      await read("outbox", {}),
      (message, status) => {
        setSyncMessage(message);
        if (status === 401 && attempt === generation.current)
          void signOut(s.token, attempt);
      },
    );
    engine.current = sync;
    const store = async (key: string, value: unknown) => {
      try {
        const previous = await read<unknown>(key, null);
        await raw(key, value);
        if (key === "marks" || key === "notes") {
          const kind = key === "marks" ? "bookmark." : "note.",
            old = (previous || []) as { id: string }[],
            next = value as { id: string }[];
          for (const item of next)
            if (
              JSON.stringify(item) !==
              JSON.stringify(old.find((x) => x.id === item.id))
            )
              sync.change(kind + item.id, item as Record<string, unknown>);
          for (const item of old)
            if (!next.some((x) => x.id === item.id))
              sync.change(kind + item.id, null);
        } else if (key === "progress") {
          for (const [id, item] of Object.entries(
            value as Record<string, object>,
          ))
            if (
              JSON.stringify(item) !==
              JSON.stringify((previous as Record<string, object> | null)?.[id])
            )
              sync.change("progress." + id, { ...item, bookId: id });
        } else return true;
        if (!timer.current)
          timer.current = setTimeout(() => {
            timer.current = null;
            void sync.flush().then(() => {
              if (!sync.error) setSyncMessage("");
            });
          }, 1500);
        return true;
      } catch {
        Alert.alert(
          "Storage is unavailable",
          "Your latest change could not be saved.",
        );
        return false;
      }
    };
    if (!offline)
      await sync.start(async (items: CloudItem[]) => {
        // This callback is awaited by ReaderSync before the reader mounts.
        for (const [kind, key] of [
          ["bookmark.", "marks"],
          ["note.", "notes"],
        ]) {
          const existing = await read<{ id: string }[]>(key, []),
            map = new Map(existing.map((x) => [x.id, x]));
          for (const row of items.filter((x) => x.key.startsWith(kind))) {
            const id = row.key.slice(kind.length);
            if (row.value) map.set(id, row.value as { id: string });
            else map.delete(id);
          }
          await raw(key, [...map.values()]);
        }
        const progress = await read<Record<string, unknown>>("progress", {});
        for (const row of items.filter((x) => x.key.startsWith("progress.")))
          if (row.value) progress[row.key.slice(9)] = row.value;
        await raw("progress", progress);
      });
    if (attempt !== generation.current) return;
    await SecureStore.setItemAsync(SESSION, JSON.stringify(s));
    if (attempt !== generation.current) return;
    setPassword("");
    setScope({
      session: s,
      isGuest: false,
      storageId: s.account.id,
      requestAccount: () => {},
      api,
      read,
      store,
      logout: async () => {
        await signOut(s.token, attempt);
      },
      keepLocalChanges: async () => {
        await sync.keepLocalChanges();
        setSyncMessage(sync.error);
      },
    });
    setLoading(false);
    if (offline)
      setSyncMessage("Offline · changes will sync when you reconnect.");
  }
  async function signOut(token: string, expected = generation.current) {
    if (expected !== generation.current) return;
    generation.current++;
    engine.current?.close();
    if (timer.current) clearTimeout(timer.current);
    setScope(null);
    setSyncMessage("");
    let retained = true;
    try {
      await SecureStore.setItemAsync(PENDING_LOGOUT, token);
    } catch {
      retained = false;
    }
    try {
      await SecureStore.deleteItemAsync(SESSION);
    } catch {
      retained = false;
    }
    try {
      await readerClient(BASE, () => token)("/logout", "POST", {});
      await SecureStore.deleteItemAsync(PENDING_LOGOUT);
    } catch (e) {
      if (e instanceof ReaderApiError && e.status === 401) {
        try {
          await SecureStore.deleteItemAsync(PENDING_LOGOUT);
        } catch {}
      } else if (!retained)
        setError(
          "Signed out here. Reconnect to finish revoking this session; secure device storage is unavailable.",
        );
    }
  }
  useEffect(() => {
    if (!scope?.session) return;
    const verify = async () => {
      try {
        await scope.api("/me");
      } catch (e) {
        if (e instanceof ReaderApiError && e.status === 401)
          await scope.logout();
      }
    };
    const expiry = setTimeout(
      () => {
        void scope.logout();
      },
      Math.max(0, Date.parse(scope.session!.expiresAt) - Date.now()),
    );
    const poll = setInterval(() => {
      void verify();
    }, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void verify();
    });
    return () => {
      clearTimeout(expiry);
      clearInterval(poll);
      sub.remove();
    };
  }, [scope]);
  useEffect(() => {
    (async () => {
      let saved: (ReaderSession & { token: string }) | null = null;
      try {
        await revokePending();
        saved = JSON.parse((await SecureStore.getItemAsync(SESSION)) || "null");
        if (saved) {
          const verified = await readerClient(
            BASE,
            () => saved!.token,
          )<ReaderSession>("/me");
          await enter({ ...verified, token: saved.token });
        }
      } catch (e) {
        if (
          saved &&
          e instanceof ReaderNetworkError &&
          Date.parse(saved.expiresAt) > Date.now()
        ) {
          try {
            await enter(saved, true);
          } catch {}
        } else if (e instanceof ReaderApiError && e.status === 401)
          await SecureStore.deleteItemAsync(SESSION);
      } finally {
        setLoading(false);
      }
    })();
    const retry = setInterval(() => {
      void engine.current?.flush();
    }, 15000);
    return () => {
      clearInterval(retry);
      engine.current?.close();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  function enterGuest() {
    generation.current++;
    engine.current?.close();
    const values = new Map<string, unknown>(),
      storageId = "guest-" + Date.now();
    const leave = async () => {
      setScope(null);
    };
    setSyncMessage("");
    setScope({
      session: null,
      isGuest: true,
      storageId,
      requestAccount: () => void leave(),
      api: (async () => {
        throw new ReaderApiError("Sign in to save your reading.", 401);
      }) as ReturnType<typeof readerClient>,
      read: async <T,>(key: string, fallback: T) =>
        (values.get(key) as T) ?? fallback,
      store: async (key, value) => {
        if (["marks", "notes", "outbox", "books"].includes(key)) return false;
        values.set(key, value);
        return true;
      },
      logout: leave,
      keepLocalChanges: async () => {},
    });
  }
  if (scope)
    return (
      <Context.Provider value={{ ...scope, syncMessage }}>
        {children}
      </Context.Provider>
    );
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.emblem}>
          <Text style={styles.leaf}>❧</Text>
        </View>
        <Text style={styles.wordmark}>Pagechime.</Text>
        <Text style={styles.eyebrow}>YOUR READING SPACE</Text>
        <Text style={styles.title}>
          {loading
            ? "Settling you in…"
            : activate || register
              ? "Make yourself at home."
              : "Welcome back."}
        </Text>
        <Text style={styles.intro}>
          A little time for yourself. Your books and thoughts, in a place of
          their own.
        </Text>
        {loading ? (
          <ActivityIndicator color="#65704f" />
        ) : (
          <>
            {activate && (
              <>
                <Text style={styles.label}>Private invitation</Text>
                <TextInput
                  style={styles.input}
                  value={invite}
                  onChangeText={setInvite}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}
            {(activate || register) && (
              <>
                <Text style={styles.label}>Your name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  maxLength={80}
                />
              </>
            )}
            <Text style={styles.label}>Username or email</Text>
            <TextInput
              accessibilityLabel="Username or email"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              maxLength={254}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              accessibilityLabel="Password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete={
                activate || register ? "new-password" : "current-password"
              }
              maxLength={256}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Hide password" : "Show password"
              }
              accessibilityState={{ selected: showPassword }}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={styles.link}>
                {showPassword ? "Hide password" : "Show password"}
              </Text>
            </Pressable>
            <Text style={styles.hint}>
              Use at least 12 characters. An email is used only to sign in;
              email recovery is not available yet.
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              style={styles.primary}
              onPress={async () => {
                setError("");
                const invalid = readerDetailsError(
                  username,
                  password,
                  activate || register ? name : undefined,
                );
                if (invalid) {
                  setError(invalid);
                  return;
                }
                setBusy(true);
                try {
                  await revokePending();
                  let code = invite.trim();
                  if (code.includes("#invite="))
                    code = code.split("#invite=")[1];
                  const creating = activate || register;
                  const received = await readerClient(BASE)<
                    ReaderSession & { token: string }
                  >(
                    activate ? "/activate" : register ? "/register" : "/login",
                    "POST",
                    { username, password, displayName: name, invite: code },
                  );
                  if (creating) {
                    setActivate(false);
                    setRegister(false);
                    setInvite("");
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
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Text style={styles.primaryText}>
                {busy
                  ? "A moment…"
                  : activate || register
                    ? "Create my account"
                    : "Enter my library →"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setRegister(!register);
                setActivate(false);
                setError("");
              }}
            >
              <Text style={styles.link}>
                {register
                  ? "Already have an account? Sign in"
                  : "New here? Create an account"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setActivate(!activate);
                setRegister(false);
                setError("");
              }}
            >
              <Text style={styles.link}>
                {activate ? "I already have an account" : "Have an invitation?"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={enterGuest}
            >
              <Text style={styles.link}>Continue as guest →</Text>
            </Pressable>
            <Text style={styles.hint}>
              Guests can read and listen. An account saves bookmarks, notes and
              reading progress. Importing your own books requires an account.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f5f3ec" },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 30,
    maxWidth: 500,
    width: "100%",
    alignSelf: "center",
  },
  emblem: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#e5e9d9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  wordmark: {
    fontFamily: "serif",
    fontSize: 30,
    color: "#292e24",
    marginBottom: 30,
  },
  leaf: { fontSize: 48, color: "#65704f" },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2,
    color: "#686e60",
    marginBottom: 15,
  },
  title: {
    fontFamily: "serif",
    fontSize: 43,
    color: "#292e24",
    letterSpacing: -1.4,
    marginBottom: 16,
  },
  intro: { fontSize: 15, lineHeight: 24, color: "#686e60", marginBottom: 30 },
  label: { fontSize: 13, color: "#292e24", marginBottom: 9, marginTop: 15 },
  input: {
    backgroundColor: "#fffefb",
    borderWidth: 1,
    borderColor: "#ddded2",
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: "#292e24",
  },
  hint: { fontSize: 12, lineHeight: 19, color: "#686e60", marginTop: 15 },
  error: { fontSize: 13, color: "#94382e", paddingVertical: 12 },
  primary: {
    backgroundColor: "#65704f",
    padding: 18,
    borderRadius: 10,
    marginTop: 24,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 15 },
  link: { color: "#65704f", textAlign: "center", padding: 20, fontSize: 13 },
});
