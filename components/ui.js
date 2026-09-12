"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSpreadsheet, Printer, ArrowUp, ArrowDown, Minus, FileDown, Loader2, Eye, FileText, ExternalLink, X } from "lucide-react";

export function Badge({ text, tone = "slate" }) {
  const map = {
    green: "bg-greenSoft text-green", amber: "bg-amberSoft text-amber",
    coral: "bg-coralSoft text-coral", aqua: "bg-aquaSoft text-aqua", slate: "bg-[#EEF2F2] text-slate",
  };
  return <span className={`${map[tone] || map.slate} text-[11.5px] font-semibold px-2.5 py-1 rounded-full border border-black/[0.03]`}>{text}</span>;
}

export function KPI({ label, value, sub, tone = "navy", trend, href }) {
  const style = {
    navy: "bg-navyLight text-white",
    aqua: "bg-card border border-line border-t-2 border-t-aqua",
    amber: "bg-card border border-line border-t-2 border-t-amber",
    coral: "bg-card border border-line border-t-2 border-t-coral",
    green: "bg-card border border-line border-t-2 border-t-green",
    slate: "bg-card border border-line border-t-2 border-t-slate",
  }[tone];
  const TrendIcon = trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  const trendColor = trend?.favorable === null || trend?.favorable === undefined ? "text-slate" : trend.favorable ? "text-green" : "text-coral";
  const card = (
    <div className={`card-lift rounded-2xl p-5 flex-1 min-w-[180px] ${style} ${href ? "cursor-pointer" : ""}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${tone === "navy" ? "text-[#BFE3E0]" : "text-slate"}`}>{label}</div>
      <div className="font-mono-num text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className={`text-xs mt-1 ${tone === "navy" ? "text-[#9CC9C5]" : "text-slate"}`}>{sub}</div>}
      {trend && (
        <div className={`flex items-center gap-1 text-[11px] font-semibold mt-1.5 ${trendColor}`}>
          <TrendIcon size={11} /> {trend.pct}% vs yesterday
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

// Shared toolbar-button treatment (Export Excel / Download PDF / Print) —
// one class string so all three stay visually identical and any future
// hover/focus tweak only needs to happen here.
const TOOLBAR_BTN = "no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold text-ink transition-colors hover:border-aqua/40 hover:bg-aquaSoft/60 hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/40";

// Every export goes through lib/excel.js's buildBrandedWorkbook —
// company logo/name/tagline, report title, period and a generated
// timestamp as the letterhead, bordered cells, a colored header row, PKR
// number formatting on currency-looking columns, and a bold totals row —
// built with exceljs (full styling support, unlike the xlsx package's
// free-tier limits) rather than the old bare json_to_sheet dump.
// `reportTitle` falls back to `sheetName` so existing call sites that
// only ever passed a sheet name still get a sensible title. Any old
// `filename` prop a caller still passes is simply ignored (not
// destructured) — the branded Evergreen_Water_<Report>_<Date>.xlsx
// pattern always applies instead.
//
// lib/excel.js (and the ~260kB exceljs it pulls in) is dynamically
// imported here, INSIDE the click handler, rather than at module scope —
// this file is imported by nearly every page in the app, so a static
// import would have shipped exceljs in every page's First Load JS even
// when the Export Excel button is never clicked (confirmed: it measurably
// did, before this fix). This way it's its own on-demand chunk, loaded
// only when someone actually exports.
export function ExportExcelButton({ rows, sheetName = "Sheet1", reportTitle, branding, period }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!rows?.length) { alert("No data to export."); return; }
    setLoading(true);
    try {
      const { buildBrandedWorkbook, brandedFilename } = await import("@/lib/excel");
      const title = reportTitle || sheetName;
      const wb = await buildBrandedWorkbook({ rows, sheetName, reportTitle: title, branding, period });
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = brandedFilename(title);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Could not build the Excel export: ${err?.message || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={handleExport} disabled={loading} className={`${TOOLBAR_BTN} disabled:opacity-60`}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Export Excel
    </button>
  );
}

function csvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export function ExportCsvButton({ rows, reportTitle = "Report" }) {
  const handleExport = () => {
    if (!rows?.length) { alert("No data to export."); return; }
    const columns = Object.keys(rows[0]);
    const csv = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const slug = reportTitle.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    anchor.href = url;
    anchor.download = `Evergreen_Water_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  return <button type="button" onClick={handleExport} className={TOOLBAR_BTN}><FileText size={14} /> Export CSV</button>;
}

// Server-generated branded PDF download (Customer Statement, Daily Sales,
// Outstanding/Receivables only) — a plain link to a route handler that
// streams back a real PDF, not window.print(). Every other page keeps its
// existing PrintButton untouched.
export function DownloadPdfButton({ href, label = "Download PDF" }) {
  const previewHref = `${href}${href.includes("?") ? "&" : "?"}preview=1`;
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) return undefined;
    const closeOnBack = () => setPreviewOpen(false);
    window.history.pushState({ ...(window.history.state || {}), evergreenPdfPreview: true }, "");
    window.addEventListener("popstate", closeOnBack);
    return () => window.removeEventListener("popstate", closeOnBack);
  }, [previewOpen]);

  const closePreview = () => {
    if (window.history.state?.evergreenPdfPreview) window.history.back();
    else setPreviewOpen(false);
  };

  return (
    <>
    <span className="no-print inline-flex items-center gap-1.5">
      <button type="button" onClick={() => setPreviewOpen(true)} className={TOOLBAR_BTN} title="Preview inside ERP">
        <Eye size={14} /> Preview
      </button>
      <a href={href} className={TOOLBAR_BTN}>
        <FileDown size={14} /> {label}
      </a>
    </span>
    {previewOpen ? (
      <div className="no-print fixed inset-0 z-[100] bg-navy/70 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="PDF preview">
        <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
            <button type="button" onClick={closePreview} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-bold"><X size={15} /> Back to ERP</button>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate">Document Preview</span>
            <a href={previewHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-xs font-bold"><ExternalLink size={14} /><span className="hidden sm:inline">Open separately</span></a>
          </div>
          <iframe title="PDF preview" src={previewHref} className="min-h-0 flex-1 border-0 bg-white" />
        </div>
      </div>
    ) : null}
    </>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={TOOLBAR_BTN}>
      <Printer size={14} /> Print / Save PDF
    </button>
  );
}

export function Th({ children, ...props }) {
  return <th {...props} className={`text-left px-3.5 py-2.5 text-slate font-semibold text-[10.5px] uppercase tracking-wide border-b border-line whitespace-nowrap ${props.className || ""}`}>{children}</th>;
}
export function Td({ children, ...props }) {
  return <td {...props} className={`px-3.5 py-2.5 whitespace-nowrap border-b border-line ${props.className || ""}`}>{children}</td>;
}
