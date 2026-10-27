import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const origin = "https://reader.test";
async function worker({
  guest = false,
  broken = false,
  putFails = false,
  network,
}: {
  guest?: boolean;
  broken?: boolean;
  putFails?: boolean;
  network: typeof fetch;
}) {
  const events: Record<string, Function> = {},
    book = new Map<string, Response>([
      [origin + "/library.json", Response.json({ books: [], revision: "old" })],
    ]);
  const cache = {
    match: async (key: Request | string) =>
      book.get(typeof key === "string" ? key : key.url)?.clone(),
    put: async (key: Request | string, value: Response) => {
      if (putFails) throw Error("Cache quota");
      book.set(typeof key === "string" ? key : key.url, value);
    },
  };
  const scopes = {
    match: async () =>
      guest
        ? undefined
        : Response.json({
            account: "11111111-1111-4111-8111-111111111111",
            expires: Date.now() + 60000,
          }),
  };
  const source = (
    await readFile(
      new URL("../scripts/service-worker.js", import.meta.url),
      "utf8",
    )
  ).replace("__SHELL__", "[]");
  vm.runInNewContext(source, {
    Request,
    Response,
    URL,
    Date,
    Promise,
    Uint8Array,
    fetch: network,
    caches: {
      open: async (name: string) => {
        if (broken) throw Error("Cache unavailable");
        return name === "leaf-reader-scopes-v1" ? scopes : cache;
      },
    },
    self: {
      location: { origin },
      addEventListener: (name: string, fn: Function) => (events[name] = fn),
    },
  });
  return async () => {
    let result: Promise<Response> | undefined;
    events.fetch({
      request: new Request(origin + "/library.json"),
      clientId: "client",
      respondWith: (p: Promise<Response>) => (result = p),
    });
    return result!;
  };
}
test("catalog uses fresh network data and a failed cache write cannot hide a successful response", async () => {
  for (const putFails of [false, true]) {
    const run = await worker({
      putFails,
      network: async () =>
        Response.json({
          books: [{ url: "/books/manifest/book.json" }],
          revision: "new",
        }),
    });
    assert.equal((await (await run()).json()).revision, "new");
  }
});
test("offline catalog fallback is account scoped; online rejections remain rejections", async () => {
  const offline = await worker({
    network: async () => {
      throw Error("Offline");
    },
  });
  assert.equal((await (await offline()).json()).revision, "old");
  const denied = await worker({
    network: async () => new Response("Denied", { status: 401 }),
  });
  assert.equal((await denied()).status, 401);
  const guest = await worker({
    guest: true,
    network: async () => Response.json({ revision: "network" }),
  });
  assert.equal((await (await guest()).json()).revision, "network");
  const broken = await worker({
    broken: true,
    network: async () => Response.json({ revision: "network" }),
  });
  assert.equal((await (await broken()).json()).revision, "network");
});
test("failed replacement precache rejects installation and retains the previous offline shell", async () => {
  const source = (
    await readFile(
      new URL("../scripts/service-worker.js", import.meta.url),
      "utf8",
    )
  ).replace("__SHELL__", '["/"]');
  const events: Record<string, Function> = {},
    deleted: string[] = [];
  let skipped = false,
    installation: Promise<unknown> | undefined;
  vm.runInNewContext(source, {
    Request,
    Response,
    URL,
    Date,
    Promise,
    Uint8Array,
    fetch: async () => {
      throw Error("offline");
    },
    caches: {
      open: async () => ({
        addAll: async () => {
          throw Error("temporary 503");
        },
      }),
      keys: async () => ["leaf-shell-old"],
      delete: async (key: string) => deleted.push(key),
    },
    self: {
      location: { origin },
      addEventListener: (name: string, fn: Function) => (events[name] = fn),
      skipWaiting: () => {
        skipped = true;
      },
      clients: { claim: async () => {} },
    },
  });
  events.install({ waitUntil: (p: Promise<unknown>) => (installation = p) });
  await assert.rejects(installation!);
  assert.equal(skipped, false);
  assert.deepEqual(deleted, []);
  // The old active worker still has its complete shell and handles offline navigation.
  const oldEvents: Record<string, Function> = {};
  let result: Promise<Response> | undefined;
  vm.runInNewContext(
    source.replace("leaf-shell-__VERSION__", "leaf-shell-old"),
    {
      Request,
      Response,
      URL,
      Date,
      Promise,
      Uint8Array,
      fetch: async () => {
        throw Error("offline");
      },
      caches: {
        open: async () => ({
          match: async () => new Response("old offline shell"),
        }),
      },
      self: {
        location: { origin },
        addEventListener: (name: string, fn: Function) =>
          (oldEvents[name] = fn),
      },
    },
  );
  oldEvents.fetch({
    request: new Request(origin + "/"),
    respondWith: (p: Promise<Response>) => (result = p),
  });
  assert.equal(await (await result!).text(), "old offline shell");
});
