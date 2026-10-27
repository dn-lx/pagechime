import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createLibraryApi,
  libraryManifest,
  type LibraryManifest,
  type LibraryStore,
} from "../server/library-api";
// @ts-expect-error Build-only JavaScript module.
import { fetchPrivateLibrary } from "../scripts/fetch-private-library.mjs";
const sum = (v: string) => createHash("sha256").update(v).digest("hex");
const key = "a".repeat(64),
  files = [
    {
      path: "books/manifest/book.json",
      sha256: sum("book"),
      size: 4,
      contentType: "application/json",
    },
    {
      path: "books/manifest/book.pdf",
      sha256: sum("pdf"),
      size: 3,
      contentType: "application/pdf",
    },
    {
      path: "library.json",
      sha256: sum("catalog"),
      size: 7,
      contentType: "application/json",
    },
  ];
const manifest: LibraryManifest = {
  version: sum(JSON.stringify(files)),
  files,
};
const endpoint = "https://assets.test/functions/v1/pagechime-library";
const signed = (m: LibraryManifest) =>
  m.files.map((f) => ({
    path: f.path,
    url: `https://assets.test/storage/v1/object/sign/pagechime-library-develop/versions/${m.version}/${f.path}?token=fixture`,
  }));
test("private library rejects anonymous, expired, read-only uploads, malformed paths and version changes", async () => {
  let published = 0;
  const store: LibraryStore = {
    current: async () => manifest,
    signed: async (m) => signed(m),
    prepare: async (m) => signed(m),
    publish: async () => {
      published++;
    },
  };
  const call = (
    scope: "build" | "upload" | null,
    path: string,
    method = "GET",
    body?: unknown,
    expired = false,
  ) =>
    createLibraryApi(
      async () =>
        scope
          ? { scope, expires_at: expired ? new Date(0).toISOString() : null }
          : null,
      store,
    )(
      new Request(endpoint + path, {
        method,
        headers: { Authorization: `Bearer ${key}` },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  assert.equal((await call(null, "/manifest")).status, 401);
  assert.equal(
    (await call("build", "/manifest", "GET", undefined, true)).status,
    401,
  );
  assert.equal((await call("build", "/publish", "POST", manifest)).status, 403);
  assert.equal((await call("build", "/prepare", "POST", manifest)).status, 403);
  assert.equal((await call("build", "/manifest")).status, 200);
  assert.equal((await call("upload", "/manifest")).status, 403);
  assert.equal(
    (await call("upload", "/publish", "POST", manifest)).status,
    200,
  );
  assert.equal(published, 1);
  for (const path of [
    "books/manifest/../../private.json",
    "books/another/book.pdf",
    "books/manifest/evil.html",
    "books/manifest/%2e%2e/private.json",
  ]) {
    const changed = {
      ...manifest,
      files: [{ ...files[0], path }, ...files.slice(1)],
    };
    await assert.rejects(libraryManifest(changed));
    assert.equal(
      (await call("upload", "/publish", "POST", changed)).status,
      400,
    );
  }
  assert.equal(
    (
      await createLibraryApi(
        async () => null,
        store,
        async () => false,
      )(new Request(endpoint))
    ).status,
    429,
  );
  assert.equal(
    (
      await call("upload", "/publish", "POST", {
        ...manifest,
        version: "b".repeat(64),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await createLibraryApi(async () => {
        throw Error("DB unavailable");
      }, store)(
        new Request(endpoint, { headers: { Authorization: `Bearer ${key}` } }),
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await createLibraryApi(
        async () => null,
        store,
        async () => {
          throw Error("Rate unavailable");
        },
      )(new Request(endpoint))
    ).status,
    503,
  );
});
test("build restore verifies digests and prevents redirects, outside origins, unsafe paths and missing required source", async () => {
  const root = await mkdtemp(join(tmpdir(), "reader-assets-"));
  const env = {
    PAGECHIME_LIBRARY_URL: endpoint,
    PAGECHIME_LIBRARY_KEY: key,
    PAGECHIME_LIBRARY_REQUIRED: "1",
  };
  const values: Record<string, string> = {
    "books/manifest/book.json": "book",
    "books/manifest/book.pdf": "pdf",
    "library.json": "catalog",
  };
  const send = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/manifest")) {
      assert.equal(
        new Headers(init?.headers).get("authorization"),
        `Bearer ${key}`,
      );
      return Response.json({
        ...manifest,
        files: files.map((f) => ({
          ...f,
          url: signed(manifest).find((x) => x.path === f.path)!.url,
        })),
      });
    }
    assert.equal(init?.redirect, "error");
    const path = url.split(`/versions/${manifest.version}/`)[1].split("?")[0];
    return new Response(values[path]);
  };
  try {
    assert.deepEqual(await fetchPrivateLibrary(root, env, send), {
      version: manifest.version,
      count: 3,
    });
    assert.equal(await readFile(join(root, "library.json"), "utf8"), "catalog");
    await assert.rejects(
      fetchPrivateLibrary(root, { PAGECHIME_LIBRARY_REQUIRED: "1" }, send),
      /PAGECHIME_LIBRARY_URL, PAGECHIME_LIBRARY_KEY/,
    );
    await assert.rejects(
      fetchPrivateLibrary(
        root,
        { PAGECHIME_LIBRARY_REQUIRED: "1", PAGECHIME_LIBRARY_URL: endpoint },
        send,
      ),
      /missing: PAGECHIME_LIBRARY_KEY\./,
    );
    await assert.rejects(
      fetchPrivateLibrary(
        root,
        { PAGECHIME_LIBRARY_REQUIRED: "1", PAGECHIME_LIBRARY_KEY: key },
        send,
      ),
      /missing: PAGECHIME_LIBRARY_URL\./,
    );
    await assert.rejects(
      fetchPrivateLibrary(
        root,
        { CONTEXT: "branch-deploy", BRANCH: "develop" },
        send,
      ),
    );
    const unsafe = async () =>
      Response.json({
        ...manifest,
        files: files.map((f) => ({
          ...f,
          url: "https://outside.test/private",
        })),
      });
    await assert.rejects(fetchPrivateLibrary(root, env, unsafe));
    const fresh = await mkdtemp(join(tmpdir(), "reader-assets-bad-"));
    await assert.rejects(
      fetchPrivateLibrary(fresh, env, async (input: any, init: any) =>
        String(input).endsWith("/manifest")
          ? send(input, init)
          : new Response("incorrect"),
      ),
    );
    await rm(fresh, { recursive: true, force: true });
    const links = await mkdtemp(join(tmpdir(), "reader-assets-link-"));
    await symlink(root, join(links, "books"));
    await assert.rejects(fetchPrivateLibrary(links, env, send));
    await rm(links, { recursive: true, force: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("library aggregate size accepts 320 MiB and rejects one byte over without downloading", async () => {
  const limit = 320 * 1024 * 1024;
  const large = [...files];
  let remaining = limit - files.reduce((n, f) => n + f.size, 0);
  for (let i = 0; remaining > 0; i++) {
    const size = Math.min(24 * 1024 * 1024, remaining);
    large.push({ path: `books/manifest/improved/part-${i}.mp3`, sha256: sum("audio"), size, contentType: "audio/mpeg" });
    remaining -= size;
  }
  large.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const candidate = { files: large, version: sum(JSON.stringify(large)) };
  assert.equal((await libraryManifest(candidate)).files.length, large.length);
  const over = large.map((file) => ({ ...file }));
  over[over.length - 1].size++;
  const tooLarge = { files: over, version: sum(JSON.stringify(over)) };
  await assert.rejects(libraryManifest(tooLarge));
  const oversized = [...files, { path: "books/manifest/improved/oversized.mp3", sha256: sum("audio"), size: 24 * 1024 * 1024 + 1, contentType: "audio/mpeg" }].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  await assert.rejects(libraryManifest({ files: oversized, version: sum(JSON.stringify(oversized)) }));
  const root = await mkdtemp(join(tmpdir(), "reader-limit-"));
  let downloads = 0;
  const send = (m: LibraryManifest) => async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/manifest"))
      return Response.json({ ...m, files: m.files.map((file) => ({ ...file, url: signed(m).find((x) => x.path === file.path)!.url })) });
    downloads++;
    throw Error("Accepted manifest reached download");
  };
  const env = { PAGECHIME_LIBRARY_URL: endpoint, PAGECHIME_LIBRARY_KEY: key, PAGECHIME_LIBRARY_REQUIRED: "1" };
  try {
    await assert.rejects(fetchPrivateLibrary(root, env, send(tooLarge)), /integrity/);
    assert.equal(downloads, 0);
    await assert.rejects(fetchPrivateLibrary(root, env, send(candidate)), /Accepted manifest reached download/);
    assert.equal(downloads, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("production restore requires its dedicated secret and fails closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "reader-production-"));
  const env = { CONTEXT: "production", PAGECHIME_LIBRARY_REQUIRED: "1", PAGECHIME_LIBRARY_URL: endpoint, PAGECHIME_LIBRARY_KEY: key };
  let requests = 0;
  try {
    await assert.rejects(fetchPrivateLibrary(root, env, async () => { requests++; throw Error("Unexpected request"); }), /PAGECHIME_PRODUCTION_LIBRARY_KEY/);
    assert.equal(requests, 0);
    await assert.rejects(fetchPrivateLibrary(root, { ...env, PAGECHIME_PRODUCTION_LIBRARY_KEY: key }, async () => { requests++; throw Error("Production secret selected"); }), /Production secret selected/);
    assert.equal(requests, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
