"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FileSpreadsheet, Printer, ArrowUp, ArrowDown, Minus, Loader2, Share2, FileText, CalendarClock, UserRound, MoreHorizontal, Info } from "lucide-react";
import PdfPreviewDialog from "@/components/PdfPreviewDialog";
import { fmtDateTime } from "@/lib/format";

export function Badge({ text, tone = "slate" }) {
  const map = {
    green: "bg-greenSoft text-green", amber: "bg-amberSoft text-amber",
    coral: "bg-coralSoft text-coral", aqua: "bg-aquaSoft text-aqua", slate: "bg-mist text-slate",
  };
  return <span className={`${map[tone] || map.slate} text-[11.5px] font-semibold px-2.5 py-1 rounded-full border border-black/[0.03]`}>{text}</span>;
}

// Standard audit stamp for every operational list. `date` is the actual
// database created_at timestamp, not the editable transaction/business date.
// This distinction makes back-dated entries transparent without making wide
// tables even wider with separate day/month/year/user columns.
export function RecordStamp({ date, user, updatedAt, updatedBy, className = "" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!triggerRef.current?.contains(event.target) && !event.target.closest?.("[data-audit-popover]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    const closeOnScroll = () => setOpen(false);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = 250;
      setPosition({
        top: Math.min(window.innerHeight - 150, Math.max(10, rect.top - 20)),
        left: Math.max(10, rect.left - width - 10),
      });
    }
    setOpen((value) => !value);
  };

  return (
    <span className={`inline-flex ${className}`}>
      <button ref={triggerRef} type="button" onClick={toggle} aria-expanded={open} title="Record details"
        className="no-print inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-[11px] font-semibold text-slate transition-colors hover:border-aqua/40 hover:bg-aquaSoft hover:text-aqua">
        <Info size={13} /> Details
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <span data-audit-popover className="fixed z-[80] w-[250px] rounded-xl border border-line bg-card p-3 text-[10.5px] leading-tight text-slate shadow-2xl" style={position}>
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-ink">Record information</span>
          <span className="flex items-start gap-2"><CalendarClock size={13} className="mt-0.5 shrink-0 text-aqua" /><span><b className="block text-ink">Created</b>{fmtDateTime(date)}</span></span>
          <span className="mt-2 flex items-start gap-2"><UserRound size={13} className="mt-0.5 shrink-0 text-aqua" /><span><b className="block text-ink">Recorded by</b>{user || "System / legacy record"}</span></span>
          {updatedAt && updatedAt !== date && <span className="mt-2 block border-t border-line pt-2"><b className="text-ink">Updated:</b> {fmtDateTime(updatedAt)}{updatedBy ? ` · ${updatedBy}` : ""}</span>}
        </span>, document.body
      )}
    </span>
  );
}

// Compact, consistent row menu. Existing links/buttons are preserved as-is;
// this component only changes their presentation and keeps wide tables calm.
export function RowActionMenu({ children, label = "Row actions" }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (!triggerRef.current?.contains(event.target) && !event.target.closest?.("[data-row-actions]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: Math.min(window.innerHeight - 230, rect.bottom + 6), left: Math.max(10, rect.right - 190) });
    }
    setOpen((value) => !value);
  };

  return <span className="relative inline-flex">
    <button ref={triggerRef} type="button" onClick={toggle} aria-label={label} aria-expanded={open}
      className="no-print grid h-9 w-9 place-items-center rounded-xl border border-line bg-card text-slate transition-colors hover:border-aqua/40 hover:bg-aquaSoft hover:text-aqua">
      <MoreHorizontal size={18} />
    </button>
    {typeof document !== "undefined" && createPortal(
      <span data-row-actions className={`row-actions-panel fixed z-[79] w-[190px] flex-col gap-1 rounded-xl border border-line bg-card p-1.5 shadow-2xl ${open ? "flex" : "hidden"}`} style={position}>
        {children}
      </span>, document.body
    )}
  </span>;
}

