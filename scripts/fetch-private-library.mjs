import {
  mkdir,
  readFile,
  writeFile,
  rename,
  realpath,
  lstat,
} from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const safePath = (path) =>
  path === "library.json" ||
  (/^books\/manifest\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(path) &&
    !path.split("/").some((p) => p === "." || p === ".."));
export async function fetchPrivateLibrary(
  root,
  env = process.env,
  send = fetch,
) {
  const { PAGECHIME_LIBRARY_URL: endpoint, PAGECHIME_LIBRARY_KEY: token } = env;
  if (!endpoint || !token) {
    if (
      env.PAGECHIME_LIBRARY_REQUIRED === "1" ||
      (env.CONTEXT === "branch-deploy" && env.BRANCH === "develop")
    ) {
      const missing = [
        !endpoint && "PAGECHIME_LIBRARY_URL",
        !token && "PAGECHIME_LIBRARY_KEY",
      ].filter(Boolean);
      throw Error(
        "The private develop library build connection is missing: " +
          missing.join(", ") +
          ". Set these variables for develop builds in Netlify.",
      );
    }
    return null;
  }
  const origin = new URL(endpoint);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{64}$/.test(token))
    throw Error("Invalid private library build configuration.");
  const response = await send(endpoint.replace(/\/$/, "") + "/manifest", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw Error(`Private library manifest failed (${response.status}).`);
  const manifest = await response.json();
  if (
    !/^[a-f0-9]{64}$/.test(manifest.version) ||
    !Array.isArray(manifest.files) ||
    manifest.files.length < 3 ||
    manifest.files.length > 256
  )
    throw Error("Invalid private library manifest.");
  const canonical = manifest.files
    .map(({ path, sha256, size, contentType }) => ({
      path,
      sha256,
      size,
      contentType,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (
    hash(JSON.stringify(canonical)) !== manifest.version ||
    new Set(canonical.map((f) => f.path)).size !== canonical.length ||
    !canonical.some((f) => f.path === "library.json") ||
    !canonical.some((f) => f.path === "books/manifest/book.json") ||
    canonical.reduce((s, f) => s + f.size, 0) > 256 * 1024 * 1024
  )
    throw Error("Library manifest integrity check failed.");
  await mkdir(root, { recursive: true });
  const base = await realpath(root);
  for (const file of manifest.files) {
    if (
      !safePath(file.path) ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      file.size > 24 * 1024 * 1024
    )
      throw Error("Unsafe private library file.");
    const url = new URL(file.url);
    if (
      url.origin !== origin.origin ||
      url.pathname !==
        "/storage/v1/object/sign/pagechime-library-develop/versions/" +
          manifest.version +
          "/" +
          file.path ||
      url.username ||
      url.password
    )
      throw Error("Invalid private library download address.");
    const target = resolve(base, file.path);
    if (!target.startsWith(base + sep))
      throw Error("Unsafe private library path.");
    let parent = base;
    for (const part of file.path.split("/").slice(0, -1)) {
      parent = resolve(parent, part);
      await mkdir(parent, { recursive: true });
      if ((await lstat(parent)).isSymbolicLink())
        throw Error("Private library directories cannot be symbolic links.");
    }
    try {
      if ((await lstat(target)).isSymbolicLink())
        throw Error("Private library files cannot be symbolic links.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      const old = await readFile(target);
      if (old.length === file.size && hash(old) === file.sha256) continue;
    } catch {}
    const result = await send(url, {
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });
    if (!result.ok)
      throw Error(`Private library download failed (${result.status}).`);
    const chunks = [];
    let size = 0;
    if (!result.body) throw Error("Private library download has no body.");
    const reader = result.body.getReader();
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > file.size) {
        await reader.cancel();
        throw Error("Private library download exceeded its declared size.");
      }
      chunks.push(next.value);
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== file.size || hash(bytes) !== file.sha256)
      throw Error("Private library file integrity check failed.");
    const temp = target + ".download-" + randomUUID();
    await writeFile(temp, bytes, { flag: "wx" });
    await rename(temp, target);
  }
  return { version: manifest.version, count: manifest.files.length };
}
