"use client";
import Link from "next/link";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Printer, ArrowUp, ArrowDown, Minus, FileDown } from "lucide-react";

export function Badge({ text, tone = "slate" }) {
  const map = {
    green: "bg-greenSoft text-green", amber: "bg-amberSoft text-amber",
    coral: "bg-coralSoft text-coral", aqua: "bg-aquaSoft text-aqua", slate: "bg-[#EEF2F2] text-slate",
  };
  return <span className={`${map[tone] || map.slate} text-[11.5px] font-semibold px-2.5 py-1 rounded-full`}>{text}</span>;
}

export function KPI({ label, value, sub, tone = "navy", trend, href }) {
  const style = {
    navy: "bg-navyLight text-white",
    aqua: "bg-card border border-line border-t-2 border-t-aqua",
    amber: "bg-card border border-line border-t-2 border-t-amber",
    coral: "bg-card border border-line border-t-2 border-t-coral",
    green: "bg-card border border-line border-t-2 border-t-green",
  }[tone];
  const TrendIcon = trend?.direction === "up" ? ArrowUp : trend?.direction === "down" ? ArrowDown : Minus;
  const trendColor = trend?.favorable === null || trend?.favorable === undefined ? "text-slate" : trend.favorable ? "text-green" : "text-coral";
  const card = (
    <div className={`card-lift rounded-2xl p-5 flex-1 min-w-[180px] ${style} ${href ? "cursor-pointer" : ""}`}>
      <div className={`text-xs font-semibold tracking-wide ${tone === "navy" ? "text-[#BFE3E0]" : "text-slate"}`}>{label}</div>
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

export function ExportExcelButton({ rows, filename, sheetName = "Sheet1" }) {
  return (
    <button
      onClick={() => {
        if (!rows?.length) { alert("No data to export."); return; }
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : filename + ".xlsx");
      }}
      className="no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold"
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
    <a href={href} className="no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">
      <FileDown size={14} /> {label}
    </a>
  );
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">
      <Printer size={14} /> Export PDF
    </button>
  );
}

export function Th({ children, ...props }) {
  return <th {...props} className={`text-left px-3.5 py-2.5 text-slate font-semibold text-[11.5px] border-b border-line whitespace-nowrap ${props.className || ""}`}>{children}</th>;
}
export function Td({ children, ...props }) {
  return <td {...props} className={`px-3.5 py-2.5 whitespace-nowrap border-b border-line ${props.className || ""}`}>{children}</td>;
}
