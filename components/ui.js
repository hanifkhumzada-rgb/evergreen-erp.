"use client";
import Link from "next/link";
import { FileSpreadsheet, Printer, ArrowUp, ArrowDown, Minus, FileDown } from "lucide-react";
import { buildBrandedWorkbook, brandedFilename } from "@/lib/excel";
import * as XLSX from "xlsx";

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

// Every export goes through lib/excel.js's buildBrandedWorkbook — company
// name/tagline, report title, period and a generated timestamp as the
// first rows, auto-fit columns, PKR number formatting on currency-looking
// columns, and a totals row — rather than the old bare json_to_sheet
// dump. `reportTitle` falls back to `sheetName` so existing call sites
// that only ever passed a sheet name still get a sensible title. Any old
// `filename` prop a caller still passes is simply ignored (not
// destructured) — the branded Evergreen_Water_<Report>_<Date>.xlsx
// pattern always applies instead.
export function ExportExcelButton({ rows, sheetName = "Sheet1", reportTitle, branding, period }) {
  return (
    <button type="button"
      onClick={() => {
        if (!rows?.length) { alert("No data to export."); return; }
        const title = reportTitle || sheetName;
        const wb = buildBrandedWorkbook({ rows, sheetName, reportTitle: title, branding, period });
        XLSX.writeFile(wb, brandedFilename(title), { cellStyles: true });
      }}
      className={TOOLBAR_BTN}
    >
      <FileSpreadsheet size={14} /> Export Excel
    </button>
  );
}

// Server-generated branded PDF download (Customer Statement, Daily Sales,
// Outstanding/Receivables only) — a plain link to a route handler that
// streams back a real PDF, not window.print(). Every other page keeps its
// existing PrintButton untouched.
export function DownloadPdfButton({ href, label = "Download PDF" }) {
  return (
    <a href={href} className={TOOLBAR_BTN}>
      <FileDown size={14} /> {label}
    </a>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={TOOLBAR_BTN}>
      <Printer size={14} /> Export PDF
    </button>
  );
}

export function Th({ children, ...props }) {
  return <th {...props} className={`text-left px-3.5 py-2.5 text-slate font-semibold text-[10.5px] uppercase tracking-wide border-b border-line whitespace-nowrap ${props.className || ""}`}>{children}</th>;
}
export function Td({ children, ...props }) {
  return <td {...props} className={`px-3.5 py-2.5 whitespace-nowrap border-b border-line ${props.className || ""}`}>{children}</td>;
}
