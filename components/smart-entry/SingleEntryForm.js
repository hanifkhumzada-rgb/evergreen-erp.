"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Copy, Trash2, AlertTriangle, CheckCircle2, FileClock } from "lucide-react";
import { FIELDS, defaultPayload } from "./fieldConfig";
import CustomerPicker from "./CustomerPicker";
import SmartAutocomplete from "@/components/SmartAutocomplete";
import SpellingAssistInput from "@/components/SpellingAssistInput";
import Toast from "@/components/Toast";
import { createAndSubmitSmartEntry, saveDraftSmartEntry, updateAndRetrySmartEntry } from "@/app/(app)/smart-entry/actions";

const REMEMBER_KEYS = new Set(["zone_id", "payment_method", "method", "category_id", "product_id"]);
function freshPayload(entryType) {
  const base = defaultPayload(entryType);
  if (typeof window === "undefined") return base;
  for (const key of REMEMBER_KEYS) {
    const remembered = localStorage.getItem(`ew-entry-default:${entryType}:${key}`);
    if (remembered && key in base) base[key] = remembered;
  }
  return base;
}

function Field({ field, value, onChange, onCustomerSelect, error, lookups }) {
  const common = { value: value ?? "", onChange: (e) => onChange(field.name, e.target.value) };
  if (field.type === "customer") {
    return <CustomerPicker customers={lookups.customers} value={value} onChange={(id) => onChange(field.name, id)} onSelect={onCustomerSelect} error={error} />;
  }
  if (field.type === "select") {
    const options = field.options || lookups[field.optionsKey] || [];
    return <SmartAutocomplete options={options} value={value} onChange={(next) => onChange(field.name, next)} placeholder={`Search ${field.label.toLowerCase()}…`} labelKey={options.some((o) => o.label) ? "label" : "name"} error={error} />;
  }
  if (field.type === "textarea") return <textarea {...common} rows={2} className={`in ${error ? "border-coral" : ""}`} />;
  if (field.type === "number") return <input type="number" step="any" min={field.min} max={field.max} {...common} className={`in ${error ? "border-coral" : ""}`} />;
  if (field.type === "date") return <input type="date" {...common} className={`in ${error ? "border-coral" : ""}`} />;
  if (field.type === "month") return <input type="month" {...common} onChange={(e) => onChange(field.name, e.target.value ? `${e.target.value}-01` : "")} className={`in ${error ? "border-coral" : ""}`} />;
  return <SpellingAssistInput value={value} onChange={(next) => onChange(field.name, next)} className={`in ${error ? "border-coral" : ""}`} />;
}

function ItemsField({ field, value, onChange, lookups }) {
  const rows = value?.length ? value : [];
  const addRow = () => onChange(field.name, [...rows, {}]);
  const removeRow = (i) => onChange(field.name, rows.filter((_, idx) => idx !== i));
  const duplicateRow = (i) => onChange(field.name, [...rows.slice(0, i + 1), { ...rows[i] }, ...rows.slice(i + 1)]);
  const updateRow = (i, key, v) => onChange(field.name, rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const rowAmount = (row) => (Number(row.quantity || 0) * Number(row.rate || 0)) - Number(row.discount || 0);
  const total = rows.reduce((sum, row) => sum + rowAmount(row), 0);
  return (
    <div className="rounded-xl border border-line overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[480px]">
        <thead><tr className="bg-foam">{field.itemFields.map((f) => <th key={f.name} className="text-left px-2 py-1.5 font-semibold text-slate">{f.label}</th>)}<th className="px-2 text-right font-semibold text-slate">Amount</th><th className="w-16" /></tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {field.itemFields.map((f) => (
                <td key={f.name} className="px-2 py-1.5">
                  {f.type === "select" ? (
                    <SmartAutocomplete options={lookups[f.optionsKey] || []} value={row[f.name] || ""} onChange={(next) => updateRow(i, f.name, next)} placeholder={`Search ${f.label.toLowerCase()}…`} />
                  ) : (
                    <input type={f.type === "number" ? "number" : "text"} step="any" value={row[f.name] ?? ""} onChange={(e) => updateRow(i, f.name, e.target.value)} className="in !py-1 !text-xs" />
                  )}
                </td>
              ))}
              <td className="px-2 text-right font-bold">{rowAmount(row).toLocaleString()}</td>
              <td><div className="flex gap-2"><button type="button" title="Duplicate row" onClick={() => duplicateRow(i)}><Copy size={13} className="text-slate" /></button><button type="button" title="Remove row" onClick={() => removeRow(i)}><Trash2 size={13} className="text-coral" /></button></div></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={field.itemFields.length + 2} className="text-center py-3 text-slate">No items yet.</td></tr>}
        </tbody>
        {rows.length > 0 && <tfoot><tr className="border-t border-line bg-foam"><td colSpan={field.itemFields.length} className="px-2 py-2 text-right font-bold text-slate">Grand Total</td><td className="px-2 py-2 text-right font-extrabold">PKR {total.toLocaleString()}</td><td /></tr></tfoot>}
      </table>
      <button type="button" onClick={addRow} className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-aqua"><Plus size={12} /> Add item</button>
    </div>
  );
}

