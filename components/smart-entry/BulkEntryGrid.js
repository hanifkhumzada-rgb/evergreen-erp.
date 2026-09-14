"use client";
import { useMemo, useRef, useState } from "react";
import { Plus, Copy, Trash2, Eraser, Upload, Download, Search, ArrowUpDown } from "lucide-react";
import { FIELDS, BULK_COLUMNS, defaultPayload } from "./fieldConfig";
import CustomerPicker from "./CustomerPicker";
import Toast from "@/components/Toast";
import { bulkSaveDraftSmartEntries, bulkSubmitSmartEntries } from "@/app/(app)/smart-entry/actions";

const STATUS_BADGE = {
  unsaved: { text: "Unsaved", tone: "bg-[#EEF2F2] text-slate" },
  draft: { text: "Draft", tone: "bg-[#EEF2F2] text-slate" },
  pending_approval: { text: "Pending Approval", tone: "bg-amberSoft text-amber" },
  approved: { text: "Saved", tone: "bg-greenSoft text-green" },
  failed: { text: "Failed", tone: "bg-coralSoft text-coral" },
};

function newRow(entryType) {
  return { __rowId: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random())), entryId: null, status: "unsaved", payload: defaultPayload(entryType), errors: {} };
}

function Cell({ field, value, onChange, error, lookups }) {
  if (field.type === "customer") {
    return <CustomerPicker customers={lookups.customers} value={value} onChange={onChange} error={error} />;
  }
  if (field.type === "select") {
    const options = field.options || lookups[field.optionsKey] || [];
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`in !py-1.5 !text-xs ${error ? "border-coral" : ""}`}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value || o.id} value={o.value || o.id}>{o.label || o.name}</option>)}
      </select>
    );
  }
  return (
    <input type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} step="any"
      value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`in !py-1.5 !text-xs ${error ? "border-coral" : ""}`} />
  );
}

