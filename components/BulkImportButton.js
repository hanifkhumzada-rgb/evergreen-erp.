"use client";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, X } from "lucide-react";

export default function BulkImportButton({ label = "Import Excel", columnsHint, sampleRow, action, previewLine }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([sampleRow || {}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${label.replace(/\s+/g, "-").toLowerCase()}-template.xlsx`);
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        setPreview({ rows });
      } catch {
        alert("Could not read this file. Please upload a valid .xlsx or .csv file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    setBusy(true);
    const res = await action(preview.rows);
    setBusy(false);
    setResult(res);
    setPreview(null);
  };

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
      <button onClick={downloadTemplate} className="no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold" title="Download a starter Excel template">
        <Download size={14} />
      </button>
      <button onClick={() => fileRef.current.click()} className="no-print flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line bg-card text-xs font-semibold">
        <Upload size={14} /> {label}
      </button>

      {preview && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-display text-lg font-semibold">Preview import</h3>
              <button onClick={() => setPreview(null)}><X size={18} /></button>
            </div>
            <p className="text-sm mb-2">{preview.rows.length} rows found.</p>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate">Expected columns: {columnsHint}</p>
              <button type="button" onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-aqua font-semibold flex-shrink-0 ml-2">
                <Download size={12} /> Template
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-line rounded-lg mb-4 text-xs">
              {preview.rows.slice(0, 20).map((r, i) => (
                <div key={i} className="px-3 py-1.5 border-b border-line">{previewLine ? previewLine(r) : JSON.stringify(r)}</div>
              ))}
            </div>
            <button disabled={busy} onClick={confirmImport} className="w-full py-2.5 rounded-lg bg-aqua text-white font-bold text-sm disabled:opacity-60">
              {busy ? "Importing…" : `Confirm import of ${preview.rows.length} rows`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed bottom-6 right-6 bg-card border border-line rounded-xl p-4 shadow-lg z-50 text-sm">
          <p><strong className="text-green">{result.imported}</strong> imported, <strong className="text-coral">{result.failed}</strong> failed.</p>
          <button className="text-xs text-aqua font-semibold mt-1" onClick={() => setResult(null)}>Dismiss</button>
        </div>
      )}
    </>
  );
}
