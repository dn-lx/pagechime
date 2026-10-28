import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  sharedPackage,
  sharedReaderBook,
  SHARED_FILE_LIMIT,
  type SharedBookPackage,
} from "../packages/core/src/shared-book.ts";
import { validateBook } from "../packages/core/src/index.ts";
import {
  createSharedLibraryApi,
  storageSignature,
} from "../server/shared-library-api.ts";
import { proxySharedLibrary } from "../server/shared-library-boundary.ts";
import { fixtureSharedStore } from "./fixtures/shared-library.ts";
const id = "shared-11111111-1111-4111-8111-111111111111",
  owner = "owner",
  key = "a".repeat(64);
const source = [
  new TextEncoder().encode("%PDF-1.4 content"),
  new Uint8Array([73, 68, 51, 4, 0]),
];
const files = source.map((b, i) => ({
  name: i ? "01.mp3" : "book.pdf",
  key: "",
  size: b.length,
  sha256: createHash("sha256").update(b).digest("hex"),
  contentType: i ? "audio/mpeg" : "application/pdf",
}));
const book: SharedBookPackage = {
  schemaVersion: 1,
  title: "A new book",
  author: "An Author",
  pdfs: [{ file: "book.pdf", label: "Original", pageCount: 7 }],
  audio: [{ file: "01.mp3", title: "Opening", duration: 90 }],
};
function setup(role = "admin", active = true) {
  const f = fixtureSharedStore();
  const api = createSharedLibraryApi(
    f.store,
    async (k) => k === key,
    async () => (active ? { id: owner, role } : null),
  );
  const req = (path: string, body?: unknown, capability = key) =>
    api(
      new Request("https://test/api/library/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "X-Pagechime-Library-Key": capability,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  return { ...f, req };
}
test("portable package becomes a valid manual reader book with independent PDF editions", () => {
  const parsed = sharedPackage(book, files),
    result = validateBook(sharedReaderBook(id, parsed.book, parsed.files));
  assert.equal(result.timing, "audio-only");
  assert.equal(result.chapters[0].segments.length, 0);
  assert.equal(result.duration, 90);
  assert.equal(result.editions![0].pageCount, 7);
  assert.match(result.pdf, /^\/books\/shared-/);
});
test("package rejects ambiguous references, traversal, unsupported types, oversized files and bad durations", () => {
  for (const bad of [
    { ...files[0], name: "../book.pdf" },
    { ...files[0], size: SHARED_FILE_LIMIT + 1 },
    { ...files[0], contentType: "text/html" },
    { ...files[0], sha256: "bad" },
  ])
    assert.throws(() => sharedPackage(book, [bad, files[1]]));
  assert.throws(() =>
    sharedPackage(
      { ...book, audio: [{ ...book.audio[0], duration: Infinity }] },
      files,
    ),
  );
  assert.throws(() => sharedPackage(book, [...files, files[0]]));
  assert.throws(() => sharedPackage({ ...book, pdfs: [] }, files));
});
test("backend requires private proxy capability and real admin session", async () => {
  assert.equal((await setup().req("catalog", undefined, "")).status, 401);
  assert.equal(
    (
      await setup("reader").req("admin/prepare", {
        id,
        book,
        files,
        role: "admin",
      })
    ).status,
    403,
  );
  assert.equal(
    (await setup("admin", false).req("admin/prepare", { id, book, files }))
      .status,
    401,
  );
  assert.equal((await setup().req("admin/prepare", null)).status, 400);
});
test("draft files remain hidden; incomplete and corrupt uploads cannot publish; retries are idempotent", async () => {
  const f = setup(),
    prepared = await (await f.req("admin/prepare", { id, book, files })).json();
  assert.equal((await f.req("catalog")).status, 200);
  assert.deepEqual((await (await f.req("catalog")).json()).books, []);
  assert.equal(
    (await f.req(`media/${id}/${prepared.uploads[0].key}`)).status,
    404,
  );
  assert.equal((await f.req(`admin/${id}/publish`, {})).status, 409);
  f.objects.set(`${id}/${prepared.uploads[0].key}`, new Uint8Array([1]));
  assert.equal(
    (await f.req(`admin/${id}/verify/${prepared.uploads[0].key}`, {})).status,
    409,
  );
  for (let i = 0; i < source.length; i++) {
    f.objects.set(`${id}/${prepared.uploads[i].key}`, source[i]);
    assert.equal(
      (await f.req(`admin/${id}/verify/${prepared.uploads[i].key}`, {})).status,
      200,
    );
  }
  const retry = await (
    await f.req("admin/prepare", { id, book, files })
  ).json();
  assert.ok(
    retry.uploads.every(
      (f: { verified: boolean; url: string | null }) =>
        f.verified && f.url === null,
    ),
  );
  assert.equal((await f.req(`admin/${id}/publish`, {})).status, 200);
  assert.equal((await f.req(`admin/${id}/publish`, {})).status, 200);
  assert.equal((await (await f.req("catalog")).json()).books.length, 1);
  assert.equal(
    (await f.req(`media/${id}/${prepared.uploads[0].key}`)).status,
    302,
  );
  assert.equal(
    (await f.req(`admin/${id}/verify/${prepared.uploads[0].key}`, {})).status,
    409,
  );
});
test("another administrator cannot resume or publish somebody else's draft", async () => {
  const f = setup();
  await f.req("admin/prepare", { id, book, files });
  const api = createSharedLibraryApi(
    f.store,
    async () => true,
    async () => ({ id: "other", role: "admin" }),
  );
  const r = await api(
    new Request(`https://test/api/library/admin/${id}/publish`, {
      method: "POST",
      headers: { "X-Pagechime-Library-Key": key },
    }),
  );
  assert.equal(r.status, 404);
});
test("signature checks reject active or mislabeled content", () => {
  assert.equal(
    storageSignature(
      new TextEncoder().encode("<script>bad</script>"),
      "application/pdf",
    ),
    false,
  );
  assert.equal(storageSignature(source[0], "application/pdf"), true);
  assert.equal(storageSignature(source[1], "audio/mpeg"), true);
});
test("web proxy enforces origin, size, credential isolation and redirect destination", async () => {
  const request = (origin: string, body = "{}") =>
    new Request("https://reader.test/api/library/admin/prepare", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: `__Host-reader_session=${"b".repeat(64)}`,
      },
      body,
    });
  assert.equal(
    (await proxySharedLibrary(request("https://evil.test"), key)).status,
    403,
  );
  assert.equal(
    (
      await proxySharedLibrary(
        request("https://reader.test", "x".repeat(100001)),
        key,
      )
    ).status,
    413,
  );
  assert.equal(
    (await proxySharedLibrary(request("https://reader.test"), undefined))
      .status,
    503,
  );
  let captured: RequestInit | undefined;
  const good = await proxySharedLibrary(
    request("https://reader.test"),
    key,
    async (url, init) => {
      captured = init;
      return Response.json({ ok: true });
    },
  );
  assert.equal(good.status, 200);
  assert.equal(
    new Headers(captured!.headers).get("authorization"),
    "Bearer " + "b".repeat(64),
  );
  assert.equal(good.headers.get("x-pagechime-library-key"), null);
  const evil = await proxySharedLibrary(
    new Request(`https://reader.test/api/library/media/${id}/asset-001.pdf`),
    key,
    async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://evil.test/file" },
      }),
  );
  assert.equal(evil.status, 503);
});