export default function BulkEntryGrid({ entryType, lookups, onDone }) {
  const columns = (BULK_COLUMNS[entryType] || []).map((name) => (FIELDS[entryType] || []).find((f) => f.name === name)).filter(Boolean);
  const [rows, setRows] = useState(() => Array.from({ length: 5 }, () => newRow(entryType)));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [showFailedOnly, setShowFailedOnly] = useState(false);
  const fileRef = useRef(null);

  const customerName = (id) => lookups.customers.find((c) => c.id === id)?.name || "";
  const customerZone = (id) => lookups.customers.find((c) => c.id === id)?.zone_name || "";

  const visibleRows = useMemo(() => {
    let list = rows;
    if (showFailedOnly) list = list.filter((r) => r.status === "failed");
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = [r.payload.customer_id ? customerName(r.payload.customer_id) : "", r.payload.name, r.payload.mobile, JSON.stringify(r.payload)].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (sortBy) {
      list = [...list].sort((a, b) => {
        const ka = sortBy === "customer" ? customerName(a.payload.customer_id || a.payload.name)
          : sortBy === "zone" ? customerZone(a.payload.customer_id) || a.payload.zone_id
          : sortBy === "date" ? (a.payload.delivery_date || a.payload.payment_date || a.payload.expense_date || a.payload.txn_date || "")
          : "";
        const kb = sortBy === "customer" ? customerName(b.payload.customer_id || b.payload.name)
          : sortBy === "zone" ? customerZone(b.payload.customer_id) || b.payload.zone_id
          : sortBy === "date" ? (b.payload.delivery_date || b.payload.payment_date || b.payload.expense_date || b.payload.txn_date || "")
          : "";
        return String(ka).localeCompare(String(kb));
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, sortBy, showFailedOnly, lookups]);

  const updateCell = (rowId, name, value) => setRows((rs) => rs.map((r) => (r.__rowId === rowId ? { ...r, payload: { ...r.payload, [name]: value }, errors: { ...r.errors, [name]: undefined } } : r)));
  const addRow = () => setRows((rs) => [...rs, newRow(entryType)]);
  const duplicateRow = (rowId) => setRows((rs) => { const r = rs.find((x) => x.__rowId === rowId); if (!r) return rs; return [...rs, { ...newRow(entryType), payload: { ...r.payload } }]; });
  const clearRow = (rowId) => setRows((rs) => rs.map((r) => (r.__rowId === rowId ? { ...newRow(entryType), __rowId: rowId } : r)));
  const removeRow = (rowId) => setRows((rs) => rs.filter((r) => r.__rowId !== rowId || r.status !== "unsaved"));

  const runBulk = async (fn, onlyFailedOrUnsaved) => {
    const target = onlyFailedOrUnsaved ? rows.filter((r) => r.status === "unsaved" || r.status === "failed" || r.status === "draft") : rows;
    if (target.length === 0) { setToast({ type: "error", message: "No rows to process." }); return; }
    setBusy(true);
    const res = await fn(entryType, target.map((r) => ({ __rowId: r.__rowId, entryId: r.entryId, payload: r.payload })));
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    const byId = new Map(res.results.map((r) => [r.rowId, r]));
    setRows((rs) => rs.map((r) => {
      const result = byId.get(r.__rowId);
      if (!result) return r;
      if (!result.ok && result.error) return { ...r, status: "failed", errors: { _general: result.error } };
      const entry = result.entry;
      return { ...r, entryId: entry?.id || r.entryId, status: entry?.status || (result.ok ? "draft" : "failed"), errors: entry?.validation_errors || {}, entryNo: entry?.entry_no };
    }));
    if (typeof res.total === "number") setSummary({ total: res.total, saved: res.saved, pending: res.pending, failed: res.failed });
    else setSummary(null);
    onDone?.();
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(ev.target.result, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const imported = parsed.map((r) => {
        const payload = defaultPayload(entryType);
        for (const col of columns) {
          const raw = r[col.label] ?? r[col.name];
          if (raw !== undefined && raw !== "") {
            if (col.type === "customer") {
              const match = lookups.customers.find((c) => c.code === String(raw) || c.mobile === String(raw) || c.name.toLowerCase() === String(raw).toLowerCase());
              payload[col.name] = match?.id || "";
            } else {
              payload[col.name] = raw;
            }
          }
        }
        return { ...newRow(entryType), payload };
      });
      setRows((rs) => [...rs.filter((r) => r.status !== "unsaved" || Object.values(r.payload).some(Boolean)), ...imported]);
      setToast({ type: "success", message: `Imported ${imported.length} rows.` });
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const downloadErrorRows = async () => {
    const failedRows = rows.filter((r) => r.status === "failed");
    if (failedRows.length === 0) { setToast({ type: "error", message: "No failed rows to export." }); return; }
    const XLSX = await import("xlsx");
    const data = failedRows.map((r) => {
      const out = {};
      for (const col of columns) out[col.label] = col.type === "customer" ? customerName(r.payload[col.name]) : r.payload[col.name];
      out["Error"] = Object.entries(r.errors || {}).filter(([k]) => k !== "_general").map(([k, v]) => `${k}: ${v}`).join("; ") || r.errors?._general || "";
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Failed Rows");
    XLSX.writeFile(wb, `Smart_Entry_Failed_${entryType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button type="button" onClick={addRow} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold"><Plus size={13} /> Add Row</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold"><Upload size={13} /> Import Excel/CSV</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
        <button type="button" onClick={downloadErrorRows} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold"><Download size={13} /> Download Error Rows</button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5">
          <Search size={13} className="text-slate" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, ID, phone…" className="text-xs outline-none bg-transparent w-40" />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1.5">
          <ArrowUpDown size={13} className="text-slate" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs outline-none bg-transparent">
            <option value="">Sort by…</option>
            <option value="customer">Customer Name</option>
            <option value="zone">Zone</option>
            <option value="date">Date</option>
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate">
          <input type="checkbox" checked={showFailedOnly} onChange={(e) => setShowFailedOnly(e.target.checked)} /> Failed only
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-foam">
              <th className="px-2 py-2 text-left font-semibold text-slate">Status</th>
              {columns.map((c) => <th key={c.name} className="px-2 py-2 text-left font-semibold text-slate whitespace-nowrap">{c.label}{c.required && " *"}</th>)}
              <th className="px-2 py-2 text-left font-semibold text-slate">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && <tr><td colSpan={columns.length + 2} className="text-center py-8 text-slate">No rows. Click Add Row or Import to start.</td></tr>}
            {visibleRows.map((row) => {
              const badge = STATUS_BADGE[row.status] || STATUS_BADGE.unsaved;
              const locked = row.status === "approved" || row.status === "pending_approval";
              return (
                <tr key={row.__rowId} className="border-t border-line align-top">
                  <td className="px-2 py-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.tone}`}>{badge.text}</span>
                    {row.entryNo && <div className="text-[10px] text-slate mt-0.5">{row.entryNo}</div>}
                    {row.errors?._general && <div className="text-[10px] text-coral mt-0.5 max-w-[140px]">{row.errors._general}</div>}
                  </td>
                  {columns.map((c) => (
                    <td key={c.name} className="px-2 py-1.5 min-w-[130px]">
                      {locked ? (
                        <span className="text-[11px]">{c.type === "customer" ? customerName(row.payload[c.name]) : String(row.payload[c.name] ?? "—")}</span>
                      ) : (
                        <Cell field={c} value={row.payload[c.name]} onChange={(v) => updateCell(row.__rowId, c.name, v)} error={row.errors?.[c.name]} lookups={lookups} />
                      )}
                      {row.errors?.[c.name] && <p className="text-coral text-[10px] mt-0.5">{row.errors[c.name]}</p>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <button type="button" title="Duplicate Row" onClick={() => duplicateRow(row.__rowId)}><Copy size={13} className="text-slate" /></button>
                      {!locked && <button type="button" title="Clear Row" onClick={() => clearRow(row.__rowId)}><Eraser size={13} className="text-slate" /></button>}
                      {row.status === "unsaved" && <button type="button" title="Remove Unsaved Row" onClick={() => removeRow(row.__rowId)}><Trash2 size={13} className="text-coral" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {summary && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs bg-foam rounded-xl px-4 py-2.5">
          <span>Total: <strong>{summary.total}</strong></span>
          <span className="text-green">Saved: <strong>{summary.saved}</strong></span>
          {summary.pending > 0 && <span className="text-amber">Pending Approval: <strong>{summary.pending}</strong></span>}
          <span className="text-coral">Failed: <strong>{summary.failed}</strong></span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" disabled={busy} onClick={() => runBulk(bulkSubmitSmartEntries, false)} className="px-4 py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Processing…" : "Submit"}</button>
        <button type="button" disabled={busy} onClick={() => runBulk(bulkSubmitSmartEntries, true)} className="px-4 py-2.5 rounded-xl border border-line font-semibold text-sm disabled:opacity-60">Save All Valid Rows</button>
        <button type="button" disabled={busy} onClick={() => runBulk(bulkSaveDraftSmartEntries, true)} className="px-4 py-2.5 rounded-xl border border-line font-semibold text-sm disabled:opacity-60">Save Draft</button>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
