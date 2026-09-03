"use client";
import { useState } from "react";
import { Ban, Trash2 } from "lucide-react";

// Shared confirmation-dialog-with-mandatory-reason flow for any destructive
// action that requires a reason — void (voidExpense/voidPayment/
// voidInvoice) or hard delete (deleteVehicle/deleteZone/deleteRoute).
// Every one of those actions also re-validates the reason server-side —
// this is just the UI half of that requirement.
export default function ReasonConfirmButton({
  action, id, label = "Void", confirmText = "Void this record?",
  detailText = "This can't be undone. The original record stays for the audit trail, and its financial effect is reversed.",
  confirmLabel = "Confirm Void", busyLabel = "Voiding…", icon: Icon = Ban,
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) { setError("A reason is required."); return; }
    setBusy(true);
    setError("");
    const res = await action(id, trimmed);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    setReason("");
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-coral text-xs font-semibold hover:bg-coralSoft">
        <Icon size={13} /> {label}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
      <div className="bg-card rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-semibold text-sm mb-1">{confirmText}</p>
        <p className="text-xs text-slate mb-3">{detailText}</p>
        <label className="block mb-3">
          <span className="text-xs font-semibold text-slate block mb-1">Reason (required)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-lg border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-2 focus:ring-aqua/20"
            placeholder="e.g. Duplicate entry, entered in error…" autoFocus />
        </label>
        {error && <p className="text-coral text-xs mb-3">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={busy}
            className="flex-1 py-2 rounded-xl border border-line text-sm font-semibold disabled:opacity-60">Cancel</button>
          <button type="button" onClick={submit} disabled={busy}
            className="flex-1 py-2 rounded-xl bg-coral text-white text-sm font-bold disabled:opacity-60">{busy ? busyLabel : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
