import {
  createSharedLibraryApi,
  restSharedStore,
} from "../../../server/shared-library-api.ts";
import { restDatabase, digest } from "../../../server/reader-api.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = restDatabase(url, secret);
const handler = createSharedLibraryApi(
  restSharedStore(url, secret, db),
  async (key) => {
    const [row] = await db.read<{ scope: string; expires_at: string | null }>(
      "book_reader_library_keys",
      { token_hash: await digest(key) },
    );
    return (
      !!row &&
      row.scope === "build" &&
      (!row.expires_at || Date.parse(row.expires_at) > Date.now())
    );
  },
  async (req) => {
    const authorization = req.headers.get("authorization") || "";
    if (!/^Bearer [a-f0-9]{64}$/.test(authorization)) return null;
    const r = await fetch(url + "/functions/v1/book-reader-api/me", {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(12000),
    });
    return r.ok ? (await r.json()).account : null;
  },
);
Deno.serve(handler);
