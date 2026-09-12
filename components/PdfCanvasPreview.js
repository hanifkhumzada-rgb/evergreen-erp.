"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export default function PdfCanvasPreview({ src }) {
  const canvasRef = useRef(null);
  const documentRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const pdfModule = await import("pdfjs-dist/legacy/build/pdf.js");
        const pdfjs = pdfModule.default?.getDocument ? pdfModule.default : pdfModule;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.js", import.meta.url).toString();
        const response = await fetch(src, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`PDF request failed (${response.status})`);
        const task = pdfjs.getDocument({ data: await response.arrayBuffer() });
        const pdf = await task.promise;
        if (!active) { pdf.destroy(); return; }
        documentRef.current = pdf;
        setPageCount(pdf.numPages);
        setPageNumber(1);
      } catch (err) {
        if (active) setError(err?.message || "PDF preview could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      documentRef.current?.destroy();
      documentRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const pdf = documentRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || !pageCount) return undefined;
    let active = true;
    const render = async () => {
      try {
        renderTaskRef.current?.cancel();
        const page = await pdf.getPage(pageNumber);
        if (!active) return;
        const base = page.getViewport({ scale: 1 });
        const available = Math.min(window.innerWidth - 32, 920);
        const viewport = page.getViewport({ scale: Math.max(0.7, available / base.width) });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const context = canvas.getContext("2d");
        const task = page.render({ canvasContext: context, viewport, transform: pixelRatio === 1 ? null : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== "RenderingCancelledException" && active) setError("This PDF page could not be rendered.");
      }
    };
    render();
    return () => { active = false; renderTaskRef.current?.cancel(); };
  }, [pageNumber, pageCount]);

  if (loading) return <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate"><Loader2 size={18} className="animate-spin" /> Loading secure preview…</div>;
  if (error) return <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-coral">{error}</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#DDE5E3]">
      <div className="flex-1 overflow-auto p-2 sm:p-4"><canvas ref={canvasRef} className="mx-auto bg-white shadow-lg" /></div>
      {pageCount > 1 ? <div className="flex items-center justify-center gap-3 border-t border-line bg-card px-3 py-2"><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)} className="rounded-lg border border-line p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="text-xs font-semibold">Page {pageNumber} of {pageCount}</span><button type="button" disabled={pageNumber >= pageCount} onClick={() => setPageNumber((value) => value + 1)} className="rounded-lg border border-line p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div> : null}
    </div>
  );
}
