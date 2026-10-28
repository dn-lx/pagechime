import { json, restDatabase, type Database } from "./reader-api.ts";
import {
  sharedPackage,
  sharedReaderBook,
  sharedBookId,
  SHARED_FILE_LIMIT,
  type SharedAsset,
  type SharedBookPackage,
} from "../packages/core/src/shared-book.ts";
export const SHARED_BUCKET = "pagechime-shared-books-develop";
export type SharedRow = {
  id: string;
  owner_id: string;
  package: SharedBookPackage;
  files: SharedAsset[];
  verified: Record<string, string>;
  status: "draft" | "published";
};
export interface SharedStore {
  list(after: string): Promise<SharedRow[]>;
  drafts(owner: string): Promise<SharedRow[]>;
  row(id: string): Promise<SharedRow | null>;
  begin(
    id: string,
    owner: string,
    book: SharedBookPackage,
    files: SharedAsset[],
  ): Promise<boolean>;
  upload(id: string, file: SharedAsset): Promise<string>;
  verify(id: string, owner: string, file: SharedAsset): Promise<boolean>;
  publish(id: string, owner: string): Promise<boolean>;
  media(id: string, file: SharedAsset): Promise<string>;
}
class InputError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (s: number, m: string): never => {
  throw new InputError(s, m);
};
async function readBody(req: Request) {
  if (!req.body) return fail(400, "Missing book details.");
  const reader = req.body.getReader();
  let text = "",
    size = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > 100000) {
      await reader.cancel();
      return fail(413, "Book details are too large.");
    }
    text += decoder.decode(r.value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode());
  } catch {
    return fail(400, "Check the book details.");
  }
}
export function createSharedLibraryApi(
  store: SharedStore,
  capability: (key: string) => Promise<boolean>,
  admin: (req: Request) => Promise<{ id: string; role: string } | null>,
) {
  return async (req: Request) => {
    try {
      const key = req.headers.get("x-pagechime-library-key") || "";
      if (!/^[a-f0-9]{64}$/.test(key) || !(await capability(key)))
        return fail(401, "Library authorization required.");
      const url = new URL(req.url),
        path = url.pathname
          .replace(/^.*\/pagechime-shared-library/, "")
          .replace(/^\/api\/library/, "");
      if (path === "/catalog" && req.method === "GET") {
        const after = url.searchParams.get("after") || "";
        if (after && !sharedBookId(after))
          return fail(400, "Invalid catalog page.");
        const rows = await store.list(after);
        return json({
          books: rows.map((r) => sharedReaderBook(r.id, r.package, r.files)),
          next: rows.length === 50 ? rows.at(-1)!.id : null,
        });
      }
      const media =
        /^\/media\/(shared-[a-f0-9-]{36})\/(asset-\d{3}\.(?:pdf|mp3|m4a|wav|ogg|png|jpe?g|webp))$/.exec(
          path,
        );
      if (media && ["GET", "HEAD"].includes(req.method)) {
        const row = await store.row(media[1]),
          file = row?.files.find((f) => f.key === media[2]);
        if (!row || row.status !== "published" || !file)
          return fail(404, "Book file not found.");
        return new Response(null, {
          status: 302,
          headers: {
            Location: await store.media(row.id, file),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (!path.startsWith("/admin/")) return fail(404, "Not found.");
      const a = await admin(req);
      if (!a) return fail(401, "Please sign in again.");
      if (a.role !== "admin")
        return fail(403, "Only an administrator can publish books.");
      if (path === "/admin/drafts" && req.method === "GET")
        return json({ drafts: await store.drafts(a.id) });
      if (path === "/admin/prepare" && req.method === "POST") {
        const body = await readBody(req);
        if (!body || typeof body !== "object" || !sharedBookId(body.id))
          return fail(400, "Invalid upload identifier.");
        let parsed: ReturnType<typeof sharedPackage>;
        try {
          parsed = sharedPackage(body.book, body.files);
        } catch (e) {
          return fail(400, (e as Error).message);
        }
        if (!(await store.begin(body.id, a.id, parsed.book, parsed.files)))
          return fail(
            409,
            "Library capacity or draft limit reached, or this upload has changed. Keep at most three unfinished uploads.",
          );
        const row = await store.row(body.id);
        if (!row || row.owner_id !== a.id)
          return fail(409, "This upload is no longer available.");
        const uploads = [];
        for (const file of row.files)
          uploads.push({
            ...file,
            verified: row.verified[file.key] === file.sha256,
            url:
              row.verified[file.key] === file.sha256
                ? null
                : await store.upload(row.id, file),
          });
        return json({ id: row.id, uploads });
      }
      const action =
        /^\/admin\/(shared-[a-f0-9-]{36})\/(publish|verify\/asset-\d{3}\.[a-z0-9]+)$/.exec(
          path,
        );
      if (action && req.method === "POST") {
        const row = await store.row(action[1]);
        if (!row || row.owner_id !== a.id)
          return fail(404, "Upload not found.");
        if (action[2] === "publish") {
          if (row.status === "published")
            return json({
              book: sharedReaderBook(row.id, row.package, row.files),
            });
          if (
            !row.files.every((f) => row.verified[f.key] === f.sha256) ||
            !(await store.publish(row.id, a.id))
          )
            return fail(
              409,
              "Every file must be uploaded and verified before publishing.",
            );
          return json({
            book: sharedReaderBook(row.id, row.package, row.files),
          });
        }
        if (row.status !== "draft")
          return fail(409, "Published files cannot be replaced.");
        const file = row.files.find((f) => f.key === action[2].slice(7));
        if (!file) return fail(404, "Upload file not found.");
        if (
          row.verified[file.key] !== file.sha256 &&
          !(await store.verify(row.id, a.id, file))
        )
          return fail(
            409,
            "The uploaded file does not match. Check the selected file and retry.",
          );
        return json({ verified: true });
      }
      return fail(404, "Not found.");
    } catch (e) {
      return e instanceof InputError
        ? json({ error: e.message }, e.status)
        : json(
            {
              error:
                "The shared library is temporarily unavailable. Your draft stays private; retry to continue.",
            },
            503,
          );
    }
  };
}
export function storageSignature(bytes: Uint8Array, type: string) {
  const s = new TextDecoder("latin1").decode(bytes.subarray(0, 16));
  if (type === "application/pdf") return s.startsWith("%PDF-");
  if (type === "audio/mpeg")
    return (
      s.startsWith("ID3") || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  if (type === "audio/wav")
    return s.startsWith("RIFF") && s.slice(8, 12) === "WAVE";
  if (type === "audio/mp4") return s.slice(4, 8) === "ftyp";
  if (type === "audio/ogg") return s.startsWith("OggS");
  if (type === "image/png") return bytes[0] === 137 && s.slice(1, 4) === "PNG";
  if (type === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return (
    type === "image/webp" && s.startsWith("RIFF") && s.slice(8, 12) === "WEBP"
  );
}
/** Service credentials stay inside the Supabase function. Only exact-object signed URLs leave it. */
export function restSharedStore(
  url: string,
  secret: string,
  db: Database = restDatabase(url, secret),
): SharedStore {
  const headers = {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
  const object = (id: string, f: SharedAsset) =>
    `${SHARED_BUCKET}/${id}/${f.key}`;
  const storageUrl = (path: string) =>
    new URL(
      path.startsWith("http")
        ? path
        : url +
          (path.startsWith("/storage/v1/") ? "" : "/storage/v1") +
          (path.startsWith("/") ? path : "/" + path),
    );
  async function call(path: string, init?: RequestInit) {
    const r = await fetch(url + path, {
      ...init,
      headers: { ...headers, ...init?.headers },
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw Error("Storage request failed.");
    return r;
  }
  return {
    list: async (after) =>
      (
        await call(
          `/rest/v1/book_reader_shared_books?status=eq.published&order=id&limit=50${after ? `&id=gt.${after}` : ""}`,
        )
      ).json(),
    drafts: async (owner) =>
      (
        await call(
          `/rest/v1/book_reader_shared_books?status=eq.draft&owner_id=eq.${encodeURIComponent(owner)}&order=id&limit=3`,
        )
      ).json(),
    row: async (id) =>
      (
        await (
          await call(`/rest/v1/book_reader_shared_books?id=eq.${id}&limit=1`)
        ).json()
      )[0] || null,
    begin: async (id, owner, book, files) => {
      const bucket = await fetch(`${url}/storage/v1/bucket/${SHARED_BUCKET}`, {
        headers,
        signal: AbortSignal.timeout(12000),
      });
      if (bucket.status === 404) {
        await call("/storage/v1/bucket", {
          method: "POST",
          body: JSON.stringify({
            id: SHARED_BUCKET,
            name: SHARED_BUCKET,
            public: false,
            file_size_limit: SHARED_FILE_LIMIT,
            allowed_mime_types: [
              "application/pdf",
              "audio/mpeg",
              "audio/mp4",
              "audio/wav",
              "audio/ogg",
              "image/webp",
              "image/png",
              "image/jpeg",
            ],
          }),
        });
      } else {
        if (!bucket.ok) throw Error("Bucket unavailable.");
        const b = await bucket.json();
        if (b.public || Number(b.file_size_limit) !== SHARED_FILE_LIMIT)
          throw Error("Unexpected shared storage configuration.");
      }
      return db.rpc("book_reader_shared_begin", {
        p_id: id,
        p_owner: owner,
        p_package: book,
        p_files: files,
      });
    },
    upload: async (id, f) => {
      const data = await (
        await call(`/storage/v1/object/upload/sign/${object(id, f)}`, {
          method: "POST",
          body: "{}",
        })
      ).json();
      const signed = storageUrl(data.url);
      if (
        signed.origin !== new URL(url).origin ||
        !signed.pathname.endsWith(`/object/upload/sign/${object(id, f)}`)
      )
        throw Error("Invalid upload address.");
      return signed.href;
    },
    verify: async (id, owner, f) => {
      const response = await call(`/storage/v1/object/${object(id, f)}`);
      if (
        response.headers
          .get("content-type")
          ?.split(";")[0]
          .trim()
          .toLowerCase() !== f.contentType
      ) {
        await response.body?.cancel();
        return false;
      }
      if (!response.body) return false;
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.length;
        if (size > f.size || size > SHARED_FILE_LIMIT) {
          await reader.cancel();
          return false;
        }
        chunks.push(r.value);
      }
      if (size !== f.size) return false;
      const all = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) {
        all.set(c, at);
        at += c.length;
      }
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", all)),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== f.sha256 || !storageSignature(all, f.contentType))
        return false;
      return db.rpc("book_reader_shared_verify", {
        p_id: id,
        p_owner: owner,
        p_key: f.key,
        p_hash: hash,
      });
    },
    publish: (id, owner) =>
      db.rpc("book_reader_shared_publish", { p_id: id, p_owner: owner }),
    media: async (id, f) => {
      const data = await (
        await call(`/storage/v1/object/sign/${object(id, f)}`, {
          method: "POST",
          body: JSON.stringify({ expiresIn: 300 }),
        })
      ).json();
      const signed = storageUrl(data.signedURL);
      if (
        signed.origin !== new URL(url).origin ||
        !signed.pathname.endsWith(`/object/sign/${object(id, f)}`)
      )
        throw Error("Invalid media address.");
      return signed.href;
    },
  };
}
