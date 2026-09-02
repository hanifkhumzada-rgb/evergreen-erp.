"use client";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, X, ArrowRight } from "lucide-react";

const PREVIEW_LINES = {
  sales: (r) => `${r.Name || r.name || r.Phone || r.phone} — Qty ${r.Qty || r.qty}${r.Paid ? `, Paid ${r.Paid}` : ""}`,
  expenses: (r) => `${r.Category || r.category} — ${r.Amount || r.amount}`,
  inventory: (r) => `${r.Supplier || r.supplier} — ${r.Item || r.item} × ${r.Qty || r.qty}`,
  payments: (r) => `${r.Name || r.name || r.Phone || r.phone} — ${r.Amount || r.amount}`,
  deliveries: (r) => `${r.Name || r.name || r.Phone || r.phone} — Qty ${r.Qty || r.qty}`,
  customers: (r) => `${r.Name || r.name} — ${r.Mobile || r.mobile || r.Phone || r.phone || "no phone"}`,
  bottleOpening: (r) => `${r.Customer || r.customer || r["Customer ID"] || r.CustomerID}`,
};

const norm = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

// expectedFields (optional, opt-in): [{ key, label, required }]. When given,
// an upload goes through Upload -> Column Mapping -> Validation -> Duplicate
// Check -> Preview -> Import -> Report. Without it, behaves exactly as
// before (used unchanged by Sales/Expenses/Payments/Deliveries/Inventory).
export default function BulkImportButton({ label = "Import Excel", columnsHint, sampleRow, action, previewType, expectedFields, duplicateKey, existingValues }) {
  const previewLine = PREVIEW_LINES[previewType];
  const fileRef = useRef();
  const [rawRows, setRawRows] = useState(null);
  const [mapping, setMapping] = useState(null); // { header: fieldKey | "__ignore__" }
  const [preview, setPreview] = useState(null); // { rows: [{ data, missing, duplicate }] }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([sampleRow || {}]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `${label.replace(/\s+/g, "-").toLowerCase()}-template.xlsx`);
  };

  const buildPreview = (rows) => {
    // existingValues is passed as a plain array (Sets aren't serializable
    // from a Server Component prop), turned into a Set here for lookups.
    const existingSet = new Set(existingValues || []);
    const valuesSeen = new Set();
    const previewRows = rows.map((data) => {
      const missing = (expectedFields || []).filter((f) => f.required && !String(data[f.key] ?? "").trim()).map((f) => f.label);
      const dupVal = duplicateKey ? duplicateKey(data) : null;
      const duplicate = !!dupVal && (existingSet.has(dupVal) || valuesSeen.has(dupVal));
      if (dupVal) valuesSeen.add(dupVal);
      return { data, missing, duplicate };
    });
    setPreview({ rows: previewRows });
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        if (!expectedFields) { setPreview({ rows: rows.map((data) => ({ data, missing: [], duplicate: false })) }); return; }
        setRawRows(rows);
        const headers = rows.length ? Object.keys(rows[0]) : [];
        const initialMap = {};
        headers.forEach((h) => {
          const match = expectedFields.find((f) => norm(f.label) === norm(h) || norm(f.key) === norm(h));
          initialMap[h] = match ? match.key : "__ignore__";
        });
        setMapping(initialMap);
      } catch {
        alert("Could not read this file. Please upload a valid .xlsx or .csv file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const applyMapping = () => {
    const mapped = rawRows.map((row) => {
      const out = {};
      Object.entries(mapping).forEach(([header, fieldKey]) => {
        if (fieldKey && fieldKey !== "__ignore__") out[fieldKey] = row[header];
      });
      return out;
    });
    setRawRows(null);
    setMapping(null);
    buildPreview(mapped);
  };

  const confirmImport = async () => {
    setBusy(true);
    const rowsToImport = preview.rows.filter((r) => r.missing.length === 0 && !r.duplicate).map((r) => r.data);
    const res = await action(rowsToImport);
    setBusy(false);
    const skippedInvalid = preview.rows.filter((r) => r.missing.length > 0).length;
    const skippedDuplicate = preview.rows.filter((r) => r.duplicate).length;
    setResult({ ...res, skippedInvalid, skippedDuplicate });
    setPreview(null);
  };

  const validCount = preview ? preview.rows.filter((r) => r.missing.length === 0 && !r.duplicate).length : 0;

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

      {mapping && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => { setRawRows(null); setMapping(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-display text-lg font-semibold">Match columns</h3>
              <button onClick={() => { setRawRows(null); setMapping(null); }}><X size={18} /></button>
            </div>
            <p className="text-xs text-slate mb-3">We matched what we could recognize — check each row and fix any that are wrong.</p>
            <div className="flex flex-col gap-2 mb-4">
              {Object.keys(mapping).map((header) => (
                <div key={header} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 min-w-0 truncate font-semibold">{header}</span>
                  <ArrowRight size={12} className="text-slate flex-shrink-0" />
                  <select value={mapping[header]} onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-line bg-card text-ink text-xs">
                    <option value="__ignore__">— ignore —</option>
                    {expectedFields.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <button onClick={applyMapping} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm">Continue to Preview</button>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-display text-lg font-semibold">Preview import</h3>
              <button onClick={() => setPreview(null)}><X size={18} /></button>
            </div>
            <p className="text-sm mb-2">
              {preview.rows.length} rows found
              {expectedFields ? <> — <strong className="text-green">{validCount}</strong> ready, <strong className="text-coral">{preview.rows.length - validCount}</strong> skipped (missing fields or duplicate)</> : "."}
            </p>
            {columnsHint && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate">Expected columns: {columnsHint}</p>
                <button type="button" onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-aqua font-semibold flex-shrink-0 ml-2">
                  <Download size={12} /> Template
                </button>
              </div>
            )}
            <div className="max-h-48 overflow-y-auto border border-line rounded-lg mb-4 text-xs">
              {preview.rows.slice(0, 30).map((r, i) => (
                <div key={i} className="px-3 py-1.5 border-b border-line flex items-center justify-between gap-2">
                  <span className="truncate">{previewLine ? previewLine(r.data) : JSON.stringify(r.data)}</span>
                  {r.duplicate && <span className="flex-shrink-0 text-[10px] font-bold text-amber">DUPLICATE</span>}
                  {r.missing.length > 0 && <span className="flex-shrink-0 text-[10px] font-bold text-coral">MISSING {r.missing.join(", ").toUpperCase()}</span>}
                </div>
              ))}
            </div>
            <button disabled={busy || (expectedFields && validCount === 0)} onClick={confirmImport} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
              {busy ? "Importing…" : `Confirm import of ${expectedFields ? validCount : preview.rows.length} rows`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed bottom-6 right-6 bg-card border border-line rounded-xl p-4 shadow-lg z-50 text-sm max-w-xs">
          <p><strong className="text-green">{result.imported}</strong> imported, <strong className="text-coral">{result.failed}</strong> failed.</p>
          {(result.skippedInvalid > 0 || result.skippedDuplicate > 0) && (
            <p className="text-xs text-slate mt-1">
              {result.skippedInvalid > 0 && <>{result.skippedInvalid} skipped (missing required fields). </>}
              {result.skippedDuplicate > 0 && <>{result.skippedDuplicate} skipped (duplicate).</>}
            </p>
          )}
          <button className="text-xs text-aqua font-semibold mt-1" onClick={() => setResult(null)}>Dismiss</button>
        </div>
      )}
    </>
  );
}
