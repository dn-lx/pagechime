// Retain the original cache namespaces for existing account-scoped offline downloads.
const SHELL = "leaf-shell-__VERSION__";
const SCOPES = "leaf-reader-scopes-v1";
const scopeUrl = (id) =>
  new URL("/__reader-scope/" + id, self.location.origin).href;
async function readScope(id) {
  if (!id) return null;
  try {
    const response = await (await caches.open(SCOPES)).match(scopeUrl(id));
    if (!response) return null;
    const scope = await response.json();
    return scope.expires > Date.now() ? scope : null;
  } catch {
    return null;
  } // Unavailable cache storage never blocks a network read.
}
async function openCache(name) {
  try {
    return await caches.open(name);
  } catch {
    return null;
  }
}
async function cached(cache, request) {
  try {
    return await cache?.match(request);
  } catch {
    return null;
  }
}
async function remember(cache, request, response) {
  try {
    await cache?.put(request, response.clone());
  } catch {}
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "reader-account" || !event.source?.id) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SCOPES),
        previous = await readScope(event.source.id);
      if (
        event.data.account &&
        /^[a-f0-9-]{36}$/.test(event.data.account) &&
        Date.parse(event.data.expiresAt) > Date.now()
      ) {
        await cache.put(
          scopeUrl(event.source.id),
          new Response(
            JSON.stringify({
              account: event.data.account,
              expires: Date.parse(event.data.expiresAt),
            }),
          ),
        );
      } else {
        await cache.delete(scopeUrl(event.source.id));
        if (previous) {
          for (const key of await cache.keys()) {
            const row = await cache.match(key);
            if (row && (await row.json()).account === previous.account)
              await cache.delete(key);
          }
          await caches.delete("leaf-books-account-" + previous.account);
        }
      }
      event.ports[0]?.postMessage({ ok: true });
    })(),
  );
});
const FILES = __SHELL__;
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(FILES))
      // Reject installation on incomplete precache; the previous worker stays usable.
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                (k.startsWith("leaf-shell-") && k !== SHELL) ||
                k === "leaf-books-v1",
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const privateFile =
        url.pathname.startsWith("/books/") || url.pathname === "/library.json";
      if (
        url.pathname.startsWith("/api/") ||
        url.pathname.startsWith("/.netlify/")
      )
        return fetch(req);
      const account = privateFile
        ? (await readScope(event.clientId))?.account
        : null;
      if (privateFile && !account) return fetch(event.request); // Guests never read or populate account caches.
      const bookCache = account
        ? await openCache("leaf-books-account-" + account)
        : null;
      const metadata =
        url.pathname === "/library.json" || url.pathname.endsWith("/book.json");
      if (privateFile && metadata) {
        try {
          const response = await fetch(new Request(req, { cache: "no-store" }));
          if (response.ok) await remember(bookCache, req, response);
          return response; // An online rejection must not reveal an old account copy.
        } catch {
          return (await cached(bookCache, url.href)) || Response.error();
        }
      }
      const stored = privateFile ? await cached(bookCache, url.href) : null;
      if (stored) {
        const range = req.headers.get("range");
        if (!range) return stored;
        const bytes = await stored.arrayBuffer(),
          match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]))
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${bytes.byteLength}` },
          });
        let start = match[1]
          ? Number(match[1])
          : Math.max(0, bytes.byteLength - Number(match[2]));
        const end =
          match[1] && match[2]
            ? Math.min(Number(match[2]), bytes.byteLength - 1)
            : bytes.byteLength - 1;
        if (start > end || start >= bytes.byteLength)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${bytes.byteLength}` },
          });
        const headers = new Headers(stored.headers);
        headers.set(
          "Content-Range",
          `bytes ${start}-${end}/${bytes.byteLength}`,
        );
        headers.set("Content-Length", String(end - start + 1));
        headers.set("Accept-Ranges", "bytes");
        return new Response(bytes.slice(start, end + 1), {
          status: 206,
          headers,
        });
      }
      if (privateFile) return fetch(req);
      const shell = await openCache(SHELL),
        storedShell = await cached(shell, req);
      if (req.mode === "navigate") {
        try {
          return await fetch(req);
        } catch {
          return (await cached(shell, "/index.html")) || Response.error();
        }
      }
      if (storedShell) return storedShell;
      return fetch(req);
    })(),
  );
});
