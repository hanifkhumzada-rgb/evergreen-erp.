"use client";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Printer } from "lucide-react";

export function pkr(n) {
  return "PKR " + Math.round(Number(n) || 0).toLocaleString("en-PK");
}
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function Badge({ text, tone = "slate" }) {
  const map = {
    green: "bg-greenSoft text-green", amber: "bg-amberSoft text-amber",
    coral: "bg-coralSoft text-coral", aqua: "bg-aquaSoft text-aqua", slate: "bg-[#EEF2F2] text-slate",
  };
  return <span className={`${map[tone] || map.slate} text-[11.5px] font-semibold px-2.5 py-1 rounded-full`}>{text}</span>;
}

export function KPI({ label, value, sub, tone = "navy" }) {
  const bg = { navy: "bg-navyLight text-white", aqua: "bg-aquaSoft", amber: "bg-amberSoft", coral: "bg-coralSoft", green: "bg-greenSoft" }[tone];
  return (
    <div className={`rounded-2xl p-5 flex-1 min-w-[180px] ${bg}`}>
      <div className={`text-xs font-semibold tracking-wide ${tone === "navy" ? "text-[#BFE3E0]" : "text-slate"}`}>{label}</div>
      <div className="font-mono-num text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className={`text-xs mt-1 ${tone === "navy" ? "text-[#9CC9C5]" : "text-slate"}`}>{sub}</div>}
    </div>
  );
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
      className="no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-white text-xs font-semibold"
    >
      <FileSpreadsheet size={14} /> Export Excel
    </button>
  );
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-white text-xs font-semibold">
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
