"use client";
import { useState } from "react";
import { updateUserRole } from "@/app/actions";

export default function UserRoleSelect({ userId, currentRole, roles }) {
  const [value, setValue] = useState(currentRole || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onChange = async (e) => {
    const newRole = e.target.value;
    const previous = value;
    setValue(newRole);
    setBusy(true);
    setError("");
    const res = await updateUserRole(userId, newRole);
    if (res?.error) { setValue(previous); setError(res.error); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <select value={value} onChange={onChange} disabled={busy}
        className="px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold bg-card disabled:opacity-60">
        {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
      </select>
      {error && <span className="text-[11px] text-coral max-w-[180px]">{error}</span>}
    </div>
  );
}
