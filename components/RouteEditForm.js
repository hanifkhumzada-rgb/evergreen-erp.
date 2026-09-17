"use client";
import { useState, useRef } from "react";
import { Pencil, X } from "lucide-react";
import { updateRoute } from "@/app/actions";
import Toast from "@/components/Toast";

export default function RouteEditForm({ route, zones = [], riders = [] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    try {
      const res = await updateRoute(route.id, formData);
      setBusy(false);
      if (res?.error) { setError(res.error); return; }
      setOpen(false);
      setToast({ type: "success", message: "Route updated." });
    } catch {
      setBusy(false);
      setError("Network error — please check your connection and try again.");
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-foam" aria-label="Edit"><Pencil size={13} /></button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">Edit Route</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Route name *</span><input name="name" required defaultValue={route.name || ""} className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Zone</span>
              <select name="zone_id" defaultValue={route.zone_id || ""} className="in">
                <option value="">— none —</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Assigned delivery boy</span>
              <select name="assigned_rider_id" defaultValue={route.assigned_rider_id || ""} className="in">
                <option value="">— unassigned —</option>
                {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Description</span><input name="description" defaultValue={route.description || ""} className="in" /></label>
            <label className="flex items-center gap-2 mb-4"><input type="checkbox" name="is_active" defaultChecked={route.is_active} /><span className="text-xs font-semibold text-slate">Active</span></label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
