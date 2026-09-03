"use client";
import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { inviteUser } from "@/app/actions";

export default function InviteUserForm({ roles }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef();

  const handleSubmit = async (formData) => {
    setError(""); setBusy(true);
    const res = await inviteUser(formData);
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    setResult(res);
    formRef.current?.reset();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy text-white text-xs font-semibold">
        <Plus size={15} /> Invite User
      </button>
      {open && (
        <div className="fixed inset-0 bg-navy/40 z-50 flex items-center justify-center p-4" onClick={() => { setOpen(false); setResult(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-semibold">Invite User</h3>
              <button type="button" onClick={() => { setOpen(false); setResult(null); }}><X size={18} /></button>
            </div>

            {result ? (
              <div className="text-sm">
                <p className="mb-2">User created. Share these login details securely:</p>
                <div className="bg-foam rounded-xl p-3 font-mono-num text-xs mb-3">
                  <div>Email: {result.email}</div>
                  <div>Temp password: {result.tempPassword}</div>
                </div>
                <p className="text-xs text-slate mb-3">Ask them to change this password after first login.</p>
                <button type="button" onClick={() => { setOpen(false); setResult(null); }} className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm">Done</button>
              </div>
            ) : (
              <form ref={formRef} action={handleSubmit}>
                {error && <p className="text-coral text-xs mb-3">{error}</p>}
                <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Full name</span><input name="full_name" required className="in" /></label>
                <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Email</span><input name="email" type="email" required className="in" /></label>
                <label className="block mb-3"><span className="text-xs font-semibold text-slate block mb-1">Phone</span><input name="phone" className="in" /></label>
                <label className="block mb-4"><span className="text-xs font-semibold text-slate block mb-1">Role</span>
                  <select name="role" className="in">
                    {roles.filter((r) => r.key !== "customer").map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                  </select>
                </label>
                <button disabled={busy} type="submit" className="w-full py-2.5 rounded-xl bg-aqua text-white font-bold text-sm disabled:opacity-60">
                  {busy ? "Creating…" : "Create User"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`.in { width:100%; padding:9px 11px; border-radius:9px; border:1px solid var(--line); background: var(--card); color: var(--ink); font-size:13.5px; outline:none; }`}</style>
    </>
  );
}
