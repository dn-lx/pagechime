"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { pdfLibrary } from "../lib/pdf";
export function PdfPage({
  url,
  page,
  onCount,
  onText,
}: {
  url: string;
  page: number;
  onCount?: (n: number) => void;
  onText?: (s: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [width, setWidth] = useState(650),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    callbacks = useRef({ onCount, onText });
  callbacks.current = { onCount, onText };
  useEffect(() => {
    let stopped = false;
    let loaded: PDFDocumentProxy | null = null;
    setDoc(null);
    setError("");
    setLoading(true);
    pdfLibrary()
      .then((m) => m.getDocument({ url, isEvalSupported: false }).promise)
      .then((d) => {
        loaded = d;
        if (stopped) {
          d.destroy();
          return;
        }
        setDoc(d);
        callbacks.current.onCount?.(d.numPages);
      })
      .catch((e) => {
        if (!stopped)
          setError(
            "This PDF could not be opened. Please check the file or try again.",
          );
      });
    return () => {
      stopped = true;
      loaded?.destroy();
    };
  }, [url]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const r = new ResizeObserver((x) =>
      setWidth(Math.min(760, x[0].contentRect.width)),
    );
    r.observe(el);
    return () => r.disconnect();
  }, []);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    setLoading(true);
    doc
      .getPage(Math.min(doc.numPages, Math.max(1, page)))
      .then(async (p) => {
        if (cancelled || !canvas.current) return;
        const c = canvas.current,
          ratio = Math.min(devicePixelRatio || 1, 2),
          base = p.getViewport({ scale: 1 }),
          vp = p.getViewport({
            scale: (Math.max(1, width) * ratio) / base.width,
          });
        c.width = vp.width;
        c.height = vp.height;
        c.style.width = "100%";
        c.style.height = "auto";
        task = p.render({ canvas: c, viewport: vp });
        await task.promise;
        if (!cancelled) {
          setLoading(false);
          if (callbacks.current.onText) {
            const t = await p.getTextContent();
            callbacks.current.onText(
              t.items.map((i) => ("str" in i ? i.str : "")).join(" "),
            );
          }
        }
      })
      .catch((e) => {
        if (!cancelled && e?.name !== "RenderingCancelledException")
          setError("This page could not be displayed. Try another page.");
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, width]);
  return (
    <div className="pdf-host" ref={host}>
      {error ? (
        <p className="error-box" role="alert">
          {error}
        </p>
      ) : (
        <>
          <canvas ref={canvas} aria-label={`Original book page ${page}`} />
          {loading && (
            <div className="pdf-loading" role="status">
              Opening page…
            </div>
          )}
        </>
      )}
    </div>
  );
}
