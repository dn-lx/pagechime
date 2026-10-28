/** Portable PageChime book format. References are original filenames, never URLs. */
export type SharedBookPackage = {
  schemaVersion: 1;
  title: string;
  author: string;
  voice?: string;
  pdfs: { file: string; label: string; pageCount: number }[];
  audio: { file: string; title: string; duration: number }[];
  cover?: string;
};
export type SharedAsset = {
  name: string;
  key: string;
  size: number;
  sha256: string;
  contentType: string;
};
export const SHARED_FILE_LIMIT = 50 * 1024 * 1024;
export const SHARED_LIBRARY_LIMIT = 400 * 1024 * 1024;
export const sharedTypes: Record<string, string> = {
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" &&
  !!v.trim() &&
  v.length <= max &&
  !/[\u0000-\u001f]/.test(v);
export const sharedBookId = (v: string) =>
  /^shared-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
    v,
  );
export function sharedPackage(
  value: unknown,
  input: unknown,
): { book: SharedBookPackage; files: SharedAsset[] } {
  const b = value as SharedBookPackage,
    fs = input as SharedAsset[];
  if (
    !b ||
    b.schemaVersion !== 1 ||
    !text(b.title, 180) ||
    !text(b.author, 180) ||
    (b.voice !== undefined && !text(b.voice, 160)) ||
    !Array.isArray(b.pdfs) ||
    !b.pdfs.length ||
    b.pdfs.length > 8 ||
    !Array.isArray(b.audio) ||
    !b.audio.length ||
    b.audio.length > 64 ||
    !Array.isArray(fs) ||
    fs.length > 73 ||
    fs.length < 2
  )
    throw Error("Add a title, author, 1–8 PDFs and 1–64 audio tracks.");
  const files = fs.map((f, i) => {
    const ext =
      typeof f?.name === "string"
        ? f.name.split(".").at(-1)!.toLowerCase()
        : "";
    if (
      !text(f?.name, 200) ||
      /[/\\]/.test(f.name) ||
      !sharedTypes[ext] ||
      f.contentType !== sharedTypes[ext] ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      !Number.isSafeInteger(f.size) ||
      f.size < 1 ||
      f.size > SHARED_FILE_LIMIT
    )
      throw Error(
        "Check file types and sizes. Each file must be at most 50 MiB.",
      );
    return {
      name: f.name,
      key: `asset-${String(i + 1).padStart(3, "0")}.${ext}`,
      size: f.size,
      sha256: f.sha256,
      contentType: f.contentType,
    };
  });
  const names = new Map(files.map((f) => [f.name, f]));
  if (
    names.size !== files.length ||
    files.reduce((n, f) => n + f.size, 0) > SHARED_LIBRARY_LIMIT
  )
    throw Error(
      "Use unique filenames and keep this upload below the library capacity.",
    );
  const used: string[] = [];
  const pdfs = b.pdfs.map((p) => {
    if (
      !p ||
      names.get(p.file)?.contentType !== "application/pdf" ||
      !text(p.label, 80) ||
      !Number.isInteger(p.pageCount) ||
      p.pageCount < 1 ||
      p.pageCount > 20000
    )
      throw Error("Check each PDF edition and its page count.");
    used.push(p.file);
    return { file: p.file, label: p.label.trim(), pageCount: p.pageCount };
  });
  const audio = b.audio.map((a) => {
    if (
      !a ||
      !names.get(a.file)?.contentType.startsWith("audio/") ||
      !text(a.title, 180) ||
      !Number.isFinite(a.duration) ||
      a.duration <= 0 ||
      a.duration > 86400
    )
      throw Error("Check each audio track and its duration.");
    used.push(a.file);
    return { file: a.file, title: a.title.trim(), duration: a.duration };
  });
  if (b.cover !== undefined) {
    if (!names.get(b.cover)?.contentType.startsWith("image/"))
      throw Error("Choose a PNG, JPEG or WebP cover.");
    used.push(b.cover);
  }
  if (
    used.length !== files.length ||
    new Set(used).size !== used.length ||
    used.some((n) => !names.has(n))
  )
    throw Error(
      "Every uploaded file must belong to exactly one PDF, track or cover.",
    );
  return {
    book: {
      schemaVersion: 1,
      title: b.title.trim(),
      author: b.author.trim(),
      ...(b.voice ? { voice: b.voice.trim() } : {}),
      pdfs,
      audio,
      ...(b.cover ? { cover: b.cover } : {}),
    },
    files,
  };
}
export function sharedReaderBook(
  id: string,
  b: SharedBookPackage,
  files: SharedAsset[],
) {
  if (!sharedBookId(id)) throw Error("Invalid shared book.");
  const url = (name: string) =>
    `/books/${id}/${files.find((f) => f.name === name)!.key}`;
  return {
    id,
    title: b.title,
    author: b.author,
    voice: b.voice || "Shared narration",
    pdf: url(b.pdfs[0].file),
    pageCount: Math.max(...b.pdfs.map((p) => p.pageCount)),
    editions: b.pdfs.map((p) => ({
      label: p.label,
      kind: "pdf" as const,
      url: url(p.file),
      pageCount: p.pageCount,
    })),
    ...(b.cover ? { cover: url(b.cover) } : {}),
    timing: "audio-only",
    chapters: b.audio.map((a) => ({
      title: a.title,
      file: files.find((f) => f.name === a.file)!.key,
      audio: url(a.file),
      duration: a.duration,
      firstPage: 1,
      segments: [],
    })),
    duration: b.audio.reduce((n, a) => n + a.duration, 0),
  };
}
export function sharedDescription(value: unknown): SharedBookPackage {
  const b = value as SharedBookPackage;
  if (
    !b ||
    !Array.isArray(b.pdfs) ||
    !Array.isArray(b.audio) ||
    b.pdfs.length > 8 ||
    b.audio.length > 64
  )
    throw Error("Choose a PageChime book description (version 1).");
  const names = [
    ...b.pdfs.map((p) => p?.file),
    ...b.audio.map((a) => a?.file),
    ...(b.cover === undefined ? [] : [b.cover]),
  ];
  return sharedPackage(
    b,
    names.map((name) => ({
      name,
      key: "",
      size: 1,
      sha256: "0".repeat(64),
      contentType:
        typeof name === "string"
          ? sharedTypes[name.split(".").at(-1)!.toLowerCase()]
          : "",
    })),
  ).book;
}
