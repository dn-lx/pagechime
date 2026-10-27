let library: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null =
  null;
export async function pdfLibrary() {
  if (!library)
    library = import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  return library;
}
