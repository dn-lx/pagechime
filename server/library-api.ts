/** Private, development-only build assets. No application-user data is exposed here. */
import { digest, json } from "./reader-api.ts";
export const LIBRARY_BUCKET = "pagechime-library-develop";
export type LibraryFile = {
  path: string;
  sha256: string;
  size: number;
  contentType: string;
};
export type LibraryManifest = { version: string; files: LibraryFile[] };
export interface LibraryStore {
  prepare(manifest: LibraryManifest): Promise<{ path: string; url: string }[]>;
  publish(manifest: LibraryManifest): Promise<void>;
  current(): Promise<LibraryManifest | null>;
  signed(manifest: LibraryManifest): Promise<{ path: string; url: string }[]>;
}
export interface LibraryAccess {
  scope: "build" | "upload";
  expires_at: string | null;
}
const types: Record<string, string> = {
  json: "application/json",
  pdf: "application/pdf",
  epub: "application/epub+zip",
  mp3: "audio/mpeg",
  webp: "image/webp",
  txt: "text/plain",
};
export async function libraryManifest(
  value: unknown,
): Promise<LibraryManifest> {
  const manifest = value as LibraryManifest;
  if (
    !manifest ||
    !/^[a-f0-9]{64}$/.test(manifest.version) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length < 3 ||
    manifest.files.length > 256
  )
    throw Error("Invalid library manifest.");
  const files = manifest.files
    .map((f) => {
      const parts = typeof f?.path === "string" ? f.path.split("/") : [];
      const ext = parts.at(-1)?.split(".").at(-1) || "";
      if (
        !(
          f.path === "library.json" ||
          /^books\/manifest\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(
            f.path,
          )
        ) ||
        parts.some((p) => p === "." || p === "..") ||
        !types[ext] ||
        f.contentType !== types[ext] ||
        !/^[a-f0-9]{64}$/.test(f.sha256) ||
        !Number.isSafeInteger(f.size) ||
        f.size < 1 ||
        f.size > 24 * 1024 * 1024
      )
        throw Error("Invalid library file.");
      return {
        path: f.path,
        sha256: f.sha256,
        size: f.size,
        contentType: f.contentType,
      };
    })
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (
    new Set(files.map((f) => f.path)).size !== files.length ||
    !files.some((f) => f.path === "library.json") ||
    !files.some((f) => f.path === "books/manifest/book.json") ||
    files.reduce((n, f) => n + f.size, 0) > 256 * 1024 * 1024
  )
    throw Error("Invalid library contents.");
  if ((await digest(JSON.stringify(files))) !== manifest.version)
    throw Error("Library version does not match its files.");
  return { version: manifest.version, files };
}
async function body(request: Request) {
  if (!request.body) throw Error("Missing manifest.");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > 100000) {
      await reader.cancel();
      throw Error("Manifest is too large.");
    }
    chunks.push(next.value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
export function createLibraryApi(
  access: (hash: string) => Promise<LibraryAccess | null>,
  store: LibraryStore,
  rate: (ip: string) => Promise<boolean> = async () => true,
) {
  return async (request: Request, ip = "unknown") => {
    try {
      if (!(await rate(ip)))
        return json({ error: "Please wait before trying again." }, 429);
      const secret = request.headers
        .get("authorization")
        ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      if (!secret) return json({ error: "Build authorization required." }, 401);
      const key = await access(await digest(secret));
      if (!key || (key.expires_at && Date.parse(key.expires_at) <= Date.now()))
        return json({ error: "Build authorization required." }, 401);
      const path =
        new URL(request.url).pathname.replace(/^.*\/pagechime-library/, "") ||
        "/manifest";
      if (path === "/manifest" && request.method === "GET") {
        if (key.scope !== "build")
          return json({ error: "Upload-only credential." }, 403);
        const manifest = await store.current();
        if (!manifest)
          return json(
            { error: "The private library has not been published." },
            404,
          );
        const valid = await libraryManifest(manifest),
          signed = await store.signed(valid);
        return json({
          ...valid,
          files: valid.files.map((file) => ({
            ...file,
            url: signed.find((x) => x.path === file.path)?.url,
          })),
        });
      }
      if (
        ["/prepare", "/publish"].includes(path) &&
        request.method === "POST"
      ) {
        if (key.scope !== "upload")
          return json({ error: "Read-only build credential." }, 403);
        let manifest: LibraryManifest;
        try {
          manifest = await libraryManifest(await body(request));
        } catch {
          return json(
            { error: "Check the library manifest and file limits." },
            400,
          );
        }
        if (path === "/prepare")
          return json({
            version: manifest.version,
            uploads: await store.prepare(manifest),
          });
        await store.publish(manifest);
        return json({ version: manifest.version, published: true });
      }
      return json({ error: "Not found." }, 404);
    } catch {
      return json(
        { error: "The private library service is temporarily unavailable." },
        503,
      );
    }
  };
}
