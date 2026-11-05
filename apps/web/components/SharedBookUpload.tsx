"use client";
import { useEffect, useState } from "react";
import type { Book, SharedBookPackage, SharedAsset } from "@pagechime/core";
import { SHARED_FILE_LIMIT, sharedDescription } from "@pagechime/core";
import {
  ArrowUp,
  ArrowDown,
  FilePdf,
  Headphones,
  UploadSimple,
} from "@phosphor-icons/react";
import Modal from "./Modal";
import {
  describeSharedFiles,
  libraryRequest,
  uploadSharedFile,
} from "../lib/shared-library";
import { useAccount } from "../lib/account";
const sortFiles = (files: FileList | null) =>
  Array.from(files || []).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
type Draft = { id: string; package: SharedBookPackage };
export default function SharedBookUpload({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: (book: Book) => void;
}) {
  const { account } = useAccount();
  const [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [voice, setVoice] = useState("");
  const [pdfs, setPdfs] = useState<File[]>([]),
    [audio, setAudio] = useState<File[]>([]),
    [cover, setCover] = useState<File | null>(null);
  const [template, setTemplate] = useState<SharedBookPackage>(),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0);
  const [prepared, setPrepared] = useState<{
    book: SharedBookPackage;
    files: SharedAsset[];
  }>();
  useEffect(() => {
    let active = true;
    libraryRequest("admin/drafts")
      .then((d) => {
        if (active) setDrafts(d.drafts);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  function useTemplate(b: SharedBookPackage) {
    b = sharedDescription(b);
    setTemplate(b);
    setTitle(b.title || "");
    setAuthor(b.author || "");
    setVoice(b.voice || "");
    setPrepared(undefined);
  }
  function change() {
    setPrepared(undefined);
    setError("");
  }
  async function review(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setBusy("Checking your files…");
      const ordered = (list: File[], names?: string[]) =>
        names
          ? [...list].sort(
              (a, b) => names.indexOf(a.name) - names.indexOf(b.name),
            )
          : list;
      const data = await describeSharedFiles(
        ordered(
          pdfs,
          template?.pdfs.map((p) => p.file),
        ),
        ordered(
          audio,
          template?.audio.map((a) => a.file),
        ),
        title,
        author,
        voice,
        cover,
        setBusy,
        template,
      );
      setPrepared(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function publish() {
    if (!prepared) return;
    setError("");
    setProgress(0);
    const id = draft || "shared-" + crypto.randomUUID();
    setDraft(id);
    try {
      setBusy("Preparing private upload…");
      const data = await libraryRequest("admin/prepare", { id, ...prepared });
      const all = [...pdfs, ...audio, ...(cover ? [cover] : [])];
      for (let i = 0; i < data.uploads.length; i++) {
        const upload = data.uploads[i];
        if (!upload.verified) {
          const file = all.find((f) => f.name === upload.name);
          if (!file)
            throw Error("Reselect the same files to resume this draft.");
          setBusy(`Uploading ${i + 1} of ${all.length}: ${file.name}`);
          let uploadError: unknown;
          try {
            await uploadSharedFile(upload.url, file, upload.contentType, (n) =>
              setProgress((i + n) / all.length),
            );
          } catch (e) {
            uploadError = e;
          }
          setBusy(`Verifying ${i + 1} of ${all.length}…`);
          // A retry may encounter an already-completed immutable upload. Its digest decides success.
          try {
            await libraryRequest(`admin/${id}/verify/${upload.key}`, {});
          } catch (e) {
            throw uploadError || e;
          }
        }
        setProgress((i + 1) / all.length);
      }
      setBusy("Publishing to the shared library…");
      const result = await libraryRequest(`admin/${id}/publish`, {});
      onPublished(result.book);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function downloadDescription() {
    if (!prepared) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(prepared.book, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pagechime-book.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (account?.role !== "admin") return null;
  return (
    <Modal title="Publish a book" onClose={busy ? () => {} : onClose}>
      <form className="import-form shared-upload" onSubmit={review}>
        <p className="muted">
          Add a book to the shared bookshelf. Published books are available to
          PageChime readers on every device.
        </p>
        {!!drafts.length && (
          <label>
            Continue an unfinished upload
            <select
              aria-label="Unfinished upload"
              disabled={!!busy}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                const d = drafts.find((d) => d.id === e.target.value);
                if (d) useTemplate(d.package);
              }}
            >
              <option value="">New book</option>
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.package.title} — reselect its files
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset disabled={!!busy || !!prepared} hidden={!!prepared}>
          <div className="form-columns">
            <label>
              Book title
              <input
                required
                maxLength={180}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  change();
                }}
              />
            </label>
            <label>
              Author
              <input
                required
                maxLength={180}
                value={author}
                onChange={(e) => {
                  setAuthor(e.target.value);
                  change();
                }}
              />
            </label>
          </div>
          <label>
            Narrator or voice
            <input
              maxLength={160}
              placeholder="Optional"
              value={voice}
              onChange={(e) => {
                setVoice(e.target.value);
                change();
              }}
            />
          </label>
          <label className="file-picker">
            <FilePdf size={24} />
            <span>
              PDF editions
              <small>Choose 1–8 PDFs. The first is the default edition.</small>
            </span>
            <input
              aria-label="PDF editions"
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => {
                setPdfs(sortFiles(e.target.files));
                change();
              }}
            />
          </label>
          {!!pdfs.length && (
            <ol className="upload-file-list">
              {pdfs.map((f, i) => (
                <li key={f.name}>
                  <span>
                    {i === 0 ? "Default: " : ""}
                    {f.name}
                  </span>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPdfs([f, ...pdfs.filter((x) => x !== f)]);
                        setTemplate(undefined);
                        change();
                      }}
                    >
                      Make default
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
          <label className="file-picker">
            <Headphones size={24} />
            <span>
              Audio tracks
              <small>
                One audiobook or numbered parts, in listening order.
              </small>
            </span>
            <input
              aria-label="Audio tracks"
              type="file"
              accept=".mp3,.m4a,.wav,.ogg,audio/*"
              multiple
              onChange={(e) => {
                setAudio(sortFiles(e.target.files));
                change();
              }}
            />
          </label>
          {!!audio.length && (
            <ol className="upload-file-list">
              {audio.map((f, i) => (
                <li key={f.name}>
                  <span>{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Move ${f.name} earlier`}
                    disabled={i === 0}
                    onClick={() => {
                      const a = [...audio];
                      [a[i - 1], a[i]] = [a[i], a[i - 1]];
                      setAudio(a);
                      setTemplate(undefined);
                      change();
                    }}
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${f.name} later`}
                    disabled={i === audio.length - 1}
                    onClick={() => {
                      const a = [...audio];
                      [a[i], a[i + 1]] = [a[i + 1], a[i]];
                      setAudio(a);
                      setTemplate(undefined);
                      change();
                    }}
                  >
                    <ArrowDown />
                  </button>
                </li>
              ))}
            </ol>
          )}
          <label>
            Cover image (optional)
            <input
              aria-label="Cover image"
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => {
                setCover(e.target.files?.[0] || null);
                change();
              }}
            />
          </label>
          <details>
            <summary>Use a prepared book description</summary>
            <p className="muted">
              Reuse pagechime-book.json to restore titles and track order.
              Select its matching files above.
            </p>
            <input
              aria-label="Book description JSON"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 100000)
                      throw Error("Choose a smaller book description.");
                    useTemplate(JSON.parse(await f.text()));
                  }
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </details>
        </fieldset>
        {!prepared && (
          <p className="quiet-note">
            PDF and audio files: up to {SHARED_FILE_LIMIT / 1024 / 1024} MiB
            each. For long recordings, export numbered parts. These uploads use
            manual PDF navigation.
          </p>
        )}
        {prepared && (
          <section className="upload-review" aria-label="Publication review">
            <h3>Ready for your bookshelf</h3>
            <p>
              {prepared.book.title} · {prepared.book.pdfs.length} PDF edition(s)
              · {prepared.book.audio.length} audio track(s)
            </p>
            <p>
              Listening order:{" "}
              {prepared.book.audio.map((a) => a.title).join(" → ")}
            </p>
            <p>
              Default PDF: {prepared.book.pdfs[0].label} ·{" "}
              {prepared.book.pdfs[0].pageCount} pages
            </p>
            <button
              type="button"
              className="text-button"
              onClick={downloadDescription}
              disabled={!!busy}
            >
              Download book description
            </button>
            {!draft && (
              <button
                type="button"
                className="text-button"
                onClick={() => setPrepared(undefined)}
                disabled={!!busy}
              >
                Edit details
              </button>
            )}
          </section>
        )}
        {busy && (
          <div role="status">
            <p>{busy}</p>
            <progress aria-label="Upload progress" max={1} value={progress} />
          </div>
        )}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        {prepared ? (
          <button
            className="primary-button"
            type="button"
            onClick={publish}
            disabled={!!busy}
          >
            {busy
              ? "Working…"
              : draft
                ? "Resume and publish"
                : "Publish to shared library"}
            <UploadSimple size={18} />
          </button>
        ) : (
          <button className="primary-button" type="submit" disabled={!!busy}>
            {busy || "Review book"}
          </button>
        )}
        {!!draft && (
          <p className="quiet-note">
            If interrupted, reopen Publish a book, choose this unfinished upload
            and select the same files. Verified files are kept.
          </p>
        )}
      </form>
    </Modal>
  );
}
