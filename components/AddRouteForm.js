"use client";
import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { createRoute } from "@/app/actions";
import Toast from "@/components/Toast";

export default function AddRouteForm({ zones = [], riders = [] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = await createRoute(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    formRef.current?.reset();
    setToast({ type: "success", message: "Route created." });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> New Route
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">New Route</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Route name *</span><input name="name" required className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Zone</span>
              <select name="zone_id" className="in">
                <option value="">— none —</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Assigned delivery boy</span>
              <select name="assigned_rider_id" className="in">
                <option value="">— unassigned —</option>
                {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Description</span><input name="description" className="in" /></label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save Route"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
