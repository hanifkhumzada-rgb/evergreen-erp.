"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Search, X } from "lucide-react";
import { ExportCsvButton, ExportExcelButton } from "@/components/ui";

const PAGE_SIZE = 30;
const VIEW_BTN = "no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-aqua/25 bg-aquaSoft/60 text-xs font-semibold text-aqua transition-colors hover:border-aqua/50 hover:bg-aquaSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua/40";

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString("en-PK", { maximumFractionDigits: 2 });
  return String(value);
}

export default function ReportPreview({ title, rows = [], sheetName, branding }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const columns = rows.length ? Object.keys(rows[0]) : [];

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => columns.some((column) => String(row[column] ?? "").toLowerCase().includes(term)));
  }, [columns, query, rows]);

  const numericColumns = useMemo(() => columns.filter((column) => rows.some((row) => typeof row[column] === "number")), [columns, rows]);
  const totals = useMemo(() => Object.fromEntries(numericColumns.map((column) => [column, filteredRows.reduce((sum, row) => sum + (Number(row[column]) || 0), 0)])), [filteredRows, numericColumns]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const shownRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [query]);
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
      <button type="button" onClick={() => setOpen(true)} className={VIEW_BTN}><Eye size={14} /> View</button>
      {open ? (
        <div className="no-print fixed inset-0 z-[130] bg-navy/70 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={`${title} report preview`}>
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[22px] border border-white/20 bg-card shadow-2xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-card px-3 py-3 sm:px-5">
              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2"><Eye size={16} className="text-aqua" /><h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2></div>
                <p className="mt-0.5 text-[11px] text-slate">{filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows</p>
              </div>
              <ExportCsvButton rows={filteredRows} reportTitle={title} />
              <ExportExcelButton rows={filteredRows} sheetName={sheetName} reportTitle={title} branding={branding} />
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line hover:bg-foam" aria-label="Close preview"><X size={17} /></button>
            </div>

            <div className="border-b border-line bg-foam/60 px-3 py-3 sm:px-5">
              <label className="flex max-w-md items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 focus-within:border-aqua/50 focus-within:ring-2 focus-within:ring-aqua/10">
                <Search size={15} className="text-slate" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} className="w-full bg-transparent text-sm outline-none" autoFocus />
                {query ? <button type="button" onClick={() => setQuery("")} className="text-[11px] font-semibold text-aqua">Clear</button> : null}
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-[#F7FAFA]">
              <table className="w-full border-collapse text-[13px]">
                <thead className="sticky top-0 z-10 bg-navy text-white"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap border-r border-white/10 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide last:border-r-0">{column}</th>)}</tr></thead>
                <tbody>
                  {!shownRows.length ? <tr><td colSpan={columns.length || 1} className="py-16 text-center text-sm text-slate">No matching records found.</td></tr> : null}
                  {shownRows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-line bg-card even:bg-foam/55 hover:bg-aquaSoft/40">{columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-2.5 text-ink">{displayValue(row[column])}</td>)}</tr>)}
                </tbody>
                {filteredRows.length && numericColumns.length ? <tfoot className="sticky bottom-0 border-t-2 border-aqua/30 bg-aquaSoft font-bold"><tr>{columns.map((column, index) => <td key={column} className="whitespace-nowrap px-3 py-3">{index === 0 ? "Total" : numericColumns.includes(column) ? displayValue(totals[column]) : ""}</td>)}</tr></tfoot> : null}
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line bg-card px-3 py-3 sm:px-5">
              <p className="text-xs text-slate">Page {page} of {pageCount}</p>
              <div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-line p-2 disabled:opacity-35"><ChevronLeft size={16} /></button><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line p-2 disabled:opacity-35"><ChevronRight size={16} /></button></div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
