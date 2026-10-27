import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createReaderApi,
  passwordHash,
  passwordMatches,
  digest,
  token,
  restDatabase,
} from "../server/reader-api";
import { proxyReader, authorizeMedia, COOKIE } from "../server/web-boundary";
import {
  ReaderSync,
  ReaderApiError,
  type SyncSnapshot,
} from "../packages/core/src/reader-account";
import { fixtureDatabase, ids, testPassword } from "./fixtures/reader-database";
const base = "https://reader.test/api/reader";
async function setup() {
  const db = await fixtureDatabase(),
    handle = createReaderApi(db, "test-pepper");
  const call = async (
    path: string,
    method = "GET",
    body?: unknown,
    session?: string,
    id = ids.alice,
  ) =>
    handle(
      new Request(base + path, {
        method,
        headers: {
          ...(session ? { Authorization: `Bearer ${session}` } : {}),
          "X-Reader-Account": id,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      "127.0.0.1",
    );
  const login = async (name = "alice") => {
    const r = await call("/login", "POST", {
      username: name,
      password: testPassword,
    });
    assert.equal(r.status, 200);
    return (await r.json()).token as string;
  };
  return { db, handle, call, login };
}
test("passwords have independent salts and reject wrong or malformed hashes", async () => {
  const a = await passwordHash(testPassword),
    b = await passwordHash(testPassword);
  assert.notEqual(a, b);
  assert(await passwordMatches(testPassword, a));
  assert(!(await passwordMatches("incorrect", a)));
  assert(!(await passwordMatches(testPassword, "plain-text")));
});
test("custom sessions enforce ownership, account binding, expiry and logout", async () => {
  const { call, db, login } = await setup(),
    a = await login(),
    b = await login("bob");
  const value = {
    id: "one",
    bookId: "demo",
    chapter: 0,
    page: 1,
    time: 2,
    body: "Private thought",
  };
  assert.equal(
    (await call("/state", "PUT", { key: "note.one", value, revision: 0 }, a))
      .status,
    200,
  );
  assert.equal(
    (await call("/state", "GET", undefined, b, ids.bob)).status,
    200,
  );
  assert.deepEqual(
    (await (await call("/state", "GET", undefined, b, ids.bob)).json()).items,
    [],
  );
  assert.equal(
    (
      await call(
        "/state",
        "PUT",
        { key: "note.one", value, revision: 0 },
        b,
        ids.alice,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/admin/accounts", "GET", undefined, a)).status,
    403,
  );
  assert.equal((await call("/state", "GET")).status, 401);
  assert.equal((await call("/logout", "POST", {}, a)).status, 200);
  assert.equal((await call("/me", "GET", undefined, a)).status, 401);
  db.table("book_reader_sessions").find((x) => x.token_hash !== a)!.expires_at =
    "2000-01-01T00:00:00Z";
  assert.equal((await call("/me", "GET", undefined, b)).status, 401);
  assert(!JSON.stringify(db.tables).includes(a));
  assert(!JSON.stringify(db.tables).includes(testPassword));
});
test("pausing access invalidates old sessions even after restoring access", async () => {
  const { call, login } = await setup(),
    a = await login(),
    admin = await login("admin");
  assert.equal(
    (
      await call(
        "/admin/accounts/" + ids.alice,
        "PATCH",
        { active: false },
        admin,
        ids.admin,
      )
    ).status,
    200,
  );
  assert.equal((await call("/me", "GET", undefined, a)).status, 401);
  assert.equal(
    (
      await call(
        "/admin/accounts/" + ids.alice,
        "PATCH",
        { active: true },
        admin,
        ids.admin,
      )
    ).status,
    200,
  );
  assert.equal((await call("/me", "GET", undefined, a)).status, 401);
});
test("a stale login cannot create a session across an access revocation", async () => {
  const { db, login, call } = await setup(),
    admin = await login("admin");
  const [before] = await db.read<any>("book_reader_accounts", {
    id: ids.alice,
  });
  await call(
    "/admin/accounts/" + ids.alice,
    "PATCH",
    { active: false },
    admin,
    ids.admin,
  );
  await call(
    "/admin/accounts/" + ids.alice,
    "PATCH",
    { active: true },
    admin,
    ids.admin,
  );
  assert.equal(
    await db.rpc("book_reader_issue_session", {
      p_account: ids.alice,
      p_version: before.session_version,
      p_hash: await digest(token()),
      p_expires: new Date(Date.now() + 10000).toISOString(),
    }),
    false,
  );
});
test("invites are single use, duplicate usernames preserve them, and details stay generic", async () => {
  const { call, login } = await setup(),
    admin = await login("admin");
  const { invite } = await (
    await call("/admin/invites", "POST", {}, admin, ids.admin)
  ).json();
  const data = {
    invite,
    username: "alice",
    displayName: "New Reader",
    password: testPassword,
  };
  assert.equal((await call("/activate", "POST", data)).status, 400);
  data.username = "charlie";
  assert.equal((await call("/activate", "POST", data)).status, 200);
  data.username = "another";
  assert.equal((await call("/activate", "POST", data)).status, 400);
});
test("bad input and repeated login attempts are denied", async () => {
  const { call, login } = await setup(),
    a = await login();
  assert.equal((await call("/login", "POST", null)).status, 400);
  assert.equal((await call("/state", "PUT", null, a)).status, 400);
  assert.equal(
    (
      await call(
        "/state",
        "PUT",
        { key: "note.x", revision: 0, value: { body: "No position" } },
        a,
      )
    ).status,
    400,
  );
  let last = 0;
  for (let i = 0; i < 11; i++)
    last = (
      await call("/login", "POST", {
        username: "unknown",
        password: testPassword,
      })
    ).status;
  assert.equal(last, 429);
});
test("state updates use compare-and-swap and deletion tombstones", async () => {
  const { call, login } = await setup(),
    a = await login(),
    value = { bookId: "demo", page: 1, chapter: 0, time: 0, body: "First" };
  const put = (revision: number, v: any = value) =>
    call("/state", "PUT", { key: "note.x", value: v, revision }, a);
  assert.equal((await put(0)).status, 200);
  assert.equal((await put(0)).status, 409);
  assert.equal((await put(1, null)).status, 200);
  assert.equal((await put(1)).status, 409);
  assert.equal(
    (await (await call("/state", "GET", undefined, a)).json()).items[0].value,
    null,
  );
});
test("web boundary rejects CSRF, hides bearer tokens and denies anonymous media", async () => {
  let called = 0;
  const send: typeof fetch = async () => {
    called++;
    return new Response(
      JSON.stringify({
        token: "a".repeat(64),
        account: { id: ids.alice },
        expiresAt: new Date(Date.now() + 10000).toISOString(),
      }),
    );
  };
  const r = await proxyReader(
    new Request(base + "/login", {
      method: "POST",
      headers: { Origin: "https://evil.test" },
      body: "{}",
    }),
    "local",
    send,
  );
  assert.equal(r.status, 403);
  assert.equal(called, 0);
  const ok = await proxyReader(
    new Request(base + "/login", {
      method: "POST",
      headers: { Origin: "https://reader.test" },
      body: "{}",
    }),
    "local",
    send,
  );
  assert(!("token" in (await ok.json())));
  assert.match(
    ok.headers.get("set-cookie")!,
    /HttpOnly; Secure; SameSite=Strict/,
  );
  assert.equal(
    await authorizeMedia(
      new Request("https://reader.test/books/demo/book.pdf"),
      send,
    ),
    false,
  );
  assert.equal(
    await authorizeMedia(
      new Request("https://reader.test/books/demo/book.pdf", {
        headers: { cookie: `${COOKIE}=${"a".repeat(64)}` },
      }),
      send,
    ),
    true,
  );
});
test("outbox keeps its original revision after reload and lets unrelated changes sync", async () => {
  let snapshot: SyncSnapshot = { pending: {}, revisions: {} },
    writes: string[] = [];
  const api: any = async (path: string, method: string, body: any) => {
    if (path === "/state" && !method)
      return {
        items: [{ key: "note.a", value: { body: "Remote" }, revision: 2 }],
      };
    writes.push(body.key);
    if (body.key === "note.a" && body.revision !== 2)
      throw new ReaderApiError("Conflict", 409);
    return { revision: 3 };
  };
  const first = new ReaderSync(api, (s) => {
    snapshot = structuredClone(s);
  });
  await first.start(() => {});
  first.change("note.a", { body: "Local" });
  snapshot.revisions["note.a"] = 1;
  snapshot.pending["note.a"].revision = 1;
  const resumed = new ReaderSync(
    api,
    (s) => {
      snapshot = structuredClone(s);
    },
    snapshot,
  );
  resumed.change("note.b", { body: "Independent" });
  await resumed.start(() => {});
  assert.equal(snapshot.pending["note.a"].revision, 1);
  assert(!snapshot.pending["note.b"]);
  assert(resumed.conflicts);
  await resumed.keepLocalChanges();
  assert.deepEqual(snapshot.pending, {});
  assert(writes.includes("note.b"));
});

test("HTTP rejection status survives a non-JSON body and late rejections cannot clear a new cookie", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("Unauthorized", { status: 401 });
    const { readerClient, ReaderApiError } = await import(
      "../packages/core/src/reader-account"
    );
    await assert.rejects(
      readerClient("https://reader.test")("/me"),
      (e) => e instanceof ReaderApiError && e.status === 401,
    );
  } finally {
    globalThis.fetch = original;
  }
  for (const path of ["/me", "/state", "/logout"]) {
    const response = await proxyReader(
      new Request(base + path, {
        method: path === "/logout" ? "POST" : "GET",
        headers: {
          Origin: "https://reader.test",
          cookie: `${COOKIE}=${"b".repeat(64)}`,
        },
        body: path === "/logout" ? "{}" : undefined,
      }),
      "local",
      async () => new Response('{"error":"Please sign in"}', { status: 401 }),
    );
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("optional reading and quotation metadata reject malformed synced values and accept old notes", async () => {
  const { call, login } = await setup(),
    token = await login();
  const value = {
    bookId: "demo",
    page: 1,
    chapter: 0,
    time: 0,
    body: "A thought",
  };
  for (const extra of [
    { quote: { x: 1 } },
    { quote: "a".repeat(2001) },
    { kind: "script" },
    { segment: -1 },
    { offset: 1.5 },
    { segment: 2, endSegment: 1 },
    { segment: 1, offset: 8, endSegment: 1, endOffset: 3 },
    { reading: { chapter: 0, segment: "0", offset: 0 } },
  ])
    assert.equal(
      (
        await call(
          "/state",
          "PUT",
          { key: "note.bad", revision: 0, value: { ...value, ...extra } },
          token,
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await call(
        "/state",
        "PUT",
        { key: "note.legacy", revision: 0, value },
        token,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/state",
        "PUT",
        {
          key: "note.quote",
          revision: 0,
          value: {
            ...value,
            quote: "A sentence",
            kind: "highlight",
            segment: 0,
            offset: 0,
            endSegment: 0,
            endOffset: 10,
          },
        },
        token,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/state",
        "PUT",
        {
          key: "progress.demo",
          revision: 0,
          value: {
            bookId: "demo",
            page: 1,
            chapter: 0,
            time: 2,
            reading: { chapter: 1, segment: 0, offset: 15 },
          },
        },
        token,
      )
    ).status,
    200,
  );
});

test("email identifiers register as readers, normalize at login, and cannot self-promote", async () => {
  const { call, db } = await setup();
  const response = await call("/register", "POST", {
    username: "  Reader+one@Example.com  ",
    password: testPassword,
    displayName: "A reader",
    role: "admin",
    active: true,
  });
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(session.account.username, "reader+one@example.com");
  assert.equal(session.account.role, "reader");
  assert.equal(
    (await call("/admin/accounts", "GET", undefined, session.token)).status,
    403,
  );
  assert.equal(
    (
      await call("/login", "POST", {
        username: "READER+ONE@EXAMPLE.COM",
        password: testPassword,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/register", "POST", {
        username: "reader+one@example.com",
        password: testPassword,
        displayName: "Duplicate",
      })
    ).status,
    409,
  );
  const account = db
    .table("book_reader_accounts")
    .find((a) => a.id === session.account.id)!;
  assert(!account.password_hash.includes(testPassword));
  assert.equal((await call("/state")).status, 401);
});
test("account creation gives specific validation and rate-limits rotating identities", async () => {
  const { call, db } = await setup();
  for (const [username, password, displayName, match] of [
    ["bad@", testPassword, "Reader", /email address/],
    ["valid@example.com", "short", "Reader", /12–256/],
    ["valid@example.com", testPassword, "", /your name/],
  ]) {
    const response = await call("/register", "POST", {
      username,
      password,
      displayName,
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, match as RegExp);
  }
  let response: Response;
  for (let i = 0; i < 6; i++)
    response = await call("/register", "POST", {
      username: `new${i}@example.com`,
      password: "short",
      displayName: "Reader",
    });
  assert.equal(response!.status, 429);
  assert.equal(db.table("book_reader_accounts").length, 3);
});
test("email owner invitation remains atomic and can sign in after activation", async () => {
  const { call, db } = await setup(),
    invite = token();
  await db.insert("book_reader_invites", {
    token_hash: await digest(invite),
    role: "admin",
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  const response = await call("/activate", "POST", {
    username: "owner@example.com",
    password: testPassword,
    displayName: "Owner",
    invite,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).account.role, "admin");
  assert.equal(
    (
      await call("/activate", "POST", {
        username: "other@example.com",
        password: testPassword,
        displayName: "Other",
        invite,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/login", "POST", {
        username: "owner@example.com",
        password: testPassword,
      })
    ).status,
    200,
  );
});
test("guest media allowlist is exact and read-only; personal API remains protected", async () => {
  const allow = ["/library.json", "/books/demo/book.pdf"];
  const send = async () => {
    throw Error("Guest paths must not call account service");
  };
  for (const path of allow)
    assert(
      await authorizeMedia(
        new Request("https://reader.test" + path),
        send,
        allow,
      ),
    );
  for (const path of [
    "/books/private/book.pdf",
    "/books/demo/%62ook.pdf",
    "/books/demo/book.pdf/",
    "/api/reader/state",
  ])
    assert.equal(
      await authorizeMedia(
        new Request("https://reader.test" + path),
        send,
        allow,
      ),
      false,
    );
  assert.equal(
    await authorizeMedia(
      new Request("https://reader.test/library.json", { method: "POST" }),
      send,
      allow,
    ),
    false,
  );
});

test("in-flight outbox flush drains later edits with the acknowledged revision", async () => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const entered = new Promise<void>((r) => {
    started = r;
  });
  const writes: any[] = [];
  let snapshot: SyncSnapshot = { pending: {}, revisions: {} };
  const api: any = async (_path: string, _method: string, body: any) => {
    writes.push(structuredClone(body));
    if (writes.length === 1) {
      started();
      await gate;
    }
    return { revision: body.revision + 1 };
  };
  const sync = new ReaderSync(api, (s) => {
    snapshot = structuredClone(s);
  });
  sync.change("note.a", { body: "First" });
  const first = sync.flush();
  await entered;
  sync.change("note.a", { body: "Edited while sending" });
  sync.change("note.b", { body: "Added while sending" });
  const again = sync.flush();
  release();
  await Promise.all([first, again]);
  assert.deepEqual(
    writes.map((w) => [w.key, w.value.body, w.revision]),
    [
      ["note.a", "First", 0],
      ["note.a", "Edited while sending", 1],
      ["note.b", "Added while sending", 0],
    ],
  );
  assert.deepEqual(snapshot.pending, {});
});

test("closing an in-flight outbox retains later edits without sending after account exit", async () => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const entered = new Promise<void>((r) => {
    started = r;
  });
  let calls = 0,
    snapshot: SyncSnapshot = { pending: {}, revisions: {} };
  const api: any = async () => {
    calls++;
    started();
    await gate;
    return { revision: 1 };
  };
  const sync = new ReaderSync(api, (s) => {
    snapshot = structuredClone(s);
  });
  sync.change("note.a", { body: "First" });
  const pending = sync.flush();
  await entered;
  sync.change("note.a", { body: "Retained" });
  sync.close();
  release();
  await pending;
  assert.equal(calls, 1);
  assert.equal(snapshot.pending["note.a"].value?.body, "Retained");
});
