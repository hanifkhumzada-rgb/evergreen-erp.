"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileDown, X } from "lucide-react";
import PdfCanvasPreview from "@/components/PdfCanvasPreview";

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-ink transition hover:border-aqua/40 hover:bg-aquaSoft/60 hover:text-aqua";

export default function PdfPreviewDialog({ href, label = "View PDF", compact = false, triggerClassName }) {
  const [open, setOpen] = useState(false);
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
        <div className="no-print fixed inset-0 z-[140] bg-navy/70 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={`${label} preview`}>
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-white/20 bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-line bg-card px-3 py-3 sm:px-5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-aquaSoft text-aqua"><Eye size={17} /></div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-semibold sm:text-lg">{label}</h2>
                <p className="text-[11px] text-slate">Secure preview inside Evergreen ERP</p>
              </div>
              <a href={downloadHref} className={BTN}><Download size={14} /> <span className="hidden sm:inline">Download PDF</span></a>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line hover:bg-foam" aria-label="Close preview"><X size={17} /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col"><PdfCanvasPreview src={href} /></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
