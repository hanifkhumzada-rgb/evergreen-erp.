"use client";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { approveExpense, rejectExpense } from "@/app/actions";
import { pkr, fmtDate } from "@/lib/format";
import Toast from "@/components/Toast";

function ApprovalRow({ expense }) {
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  const act = async (action, fn) => {
    setBusy(action);
    const res = await fn(expense.id);
    setBusy(null);
    if (res?.error) setToast({ type: "error", message: res.error });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-line last:border-b-0">
      <div className="flex-1 min-w-[180px]">
        <div className="text-sm font-semibold">{expense.description || expense.expense_categories?.name || "Expense"}</div>
        <div className="text-xs text-slate">{expense.expense_categories?.name} · {fmtDate(expense.expense_date)}</div>
      </div>
      <div className="font-mono-num text-sm font-semibold flex-shrink-0">{pkr(expense.amount)}</div>
      <div className="flex gap-2 flex-shrink-0">
        <button type="button"
          onClick={() => act("approve", approveExpense)}
          disabled={!!busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green text-white text-xs font-semibold disabled:opacity-60"
        ><CheckCircle2 size={14} /> {busy === "approve" ? "Approving…" : "Approve"}</button>
        <button type="button"
          onClick={() => act("reject", rejectExpense)}
          disabled={!!busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-coral text-white text-xs font-semibold disabled:opacity-60"
        ><XCircle size={14} /> {busy === "reject" ? "Rejecting…" : "Reject"}</button>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default function PendingApprovals({ expenses }) {
  if (!expenses.length) return null;
  return (
    <div className="border border-line rounded-2xl p-5 mb-4 border-t-2 border-t-amber">
      <h4 className="text-sm font-bold mb-1">Pending Approvals</h4>
      <p className="text-xs text-slate mb-1">
        These expenses are above the approval threshold and are on hold — nothing has posted to the books yet.
      </p>
      <div>
        {expenses.map((e) => <ApprovalRow key={e.id} expense={e} />)}
      </div>
    </div>
  );
}
