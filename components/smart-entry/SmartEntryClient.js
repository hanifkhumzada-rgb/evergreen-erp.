"use client";
import { useMemo, useState } from "react";
import { LayoutGrid, Table2, CheckCircle2, XCircle, PencilLine, History } from "lucide-react";
import { ENTRY_TYPES } from "./fieldConfig";
import SingleEntryForm from "./SingleEntryForm";
import BulkEntryGrid from "./BulkEntryGrid";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import Toast from "@/components/Toast";
import { approveSmartEntry, rejectSmartEntry, deleteSmartEntry, reverseSmartEntry } from "@/app/(app)/smart-entry/actions";

const STATUS_TONE = {
  draft: "bg-[#EEF2F2] text-slate", pending_approval: "bg-amberSoft text-amber",
  approved: "bg-greenSoft text-green", rejected: "bg-coralSoft text-coral", failed: "bg-coralSoft text-coral",
};
const STATUS_LABEL = {
  draft: "Draft", pending_approval: "Pending Approval", approved: "Approved", rejected: "Rejected", failed: "Failed",
};

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SmartEntryClient({ allowedTypes, canApprove, isOwner, lookups, pendingEntries, recentEntries }) {
  const [entryType, setEntryType] = useState(allowedTypes[0]?.value || "delivery");
  const [mode, setMode] = useState("single");
  const [editEntry, setEditEntry] = useState(null);
  const [toast, setToast] = useState(null);
  const config = ENTRY_TYPES.find((t) => t.value === entryType);

  const selectType = (value) => { setEntryType(value); setEditEntry(null); if (!ENTRY_TYPES.find((t) => t.value === value)?.bulk) setMode("single"); };

  const startEditRetry = (entry) => {
    setEntryType(entry.entry_type);
    setMode("single");
    setEditEntry(entry);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const act = async (fn, ...args) => {
    const res = await fn(...args);
    if (res?.error) setToast({ type: "error", message: res.error });
    else setToast({ type: "success", message: "Done." });
  };

  const historyRows = useMemo(() => recentEntries || [], [recentEntries]);

  return (
    <div>
      <div className="no-print flex flex-wrap gap-2 mb-4">
        {allowedTypes.map((t) => (
          <button key={t.value} type="button" onClick={() => selectType(t.value)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition ${entryType === t.value ? "bg-aqua text-white border-aqua" : "border-line bg-card hover:bg-foam"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {editEntry && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-amber/40 bg-amberSoft px-4 py-2.5 text-xs text-amber">
          <span>Editing &amp; retrying <strong>{editEntry.entry_no}</strong> ({STATUS_LABEL[editEntry.status]})</span>
          <button type="button" onClick={() => setEditEntry(null)} className="font-semibold underline">Cancel</button>
        </div>
      )}

      {!editEntry && config?.bulk && (
        <div className="no-print flex gap-2 mb-4">
          <button type="button" onClick={() => setMode("single")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "single" ? "bg-navy text-white border-navy" : "border-line"}`}><LayoutGrid size={13} /> Single Entry</button>
          <button type="button" onClick={() => setMode("bulk")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === "bulk" ? "bg-navy text-white border-navy" : "border-line"}`}><Table2 size={13} /> Bulk Entry</button>
        </div>
      )}

      {mode === "single" || editEntry ? (
        <SingleEntryForm entryType={entryType} lookups={lookups} editEntry={editEntry} onDone={() => setEditEntry(null)} />
      ) : (
        <BulkEntryGrid entryType={entryType} lookups={lookups} />
      )}

      {canApprove && pendingEntries?.length > 0 && (
        <div className="mt-8">
          <h3 className="font-display text-base font-semibold mb-2.5">Pending Approval <span className="text-slate font-normal text-sm">({pendingEntries.length})</span></h3>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-foam"><th className="px-3 py-2 text-left font-semibold text-slate">Ref</th><th className="px-3 py-2 text-left font-semibold text-slate">Type</th><th className="px-3 py-2 text-left font-semibold text-slate">Submitted By</th><th className="px-3 py-2 text-left font-semibold text-slate">Date</th><th className="px-3 py-2 text-left font-semibold text-slate">Actions</th></tr></thead>
              <tbody>
                {pendingEntries.map((e) => (
                  <tr key={e.id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold">{e.entry_no}</td>
                    <td className="px-3 py-2">{ENTRY_TYPES.find((t) => t.value === e.entry_type)?.label}</td>
                    <td className="px-3 py-2">{e.creator_name || "—"}</td>
                    <td className="px-3 py-2">{fmtDateTime(e.submitted_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => act(approveSmartEntry, e.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green text-white text-[11px] font-semibold"><CheckCircle2 size={12} /> Approve</button>
                        <ReasonConfirmButton action={rejectSmartEntry} id={e.id} label="Reject" icon="ban" confirmText={`Reject ${e.entry_no}?`} detailText="The entry stays visible with the rejection reason and never touches the ledger, inventory or reports." confirmLabel="Reject" busyLabel="Rejecting…" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h3 className="no-print font-display text-base font-semibold mb-2.5 flex items-center gap-1.5"><History size={16} /> Recent Entries</h3>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-xs border-collapse">
            <thead><tr className="bg-foam">
              <th className="px-3 py-2 text-left font-semibold text-slate">Ref</th>
              <th className="px-3 py-2 text-left font-semibold text-slate">Type</th>
              <th className="px-3 py-2 text-left font-semibold text-slate">Status</th>
              <th className="px-3 py-2 text-left font-semibold text-slate">Entered By</th>
              <th className="px-3 py-2 text-left font-semibold text-slate">Approved By</th>
              <th className="px-3 py-2 text-left font-semibold text-slate">Date</th>
              <th className="px-3 py-2 text-left font-semibold text-slate">Remarks</th>
              <th className="px-3 py-2 text-left font-semibold text-slate">Actions</th>
            </tr></thead>
            <tbody>
              {historyRows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate">No entries yet.</td></tr>}
              {historyRows.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-3 py-2 font-semibold">{e.entry_no}</td>
                  <td className="px-3 py-2">{ENTRY_TYPES.find((t) => t.value === e.entry_type)?.label}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_TONE[e.status]}`}>{STATUS_LABEL[e.status]}</span></td>
                  <td className="px-3 py-2">{e.creator_name || "—"}</td>
                  <td className="px-3 py-2">{e.approver_name || "—"}</td>
                  <td className="px-3 py-2">{fmtDateTime(e.created_at)}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={e.decision_reason || ""}>{e.decision_reason || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(e.status === "draft" || e.status === "rejected" || e.status === "failed") && (
                        <button type="button" onClick={() => startEditRetry(e)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[11px] font-semibold"><PencilLine size={11} /> Edit &amp; Retry</button>
                      )}
                      {(e.status === "draft" || e.status === "rejected" || e.status === "failed") && (
                        <ReasonConfirmButton action={deleteSmartEntry} id={e.id} label="Delete" icon="trash" confirmText={`Delete ${e.entry_no}?`} detailText="Only unposted entries can be deleted this way." confirmLabel="Delete" busyLabel="Deleting…" />
                      )}
                      {e.status === "approved" && isOwner && (
                        <ReasonConfirmButton action={reverseSmartEntry} id={e.id} label="Reverse" icon="archive" confirmText={`Reverse ${e.entry_no}?`} detailText="Owner-only. Reverses the posted delivery/payment/expense/invoice and keeps a full audit trail. Not yet supported for every entry type." confirmLabel="Reverse" busyLabel="Reversing…" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