export default function SingleEntryForm({ entryType, lookups, editEntry, onDone }) {
  const fields = FIELDS[entryType] || [];
  const [payload, setPayload] = useState(() => (editEntry ? { ...freshPayload(entryType), ...editEntry.payload } : freshPayload(entryType)));
  const [errors, setErrors] = useState(editEntry?.validation_errors || {});
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [idempotencyKey] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()));

  useEffect(() => {
    setPayload(editEntry ? { ...freshPayload(entryType), ...editEntry.payload } : freshPayload(entryType));
    setErrors(editEntry?.validation_errors || {});
  }, [entryType, editEntry]);

  const update = (name, value) => {
    setPayload((p) => ({ ...p, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
    if (REMEMBER_KEYS.has(name) && value && typeof window !== "undefined") localStorage.setItem(`ew-entry-default:${entryType}:${name}`, value);
  };
  const autoFillCustomer = (customer) => setPayload((current) => ({
    ...current,
    customer_id: customer.id,
    product_id: current.product_id || customer.default_product_id || "",
    unit_price: current.unit_price || customer.rate || "",
    zone_id: current.zone_id || customer.zone_id || "",
  }));

  const visibleFields = useMemo(() => fields.filter((f) => !f.showIf || f.showIf(payload)), [fields, payload]);
  const summary = useMemo(() => {
    const itemTotal = (payload.items || []).reduce((sum, row) => sum + (Number(row.quantity || 0) * Number(row.rate || 0)) - Number(row.discount || 0), 0);
    if (entryType === "delivery") return [{ label: "Amount", value: `PKR ${(Number(payload.delivered_qty || 0) * Number(payload.unit_price || 0)).toLocaleString()}` }, { label: "Issued", value: payload.delivered_qty || 0 }, { label: "Empty Return", value: payload.empty_received || 0 }];
    if (entryType === "payment") return [{ label: "Payment", value: `PKR ${Number(payload.amount || 0).toLocaleString()}` }, { label: "Mode", value: payload.method || "—" }];
    if (entryType === "expense") return [{ label: "Expense", value: `PKR ${Number(payload.amount || 0).toLocaleString()}` }, { label: "Posting", value: "Expense Ledger" }];
    if (entryType === "bottle") return [{ label: "Net Movement", value: Number(payload.delivered_qty || 0) - Number(payload.returned_qty || 0) + Number(payload.adjustment_qty || 0) }, { label: "Damaged / Lost", value: Number(payload.damaged_qty || 0) + Number(payload.lost_qty || 0) }];
    if (entryType === "employee_salary") return [{ label: "Net Payable", value: `PKR ${Number(payload.net_paid || 0).toLocaleString()}` }, { label: "Period", value: payload.period_month || "—" }];
    if (payload.items) return [{ label: "Lines", value: payload.items.length }, { label: "Subtotal", value: `PKR ${itemTotal.toLocaleString()}` }, { label: "Grand Total", value: `PKR ${Math.max(0, itemTotal - Number(payload.discount || 0) + Number(payload.tax || 0)).toLocaleString()}` }];
    return [{ label: "Status", value: editEntry ? "Edit & Retry" : "Unsaved" }, { label: "Audit", value: "User + Date + Time" }];
  }, [entryType, payload, editEntry]);

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
    setPayload(freshPayload(entryType));
    setErrors({});
    onDone?.(entry);
  };

  const clearForm = () => { setPayload(freshPayload(entryType)); setErrors({}); setWarnings([]); };

  return (
    <div className="erp-entry-form rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div><h3 className="font-display text-base font-semibold">{FIELDS[entryType] ? entryType.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Smart Entry"}</h3><p className="text-[11px] text-slate">Single transaction entry · related modules update after valid posting</p></div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${editEntry ? "bg-amberSoft text-amber" : "bg-aquaSoft text-aqua"}`}>{editEntry ? "Edit & Retry" : "New"}</span>
      </div>
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
              : <Field field={f} value={payload[f.name]} onChange={update} onCustomerSelect={autoFillCustomer} error={errors[f.name]} lookups={lookups} />}
            {errors[f.name] && f.type !== "customer" && <p className="text-coral text-[11px] mt-1">{errors[f.name]}</p>}
          </label>
        ))}
      </div>
      <div className="erp-form-summary">{summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
      <div className="flex flex-wrap gap-2 mt-5">
        <button type="button" disabled={busy} onClick={handleSubmit} className="px-4 py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
          <span className="inline-flex items-center gap-1.5">{editEntry ? <CheckCircle2 size={14} /> : <CheckCircle2 size={14} />}{busy ? "Saving…" : editEntry ? "Save & Retry" : "Submit"}</span>
        </button>
        {!editEntry && (
          <button type="button" disabled={busy} onClick={handleSaveDraft} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line font-semibold text-sm disabled:opacity-60"><FileClock size={14} /> Save Draft</button>
        )}
        <button type="button" disabled={busy} onClick={clearForm} className="px-4 py-2.5 rounded-xl text-slate font-semibold text-sm">Clear</button>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
