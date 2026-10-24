import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** A bounded build overlay: the plan contains indices/hashes, never book text. */
export function repairBookReading(book, plan) {
  if (book.id !== plan.id || !Array.isArray(book.chapters)) return null;
  const hash = createHash("sha256")
    .update(
      JSON.stringify(book.chapters.map((c) => c.segments.map((s) => s.text))),
    )
    .digest("hex");
  if (hash !== plan.sourceTextSha256) return null;
  const repaired = structuredClone(book);
  for (const { chapter, segment } of plan.joins)
    repaired.chapters[chapter].segments[segment].continuesPreviousWord = true;
  for (const { chapter, segment, from, to } of plan.deletions) {
    const passage = repaired.chapters[chapter].segments[segment];
    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      from < 0 ||
      to <= from ||
      to > passage.text.length
    )
      throw Error("Invalid reading repair.");
    passage.readingEdits = [{ from, to, text: "" }];
  }
  return repaired;
}

export async function applyReadingRepairs(publicRoot) {
  const path = join(publicRoot, "books/manifest/book.json");
  let bytes;
  try {
    bytes = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  const plan = JSON.parse(
    await readFile(
      new URL("./book-reading-repairs.json", import.meta.url),
      "utf8",
    ),
  );
  const repaired = repairBookReading(JSON.parse(bytes), plan);
  if (!repaired) {
    console.warn("Reading repair source differs; original book retained.");
    return false;
  }
  await writeFile(path, JSON.stringify(repaired));
  console.log(
    "Applied verified reading metadata; original text and audio cues retained.",
  );
  return true;
}
