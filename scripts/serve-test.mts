import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createReaderApi } from "../server/reader-api.ts";
import { proxyReader, authorizeMedia } from "../server/web-boundary.ts";
import { createSharedLibraryApi } from "../server/shared-library-api.ts";
import { proxySharedLibrary } from "../server/shared-library-boundary.ts";
import { fixtureSharedStore } from "../tests/fixtures/shared-library.ts";
import {
  longBook,
  repairedBook,
  mixedBook,
  untimedBook,
} from "../tests/fixtures/reading-books.ts";
import {
  fixtureDatabase,
  testPassword,
} from "../tests/fixtures/reader-database.ts";
const db = await fixtureDatabase();
const handler = createReaderApi(db, "fixture-pepper");
const sharedGroups = new Map<string, ReturnType<typeof fixtureSharedStore>>();
const sharedKey = "f".repeat(64);
const failInitialSync = new Set<string>();
const send: typeof fetch = async (input, init) => {
  const request = new Request(input as string, init);
  const account = db
    .table("book_reader_accounts")
    .find((a) => a.id === request.headers.get("x-reader-account"));
  if (
    new URL(request.url).pathname.endsWith("/state") &&
    account &&
    failInitialSync.delete(account.username)
  )
    return new Response(JSON.stringify({ error: "Fixture state outage" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  return handler(
    request,
    request.headers.get("x-forwarded-for") || "fixture-ip",
  );
};
const fixtureHash = db.table("book_reader_accounts")[0].password_hash;
const root = resolve("apps/web/out");
const manifestGuestPaths =
  process.env.READER_TEST_MANIFEST === "1"
    ? JSON.parse(await readFile(".generated/guest-media.json", "utf8"))
    : [];
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".pdf": "application/pdf",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".webp": "image/webp",
  ".epub": "application/epub+zip",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const origin = "http://localhost:4174";
      // Model independent browser contexts as independent clients. Keep each
      // context's real rate limits active instead of sharing one suite-wide IP.
      const existingClient =
        /(?:^|; )reader-test-client=([a-f0-9-]{36})(?:;|$)/.exec(
          req.headers.cookie || "",
        )?.[1];
      let client = existingClient || "fixture-ip";
      if (!existingClient && (path === "/" || path === "/__test/account")) {
        client = crypto.randomUUID();
        res.setHeader(
          "Set-Cookie",
          `reader-test-client=${client}; Path=/; HttpOnly; SameSite=Lax`,
        );
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers))
        if (value)
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
      const request = new Request(origin + req.url, {
        method: req.method,
        headers,
        body: raw.length ? raw : undefined,
      });
      const sharedGroup =
        /(?:^|; )reader-test-shared=([a-f0-9-]{36})(?:;|$)/.exec(
          req.headers.cookie || "",
        )?.[1] || "default";
      if (!sharedGroups.has(sharedGroup))
        sharedGroups.set(sharedGroup, fixtureSharedStore());
      const shared = sharedGroups.get(sharedGroup)!;
      if (path.startsWith("/api/library/")) {
        const api = createSharedLibraryApi(
          shared.store,
          async (k) => k === sharedKey,
          async (r) => {
            const result = await handler(
              new Request("http://fixture/book-reader-api/me", {
                headers: {
                  Authorization: r.headers.get("authorization") || "",
                },
              }),
            );
            return result.ok ? (await result.json()).account : null;
          },
        );
        const response = await proxySharedLibrary(
          request,
          sharedKey,
          async (input, init) => api(new Request(input, init)),
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const sharedObject =
        /^\/storage\/v1\/object\/(upload\/sign|sign)\/pagechime-shared-books-develop\/(shared-[a-f0-9-]{36})\/(asset-\d{3}\.[a-z0-9]+)$/.exec(
          path,
        );
      if (sharedObject) {
        const [, kind, id, key] = sharedObject,
          row = shared.rows.get(id),
          asset = row?.files.find((f) => f.key === key),
          name = id + "/" + key;
        if (!asset || !row) {
          res.writeHead(404);
          res.end();
          return;
        }
        if (kind === "upload/sign" && req.method === "PUT") {
          if (row.status !== "draft" || shared.objects.has(name)) {
            res.writeHead(409);
            res.end();
            return;
          }
          shared.objects.set(name, raw);
          res.writeHead(200);
          res.end("{}");
          return;
        }
        if (kind !== "sign" || row.status !== "published") {
          res.writeHead(404);
          res.end();
          return;
        }
        const bytes = shared.objects.get(name);
        if (!bytes) {
          res.writeHead(404);
          res.end();
          return;
        }
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
        if (range) {
          const from = Number(range[1]),
            to = Math.min(
              Number(range[2] || bytes.length - 1),
              bytes.length - 1,
            );
          res.writeHead(206, {
            "Content-Type": asset.contentType,
            "Accept-Ranges": "bytes",
            "Content-Range": `bytes ${from}-${to}/${bytes.length}`,
            "Content-Length": to - from + 1,
          });
          res.end(bytes.subarray(from, to + 1));
          return;
        }
        res.writeHead(200, {
          "Content-Type": asset.contentType,
          "Accept-Ranges": "bytes",
          "Content-Length": bytes.length,
        });
        res.end(bytes);
        return;
      }
      const sharedMedia =
        /^\/books\/(shared-[a-f0-9-]{36})\/(asset-\d{3}\.[a-z0-9]+)$/.exec(
          path,
        );
      if (sharedMedia) {
        res.writeHead(302, {
          Location: `/api/library/media/${sharedMedia[1]}/${sharedMedia[2]}`,
        });
        res.end();
        return;
      }
      if (path === "/__test/fail-initial-sync" && req.method === "POST") {
        failInitialSync.add(JSON.parse(raw.toString()).username);
        res.writeHead(204);
        res.end();
        return;
      }
      if (path === "/__test/account" && req.method === "POST") {
        const id = crypto.randomUUID(),
          username = "test-" + id.slice(0, 14);
        await db.insert("book_reader_accounts", {
          id,
          username,
          display_name: "A Reader",
          role: "reader",
          active: true,
          password_hash: fixtureHash,
          session_version: 0,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ username, password: testPassword, id }));
        return;
      }
      if (path.startsWith("/api/reader/")) {
        const response = await proxyReader(request, client, send);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (
        (path === "/library.json" || path.startsWith("/books/")) &&
        !(await authorizeMedia(request, send, [
          ...manifestGuestPaths,
          "/library.json",
          "/books/demo/book.json",
          "/books/demo/piper.json",
          "/books/demo/book.pdf",
          "/books/demo/1.wav",
          "/books/demo/2.wav",
        ]))
      ) {
        res.writeHead(401, { "Cache-Control": "no-store" });
        res.end("Please sign in.");
        return;
      }
      let body: Buffer, type: string;
      if (path === "/library.json") {
        body =
          process.env.READER_TEST_MANIFEST === "1"
            ? await readFile(resolve(root, "library.json"))
            : Buffer.from(
                JSON.stringify({
                  books: [
                    {
                      url:
                        process.env.READER_TEST_MANIFEST === "1"
                          ? "/books/manifest/book.json"
                          : "/books/demo/book.json",
                    },
                  ],
                }),
              );
        type = "application/json";
      } else if (path.startsWith("/books/demo/")) {
        const name =
          path.endsWith("book.json") || path.endsWith("piper.json")
            ? "book.json"
            : path.endsWith(".pdf")
              ? "book.pdf"
              : "audio.wav";
        // Isolated browser contexts choose a corpus without bypassing the real worker/auth path.
        const corpus =
          /(?:^|; )reader-test-corpus=(long|mixed|untimed|words|mixedwords|editions|references|repaired|voices|voicepages|audioonly)(?:;|$)/.exec(
            req.headers.cookie || "",
          )?.[1];
        const wordBook = JSON.parse(
          await readFile("tests/fixtures/book.json", "utf8"),
        );
        wordBook.chapters[0].segments[0].words = [
          { start: 0, end: 0.4, from: 0, to: 1 },
          { start: 0.6, end: 1.2, from: 2, to: 7 },
          { start: 1.4, end: 2, from: 8, to: 18 },
        ];
        const mixedWords = structuredClone(wordBook);
        mixedWords.chapters[0].segments[1].text =
          "A patient sentence carries this page onward. ".repeat(240);
        const editionBook = JSON.parse(
          await readFile("tests/fixtures/book.json", "utf8"),
        );
        editionBook.editions = [
          { label: "Cozy PDF", kind: "pdf", url: "/books/demo/cozy.pdf" },
        ];
        const voiceBase = JSON.parse(
          await readFile("tests/fixtures/book.json", "utf8"),
        );
        const piperBook = {
          ...voiceBase,
          id: "demo-piper",
          sourceBookId: "demo",
          narration: "piper",
          chapters: [
            {
              ...voiceBase.chapters[0],
              title: "Piper reading",
              duration: 8,
              segments: voiceBase.chapters
                .flatMap((c: any) => c.segments)
                .map((s: any, i: number) => ({
                  ...s,
                  start: i * 2,
                  end: i * 2 + 2,
                })),
            },
          ],
        };
        const voicePageSegments = longBook.chapters.flatMap((c) =>
          c.segments.flatMap((segment) => {
            const words = segment.text.split(/\s+/);
            const result = [];
            for (let i = 0; i < words.length; i += 40)
              result.push({
                text: words.slice(i, i + 40).join(" "),
                page: segment.page,
              });
            return result;
          }),
        );
        const voicePages = {
          ...longBook,
          id: "demo-piper",
          sourceBookId: "demo",
          narration: "piper",
          chapters: [
            {
              ...longBook.chapters[0],
              title: "Piper reading",
              duration: 8,
              segments: voicePageSegments.map((s, i) => ({
                ...s,
                start: (i * 8) / voicePageSegments.length,
                end: ((i + 1) * 8) / voicePageSegments.length,
              })),
            },
          ],
        };
        const variants = {
          audioonly: {
            ...voiceBase,
            timing: "audio-only",
            chapters: voiceBase.chapters.map(
              (chapter: Record<string, unknown>) => ({
                ...chapter,
                segments: [],
              }),
            ),
          },
          voicepages: {
            ...longBook,
            preparedNarrations: { piper: "/books/demo/piper.json" },
          },
          voices: {
            ...voiceBase,
            preparedNarrations: { piper: "/books/demo/piper.json" },
          },
          references: {
            ...wordBook,
            chapters: [0, 1, 0, 1, 0].map((n, i) => ({
              ...wordBook.chapters[n],
              title: `Section ${i + 1}`,
              skipByDefault: [0, 2, 4].includes(i),
            })),
          },
          editions: editionBook,
          mixedwords: mixedWords,
          words: wordBook,
          long: longBook,
          repaired: repairedBook,
          mixed: mixedBook,
          untimed: untimedBook,
        };
        body =
          name === "book.json" && corpus
            ? Buffer.from(
                JSON.stringify(
                  path.endsWith("/piper.json") && corpus === "voicepages"
                    ? voicePages
                    : path.endsWith("/piper.json") && corpus === "voices"
                      ? piperBook
                      : variants[corpus as keyof typeof variants],
                ),
              )
            : await readFile(resolve("tests/fixtures", name));
        type = types[extname(name)];
      } else {
        let file = resolve(root, "." + path);
        if (file !== root && !file.startsWith(root + "/")) throw Error();
        if ((await stat(file)).isDirectory()) file += "/index.html";
        body = await readFile(file);
        type = types[extname(file)] || "application/octet-stream";
      }
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Accept-Ranges", "bytes");
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
      if (match) {
        const start = Number(match[1]),
          end = Math.min(Number(match[2] || body.length - 1), body.length - 1);
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${body.length}`,
          "Content-Length": end - start + 1,
        });
        res.end(body.subarray(start, end + 1));
      } else {
        res.writeHead(200, { "Content-Length": body.length });
        res.end(body);
      }
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(4174, "127.0.0.1");
