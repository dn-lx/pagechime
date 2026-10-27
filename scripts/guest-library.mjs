import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
/** Only files explicitly referenced by the packaged catalog can be read by guests. */
export async function guestLibraryPaths(publicDirectory) {
  const root = await realpath(publicDirectory),
    paths = new Set(["/library.json"]),
    seen = new Set();
  async function file(url) {
    if (
      typeof url !== "string" ||
      !url.startsWith("/books/") ||
      /[?#\\\\]/.test(url)
    )
      throw Error("Invalid guest library path");
    const parsed = new URL(url, "https://catalog.invalid"),
      decoded = decodeURIComponent(parsed.pathname);
    if (
      parsed.pathname !== url ||
      decoded
        .split("/")
        .some((x) => x === "." || x === ".." || x.includes("\\"))
    )
      throw Error("Invalid guest library path");
    const local = await realpath(resolve(root, "." + decoded));
    if (!local.startsWith(root + sep) || !(await stat(local)).isFile())
      throw Error("Guest library file is outside the public directory");
    paths.add(parsed.pathname);
    return local;
  }
  async function book(url) {
    if (seen.has(url)) return;
    seen.add(url);
    const data = JSON.parse(await readFile(await file(url), "utf8"));
    await file(data.pdf);
    if (data.cover) await file(data.cover);
    for (const edition of data.editions || []) await file(edition.url);
    if (data.credits) await file(data.credits);
    if (!Array.isArray(data.chapters))
      throw Error("Guest book has no chapters");
    for (const chapter of data.chapters) await file(chapter.audio);
    if (data.alternateNarration) await book(data.alternateNarration);
    for (const url of Object.values(data.preparedNarrations || {})) await book(url);
  }
  const catalog = JSON.parse(
    await readFile(resolve(root, "library.json"), "utf8"),
  );
  if (!Array.isArray(catalog.books))
    throw Error("Guest catalog has no books list");
  for (const entry of catalog.books) await book(entry.url);
  return [...paths].sort();
}
