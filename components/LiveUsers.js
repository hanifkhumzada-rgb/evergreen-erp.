"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, CircleUserRound, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const PAGE_NAMES = {
  "/dashboard": "Dashboard",
  "/operations": "Daily Operations",
  "/smart-entry": "Smart Entry",
  "/customers": "Customers",
  "/deliveries": "Deliveries",
  "/tracking": "Live Tracking",
  "/production": "Production & Filling",
  "/inventory": "Purchases & Stock",
  "/sales": "Sales",
  "/invoices": "Invoices & Billing",
  "/payments": "Payments",
  "/expenses": "Expenses",
  "/ledger": "Customer Ledger",
  "/employees": "Employees",
  "/fleet": "Fleet",
  "/reports": "Reports",
  "/settings": "Settings",
  "/user-management": "User Management",
};

function pageName(pathname) {
  const key = Object.keys(PAGE_NAMES)
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (key) return PAGE_NAMES[key];
  return pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "ERP";
}

function normalizePresence(state) {
  const latestByUser = new Map();
  Object.values(state || {}).flat().forEach((entry) => {
    if (!entry?.user_id) return;
    const previous = latestByUser.get(entry.user_id);
    if (!previous || String(entry.last_active) > String(previous.last_active)) latestByUser.set(entry.user_id, entry);
  });
  return [...latestByUser.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === "online" ? -1 : 1;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function activityLabel(value) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Active now";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ago`;
}

export default function LiveUsers({ userId, businessId, name, role, canView }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef(null);
  const payloadRef = useRef(null);
  const onlineSince = useRef(new Date().toISOString());
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);

  const buildPayload = () => ({
    user_id: userId,
    name: name || "ERP User",
    role: role || "Staff",
    page: pageName(pathname),
    path: pathname,
    status: document.visibilityState === "hidden" ? "away" : "online",
    online_at: onlineSince.current,
    last_active: new Date().toISOString(),
  });

  useEffect(() => {
    if (!userId || !businessId) return undefined;
    payloadRef.current = buildPayload();
    const channel = supabase.channel(`erp-presence:${businessId}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => setUsers(normalizePresence(channel.presenceState())))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track(payloadRef.current);
      });

    return () => {
      channelRef.current = null;
      channel.untrack();
      supabase.removeChannel(channel);
    };
    // One presence connection per signed-in app session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId, businessId]);

  useEffect(() => {
    const updatePresence = () => {
      payloadRef.current = buildPayload();
      channelRef.current?.track(payloadRef.current);
    };
    updatePresence();
    document.addEventListener("visibilitychange", updatePresence);
    window.addEventListener("focus", updatePresence);
    const heartbeat = window.setInterval(updatePresence, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", updatePresence);
      window.removeEventListener("focus", updatePresence);
      window.clearInterval(heartbeat);
    };
    // Route changes update the current module without reconnecting the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, name, role]);

  if (!canView) return null;

  const onlineCount = users.filter((user) => user.status === "online").length;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="topbar-icon-btn flex h-10 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold"
        aria-label={`${onlineCount} users live in ERP`}
        aria-expanded={open}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
        </span>
        <span className="hidden lg:inline">Live</span>
        <span className="grid min-w-5 place-items-center topbar-chip rounded-full px-1.5 py-0.5 text-[10px]">{onlineCount}</span>
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close live users" />
          <section className="fixed inset-x-3 top-[68px] z-50 max-h-[70vh] overflow-hidden rounded-2xl border border-line bg-card text-navy shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[360px]" aria-label="Live ERP users">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold"><Activity size={16} className="text-emerald-500" /> Live ERP Users</p>
                <p className="mt-0.5 text-[11px] text-slate">{onlineCount} online now · {users.length - onlineCount} away</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-mist" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {users.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate">Connecting to live users…</p>
              ) : users.map((user) => (
                <div key={user.user_id} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-mist/70">
                  <div className="relative grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-aqua/10 text-aqua">
                    <CircleUserRound size={19} />
                    <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card ${user.status === "online" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{user.name}{user.user_id === userId ? " (You)" : ""}</p>
                      <span className="flex-shrink-0 text-[10px] text-slate">{activityLabel(user.last_active)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate">{user.role} · {user.page}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
