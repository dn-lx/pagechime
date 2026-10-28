import {
  validateBook,
  type Book,
  type SharedAsset,
  type SharedBookPackage,
  sharedTypes,
  SHARED_FILE_LIMIT,
  sharedPackage,
} from "@pagechime/core";
import { pdfLibrary } from "./pdf";
export async function libraryRequest(path: string, body?: unknown) {
  const r = await fetch("/api/library/" + path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw Error(
      data.error || "The shared library could not complete this request.",
    );
  return data;
}
export async function sharedCatalog(
  after = "",
): Promise<{ books: Book[]; next: string | null }> {
  const data = await libraryRequest(
    "catalog" + (after ? "?after=" + encodeURIComponent(after) : ""),
  );
  if (
    !Array.isArray(data.books) ||
    (data.next !== null && typeof data.next !== "string")
  )
    throw Error("The shared catalog is incomplete.");
  return { books: data.books.map(validateBook), next: data.next };
}
export async function mediaDuration(file: File) {
  const src = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      const timer = setTimeout(
        () =>
          done(
            Error("This audio file did not open. Try MP3, M4A, WAV or OGG."),
          ),
        20000,
      );
      const done = (error?: Error) => {
        clearTimeout(timer);
        audio.removeAttribute("src");
        audio.load();
        if (error) reject(error);
      };
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const d = audio.duration;
        if (!Number.isFinite(d) || d <= 0)
          done(
            Error(
              "This audio has no readable duration. Export it as MP3 or M4A.",
            ),
          );
        else {
          done();
          resolve(d);
        }
      };
      audio.onerror = () =>
        done(
          Error("This browser cannot read the selected audio. Try MP3 or M4A."),
        );
      audio.src = src;
    });
  } finally {
    URL.revokeObjectURL(src);
  }
}
export async function describeSharedFiles(
  pdfs: File[],
  audio: File[],
  title: string,
  author: string,
  voice: string,
  cover: File | null,
  progress: (s: string) => void,
  template?: SharedBookPackage,
) {
  const all = [...pdfs, ...audio, ...(cover ? [cover] : [])],
    files: SharedAsset[] = [];
  if (!pdfs.length || pdfs.length > 8 || !audio.length || audio.length > 64)
    throw Error("Choose 1–8 PDFs and 1–64 audio tracks.");
  if (new Set(all.map((f) => f.name)).size !== all.length)
    throw Error("Use a different filename for each selected file.");
  for (let i = 0; i < all.length; i++) {
    const f = all[i],
      ext = f.name.split(".").at(-1)!.toLowerCase();
    if (f.size > SHARED_FILE_LIMIT || !f.size || !sharedTypes[ext])
      throw Error(`${f.name}: use a supported file no larger than 50 MiB.`);
    progress(`Checking file ${i + 1} of ${all.length}…`);
    const sha256 = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await f.arrayBuffer()),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    files.push({
      name: f.name,
      key: "",
      size: f.size,
      sha256,
      contentType: sharedTypes[ext],
    });
  }
  const book: SharedBookPackage = {
    schemaVersion: 1,
    title,
    author,
    ...(voice.trim() ? { voice } : {}),
    pdfs: [],
    audio: [],
    ...(cover ? { cover: cover.name } : {}),
  };
  const lib = await pdfLibrary();
  for (const file of pdfs) {
    progress(`Reading PDF: ${file.name}…`);
    const doc = await lib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    }).promise;
    book.pdfs.push({
      file: file.name,
      label:
        template?.pdfs.find((p) => p.file === file.name)?.label ||
        file.name.replace(/\.pdf$/i, "").slice(0, 80),
      pageCount: doc.numPages,
    });
    await doc.destroy();
  }
  for (const file of audio) {
    progress(`Reading audio: ${file.name}…`);
    book.audio.push({
      file: file.name,
      title:
        template?.audio.find((a) => a.file === file.name)?.title ||
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]/g, " ")
          .slice(0, 180),
      duration: await mediaDuration(file),
    });
  }
  return sharedPackage(book, files);
}
export async function uploadSharedFile(
  url: string,
  file: File,
  type: string,
  progress: (fraction: number) => void,
) {
  // The server issues an exact-object, two-hour upload URL. No account or privileged key is sent here.
  const target = new URL(url, location.href);
  if (
    ![location.origin, "https://wbqnctrvxohxwiaignhg.supabase.co"].includes(
      target.origin,
    ) ||
    !target.pathname.startsWith(
      "/storage/v1/object/upload/sign/pagechime-shared-books-develop/",
    )
  )
    throw Error("The upload address is invalid.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.href);
    xhr.timeout = 10 * 60 * 1000;
    xhr.setRequestHeader("Content-Type", type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(e.loaded / e.total);
    };
    xhr.onerror = () =>
      reject(
        Error("Upload interrupted. Keep this page open and retry to continue."),
      );
    xhr.ontimeout = () => reject(Error("Upload timed out. Retry to continue."));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(Error("The file upload needs verification or a retry."));
    xhr.send(file);
  });
}
