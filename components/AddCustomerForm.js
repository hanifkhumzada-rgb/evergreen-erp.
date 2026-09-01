"use client";
import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { createCustomer } from "@/app/actions";

export default function AddCustomerForm({ zones }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef();

  const handleSubmit = async (formData) => {
    setError("");
    const res = await createCustomer(formData);
    if (res?.error) { setError(res.error); return; }
    setOpen(false);
    formRef.current?.reset();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> New Customer
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form ref={formRef} action={handleSubmit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">New Customer</h3>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
            {error && <p className="text-coral text-xs mb-3">{error}</p>}
            <Field label="Full name"><input name="name" required className="in" /></Field>
            <Field label="Phone"><input name="phone" required className="in" /></Field>
            <Field label="Zone">
              <select name="zone_id" className="in">
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </Field>
            <Field label="Customer type">
              <select name="customer_type" className="in">
                {["Household","Office","Shop","Restaurant","Corporate"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Rate per bottle (PKR)"><input name="rate" type="number" defaultValue={120} className="in" /></Field>
            <Field label="Address"><input name="address" className="in" /></Field>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm mt-2">Save Customer</button>
          </form>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
    </>
  );
}
function Field({ label, children }) {
  return <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">{label}</span>{children}</label>;
}
