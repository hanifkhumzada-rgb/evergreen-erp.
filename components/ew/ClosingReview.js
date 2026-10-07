"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { reviewDailyClosing } from "@/app/actions";

// Approve / Reject a daily closing (Owner/Admin; enforced in the database).
export default function ClosingReview({ id }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const act = (approve) => {
    const note = approve ? "" : window.prompt("Reason for rejecting this closing?") || "";
    if (!approve && note.trim().length < 3) return;
    setError("");
    start(async () => {
      const res = await reviewDailyClosing(id, approve, note);
      if (res?.error) setError(res.error); else router.refresh();
    });
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={pending} onClick={() => act(true)} className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-green px-2.5 text-xs font-bold text-white disabled:opacity-60">{pending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve</button>
      <button type="button" disabled={pending} onClick={() => act(false)} className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-coral/40 px-2.5 text-xs font-bold text-coral disabled:opacity-60"><XCircle size={13} /> Reject</button>
      {error ? <span className="w-full text-[11px] text-coral">{error}</span> : null}
    </span>
  );
}
