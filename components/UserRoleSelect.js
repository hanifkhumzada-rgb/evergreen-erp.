"use client";
import { useState } from "react";
import { updateUserRole } from "@/app/actions";

export default function UserRoleSelect({ userId, currentRole, roles }) {
  const [value, setValue] = useState(currentRole || "");
  const [busy, setBusy] = useState(false);

  const onChange = async (e) => {
    const newRole = e.target.value;
    setValue(newRole);
    setBusy(true);
    await updateUserRole(userId, newRole);
    setBusy(false);
  };

  return (
    <select value={value} onChange={onChange} disabled={busy}
      className="px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold bg-white disabled:opacity-60">
      {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
    </select>
  );
}
