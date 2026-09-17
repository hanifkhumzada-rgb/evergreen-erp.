"use client";
import { useState, useTransition } from "react";
import { Check, CheckCheck } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions";

export function MarkReadButton({ id }) {
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" disabled={pending}
      onClick={() => startTransition(() => markNotificationRead(id))}
      title="Mark as read"
      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border border-line bg-card text-[10px] font-semibold text-slate hover:bg-foam disabled:opacity-60">
      <Check size={11} /> {pending ? "…" : "Read"}
    </button>
  );
}

export function MarkAllReadButton({ count }) {
  const [pending, startTransition] = useTransition();
  if (!count) return null;
  return (
    <button type="button" disabled={pending}
      onClick={() => startTransition(() => markAllNotificationsRead())}
      className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold hover:bg-foam disabled:opacity-60">
      <CheckCheck size={14} /> {pending ? "Marking…" : `Mark all read (${count})`}
    </button>
  );
}
