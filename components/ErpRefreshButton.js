"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, RefreshCw } from "lucide-react";

const AUTO_REFRESH_KEY = "ew-erp-auto-refresh-ms";
const OPTIONS = [
  { label: "Off", value: 0 },
  { label: "Every 30 sec", value: 30000 },
  { label: "Every 1 min", value: 60000 },
  { label: "Every 5 min", value: 300000 },
];

export default function ErpRefreshButton() {
  const router = useRouter();
  const timerRef = useRef(null);
  const rootRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [open, setOpen] = useState(false);
  const [autoRefreshMs, setAutoRefreshMs] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem(AUTO_REFRESH_KEY));
    if (OPTIONS.some((option) => option.value === saved)) setAutoRefreshMs(saved);
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => { clearTimeout(timerRef.current); document.removeEventListener("pointerdown", close); };
  }, []);

  useEffect(() => {
    if (!autoRefreshMs) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        setStatus("refreshing");
        router.refresh();
        setLastUpdated(new Date());
        timerRef.current = window.setTimeout(() => setStatus("idle"), 700);
      }
    }, autoRefreshMs);
    return () => window.clearInterval(id);
  }, [autoRefreshMs, router]);

  const refreshErp = () => {
    if (status === "refreshing") return;

    setStatus("refreshing");
    router.refresh();
    setLastUpdated(new Date());

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStatus("done");
      timerRef.current = setTimeout(() => setStatus("idle"), 1200);
    }, 650);
  };

  const refreshing = status === "refreshing";

  const selectAutoRefresh = (value) => {
    setAutoRefreshMs(value);
    localStorage.setItem(AUTO_REFRESH_KEY, String(value));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex" aria-live="polite">
      <button type="button" onClick={refreshErp} disabled={refreshing}
        className="topbar-icon-btn inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-l-xl px-2.5 text-xs font-semibold transition-colors disabled:cursor-wait"
        title={lastUpdated ? `Refresh ERP data · last updated ${lastUpdated.toLocaleTimeString()}` : "Refresh ERP data"}
        aria-label={refreshing ? "Refreshing ERP data" : "Refresh ERP data"}>
        {status === "done" ? <Check size={17} aria-hidden="true" /> : <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />}
        <span className="hidden 2xl:inline">{refreshing ? "Refreshing…" : status === "done" ? "Updated" : "Refresh"}</span>
      </button>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu"
        className="topbar-icon-btn -ml-px grid h-10 w-7 place-items-center rounded-r-xl border-l border-line" title="Refresh options" aria-label="Refresh options">
        <ChevronDown size={13}/>
      </button>
      {open ? <div role="menu" className="absolute right-0 top-full z-[90] mt-2 w-52 rounded-xl border border-line bg-card p-2 text-ink shadow-2xl">
        <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate">Auto refresh</p>
        {OPTIONS.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={autoRefreshMs === option.value}
          onClick={() => selectAutoRefresh(option.value)} className={`flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 text-left text-xs ${autoRefreshMs === option.value ? "bg-aquaSoft font-bold text-aqua" : "hover:bg-foam"}`}>
          {option.label}{autoRefreshMs === option.value ? <Check size={13}/> : null}
        </button>)}
        <p className="mt-1 border-t border-line px-2 pt-2 text-[10px] leading-relaxed text-slate">Refresh pauses automatically when this tab is hidden or offline.</p>
      </div> : null}
    </div>
  );
}
