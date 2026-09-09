"use client";
import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { getAllOfflineItems } from "@/lib/offlineQueue";
import { syncOfflineQueue } from "@/lib/offlineSync";

// Lives in the app header (always mounted) — this is also where the
// offline queue's lifecycle is driven from: listens for the browser's
// online/offline events and kicks off a sync the moment connectivity
// returns, with no action needed from whoever's using the app. Also
// syncs once on mount, in case the queue still has leftover items from a
// previous session that ended while offline (closed the tab/app before
// reconnecting).
export default function OfflineIndicator() {
  const [pending, setPending] = useState([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    try { setPending(await getAllOfflineItems()); } catch { /* IndexedDB unavailable — nothing to show */ }
  };

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    refresh();

    const handleOnline = async () => {
      setOnline(true);
      setSyncing(true);
      await syncOfflineQueue();
      setSyncing(false);
      refresh();
    };
    const handleOffline = () => setOnline(false);
    const handleQueueChanged = () => refresh();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-queue-changed", handleQueueChanged);

    // Leftover items from a session that ended while still offline.
    if (typeof navigator === "undefined" || navigator.onLine) handleOnline();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-queue-changed", handleQueueChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errored = pending.filter((p) => p.error).length;

  if (online && pending.length === 0) return null;

  return (
    <div
      title={pending.length ? pending.map((p) => p.label || p.type).join(", ") : undefined}
      className={`no-print flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${!online ? "bg-coralSoft text-coral" : errored ? "bg-amberSoft text-amber" : "bg-aquaSoft text-aqua"}`}
    >
      {!online ? <WifiOff size={13} /> : <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />}
      {!online
        ? (pending.length ? `Offline — ${pending.length} pending` : "Offline")
        : pending.length
          ? (syncing ? `Syncing ${pending.length}…` : errored ? `${errored} failed to sync` : `${pending.length} pending sync`)
          : null}
    </div>
  );
}
