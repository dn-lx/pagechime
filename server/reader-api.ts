import {
  normalizeReaderUsername,
  readerDetailsError,
} from "../packages/core/src/account-details.ts";
/** This module runs only on the server. No dependency on Supabase Auth. */
export interface Database {
  read<T = Record<string, unknown>>(
    table: string,
    filters?: Record<string, string>,
    select?: string,
  ): Promise<T[]>;
  insert(table: string, value: Record<string, unknown>): Promise<void>;
  update(
    table: string,
    filters: Record<string, string>,
    value: Record<string, unknown>,
  ): Promise<void>;
  remove(table: string, filters: Record<string, string>): Promise<void>;
  rpc<T>(name: string, args: Record<string, unknown>): Promise<T>;
}
export type Account = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "reader";
  active: boolean;
  password_hash: string;
  session_version: number;
};
const encoder = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(b))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const bytes = (s: string) =>
  new Uint8Array(s.match(/../g)!.map((x) => parseInt(x, 16)));
export const token = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async (s: string) =>
  hex(await crypto.subtle.digest("SHA-256", encoder.encode(s)));
export async function passwordHash(password: string, salt = token()) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: bytes(salt) },
    key,
    256,
  );
  return `pbkdf2-sha256$600000$${salt}$${hex(bits)}`;
}
export async function passwordMatches(password: string, encoded: string) {
  const parts = encoded.split("$");
  if (
    parts.length !== 4 ||
    parts[0] !== "pbkdf2-sha256" ||
    parts[1] !== "600000" ||
    !/^[0-9a-f]{64}$/.test(parts[2]) ||
    !/^[0-9a-f]{64}$/.test(parts[3])
  )
    return false;
  const result = await passwordHash(password, parts[2]);
  let diff = 0;
  for (let i = 0; i < result.length; i++)
    diff |= result.charCodeAt(i) ^ encoded.charCodeAt(i);
  return diff === 0;
}
const dummy = "pbkdf2-sha256$600000$" + "0".repeat(64) + "$" + "0".repeat(64);
const clean = (a: Account) => ({
  id: a.id,
  username: a.username,
  displayName: a.display_name,
  role: a.role,
});
export class DatabaseFailure extends Error {
  constructor(public code: string) {
    super("Database request failed");
  }
}
class Failure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new Failure(status, message);
};
const text = (x: unknown, max: number) =>
  typeof x === "string" && x.length <= max
    ? x
    : fail(400, "Check the supplied details.");
