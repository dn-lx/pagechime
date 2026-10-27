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
