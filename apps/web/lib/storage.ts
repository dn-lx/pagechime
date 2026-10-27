import type { Book } from "@pagechime/core";
// Legacy names are a persistence contract; retain account data across brand updates.
export type StoredBook = {
  book: Book;
  pdf: Blob;
  audio: { name: string; blob: Blob }[];
};
const open = (account = "legacy") =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("leaf-library-" + account, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("books", { keyPath: "book.id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
async function run<T>(
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
  account = "legacy",
): Promise<T> {
  const db = await open(account);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("books", mode),
      r = action(tx.objectStore("books"));
    tx.oncomplete = () => {
      resolve(r.result);
      db.close();
    };
    tx.onerror = () => {
      reject(tx.error || r.error);
      db.close();
    };
    tx.onabort = () => {
      reject(tx.error || new Error("Storage was interrupted."));
      db.close();
    };
  });
}
export function createReaderStorage(
  account: string,
  onSave: (key: string, value: unknown, previous: unknown) => void = () => {},
) {
  const prefix = "leaf.account." + account + ".";
  const readSaved = <T>(key: string, fallback: T): T => {
    try {
      return (
        JSON.parse(localStorage.getItem(prefix + key) || "null") ?? fallback
      );
    } catch {
      return fallback;
    }
  };
  const writeSaved = (key: string, value: unknown, silent = false) => {
    try {
      const previous = readSaved(key, null);
      localStorage.setItem(prefix + key, JSON.stringify(value));
      if (!silent) onSave(key, value, previous);
      return true;
    } catch {
      return false;
    }
  };
  return {
    readSaved,
    writeSaved,
    getLocalBooks: () =>
      run<StoredBook[]>("readonly", (s) => s.getAll(), account),
    putLocalBook: (book: StoredBook) =>
      run("readwrite", (s) => s.put(book), account),
    deleteLocalBook: (id: string) =>
      run("readwrite", (s) => s.delete(id), account),
    cacheName: "leaf-books-account-" + account,
  };
}
/** Guest state lasts only while this reader instance is open. Never touches disk. */
export function createGuestStorage(): ReaderStorage {
  const values = new Map<string, unknown>();
  return {
    readSaved: <T>(key: string, fallback: T): T =>
      (values.get(key) as T) ?? fallback,
    writeSaved: (key, value) => {
      if (["bookmarks", "notes", "outbox"].includes(key)) return false;
      values.set(key, value);
      return true;
    },
    getLocalBooks: async () => [],
    putLocalBook: async () => {
      throw Error("Sign in to add your own books.");
    },
    deleteLocalBook: async () => undefined,
    cacheName: "guest-no-cache",
  };
}
export type ReaderStorage = ReturnType<typeof createReaderStorage>;
export function materialize(record: StoredBook): Book {
  return {
    ...record.book,
    local: true,
    pdf: URL.createObjectURL(record.pdf),
    chapters: record.book.chapters.map((c, i) => ({
      ...c,
      audio: URL.createObjectURL(record.audio[i].blob),
    })),
  };
}
