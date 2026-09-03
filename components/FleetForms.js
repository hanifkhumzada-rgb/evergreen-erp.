"use client";
import { useState, useRef } from "react";
import { Plus, X, CalendarClock } from "lucide-react";
import { addVehicle, addVehicleExpense, updateVehicleExpiry } from "@/app/actions";

export function AddVehicleForm({ employees }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();
  const submit = async (fd) => { setBusy(true); await addVehicle(fd); setBusy(false); setOpen(false); formRef.current?.reset(); };
  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold"><Plus size={15} /> Add Vehicle</button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={submit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg font-semibold">Add Vehicle</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Vehicle number</span><input name="vehicle_no" required className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Vehicle type</span><input name="vehicle_type" placeholder="Suzuki Bolan, motorcycle..." className="in" /></label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Driver</span>
              <select name="driver_employee_id" className="in"><option value="">— Unassigned —</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <label className="block"><span className="text-[11px] font-semibold text-slate block mb-1">Insurance expiry</span><input name="insurance_expiry" type="date" className="in" /></label>
              <label className="block"><span className="text-[11px] font-semibold text-slate block mb-1">Registration expiry</span><input name="registration_expiry" type="date" className="in" /></label>
              <label className="block"><span className="text-[11px] font-semibold text-slate block mb-1">Service due</span><input name="service_due_date" type="date" className="in" /></label>
            </div>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save Vehicle"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
    </>
  );
}

export function AddVehicleExpenseForm({ vehicles }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef();
  const submit = async (fd) => { setBusy(true); await addVehicleExpense(fd); setBusy(false); setOpen(false); formRef.current?.reset(); };
  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-line bg-card text-xs font-semibold"><Plus size={15} /> Log Vehicle Expense</button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={submit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg font-semibold">Log Vehicle Expense</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Vehicle</span>
              <select name="vehicle_id" required className="in">{vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicle_no}</option>)}</select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Category</span>
              <select name="category" className="in"><option>Fuel</option><option>Maintenance</option><option>Repair</option><option>Insurance</option></select>
            </label>
            <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Amount (PKR)</span><input name="amount" type="number" required className="in" /></label>
            <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Notes</span><input name="notes" className="in" /></label>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
    </>
  );
}

// Per-row inline editor for the three expiry dates — vehicles added before
// this form existed (or via bulk import, which doesn't carry dates) had no
// way to get them set otherwise.
export function EditVehicleDatesForm({ vehicle }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (fd) => { setBusy(true); await updateVehicleExpiry(vehicle.id, fd); setBusy(false); setOpen(false); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-[11px] text-aqua font-semibold hover:underline">
        <CalendarClock size={12} /> Edit dates
      </button>
    );
  }
  return (
    <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <form action={submit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-sm w-full">
        <div className="flex justify-between items-center mb-4"><h3 className="font-display text-lg font-semibold">{vehicle.registration_no} — dates</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
        <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Insurance expiry</span><input name="insurance_expiry" type="date" defaultValue={vehicle.insurance_expiry || ""} className="in" /></label>
        <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Registration expiry</span><input name="registration_expiry" type="date" defaultValue={vehicle.registration_expiry || ""} className="in" /></label>
        <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Service due</span><input name="service_due_date" type="date" defaultValue={vehicle.service_due_date || ""} className="in" /></label>
        <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
      </form>
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
    </div>
  );
}
