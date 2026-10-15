"use client";

import { useState } from "react";
import { submitProfileCorrection } from "@/app/portal/actions";

export default function ProfileCorrectionForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function submit(formData) { setBusy(true); setResult(null); const response = await submitProfileCorrection(formData); setBusy(false); setResult(response); }
  return <form action={submit} className="rounded-2xl border border-line bg-card p-4 space-y-3">
    <div><h2 className="text-sm font-bold">Request Profile Correction</h2><p className="mt-1 text-[11px] text-slate">Changes are reviewed before your customer record is updated.</p></div>
    <label><span className="mb-1 block text-xs font-semibold text-slate">Field</span><select name="field" required className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm"><option value="">Select field</option><option>Name</option><option>Mobile Number</option><option>Building / Society</option><option>Flat / House Number</option><option>Delivery Address</option></select></label>
    <label><span className="mb-1 block text-xs font-semibold text-slate">Correct Information</span><input name="requested_value" required className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm" /></label>
    <label><span className="mb-1 block text-xs font-semibold text-slate">Reason (optional)</span><textarea name="reason" rows="2" className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm" /></label>
    {result && <p className={`rounded-xl px-3 py-2 text-xs ${result.ok ? "bg-greenSoft text-green" : "bg-coralSoft text-coral"}`}>{result.ok ? "Correction request submitted for review." : result.error}</p>}
    <button disabled={busy} className="w-full rounded-xl border border-aqua bg-aquaSoft px-4 py-3 text-xs font-bold text-aqua disabled:opacity-60">{busy ? "Submitting…" : "Request Correction"}</button>
  </form>;
}
