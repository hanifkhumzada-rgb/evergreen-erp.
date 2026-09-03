"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteUser } from "@/app/actions";

export default function DeleteUserButton({ userId, userName, isSelf }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onClick = async () => {
    if (isSelf || busy) return;
    if (!window.confirm(`Permanently delete ${userName}? This cannot be undone — their login and profile will be removed immediately.`)) return;
    setBusy(true);
    setError("");
    const res = await deleteUser(userId);
    setBusy(false);
    if (res?.error) setError(res.error);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button"
        onClick={onClick}
        disabled={busy || isSelf}
        title={isSelf ? "You can't delete your own account from this screen" : "Permanently delete this user — cannot be undone"}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-coral text-xs font-semibold hover:bg-coralSoft disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <Trash2 size={13} /> {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="text-[11px] text-coral max-w-[180px]">{error}</span>}
    </div>
  );
}