const uuid = (x: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function restDatabase(url: string, secret: string): Database {
  async function call(path: string, method = "GET", body?: unknown) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new DatabaseFailure(
        typeof error.code === "string" ? error.code : "unknown",
      );
    }
    return response.status === 204 ||
      response.headers.get("content-length") === "0"
      ? null
      : JSON.parse((await response.text()) || "null");
  }
  const query = (f: Record<string, string> = {}) =>
    new URLSearchParams(
      Object.fromEntries(Object.entries(f).map(([k, v]) => [k, `eq.${v}`])),
    );
  return {
    read: async <T>(table: string, f = {}, select = "*") => {
      const rows: T[] = [];
      const q = query(f);
      q.set("select", select);
      q.set("limit", "500");
      q.set(
        "order",
        table === "book_reader_state"
          ? "key"
          : table === "book_reader_accounts"
            ? "id"
            : "token_hash",
      );
      for (;;) {
        q.set("offset", String(rows.length));
        const response = await fetch(`${url}/rest/v1/${table}?${q}`, {
          headers: {
            apikey: secret,
            Authorization: `Bearer ${secret}`,
            Prefer: "count=exact",
          },
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) throw new Error("Database request failed");
        const total = Number(
          response.headers.get("content-range")?.split("/")[1],
        );
        const page = (await response.json()) as T[];
        if (!Number.isFinite(total) || !Array.isArray(page))
          throw new Error("Incomplete database response");
        rows.push(...page);
        if (rows.length >= total) return rows;
        if (!page.length) throw new Error("Incomplete database response");
      }
    },
    insert: async (t, v) => {
      await call(t, "POST", v);
    },
    update: async (t, f, v) => {
      await call(`${t}?${query(f)}`, "PATCH", v);
    },
    remove: async (t, f) => {
      await call(`${t}?${query(f)}`, "DELETE");
    },
    rpc: async <T>(n: string, a: Record<string, unknown>) =>
      (await call(`rpc/${n}`, "POST", a)) as T,
  };
}
export function createReaderApi(db: Database, pepper: string) {
  async function rate(ip: string, username: string, registration = false) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(pepper),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const scopes: Array<readonly [string, number]> = [
      ["global", 1000],
      [`ip:${ip}`, 60],
      [`user:${username}`, 10],
    ];
    if (registration)
      scopes.push(["register:global", 100], [`register:ip:${ip}`, 5]);
    for (const [s, limit] of scopes) {
      const hashed = hex(
        await crypto.subtle.sign("HMAC", key, encoder.encode(s)),
      );
      if (
        !(await db.rpc<boolean>("book_reader_consume_attempt", {
          p_key: hashed,
          p_limit: limit,
        }))
      )
        fail(429, "Please wait a little before trying again.");
    }
  }
  async function authenticate(req: Request) {
    const bearer = req.headers
      .get("authorization")
      ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!bearer) return fail(401, "Please sign in.");
    const hash = await digest(bearer);
    const [s] = await db.read<{
      account_id: string;
      expires_at: string;
      session_version: number;
    }>("book_reader_sessions", { token_hash: hash });
    if (!s || Date.parse(s.expires_at) <= Date.now())
      return fail(401, "Please sign in again.");
    const [a] = await db.read<Account>("book_reader_accounts", {
      id: s.account_id,
    });
    if (!a?.active || a.session_version !== s.session_version)
      return fail(401, "Please sign in again.");
    return { account: a, hash, expiresAt: s.expires_at };
  }
  async function session(a: Account) {
    const secret = token(),
      expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    if (
      !(await db.rpc<boolean>("book_reader_issue_session", {
        p_hash: await digest(secret),
        p_account: a.id,
        p_expires: expiresAt,
        p_version: a.session_version,
      }))
    )
      return fail(401, "Please sign in again.");
    return json({ account: clean(a), token: secret, expiresAt });
  }
  return async (req: Request, ip = "unknown") => {
    try {
      const path =
        new URL(req.url).pathname
          .replace(/^.*\/book-reader-api/, "")
          .replace(/^\/api\/reader/, "") || "/me";
      if (req.method === "OPTIONS") return new Response(null, { status: 405 }); // Native has no CORS; web uses its same-origin BFF.
      if (
        (path === "/login" || path === "/activate" || path === "/register") &&
        req.method === "POST"
      ) {
        const raw = await req.text();
        if (raw.length > 4096) return fail(413, "Request is too large.");
        const b = JSON.parse(raw);
        if (!b || typeof b !== "object" || Array.isArray(b))
          return fail(400, "Invalid request.");
        const username = normalizeReaderUsername(text(b.username, 254)),
          password = text(b.password, 256);
        await rate(ip, username, path === "/register");
        const name =
          path === "/login" ? undefined : text(b.displayName, 80).trim();
        const detailsError = readerDetailsError(username, password, name);
        if (detailsError) return fail(400, detailsError);
        if (path === "/register") {
          const a: Account = {
            id: crypto.randomUUID(),
            username,
            display_name: name!,
            role: "reader",
            active: true,
            session_version: 0,
            password_hash: await passwordHash(password),
          };
          try {
            await db.insert("book_reader_accounts", a);
          } catch (error) {
            if (error instanceof DatabaseFailure && error.code === "23505")
              return fail(
                409,
                "This username or email is already in use. Try signing in, or choose another.",
              );
            throw error;
          }
          return session(a);
        }
        if (path === "/activate") {
          const invite = text(b.invite, 64),
            name = text(b.displayName, 80).trim();
          if (!/^[a-f0-9]{64}$/.test(invite) || !name)
            return fail(400, "Check your invitation and account details.");
          let id: string | null;
          try {
            id = await db.rpc<string | null>("book_reader_claim_invite", {
              p_hash: await digest(invite),
              p_username: username,
              p_name: name,
              p_password: await passwordHash(password),
            });
          } catch {
            return fail(
              400,
              "This invitation or username could not be accepted.",
            );
          }
          if (!id)
            return fail(
              400,
              "This invitation or username could not be accepted.",
            );
          const [a] = await db.read<Account>("book_reader_accounts", { id });
          return session(a);
        }
        const [a] = await db.read<Account>("book_reader_accounts", {
          username,
        });
        const matches = await passwordMatches(
          password,
          a?.password_hash || dummy,
        );
        if (!a?.active || !matches)
          return fail(401, "The username or password could not be accepted.");
        return session(a);
      }
      const { account: a, hash, expiresAt } = await authenticate(req);
      if (path === "/me" && req.method === "GET")
        return json({ account: clean(a), expiresAt });
      if (path === "/logout" && req.method === "POST") {
        await db.remove("book_reader_sessions", { token_hash: hash });
        return json({ ok: true });
      }
      if (path === "/state" && req.headers.get("x-reader-account") !== a.id)
        return fail(403, "The reader account changed. Please reload.");
      if (path === "/state" && req.method === "GET")
        return json({
          items: await db.read(
            "book_reader_state",
            { account_id: a.id },
            "key,value,revision",
          ),
        });
      if (path === "/state" && req.method === "PUT") {
        const raw = await req.text();
        if (raw.length > 24000) return fail(413, "This note is too long.");
        const b = JSON.parse(raw);
        if (!b || typeof b !== "object" || Array.isArray(b))
          return fail(400, "Invalid request.");
        const key = text(b.key, 180);
        if (
          !/^(bookmark|note|progress)\.[A-Za-z0-9_.-]{1,160}$/.test(key) ||
          !Number.isInteger(b.revision) ||
          b.revision < 0 ||
          b.revision > 2147483646 ||
          b.value === undefined
        )
          return fail(400, "Invalid reading data.");
        if (b.value !== null) {
          const v = b.value;
          if (typeof v !== "object" || Array.isArray(v))
            return fail(400, "Invalid reading data.");
          if (
            key.startsWith("note.") &&
            (typeof v.body !== "string" || v.body.length > 10000)
          )
            return fail(400, "A note needs text (up to 10,000 characters).");
          if (
            typeof v.bookId !== "string" ||
            v.bookId.length > 160 ||
            !Number.isInteger(v.page) ||
            v.page < 1 ||
            !Number.isInteger(v.chapter) ||
            v.chapter < 0 ||
            typeof v.time !== "number" ||
            !Number.isFinite(v.time) ||
            v.time < 0
          )
            return fail(400, "Invalid reading position.");
          const integer = (n: unknown) =>
            Number.isSafeInteger(n) && Number(n) >= 0;
          if (
            v.quote !== undefined &&
            (typeof v.quote !== "string" || v.quote.length > 2000)
          )
            return fail(
              400,
              "A quotation must be text up to 2,000 characters.",
            );
          if (v.kind !== undefined && !["note", "highlight"].includes(v.kind))
            return fail(400, "Invalid note type.");
          for (const field of ["segment", "offset", "endSegment", "endOffset"])
            if (v[field] !== undefined && !integer(v[field]))
              return fail(400, "Invalid text selection.");
          if (
            v.endSegment !== undefined &&
            v.segment !== undefined &&
            (v.endSegment < v.segment ||
              (v.endSegment === v.segment &&
                (v.endOffset ?? 0) < (v.offset ?? 0)))
          )
            return fail(400, "Invalid text selection.");
          if (
            ["segment", "offset", "endSegment", "endOffset"].some(
              (k) => v[k] !== undefined,
            ) &&
            !["segment", "offset", "endSegment", "endOffset"].every((k) =>
              integer(v[k]),
            )
          )
            return fail(400, "Incomplete text selection.");
          if (v.reading !== undefined) {
            const a = v.reading;
            if (
              !a ||
              typeof a !== "object" ||
              Array.isArray(a) ||
              !integer(a.chapter) ||
              !integer(a.segment) ||
              !integer(a.offset)
            )
              return fail(400, "Invalid reading anchor.");
          }
        }
        const revision = await db.rpc<number | null>(
          "book_reader_write_state",
          {
            p_account: a.id,
            p_key: key,
            p_value: b.value,
            p_revision: b.revision,
          },
        );
        if (!revision)
          return fail(
            409,
            "This item changed on another device. Your local copy has been kept.",
          );
        return json({ revision });
      }
      if (path.startsWith("/admin/")) {
        if (a.role !== "admin")
          return fail(403, "Administrator access is required.");
        if (path === "/admin/accounts" && req.method === "GET")
          return json({
            accounts: await db.read(
              "book_reader_accounts",
              {},
              "id,username,display_name,role,active,created_at",
            ),
          });
        if (path === "/admin/invites" && req.method === "POST") {
          const secret = token();
          await db.insert("book_reader_invites", {
            token_hash: await digest(secret),
            role: "reader",
            created_by: a.id,
            expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
          });
          return json({ invite: secret });
        }
        const id = path.slice("/admin/accounts/".length);
        if (
          path.startsWith("/admin/accounts/") &&
          req.method === "PATCH" &&
          uuid(id)
        ) {
          const b = await req.json();
          if (
            !b ||
            typeof b !== "object" ||
            Array.isArray(b) ||
            typeof b.active !== "boolean" ||
            id === a.id
          )
            return fail(400, "You cannot change your own access here.");
          await db.rpc("book_reader_set_access", {
            p_account: id,
            p_active: b.active,
          });
          return json({ ok: true });
        }
      }
      return json({ error: "This address was not found." }, 404);
    } catch (e) {
      if (e instanceof Failure) return json({ error: e.message }, e.status);
      if (e instanceof SyntaxError)
        return json({ error: "Invalid request." }, 400);
      return json(
        { error: "The reader service is temporarily unavailable." },
        503,
      );
    }
  };
}
