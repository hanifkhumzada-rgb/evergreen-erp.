"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DocumentActionBar, Th, Td } from "@/components/ui";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import { FileSpreadsheet } from "lucide-react";
import { REPORT_GROUPS } from "@/lib/reportGroups";

function fmtCell(v) {
  if (typeof v === "number") return v.toLocaleString();
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

// The server builds only the selected report (see app/(app)/reports), so
// switching reports is a normal navigation carrying the date range along.
export default function ReportsBrowser({ selected, rows = [], displayLimit = 300, baseParams = {}, branding }) {
  const pathname = usePathname();
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const numericCols = columns.filter((c) => rows.length > 0 && rows.every((r) => typeof r[c] === "number"));
  const totals = {};
  numericCols.forEach((c) => { totals[c] = rows.reduce((a, r) => a + (Number(r[c]) || 0), 0); });
  const shownRows = rows.length > displayLimit ? rows.slice(0, displayLimit) : rows;
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const hrefFor = (name) => `${pathname}?${new URLSearchParams({ ...baseParams, report: name })}`;

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      <div className="lg:w-64 flex-shrink-0 border border-line rounded-2xl p-3 h-fit no-print">
        {REPORT_GROUPS.map((g) => (
          <div key={g.label} className="mb-3 last:mb-0">
            <div className="text-[10px] font-bold tracking-wider text-slate px-2 mb-1">{g.label.toUpperCase()}</div>
            <div className="flex flex-col gap-0.5">
              {g.reports.map((name) => (
                <Link key={name} href={hrefFor(name)} scroll={false} aria-current={selected === name ? "page" : undefined}
                  className={`flex items-center gap-2 px-2.5 py-1.75 rounded-lg text-[13px] font-semibold text-left transition-colors ${selected === name ? "bg-aquaSoft text-aqua" : "hover:bg-foam text-ink"}`}>
                  <FileSpreadsheet size={14} className="flex-shrink-0" />
                  <span className="flex-1">{name}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <DocumentPrintHeader branding={branding} title={selected} meta={`Generated ${today}`} />
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-lg font-semibold">{selected}</h3>
          <div className="no-print flex gap-2">
            <DocumentActionBar
              print
              excel={{ rows, sheetName: selected.slice(0, 30), reportTitle: selected, branding }}
              share={{ title: selected }}
            />
          </div>
        </div>
        {rows.length > shownRows.length && (
          <p className="no-print mb-2 text-xs text-slate">
            Showing the first {shownRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows. Totals and the Excel export include all rows.
          </p>
        )}
        <div className="overflow-x-auto border border-line rounded-2xl">
          <table className="w-full text-[13.5px] border-collapse">
            <thead><tr className="bg-foam">{columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={columns.length || 1} className="text-center py-8 text-slate">No data for this report yet.</td></tr>}
              {shownRows.map((row, i) => (
                <tr key={i} className="hover:bg-foam">{columns.map((c) => <Td key={c}>{fmtCell(row[c])}</Td>)}</tr>
              ))}
            </tbody>
            {numericCols.length > 0 && rows.length > 0 && (
              <tfoot>
                <tr className="bg-foam font-semibold">
                  {columns.map((c, i) => (
                    <Td key={c}>{i === 0 ? "Total" : (numericCols.includes(c) ? fmtCell(totals[c]) : "")}</Td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <DocumentPrintFooter />
      </div>
    </div>
  );
}
