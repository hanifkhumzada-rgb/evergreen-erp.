"use client";
import { useState } from "react";
import { ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import { FileSpreadsheet } from "lucide-react";

// Groups the same reports the Reports page has always computed — this only
// changes how they're navigated to/selected, not what data each one shows.
const REPORT_GROUPS = [
  { label: "Sales", reports: ["Sales Report", "Customer Profitability", "Area / Route Report"] },
  { label: "Receivables", reports: ["Customer Ledger", "Receivables Report"] },
  { label: "Deliveries", reports: ["Delivery Report"] },
  { label: "Bottles", reports: ["Bottle Report"] },
  { label: "Inventory", reports: ["Inventory Report"] },
  { label: "Expenses", reports: ["Expense Report"] },
  { label: "Team", reports: ["Employee Performance"] },
];

function fmtCell(v) {
  if (typeof v === "number") return v.toLocaleString();
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export default function ReportsBrowser({ reports }) {
  const byName = {};
  reports.forEach((r) => { byName[r.name] = r; });
  const [selected, setSelected] = useState(REPORT_GROUPS[0].reports[0]);
  const report = byName[selected];
  const rows = report?.rows || [];
  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      <div className="lg:w-64 flex-shrink-0 border border-line rounded-2xl p-3 h-fit">
        {REPORT_GROUPS.map((g) => {
          const groupReports = g.reports.filter((name) => byName[name]);
          if (!groupReports.length) return null;
          return (
            <div key={g.label} className="mb-3 last:mb-0">
              <div className="text-[10px] font-bold tracking-wider text-slate px-2 mb-1">{g.label.toUpperCase()}</div>
              <div className="flex flex-col gap-0.5">
                {groupReports.map((name) => (
                  <button key={name} type="button" onClick={() => setSelected(name)}
                    className={`flex items-center gap-2 px-2.5 py-1.75 rounded-lg text-[13px] font-semibold text-left transition-colors ${selected === name ? "bg-aquaSoft text-aqua" : "hover:bg-foam text-ink"}`}>
                    <FileSpreadsheet size={14} className="flex-shrink-0" />
                    <span className="flex-1">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-lg font-semibold">{selected}</h3>
          <div className="no-print flex gap-2">
            <ExportExcelButton rows={rows} filename={`${selected.replace(/\s+/g, "-").toLowerCase()}.xlsx`} sheetName={selected.slice(0, 30)} />
            <PrintButton />
          </div>
        </div>
        <div className="overflow-x-auto border border-line rounded-2xl">
          <table className="w-full text-[13.5px] border-collapse">
            <thead><tr className="bg-foam">{columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={columns.length || 1} className="text-center py-8 text-slate">No data for this report yet.</td></tr>}
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-foam">{columns.map((c) => <Td key={c}>{fmtCell(row[c])}</Td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
