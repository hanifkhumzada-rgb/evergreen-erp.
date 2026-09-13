"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Plus, UserPlus, Truck, Receipt, Wallet, FilePlus2, ClipboardCheck, X, PencilLine } from "lucide-react";

const ACTIONS = [
  { label: "New customer", href: "/customers?quick=new", icon: UserPlus, roles: ["owner", "admin", "manager"], permission: "customers.create" },
  { label: "Record delivery", href: "/deliveries?quick=new", icon: Truck, roles: ["owner", "admin", "manager"], permission: "deliveries.create" },
  { label: "Correct delivery", href: "/delivery-corrections", icon: PencilLine, roles: ["owner", "admin", "manager"], permission: "deliveries.edit" },
  { label: "Receive payment", href: "/payments?quick=new", icon: Receipt, roles: ["owner", "admin", "accountant"], permission: "payments.create" },
  { label: "Add expense", href: "/expenses?quick=new", icon: Wallet, roles: ["owner", "admin", "manager", "accountant"], permission: "expenses.create" },
  { label: "Create invoice", href: "/invoices?quick=new", icon: FilePlus2, roles: ["owner", "admin", "manager", "accountant"], permission: "invoices.create" },
  { label: "Close today", href: "/accounting/daily-closing", icon: ClipboardCheck, roles: ["owner", "admin", "accountant"], permission: "cash.manage" },
];

export default function QuickAdd({ role, permissions = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const permissionSet = new Set(permissions || []);
  const actions = ACTIONS.filter((action) => action.roles.includes(role) || permissionSet.has(action.permission));

  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape" || (event.type === "mousedown" && !rootRef.current?.contains(event.target))) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("mousedown", close);
    };
  }, []);

  if (!actions.length) return null;
  return (
    <div ref={rootRef} className="quick-add-root no-print fixed bottom-5 right-5 z-40 sm:bottom-7 sm:right-7">
      {open && (
        <div className="mb-3 w-72 overflow-hidden rounded-2xl border border-line bg-card p-2 shadow-2xl shadow-navy/20">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div><p className="text-sm font-bold">Quick Add</p><p className="text-[11px] text-slate">Only actions you can access are shown</p></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-foam" aria-label="Close quick add"><X size={15} /></button>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {actions.map((action) => {
              const Icon = action.icon;
              return <Link key={action.href} href={action.href} onClick={() => setOpen(false)} className="flex min-h-20 flex-col justify-between rounded-xl border border-line bg-foam/50 p-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:border-aqua/40 hover:bg-aquaSoft">
                <Icon size={17} className="text-aqua" /><span>{action.label}</span>
              </Link>;
            })}
          </div>
        </div>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-aqua to-[#087C69] px-4 py-3 text-sm font-bold text-white shadow-xl shadow-aqua/25 transition hover:-translate-y-0.5 hover:shadow-2xl">
        <Plus size={19} className={`transition-transform ${open ? "rotate-45" : ""}`} /> Quick Add
      </button>
      <style jsx global>{`.pdf-preview-open .quick-add-root { display: none !important; }`}</style>
    </div>
  );
}