// For a sentence-length informational note (e.g. "Coming soon", a
// disclaimer) — Badge above is for short status words only; stretching a
// full sentence into a rounded-full pill reads as visibly broken.
export function Callout({ children, tone = "slate" }) {
  const map = {
    green: "bg-greenSoft text-green border-green/20", amber: "bg-amberSoft text-amber border-amber/20",
    coral: "bg-coralSoft text-coral border-coral/20", aqua: "bg-aquaSoft text-aqua border-aqua/20",
    slate: "bg-mist text-slate border-line",
  };
  return <p className={`${map[tone] || map.slate} text-xs font-medium px-3.5 py-2.5 rounded-xl border leading-relaxed`}>{children}</p>;
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
    <div className={`premium-kpi card-lift rounded-2xl p-5 flex-1 min-w-[180px] ${style} ${href ? "cursor-pointer" : ""}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${tone === "navy" ? "text-white/75" : "text-slate"}`}>{label}</div>
      <div className="premium-kpi-value font-mono-num text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className={`text-xs mt-1 ${tone === "navy" ? "text-white/65" : "text-slate"}`}>{sub}</div>}
      {trend && (
        <div className={`flex items-center gap-1 text-[11px] font-semibold mt-1.5 ${trendColor}`}>
          <TrendIcon size={11} /> {trend.pct}% vs yesterday
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} className="flex min-w-0">{card}</Link> : card;
}

// Shared toolbar-button treatment (Print / View+Download PDF / Download
// Excel / Share) — one class string so every action across the app stays
// visually identical and any future hover/focus tweak only needs to
// happen here. `_ICON` is the same treatment as a fixed-size square for
// compact/icon-only placements (table rows, tight per-item toolbars).
const TOOLBAR_BTN = "no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold text-ink transition-colors hover:border-aqua/40 hover:bg-aquaSoft/60 hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/40";
const TOOLBAR_BTN_ICON = "no-print flex items-center justify-center w-8 h-8 rounded-lg border border-line bg-card text-ink transition-colors hover:border-aqua/40 hover:bg-aquaSoft/60 hover:text-aqua focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/40";

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
// `rows` exports what the page already has; `loadRows` (a server action)
// fetches every matching row on click instead — used by server-paginated
// lists so the export is never limited to the rows on the current page.
export function ExportExcelButton({ rows: givenRows, loadRows, sheetName = "Sheet1", reportTitle, branding, period, compact = false }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const rows = loadRows ? await loadRows() : givenRows;
      if (!rows?.length) { alert("No data to export."); return; }
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
    <button type="button" onClick={handleExport} disabled={loading} className={`${compact ? TOOLBAR_BTN_ICON : TOOLBAR_BTN} disabled:opacity-60`} title="Download Excel">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} {!compact && "Download Excel"}
    </button>
  );
}

function csvCell(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

// Unrelated to the PDF/Print/Excel/Share bar below — a plain-data CSV
// export some settings/export flows want alongside (or instead of) the
// branded Excel workbook.
export function ExportCsvButton({ rows, reportTitle = "Report" }) {
  const handleExport = () => {
    if (!rows?.length) { alert("No data to export."); return; }
    const columns = Object.keys(rows[0]);
    const csv = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
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

function PdfAction({ href, label, compact }) {
  return <PdfPreviewDialog href={href} label={label} compact={compact} triggerClassName={compact ? TOOLBAR_BTN_ICON : TOOLBAR_BTN} />;
}

function PrintAction({ compact }) {
  return (
    <button type="button" onClick={() => window.print()} className={compact ? TOOLBAR_BTN_ICON : TOOLBAR_BTN} title="Print">
      <Printer size={14} /> {!compact && "Print"}
    </button>
  );
}

// Native Web Share API where the browser/device supports it (mobile
// Chrome/Safari show the OS share sheet — WhatsApp, Mail, etc.); falls
// back to copying the link to the clipboard everywhere else (desktop
// browsers mostly don't implement navigator.share).
function ShareAction({ title, text, url, compact }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  return (
    <button type="button" onClick={handleShare} className={compact ? TOOLBAR_BTN_ICON : TOOLBAR_BTN} title={copied ? "Copied!" : "Share"}>
      <Share2 size={14} /> {!compact && (copied ? "Copied!" : "Share")}
    </button>
  );
}

// The one action bar every report/document/print-preview view in the app
// should use, so Print/PDF/Excel/Share always look and behave the same
// way instead of each page wiring up its own slightly different buttons.
// Every prop is optional — a view that has no tabular data to export
// (e.g. a single customer/invoice page) simply omits `excel` and gets no
// Excel button, rather than a disabled one.
//   print   — true to show a Print button (calls window.print())
//   pdfHref — the /api/pdf/... route for this document; renders View+Download
//   pdfLabel — label on the View button (defaults to "View PDF")
//   excel   — { rows, sheetName, reportTitle, branding, period } for ExportExcelButton
//   share   — { title, text, url } for the Share button (url defaults to the current page)
//   compact — icon-only buttons, for tight spaces like table rows
export function DocumentActionBar({ print = false, pdfHref, pdfLabel = "View PDF", excel, share, compact = false }) {
  return (
    <span className="no-print inline-flex flex-wrap items-center gap-1.5">
      {print && <PrintAction compact={compact} />}
      {pdfHref && <PdfAction href={pdfHref} label={pdfLabel} compact={compact} />}
      {excel && <ExportExcelButton {...excel} compact={compact} />}
      {share && <ShareAction {...share} compact={compact} />}
    </span>
  );
}

export function Th({ children, ...props }) {
  return <th {...props} className={`text-left px-3.5 py-2.5 text-slate font-semibold text-[10.5px] uppercase tracking-wide border-b border-line whitespace-nowrap ${props.className || ""}`}>{children}</th>;
}
export function Td({ children, ...props }) {
  return <td {...props} className={`px-3.5 py-2.5 whitespace-nowrap border-b border-line ${props.className || ""}`}>{children}</td>;
}
