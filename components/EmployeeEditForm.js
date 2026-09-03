"use client";
import { useState, useRef } from "react";
import { Pencil, X } from "lucide-react";
import { updateEmployeeProfile } from "@/app/actions";
import Toast from "@/components/Toast";

export default function EmployeeEditForm({ employee, zones = [], vehicles = [] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();

  const handleSubmit = async (formData) => {
    setError("");
    setBusy(true);
    const res = await updateEmployeeProfile(employee.id, formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    setToast({ type: "success", message: "Employee updated." });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-foam" aria-label="Edit"><Pencil size={13} /></button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">Edit {employee.full_name}</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Employee ID</span><input name="employee_code" defaultValue={employee.employee_code || ""} className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Joining date</span><input name="joining_date" type="date" defaultValue={employee.joining_date || ""} className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Salary / wage (PKR)</span><input name="salary" type="number" min={0} defaultValue={employee.salary || ""} className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Zone</span>
              <select name="zone_id" defaultValue={employee.zone_id || ""} className="in">
                <option value="">— none —</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Assigned vehicle</span>
              <select name="assigned_vehicle_id" defaultValue={employee.assigned_vehicle_id || ""} className="in">
                <option value="">— none —</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registration_no}</option>)}
              </select>
            </label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </>
  );
}
