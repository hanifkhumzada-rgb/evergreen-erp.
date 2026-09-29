"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, FileDown, Maximize2, Minimize2, Printer, Share2, X } from "lucide-react";
import PdfCanvasPreview from "@/components/PdfCanvasPreview";

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-ink transition hover:border-aqua/40 hover:bg-aquaSoft/60 hover:text-aqua";

export default function PdfPreviewDialog({ href, label = "View PDF", compact = false, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const printFrameRef = useRef(null);
  const downloadHref = `${href}${href.includes("?") ? "&" : "?"}download=1`;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const printPdf = () => {
    const frame = printFrameRef.current;
    if (!frame?.contentWindow) return alert("PDF is still loading. Please try again in a moment.");
    frame.contentWindow.focus();
    frame.contentWindow.print();
  };

  const sharePdf = async () => {
    const url = new URL(href, window.location.origin).toString();
    if (navigator.share) {
      try { await navigator.share({ title: `${label} · Evergreen Water`, url }); } catch { /* dismissed */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); alert("PDF link copied."); } catch { window.prompt("Copy PDF link:", url); }
  };

  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className={triggerClassName} title="Open inside ERP">
          <Eye size={14} /> {!compact && label}
        </button>
        <a href={downloadHref} className={triggerClassName} title="Download to device">
          <FileDown size={14} />
        </a>
      </span>

      {open ? (
        <div className={`no-print fixed inset-0 z-[140] bg-navy/70 ${fullScreen ? "p-0" : "p-2 sm:p-5"}`} role="dialog" aria-modal="true" aria-label={`${label} preview`}>
          <div className={`mx-auto flex h-full flex-col overflow-hidden border border-white/20 bg-card shadow-2xl ${fullScreen ? "max-w-none rounded-none" : "max-w-6xl rounded-[22px]"}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-card px-3 py-3 sm:px-5">
              <button type="button" onClick={() => { setOpen(false); setFullScreen(false); }} className={BTN}><ArrowLeft size={14} /> <span className="hidden sm:inline">Back</span></button>
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-aquaSoft text-aqua"><Eye size={17} /></div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-semibold sm:text-lg">{label}</h2>
                <p className="text-[11px] text-slate">Secure preview inside Evergreen ERP</p>
              </div>
              <button type="button" onClick={printPdf} className={BTN}><Printer size={14} /> <span className="hidden sm:inline">Print</span></button>
              <a href={downloadHref} className={BTN}><Download size={14} /> <span className="hidden sm:inline">Download PDF</span></a>
              <button type="button" onClick={sharePdf} className={BTN}><Share2 size={14} /> <span className="hidden sm:inline">WhatsApp / Share</span></button>
              <button type="button" onClick={() => setFullScreen((value) => !value)} className={BTN} title={fullScreen ? "Exit full screen" : "Full screen"}>{fullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} <span className="hidden lg:inline">{fullScreen ? "Exit Full Screen" : "Full Screen"}</span></button>
              <button type="button" onClick={() => { setOpen(false); setFullScreen(false); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line hover:bg-foam" aria-label="Close preview"><X size={17} /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col"><PdfCanvasPreview src={href} /></div>
            <div className="flex items-center justify-between border-t border-line bg-card px-3 py-2 sm:px-5"><p className="text-[11px] text-slate">Preview stays inside ERP</p><button type="button" onClick={() => { setOpen(false); setFullScreen(false); }} className={BTN}>Close / Cancel</button></div>
            <iframe ref={printFrameRef} src={href} title={`${label} print source`} className="hidden" />
          </div>
        </div>
      ) : null}
    </>
  );
}
