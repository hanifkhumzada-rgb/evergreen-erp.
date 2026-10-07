"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Printer, FileDown, FileSpreadsheet, Share2, X, ZoomIn, ZoomOut, Loader2, MessageCircle } from "lucide-react";
import { useErpBack, useEwChrome, printWithTitle, shareOrCopy, whatsappHref } from "@/components/ew/useErpBack";

const BTN = "ew-tool-btn";

// The in-ERP Document Viewer: a sticky toolbar (Back · Print · Download
// PDF · Excel · WhatsApp · Share · Close) over an A4 document that is
// auto-zoomed to fit the screen (phones included). Back/Close return to
// the previous ERP screen — never out of the ERP.
//
// Props (all serialisable so Server Components can render this):
//   title        document name, also the default PDF filename
//   fallbackHref where Back/Close go if there is no earlier ERP page
//   excel        { title, period, filters, sheets } for lib/ew/excel.js
//   whatsapp     { phone, text } → wa.me link
//   share        { title, text }
export default function DocumentViewer({ title, subtitle, fallbackHref = "/dashboard", excel, whatsapp, share, children }) {
  const goBack = useErpBack(fallbackHref);
  const stageRef = useRef(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState(null); // null = auto-fit
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  useEwChrome("doc");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector("[data-ew-drawer-open]")) goBack(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => {
      const paper = el.querySelector(".ew-paper");
      // A4 at 96dpi: 210mm = 794px, 297mm = 1123px (fixed in CSS).
      const natural = paper?.classList.contains("ew-paper-landscape") ? 1123 : 794;
      const available = el.clientWidth - 16;
      setFit(Math.min(1, Math.max(0.3, available / natural)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = zoom ?? fit;
  const flash = (msg) => { setNote(msg); setTimeout(() => setNote(""), 2600); };

  const doExcel = async () => {
    if (!excel) return;
    setBusy("excel");
    try {
      const { downloadEwWorkbook } = await import("@/lib/ew/excel");
      await downloadEwWorkbook(excel);
    } catch (err) {
      alert(`Excel export failed: ${err?.message || "unknown error"}`);
    } finally { setBusy(""); }
  };

  const doPdf = () => {
    flash("Choose “Save as PDF” as the printer to download.");
    setTimeout(() => printWithTitle(title), 350);
  };

  const doShare = async () => {
    const r = await shareOrCopy({ title: share?.title || title, text: share?.text });
    if (r === "copied") flash("Link copied to clipboard.");
  };

  return (
    <div className="ew-viewer">
      <div className="ew-toolbar no-print" role="toolbar" aria-label="Document actions">
        <button type="button" onClick={goBack} className={`${BTN} ew-tool-back`} title="Back to previous screen"><ArrowLeft size={16} /><span>Back</span></button>
        <div className="ew-toolbar-title">
          <div className="ew-toolbar-name">{title}</div>
          {subtitle ? <div className="ew-toolbar-sub">{subtitle}</div> : null}
        </div>
        <div className="ew-toolbar-actions">
          <button type="button" onClick={() => printWithTitle(title)} className={BTN} title="Print"><Printer size={16} /><span>Print</span></button>
          <button type="button" onClick={doPdf} className={BTN} title="Download PDF"><FileDown size={16} /><span>PDF</span></button>
          {excel ? <button type="button" onClick={doExcel} disabled={busy === "excel"} className={BTN} title="Download Excel">{busy === "excel" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}<span>Excel</span></button> : null}
          {whatsapp ? <a href={whatsappHref(whatsapp.phone, whatsapp.text)} target="_blank" rel="noopener noreferrer" className={`${BTN} ew-tool-wa`} title="Send on WhatsApp"><MessageCircle size={16} /><span>WhatsApp</span></a> : null}
          <button type="button" onClick={doShare} className={BTN} title="Share"><Share2 size={16} /><span>Share</span></button>
          <span className="ew-zoom-group">
            <button type="button" onClick={() => setZoom(Math.max(0.3, +(scale - 0.1).toFixed(2)))} className={`${BTN} ew-tool-icon`} aria-label="Zoom out"><ZoomOut size={16} /></button>
            <button type="button" onClick={() => setZoom(zoom === null ? 1 : null)} className={`${BTN} ew-tool-zoomval`} title={zoom === null ? "Actual size" : "Fit to screen"}>{Math.round(scale * 100)}%</button>
            <button type="button" onClick={() => setZoom(Math.min(2, +(scale + 0.1).toFixed(2)))} className={`${BTN} ew-tool-icon`} aria-label="Zoom in"><ZoomIn size={16} /></button>
          </span>
          <button type="button" onClick={goBack} className={`${BTN} ew-tool-icon ew-tool-close`} aria-label="Close viewer" title="Close"><X size={17} /></button>
        </div>
      </div>
      {note ? <div className="ew-toast no-print" role="status">{note}</div> : null}
      <div ref={stageRef} className="ew-stage">
        <div className="ew-zoom" style={{ zoom: scale }}>{children}</div>
      </div>
    </div>
  );
}
