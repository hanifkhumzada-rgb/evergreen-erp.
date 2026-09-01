"use client";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Download, Printer } from "lucide-react";

export default function ReportCard({ name, rows }) {
  return (
    <div className="card-lift border border-line rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7.5 h-7.5 rounded-lg bg-aquaSoft flex items-center justify-center p-1.5"><FileSpreadsheet size={15} className="text-aqua" /></div>
        <strong className="text-[13.5px]">{name}</strong>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!rows.length) { alert("No data for this report yet."); return; }
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
            XLSX.writeFile(wb, name.replace(/\s+/g, "-").toLowerCase() + ".xlsx");
          }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold"
        ><Download size={14} /> Excel</button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold"><Printer size={14} /> PDF</button>
      </div>
    </div>
  );
}
