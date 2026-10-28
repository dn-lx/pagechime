import { createHash } from "node:crypto";
import {
  storageSignature,
  type SharedRow,
  type SharedStore,
} from "../../server/shared-library-api.ts";
import { SHARED_LIBRARY_LIMIT } from "../../packages/core/src/shared-book.ts";
/** In-memory storage adapter for real API/BFF/browser flows; production never imports this. */
export function fixtureSharedStore() {
  const rows = new Map<string, SharedRow>(),
    objects = new Map<string, Uint8Array>();
  const store: SharedStore = {
    list: async (after) =>
      [...rows.values()]
        .filter((r) => r.status === "published" && r.id > after)
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, 50),
    drafts: async (owner) =>
      [...rows.values()].filter(
        (r) => r.status === "draft" && r.owner_id === owner,
      ),
    row: async (id) => structuredClone(rows.get(id) || null),
    begin: async (id, owner, book, files) => {
      const existing = rows.get(id);
      if (existing)
        return (
          existing.owner_id === owner &&
          JSON.stringify(existing.package) === JSON.stringify(book) &&
          JSON.stringify(existing.files) === JSON.stringify(files)
        );
      if (
        [...rows.values()].filter(
          (r) => r.owner_id === owner && r.status === "draft",
        ).length >= 3 ||
        [...rows.values()]
          .flatMap((r) => r.files)
          .concat(files)
          .reduce((n, f) => n + f.size, 0) > SHARED_LIBRARY_LIMIT
      )
        return false;
      rows.set(id, {
        id,
        owner_id: owner,
        package: book,
        files,
        verified: {},
        status: "draft",
      });
      return true;
    },
    upload: async (id, f) =>
      `http://localhost:4174/storage/v1/object/upload/sign/pagechime-shared-books-develop/${id}/${f.key}`,
    verify: async (id, owner, f) => {
      const r = rows.get(id),
        bytes = objects.get(`${id}/${f.key}`);
      if (
        !r ||
        r.owner_id !== owner ||
        r.status !== "draft" ||
        !bytes ||
        bytes.length !== f.size ||
        createHash("sha256").update(bytes).digest("hex") !== f.sha256 ||
        !storageSignature(bytes, f.contentType)
      )
        return false;
      r.verified[f.key] = f.sha256;
      return true;
    },
    publish: async (id, owner) => {
      const r = rows.get(id);
      if (
        !r ||
        r.owner_id !== owner ||
        r.status !== "draft" ||
        !r.files.every((f) => r.verified[f.key] === f.sha256)
      )
        return false;
      r.status = "published";
      return true;
    },
    media: async (id, f) =>
      `http://localhost:4174/storage/v1/object/sign/pagechime-shared-books-develop/${id}/${f.key}`,
  };
  return { store, rows, objects };
}
