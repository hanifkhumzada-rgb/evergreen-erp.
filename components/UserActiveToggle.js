"use client";
import { useState } from "react";
import { toggleUserActive } from "@/app/actions";
import { Badge } from "@/components/ui";

export default function UserActiveToggle({ userId, isActive }) {
  const [active, setActive] = useState(isActive);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    const next = !active;
    await toggleUserActive(userId, next);
    setActive(next);
    setBusy(false);
  };

  return (
    <button onClick={onClick} disabled={busy} className="disabled:opacity-60">
      <Badge text={active ? "Active" : "Inactive"} tone={active ? "green" : "slate"} />
    </button>
  );
}
