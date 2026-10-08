"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw } from "lucide-react";

export default function ErpRefreshButton() {
  const router = useRouter();
  const timerRef = useRef(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const refreshErp = () => {
    if (status === "refreshing") return;

    setStatus("refreshing");
    router.refresh();

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStatus("done");
      timerRef.current = setTimeout(() => setStatus("idle"), 1200);
    }, 650);
  };

  const refreshing = status === "refreshing";

  return (
    <button
      type="button"
      onClick={refreshErp}
      disabled={refreshing}
      className="topbar-icon-btn inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition-colors disabled:cursor-wait"
      title="Refresh ERP data"
      aria-label={refreshing ? "Refreshing ERP data" : "Refresh ERP data"}
      aria-live="polite"
    >
      {status === "done" ? (
        <Check size={17} aria-hidden="true" />
      ) : (
        <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
      )}
      <span className="hidden 2xl:inline">
        {refreshing ? "Refreshing…" : status === "done" ? "Updated" : "Refresh"}
      </span>
    </button>
  );
}
