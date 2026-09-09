"use client";
import { useState } from "react";
import { updateCustomerIssueStatus } from "@/app/actions";

const STATUSES = ["open", "under_review", "resolved", "rejected"];
const STATUS_LABEL = { open: "Open", under_review: "Under Review", resolved: "Resolved", rejected: "Rejected" };

export default function IssueStatusForm({ issue }) {
  const [status, setStatus] = useState(issue.status);
  const [note, setNote] = useState(issue.resolution_note || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const needsNote = status === "resolved" || status === "rejected";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await updateCustomerIssueStatus(issue.id, status, note);
    setSaving(false);
    if (res?.error) setError(res.error);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
      <div className="flex gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-1 px-2.5 py-1.5 rounded-lg border border-line bg-card text-xs">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button disabled={saving} type="submit" className="px-3 py-1.5 rounded-lg bg-navyLight text-white text-xs font-semibold disabled:opacity-60">
          {saving ? "Saving…" : "Update"}
        </button>
      </div>
      {needsNote && (
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} required
          placeholder="Resolution note (required)"
          className="w-full px-2.5 py-1.5 rounded-lg border border-line bg-card text-xs" />
      )}
      {error && <p className="text-coral text-[11px]">{error}</p>}
    </form>
  );
}
