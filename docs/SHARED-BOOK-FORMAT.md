# Create and publish a PageChime book

## From your phone

1. Open the develop website, pass its private Netlify gate, and sign in to your PageChime **admin** account.
2. Open the library menu and choose **Publish a book**. Enter the book title, author and optional narrator.
3. Select the book's PDFs and audio files. The first PDF is the default edition. Audio filenames sort naturally; use the up/down buttons to change the listening order. Optionally select a cover image.
4. Choose **Review book**. PageChime reads PDF page counts and audio durations, checks filenames/sizes, and shows the publication summary. You can download a reusable `pagechime-book.json` description.
5. Choose **Publish to shared library**. Files upload privately and are verified before the book becomes visible. Keep this page open while uploading.
6. Readers see the book when opening PageChime or choosing **Refresh library**. A website build is not needed.

**Add a book** remains the separate personal, device-local import. It does not publish to other readers. Shared publishing requires the PageChime admin role, independently of signing into Netlify.

If a connection fails, retry on the same form. After closing/reloading it, choose the unfinished upload and reselect the same files. Already verified files are retained. A draft never appears on readers' shelves. Choose a draft rather than repeatedly creating another upload for the same book.

## File standard

Use one set of files per book:

| Content | Standard |
| --- | --- |
| PDFs | 1–8 ordinary, unencrypted PDFs; each edition keeps its own page count. Use descriptive names such as `original.pdf` and `large-print.pdf`. |
| Audio | 1–64 MP3, M4A, WAV or OGG files. MP3 is the most portable choice. Number parts `01-Introduction.mp3`, `02-Chapter-One.mp3`, etc. |
| Cover | Optional PNG, JPEG or WebP image. |
| Book description | Optional `pagechime-book.json`, format version 1; titles and references below. The uploader creates it automatically. |

Each media file must be at most **50 MiB**. Export long recordings as numbered parts at chapter or quiet boundaries; use consistent voice/speed/volume. For spoken-word MP3, mono 24–48 kHz at 64–128 kbps is a practical starting point. Check the whole recording and preserve all intended content. Do not submit a short sample in place of the complete book.

Files need unique names within a book. The description references those exact filenames, without folders or web addresses. PageChime assigns safe immutable storage paths and computes/verifies SHA-256 hashes. No ZIP packaging or hand-edited upload manifest is required.

The initial new shared-library capacity is **400 MiB**, with at most three unfinished uploads per admin. There is no fixed book-count limit; capacity depends on file sizes and the hosting plan. Existing packaged Manifest assets use the previous source. Increasing capacity or changing plans is a separate decision.

## Reusable description, version 1

```json
{
  "schemaVersion": 1,
  "title": "A Quiet Garden",
  "author": "Example Author",
  "voice": "British English narration",
  "pdfs": [
    { "file": "original.pdf", "label": "Original", "pageCount": 120 },
    { "file": "large-print.pdf", "label": "Large print", "pageCount": 180 }
  ],
  "audio": [
    { "file": "01-Introduction.mp3", "title": "Introduction", "duration": 240.5 },
    { "file": "02-Chapter-One.mp3", "title": "Chapter One", "duration": 1520.25 }
  ],
  "cover": "cover.webp"
}
```

Durations are seconds. The uploader independently reads durations/page counts from the selected files. PDF and audio list order is meaningful. Remove the optional voice/cover fields if unused. Private book descriptions and media do not belong in the public source repository.

Ordinary shared uploads use **manual PDF navigation**. Audio part changes and seeks retain the chosen page. A PDF and an MP3 alone do not contain synchronized word/page timings; the format does not infer them. Existing synchronized Manifest editions retain their verified cues.

## Maintainer contract

The portable format is validated in `packages/core/src/shared-book.ts`. The shared API and same-origin boundary are in `server/shared-library-api.ts` and `server/shared-library-boundary.ts`; the isolated schema is the `shared_reader_books` migration. Only the private Netlify backend capability can reach catalog/media operations; admin mutations additionally validate the existing opaque Me+ reader session. Direct Data API access is denied by RLS/revoked grants. File bytes upload to exact-object signed Storage URLs, bypassing function request-size limits. A book is published only when every immutable object's hash, size and signature is verified.
