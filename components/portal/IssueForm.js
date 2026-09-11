"use client";
import { useState } from "react";
import { submitCustomerIssue } from "@/app/portal/actions";

const ISSUE_TYPES = ["Extra Order Request", "Pause Delivery", "Resume Delivery", "Missed Delivery", "Wrong Quantity", "Quality Issue", "Billing Discrepancy", "Bottle Return Dispute", "Other"];

export default function IssueForm({ deliveries, defaultDeliveryId, defaultType }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setStatus(null);
    const res = await submitCustomerIssue(formData);
    setLoading(false);
    setStatus(res.ok ? "success" : res.error || "error");
    if (res.ok) document.getElementById("issue-form")?.reset();
  };

  return (
    <form id="issue-form" action={handleSubmit} className="bg-card border border-line rounded-2xl p-4 flex flex-col gap-3">
      <h2 className="text-sm font-bold">Report an Issue</h2>
      <label className="block">
        <span className="text-xs font-semibold text-slate block mb-1.5">Issue Type</span>
        <select name="issue_type" required defaultValue={ISSUE_TYPES.includes(defaultType) ? defaultType : ISSUE_TYPES[0]} className="w-full px-3 py-2.5 rounded-xl border border-line bg-card text-sm">
          {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      {deliveries?.length > 0 && (
        <label className="block">
          <span className="text-xs font-semibold text-slate block mb-1.5">Related Delivery (optional)</span>
          <select name="delivery_id" defaultValue={defaultDeliveryId || ""} className="w-full px-3 py-2.5 rounded-xl border border-line bg-card text-sm">
            <option value="">None</option>
            {deliveries.map((d) => <option key={d.id} value={d.id}>{d.delivery_no} — {d.delivery_date}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-xs font-semibold text-slate block mb-1.5">Description</span>
        <textarea name="description" required rows={3} className="w-full px-3 py-2.5 rounded-xl border border-line bg-card text-sm" placeholder="Tell us what happened..." />
      </label>
      {status === "success" && <p className="text-green text-xs bg-greenSoft px-3 py-2 rounded-lg">Issue reported. Our team will review it shortly.</p>}
      {status && status !== "success" && <p className="text-coral text-xs bg-coralSoft px-3 py-2 rounded-lg">{status}</p>}
      <button disabled={loading} className="py-2.5 rounded-xl bg-navyLight text-white text-xs font-bold disabled:opacity-60">
        {loading ? "Submitting…" : "Submit Issue"}
      </button>
    </form>
  );
}
