import {
  type Database,
  DatabaseFailure,
  passwordHash,
  type Account,
} from "../../server/reader-api";
export class MemoryDatabase implements Database {
  tables: Record<string, Record<string, any>[]> = {};
  table(name: string) {
    return (this.tables[name] ||= []);
  }
  async read<T = Record<string, unknown>>(
    t: string,
    f: Record<string, string> = {},
    select = "*",
  ): Promise<T[]> {
    return structuredClone(
      this.table(t)
        .filter((row) =>
          Object.entries(f).every(([k, v]) => String(row[k]) === v),
        )
        .map((row) =>
          select === "*"
            ? row
            : Object.fromEntries(select.split(",").map((k) => [k, row[k]])),
        ),
    ) as T[];
  }
  async insert(t: string, v: Record<string, unknown>) {
    if (
      t === "book_reader_accounts" &&
      this.table(t).some((row) => row.username === v.username)
    )
      throw new DatabaseFailure("23505");
    this.table(t).push(structuredClone(v));
  }
  async update(
    t: string,
    f: Record<string, string>,
    v: Record<string, unknown>,
  ) {
    for (const row of this.table(t))
      if (Object.entries(f).every(([k, x]) => row[k] === x))
        Object.assign(row, v);
  }
  async remove(t: string, f: Record<string, string>) {
    this.tables[t] = this.table(t).filter(
      (row) => !Object.entries(f).every(([k, x]) => row[k] === x),
    );
  }
  async rpc<T>(name: string, a: Record<string, any>): Promise<T> {
    let result: unknown;
    if (name === "book_reader_consume_attempt") {
      let row = this.table("book_reader_rate_limits").find(
        (x) => x.key === a.p_key,
      );
      if (!row) {
        row = { key: a.p_key, hits: 0 };
        this.table("book_reader_rate_limits").push(row);
      }
      result = ++row.hits <= a.p_limit;
    } else if (name === "book_reader_issue_session") {
      const row = this.table("book_reader_accounts").find(
        (x) => x.id === a.p_account,
      );
      result = !!row?.active && row.session_version === a.p_version;
      if (result)
        await this.insert("book_reader_sessions", {
          token_hash: a.p_hash,
          account_id: a.p_account,
          expires_at: a.p_expires,
          session_version: a.p_version,
        });
    } else if (name === "book_reader_set_access") {
      const row = this.table("book_reader_accounts").find(
        (x) => x.id === a.p_account,
      );
      if (row) {
        row.active = a.p_active;
        row.session_version++;
      }
      await this.remove("book_reader_sessions", { account_id: a.p_account });
    } else if (name === "book_reader_write_state") {
      const row = this.table("book_reader_state").find(
        (x) => x.account_id === a.p_account && x.key === a.p_key,
      );
      if (row && row.revision === a.p_revision) {
        row.value = structuredClone(a.p_value);
        result = ++row.revision;
      } else if (!row && a.p_revision === 0) {
        await this.insert("book_reader_state", {
          account_id: a.p_account,
          key: a.p_key,
          value: a.p_value,
          revision: 1,
        });
        result = 1;
      } else result = null;
    } else if (name === "book_reader_claim_invite") {
      const row = this.table("book_reader_invites").find(
        (x) =>
          x.token_hash === a.p_hash &&
          !x.used_at &&
          Date.parse(x.expires_at) > Date.now(),
      );
      if (!row) result = null;
      else {
        if (
          this.table("book_reader_accounts").some(
            (x) => x.username === a.p_username,
          )
        )
          throw Error("Duplicate");
        row.used_at = new Date().toISOString();
        const id = crypto.randomUUID();
        await this.insert("book_reader_accounts", {
          id,
          username: a.p_username,
          display_name: a.p_name,
          password_hash: a.p_password,
          role: row.role,
          active: true,
          session_version: 0,
        });
        result = id;
      }
    } else throw Error("Unknown RPC");
    return result as T;
  }
}
export const testPassword = "Twelve words make a quiet chapter.";
export const ids = {
  alice: "11111111-1111-4111-8111-111111111111",
  bob: "22222222-2222-4222-8222-222222222222",
  admin: "33333333-3333-4333-8333-333333333333",
};
export async function fixtureDatabase() {
  const db = new MemoryDatabase(),
    hash = await passwordHash(testPassword);
  for (const [name, id] of Object.entries(ids))
    await db.insert("book_reader_accounts", {
      id,
      username: name,
      display_name: name[0].toUpperCase() + name.slice(1),
      role: name === "admin" ? "admin" : "reader",
      active: true,
      password_hash: hash,
      session_version: 0,
    });
  return db;
}
