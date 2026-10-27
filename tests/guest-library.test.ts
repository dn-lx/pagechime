import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error Build-only JavaScript module.
import { guestLibraryPaths } from "../scripts/guest-library.mjs";
import { createGuestStorage } from "../apps/web/lib/storage";

test("guest storage is transient, isolated, and refuses personal saved records", async () => {
  const guest = createGuestStorage(),
    next = createGuestStorage();
  for (const key of ["notes", "bookmarks", "outbox"]) {
    assert.equal(guest.writeSaved(key, [{ id: "private" }]), false);
    assert.deepEqual(guest.readSaved(key, []), []);
  }
  guest.writeSaved("progress.demo", { page: 4 });
  assert.deepEqual(guest.readSaved("progress.demo", null), { page: 4 });
  assert.equal(next.readSaved("progress.demo", null), null);
  assert.deepEqual(await guest.getLocalBooks(), []);
});
test("guest build exposes catalog references only and fails closed for missing or unsafe files", async () => {
  const root = await mkdtemp(join(tmpdir(), "guest-library-"));
  try {
    await mkdir(join(root, "books/demo"), { recursive: true });
    await writeFile(
      join(root, "library.json"),
      JSON.stringify({ books: [{ url: "/books/demo/book.json" }] }),
    );
    const book = {
      pdf: "/books/demo/book.pdf",
      chapters: [{ audio: "/books/demo/1.wav" }],
    };
    for (const f of ["book.pdf", "1.wav", "unlisted.pdf"])
      await writeFile(join(root, "books/demo", f), "fixture");
    const save = async (data: unknown) =>
      writeFile(join(root, "books/demo/book.json"), JSON.stringify(data));
    await save(book);
    assert.deepEqual(await guestLibraryPaths(root), [
      "/books/demo/1.wav",
      "/books/demo/book.json",
      "/books/demo/book.pdf",
      "/library.json",
    ]);
    await writeFile(join(root, "books/demo/piper.json"), JSON.stringify({ ...book,
      chapters: [{ audio: "/books/demo/piper.mp3" }] }));
    await writeFile(join(root, "books/demo/piper.mp3"), "private voice fixture");
    await save({ ...book, preparedNarrations: { piper: "/books/demo/piper.json" } });
    const prepared = await guestLibraryPaths(root);
    assert.ok(prepared.includes("/books/demo/piper.json"));
    assert.ok(prepared.includes("/books/demo/piper.mp3"));
    assert.ok(!prepared.includes("/books/demo/unlisted.pdf"));
    await save({ ...book, preparedNarrations: { piper: "https://outside.test/piper.json" } });
    await assert.rejects(guestLibraryPaths(root));
    for (const pdf of [
      "/books/demo/missing.pdf",
      "https://outside.test/private.pdf",
      "/books/../private.pdf",
      "/books/%2e%2e/private.pdf",
      "/books/demo/book.pdf?secret=yes",
    ]) {
      await save({ ...book, pdf });
      await assert.rejects(guestLibraryPaths(root));
    }
    await symlink("/etc/hosts", join(root, "books/demo/outside.pdf"));
    await save({ ...book, pdf: "/books/demo/outside.pdf" });
    await assert.rejects(guestLibraryPaths(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
