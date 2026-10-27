/** Owner-operated, private build-input upload. Never print credentials or signed URLs. */
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(process.argv[2] || "apps/web/public"),
  endpoint = process.env.PAGECHIME_LIBRARY_URL,
  token = process.env.PAGECHIME_LIBRARY_UPLOAD_KEY;
if (
  !endpoint ||
  new URL(endpoint).protocol !== "https:" ||
  !/^[a-f0-9]{64}$/.test(token || "")
)
  throw Error(
    "Provide the private library endpoint and temporary upload capability in the environment.",
  );
const origin = new URL(endpoint).origin,
  types = {
    json: "application/json",
    pdf: "application/pdf",
    epub: "application/epub+zip",
    mp3: "audio/mpeg",
    webp: "image/webp",
    txt: "text/plain",
  };
const paths = ["library.json"];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw Error("Library inputs cannot be symbolic links.");
    const file = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile())
      paths.push(relative(root, file).split(sep).join("/"));
  }
}
await walk(resolve(root, "books/manifest"));
const files = [];
for (const path of paths.sort()) {
  const bytes = await readFile(resolve(root, path)),
    contentType = types[path.split(".").at(-1)];
  if (!contentType || bytes.length < 1 || bytes.length > 24 * 1024 * 1024)
    throw Error("Check private library file types and size limits.");
  files.push({
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
    contentType,
  });
}
const manifest = {
  version: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
  files,
};
async function call(path) {
  const response = await fetch(endpoint.replace(/\/$/, "") + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(manifest),
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw Error(`Private library ${path} failed (${response.status}).`);
  return response.json();
}
const prepared = await call("/prepare");
if (
  prepared.version !== manifest.version ||
  prepared.uploads?.length !== files.length
)
  throw Error("Upload manifest mismatch.");
for (const file of files) {
  const signed = prepared.uploads.find((x) => x.path === file.path),
    url = new URL(signed?.url);
  if (
    url.origin !== origin ||
    url.pathname !==
      `/storage/v1/object/upload/sign/pagechime-library-develop/versions/${manifest.version}/${file.path}`
  )
    throw Error("Invalid private upload address.");
  const bytes = await readFile(resolve(root, file.path));
  if (
    bytes.length !== file.size ||
    createHash("sha256").update(bytes).digest("hex") !== file.sha256
  )
    throw Error("A source file changed during upload.");
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.contentType, "x-upsert": "false" },
    body: bytes,
    redirect: "error",
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw Error(
      `Private library upload failed (${response.status}); no pointer was published.`,
    );
}
await call("/publish");
console.log(
  JSON.stringify({
    published: true,
    version: manifest.version,
    files: files.length,
    bytes: files.reduce((n, f) => n + f.size, 0),
  }),
);
