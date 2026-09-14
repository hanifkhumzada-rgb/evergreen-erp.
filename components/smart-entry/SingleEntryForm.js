"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { FIELDS, defaultPayload } from "./fieldConfig";
import CustomerPicker from "./CustomerPicker";
import Toast from "@/components/Toast";
import { createAndSubmitSmartEntry, saveDraftSmartEntry, updateAndRetrySmartEntry } from "@/app/(app)/smart-entry/actions";

function Field({ field, value, onChange, error, lookups }) {
  const common = { value: value ?? "", onChange: (e) => onChange(field.name, e.target.value) };
  if (field.type === "customer") {
    return <CustomerPicker customers={lookups.customers} value={value} onChange={(id) => onChange(field.name, id)} error={error} />;
  }
  if (field.type === "select") {
    const options = field.options || lookups[field.optionsKey] || [];
    return (
      <select {...common} className={`in ${error ? "border-coral" : ""}`}>
        <option value="">— select —</option>
        {options.map((o) => <option key={o.value || o.id} value={o.value || o.id}>{o.label || o.name}</option>)}
      </select>
    );
  }
  if (field.type === "textarea") return <textarea {...common} rows={2} className={`in ${error ? "border-coral" : ""}`} />;
  if (field.type === "number") return <input type="number" step="any" min={field.min} max={field.max} {...common} className={`in ${error ? "border-coral" : ""}`} />;
  if (field.type === "date") return <input type="date" {...common} className={`in ${error ? "border-coral" : ""}`} />;
  if (field.type === "month") return <input type="month" {...common} onChange={(e) => onChange(field.name, e.target.value ? `${e.target.value}-01` : "")} className={`in ${error ? "border-coral" : ""}`} />;
  return <input type="text" {...common} className={`in ${error ? "border-coral" : ""}`} />;
}

function ItemsField({ field, value, onChange, lookups }) {
  const rows = value?.length ? value : [];
  const addRow = () => onChange(field.name, [...rows, {}]);
  const removeRow = (i) => onChange(field.name, rows.filter((_, idx) => idx !== i));
  const updateRow = (i, key, v) => onChange(field.name, rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  return (
    <div className="rounded-xl border border-line overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[480px]">
        <thead><tr className="bg-foam">{field.itemFields.map((f) => <th key={f.name} className="text-left px-2 py-1.5 font-semibold text-slate">{f.label}</th>)}<th className="w-8" /></tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {field.itemFields.map((f) => (
                <td key={f.name} className="px-2 py-1.5">
                  {f.type === "select" ? (
                    <select value={row[f.name] || ""} onChange={(e) => updateRow(i, f.name, e.target.value)} className="in !py-1 !text-xs">
                      <option value="">—</option>
                      {(lookups[f.optionsKey] || []).map((o) => <option key={o.value || o.id} value={o.value || o.id}>{o.label || o.name}</option>)}
                    </select>
                  ) : (
                    <input type={f.type === "number" ? "number" : "text"} step="any" value={row[f.name] ?? ""} onChange={(e) => updateRow(i, f.name, e.target.value)} className="in !py-1 !text-xs" />
                  )}
                </td>
              ))}
              <td><button type="button" onClick={() => removeRow(i)}><Trash2 size={13} className="text-coral" /></button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={field.itemFields.length + 1} className="text-center py-3 text-slate">No items yet.</td></tr>}
        </tbody>
      </table>
      <button type="button" onClick={addRow} className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-aqua"><Plus size={12} /> Add item</button>
    </div>
  );
}

export default function SingleEntryForm({ entryType, lookups, editEntry, onDone }) {
  const fields = FIELDS[entryType] || [];
  const [payload, setPayload] = useState(() => (editEntry ? { ...defaultPayload(entryType), ...editEntry.payload } : defaultPayload(entryType)));
  const [errors, setErrors] = useState(editEntry?.validation_errors || {});
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()));

  useEffect(() => {
    setPayload(editEntry ? { ...defaultPayload(entryType), ...editEntry.payload } : defaultPayload(entryType));
    setErrors(editEntry?.validation_errors || {});
  }, [entryType, editEntry]);

  const update = (name, value) => { setPayload((p) => ({ ...p, [name]: value })); setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e)); };

  const visibleFields = useMemo(() => fields.filter((f) => !f.showIf || f.showIf(payload)), [fields, payload]);

  const handleSaveDraft = async () => {
    setBusy(true);
    const res = await saveDraftSmartEntry(entryType, payload, idempotencyKey);
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    setToast({ type: "success", message: "Saved as draft." });
    onDone?.(res.entry);
  };

  const handleSubmit = async () => {
    setBusy(true);
    const res = editEntry
      ? await updateAndRetrySmartEntry(editEntry.id, payload)
      : await createAndSubmitSmartEntry(entryType, payload, idempotencyKey);
    setBusy(false);
    if (res?.error) { setToast({ type: "error", message: res.error }); return; }
    const entry = res.entry;
    if (entry.status === "failed") {
      setErrors(entry.validation_errors || {});
      setToast({ type: "error", message: "Some fields need correction — see highlighted errors below." });
      return;
    }
    setWarnings(entry.warnings || []);
    if (entry.status === "pending_approval") {
      setToast({ type: "success", message: `Submitted — ${entry.entry_no} is pending approval.` });
    } else {
      setToast({ type: "success", message: `${entry.entry_no} posted successfully.` });
    }
    setPayload(defaultPayload(entryType));
    setErrors({});
    onDone?.(entry);
  };

  const clearForm = () => { setPayload(defaultPayload(entryType)); setErrors({}); setWarnings([]); };

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber/40 bg-amberSoft p-3 text-xs text-amber flex gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <ul className="space-y-0.5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleFields.map((f) => (
          <label key={f.name} className={`block ${f.type === "textarea" || f.type === "items" ? "sm:col-span-2" : ""}`}>
            <span className="text-xs font-semibold text-slate block mb-1">{f.label}{f.required && <span className="text-coral"> *</span>}</span>
            {f.type === "items"
              ? <ItemsField field={f} value={payload[f.name]} onChange={update} lookups={lookups} />
              : <Field field={f} value={payload[f.name]} onChange={update} error={errors[f.name]} lookups={lookups} />}
            {errors[f.name] && f.type !== "customer" && <p className="text-coral text-[11px] mt-1">{errors[f.name]}</p>}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mt-5">
        <button type="button" disabled={busy} onClick={handleSubmit} className="px-4 py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
          {busy ? "Saving…" : editEntry ? "Save & Retry" : "Submit"}
        </button>
        {!editEntry && (
          <button type="button" disabled={busy} onClick={handleSaveDraft} className="px-4 py-2.5 rounded-xl border border-line font-semibold text-sm disabled:opacity-60">Save Draft</button>
        )}
        <button type="button" disabled={busy} onClick={clearForm} className="px-4 py-2.5 rounded-xl text-slate font-semibold text-sm">Clear</button>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
