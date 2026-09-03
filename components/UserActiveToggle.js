"use client";
import { useState } from "react";
import { toggleUserActive } from "@/app/actions";
import { Badge } from "@/components/ui";

export default function UserActiveToggle({ userId, isActive }) {
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onClick = async () => {
    setBusy(true);
    setError("");
    const next = !active;
    const res = await toggleUserActive(userId, next);
    if (res?.error) setError(res.error); else setActive(next);
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" onClick={onClick} disabled={busy} className="disabled:opacity-60">
        <Badge text={active ? "Active" : "Inactive"} tone={active ? "green" : "slate"} />
      </button>
      {error && <span className="text-[11px] text-coral max-w-[180px]">{error}</span>}
    </div>
  );
}
