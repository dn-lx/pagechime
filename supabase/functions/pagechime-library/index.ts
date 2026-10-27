import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import {
  createLibraryApi,
  LIBRARY_BUCKET,
  type LibraryManifest,
} from "../../../server/library-api.ts";
import { restDatabase } from "../../../server/reader-api.ts";
const url = Deno.env.get("SUPABASE_URL")!,
  secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = restDatabase(url, secret),
  objects = supabase.storage.from(LIBRARY_BUCKET);
const key = (manifest: LibraryManifest, path: string) =>
  `versions/${manifest.version}/${path}`;
async function signed(manifest: LibraryManifest) {
  const { data, error } = await objects.createSignedUrls(
    manifest.files.map((f) => key(manifest, f.path)),
    600,
  );
  if (error || !data || data.some((x) => x.error || !x.signedUrl))
    throw Error("Library objects are incomplete");
  return manifest.files.map((f) => ({
    path: f.path,
    url: data.find((x) => x.path === key(manifest, f.path))!.signedUrl,
  }));
}
const handler = createLibraryApi(
  async (hash) =>
    (
      await db.read<{ scope: "build" | "upload"; expires_at: string | null }>(
        "book_reader_library_keys",
        { token_hash: hash },
        "scope,expires_at",
      )
    )[0] || null,
  {
    prepare: async (manifest) => {
      const existing = await supabase.storage.getBucket(LIBRARY_BUCKET);
      if (existing.error) {
        const created = await supabase.storage.createBucket(LIBRARY_BUCKET, {
          public: false,
          fileSizeLimit: 24 * 1024 * 1024,
          allowedMimeTypes: [
            ...new Set(manifest.files.map((f) => f.contentType)),
          ],
        });
        if (created.error) throw Error("Bucket unavailable");
      } else if (existing.data.public)
        throw Error("Library bucket must be private");
      const uploads = [];
      for (const file of manifest.files) {
        const { data, error } = await objects.createSignedUploadUrl(
          key(manifest, file.path),
          { upsert: false },
        );
        if (error || !data) throw Error("Upload unavailable");
        uploads.push({ path: file.path, url: data.signedUrl });
      }
      return uploads;
    },
    publish: async (manifest) => {
      await signed(manifest); // All immutable objects must exist before the atomic pointer changes.
      const { error } = await objects.upload(
        "current.json",
        JSON.stringify(manifest),
        { upsert: true, contentType: "application/json", cacheControl: "0" },
      );
      if (error) throw Error("Publish unavailable");
    },
    current: async () => {
      const { data, error } = await objects.download("current.json");
      if (error) return null;
      return JSON.parse(await data.text());
    },
    signed,
  },
  async (ip) => {
    const hmac = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const bytes = await crypto.subtle.sign(
      "HMAC",
      hmac,
      new TextEncoder().encode("pagechime-library:" + ip),
    );
    return db.rpc<boolean>("book_reader_consume_attempt", {
      p_key: Array.from(new Uint8Array(bytes), (x) =>
        x.toString(16).padStart(2, "0"),
      ).join(""),
      p_limit: 60,
    });
  },
);
Deno.serve((req) =>
  handler(
    req,
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown",
  ),
);
