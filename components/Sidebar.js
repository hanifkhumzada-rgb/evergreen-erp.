"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { signOut } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Home, Users, Truck, Droplet, Package, Wallet, Receipt, ReceiptText,
  BookOpen, UserCog, BarChart3, Settings, LogOut, Landmark, FileText,
  Scale, TrendingUp, ClipboardCheck, Car, Bot, Bell, MapPin, Menu, X,
  ChevronRight, ChevronLeft, Factory, FolderInput, ShieldCheck, Navigation,
  Zap, MessageSquare, LifeBuoy, Star, Megaphone, Files, BriefcaseBusiness,
  ChevronDown, Search, CalendarCheck, Wrench, Sparkles,
} from "lucide-react";

const SidebarContext = createContext(null);
const OWNER_ROLES = ["owner", "admin"];

export function SidebarProvider({ children }) {
  const [open, setOpen] = useState(false);
  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

export function SidebarToggleButton() {
  const { open, setOpen } = useContext(SidebarContext);
  return (
    <button type="button" onClick={() => setOpen(!open)} className="no-print md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-foam" aria-label="Toggle menu">
      {open ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
}

const NAV = [
  { type: "link", href: "/dashboard", label: "Dashboard", icon: Home, roles: [...OWNER_ROLES, "manager", "accountant"] },
  { type: "link", href: "/smart-entry", label: "Smart Entry", icon: Sparkles, roles: [...OWNER_ROLES, "manager", "accountant", "rider"] },
  { type: "group", key: "operations", label: "Operations", icon: Truck, items: [
    { href: "/operations", label: "Daily Operations", icon: CalendarCheck, roles: [...OWNER_ROLES, "manager", "accountant"] },
    { href: "/customers", label: "Customers", icon: Users, roles: [...OWNER_ROLES, "manager"] },
    { href: "/deliveries", label: "Deliveries", icon: Truck, roles: [...OWNER_ROLES, "manager", "rider"] },
    { href: "/delivery-corrections", label: "Delivery Corrections", icon: Wrench, roles: [...OWNER_ROLES, "manager"] },
    { href: "/bottle-ledger", label: "Bottle Inventory", icon: Droplet, roles: [...OWNER_ROLES, "manager"] },
    { href: "/production", label: "Production & Filling", icon: Factory, roles: [...OWNER_ROLES, "manager", "accountant"] },
    { href: "/inventory", label: "Purchases & Stock", icon: Package, roles: [...OWNER_ROLES, "manager"] },
    { href: "/zones", label: "Zones & Routes", icon: MapPin, roles: [...OWNER_ROLES, "manager"] },
  ]},
  { type: "group", key: "money", label: "Sales & Finance", icon: Wallet, items: [
    { href: "/sales", label: "Sales", icon: ReceiptText, roles: [...OWNER_ROLES, "manager", "accountant"] },
    { href: "/invoices", label: "Invoices & Billing", icon: ReceiptText, roles: [...OWNER_ROLES, "manager", "accountant"] },
    { href: "/payments", label: "Payments", icon: Receipt, roles: [...OWNER_ROLES, "accountant"] },
    { href: "/expenses", label: "Expenses", icon: Wallet, roles: [...OWNER_ROLES, "manager", "accountant"] },
    { href: "/ledger", label: "Customer Ledger", icon: BookOpen, roles: [...OWNER_ROLES, "accountant"] },
  ]},
  { type: "group", key: "team-fleet", label: "Team & Fleet", icon: BriefcaseBusiness, items: [
    { href: "/employees", label: "Employees", icon: UserCog, roles: [...OWNER_ROLES, "manager"] },
    { href: "/fleet", label: "Fleet", icon: Car, roles: [...OWNER_ROLES, "manager"] },
    { href: "/tracking", label: "Live Tracking", icon: Navigation, roles: [...OWNER_ROLES, "manager"] },
  ]},
  { type: "group", key: "accounting-finance", label: "Accounting & Finance", icon: Landmark, items: [
    { href: "/accounting/chart-of-accounts", label: "Chart of Accounts", icon: Landmark, roles: [...OWNER_ROLES, "accountant"] },
    { href: "/accounting/journal", label: "Journal Entries", icon: FileText, roles: [...OWNER_ROLES, "accountant"] },
    { href: "/accounting/trial-balance", label: "Trial Balance", icon: Scale, roles: [...OWNER_ROLES, "accountant"] },
    { href: "/accounting/profit-loss", label: "Profit & Loss", icon: TrendingUp, roles: [...OWNER_ROLES, "accountant"] },
    { href: "/accounting/balance-sheet", label: "Balance Sheet", icon: Scale, roles: [...OWNER_ROLES, "accountant"] },
    { href: "/accounting/daily-closing", label: "Daily Closing", icon: ClipboardCheck, roles: [...OWNER_ROLES, "accountant"] },
    { href: "/reports", label: "Reports & Performance", icon: BarChart3, roles: [...OWNER_ROLES, "manager", "accountant"] },
  ]},
  { type: "group", key: "growth", label: "Growth & Automation", icon: Zap, items: [
    { href: "/ai", label: "Evergreen AI", icon: Bot, roles: [...OWNER_ROLES, "manager", "accountant"] },
    { href: "/marketing", label: "Marketing Studio", icon: Megaphone, roles: [...OWNER_ROLES, "manager"] },
    { href: "/notifications", label: "Alerts & Notifications", icon: Bell, roles: [...OWNER_ROLES, "manager", "accountant"] },
    { href: "/automation", label: "Automation Center", icon: Zap, roles: OWNER_ROLES },
    { href: "/communication", label: "Communication Center", icon: MessageSquare, roles: OWNER_ROLES },
    { href: "/issues", label: "Customer Issues", icon: LifeBuoy, roles: [...OWNER_ROLES, "manager"] },
    { href: "/customer-feedback", label: "Customer Feedback", icon: Star, roles: [...OWNER_ROLES, "manager"] },
    { href: "/documents", label: "Record Preview Hub", icon: Files, roles: [...OWNER_ROLES, "manager", "accountant"] },
  ]},
  { type: "group", key: "system", label: "System", icon: Settings, items: [
    { href: "/user-management", label: "User Management", icon: UserCog, roles: OWNER_ROLES },
    { href: "/user-management/permissions", label: "Permissions", icon: ShieldCheck, roles: OWNER_ROLES },
    { href: "/audit-logs", label: "Audit Logs", icon: FileText, roles: OWNER_ROLES },
    { href: "/settings/export", label: "Import/Export", icon: FolderInput, roles: OWNER_ROLES },
    { href: "/settings", label: "Settings", icon: Settings, roles: OWNER_ROLES },
  ]},
];

const PERMISSION_BY_HREF = {
  "/smart-entry": "smart_entry.view",
  "/customers": "customers.view",
  "/deliveries": "deliveries.view",
  "/delivery-corrections": "deliveries.edit",
  "/bottle-ledger": "bottles.view",
  "/inventory": "inventory.view",
  "/sales": "invoices.view",
  "/invoices": "invoices.view",
  "/payments": "payments.view",
  "/expenses": "expenses.view",
  "/ledger": "customers.view",
  "/fleet": "vehicles.view",
  "/tracking": "gps.view",
  "/reports": "reports.view",
  "/ai": "ai.view",
  "/user-management": "users.manage",
  "/user-management/permissions": "users.manage",
  "/audit-logs": "audit.view",
  "/settings/export": "settings.manage",
  "/settings": "settings.manage",
};

function canSee(item, normalizedRole, permissionSet) {
  const permission = PERMISSION_BY_HREF[item.href];
  if (permission) return permissionSet.has(permission);
  return item.roles?.includes(normalizedRole);
}

function visibleEntries(role, permissions = []) {
  const normalizedRole = (Array.isArray(role) ? role[0]?.key : role?.key || role)?.toString().trim().toLowerCase();
  const permissionSet = new Set(permissions || []);
  return NAV.map((entry) => {
    if (entry.type === "link") return canSee(entry, normalizedRole, permissionSet) ? entry : null;
    const items = entry.items.filter((item) => canSee(item, normalizedRole, permissionSet));
    return items.length ? { ...entry, items } : null;
  }).filter(Boolean);
}

function isEntryActive(entry, pathname) {
  return entry.type === "link" ? pathname.startsWith(entry.href) : entry.items.some((item) => pathname.startsWith(item.href));
}

function NotifBadge({ count }) {
  if (!count) return null;
  return <span className="flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-coral text-white text-[10px] font-bold">{count > 99 ? "99+" : count}</span>;
}

function NavList({ entries, pathname, unreadNotifications, onNavigate }) {
  const activeGroup = entries.find((entry) => entry.type === "group" && isEntryActive(entry, pathname))?.key;
  const [opened, setOpened] = useState(activeGroup || "operations");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.trim().toLowerCase();
    return entries.map((entry) => {
      if (entry.type === "link") return entry.label.toLowerCase().includes(q) ? entry : null;
      const items = entry.items.filter((item) => item.label.toLowerCase().includes(q) || entry.label.toLowerCase().includes(q));
      return items.length ? { ...entry, items } : null;
    }).filter(Boolean);
  }, [entries, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label className="relative block px-0.5">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8FB8B3]" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a workspace…" className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white outline-none placeholder:text-[#8FB8B3] focus:border-aqua/60 focus:bg-white/10" />
      </label>
      <div className="nav-scroll flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {filtered.map((entry) => {
          if (entry.type === "link") {
            const Icon = entry.icon;
            const active = pathname.startsWith(entry.href);
            return <Link key={entry.href} href={entry.href} onClick={onNavigate} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12.5px] font-semibold ${active ? "bg-gradient-to-r from-aqua to-[#087C69] text-white" : "text-[#C7DEDC] hover:bg-white/5"}`}><Icon size={15} /><span className="flex-1">{entry.label}</span></Link>;
          }
          const active = isEntryActive(entry, pathname);
          const expanded = Boolean(query.trim()) || opened === entry.key || active;
          const GroupIcon = entry.icon;
          return (
            <div key={entry.key}>
              <button type="button" onClick={() => setOpened(expanded ? null : entry.key)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold ${active ? "bg-white/10 text-white" : "text-[#A8CBC7] hover:bg-white/5"}`}>
                <GroupIcon size={16} /><span className="flex-1 text-left">{entry.label}</span><ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && <div className="flex flex-col gap-0.5 pl-2 mt-1">{entry.items.map((item) => {
                const Icon = item.icon;
                const itemActive = pathname.startsWith(item.href);
                return <Link key={item.href} href={item.href} onClick={onNavigate} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12.5px] font-semibold ${itemActive ? "bg-gradient-to-r from-aqua to-[#087C69] text-white" : "text-[#C7DEDC] hover:bg-white/5"}`}><Icon size={15} /><span className="flex-1">{item.label}</span>{item.href === "/notifications" && <NotifBadge count={unreadNotifications} />}</Link>;
              })}</div>}
            </div>
          );
        })}
        {!filtered.length && <p className="px-3 py-5 text-center text-xs text-[#8FB8B3]">No workspace found.</p>}
      </div>
    </div>
  );
}

function RailNav({ entries, pathname, unreadNotifications }) {
  const flat = entries.flatMap((entry) => entry.type === "link" ? [entry] : entry.items);
  return (
    <div className="flex flex-col items-center gap-1 flex-1 overflow-y-auto w-full">
      {flat.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} title={item.label} className={`relative w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 ${active ? "bg-aqua text-white" : "text-[#C7DEDC] hover:bg-white/10"}`}><Icon size={18} />{item.href === "/notifications" && unreadNotifications > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral" />}</Link>;
      })}
    </div>
  );
}

function BrandHeader({ onCollapse }) {
  return (
    <div className="flex items-center gap-2 px-1.5 pb-4">
      <Image src="/ew-mark.svg" width={36} height={36} alt="Evergreen Water" className="rounded-xl flex-shrink-0" priority unoptimized />
      <span className="font-display font-semibold text-sm leading-tight flex-1">Evergreen Water</span>
      <ThemeToggle className="text-[#C7DEDC] hover:bg-white/10" />
      {onCollapse && <button type="button" onClick={onCollapse} title="Collapse sidebar" className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C7DEDC] hover:bg-white/10"><ChevronLeft size={16} /></button>}
    </div>
  );
}

export default function Sidebar({ role, permissions = [], unreadNotifications = 0 }) {
  const pathname = usePathname();
  const { open, setOpen } = useContext(SidebarContext);
  const [pinned, setPinned] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPinned(localStorage.getItem("sidebarPinned") === "1");
    setMounted(true);
  }, []);

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    localStorage.setItem("sidebarPinned", next ? "1" : "0");
  };

  const entries = visibleEntries(role, permissions);
  const expanded = mounted && pinned;

  return (
    <>
      {open && <div className="no-print fixed inset-0 bg-navy/40 z-40 md:hidden" onClick={() => setOpen(false)} />}
      <div className={`no-print md:hidden w-[250px] bg-navy text-white flex flex-col p-3 fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <BrandHeader />
        <NavList entries={entries} pathname={pathname} unreadNotifications={unreadNotifications} onNavigate={() => setOpen(false)} />
        <form action={signOut}><button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-[#C7DEDC] w-full mt-2"><LogOut size={16} /> Sign out</button></form>
      </div>

      {expanded ? (
        <div className="no-print hidden md:flex md:flex-col w-[250px] flex-shrink-0 bg-navy text-white p-3">
          <BrandHeader onCollapse={togglePinned} />
          <NavList entries={entries} pathname={pathname} unreadNotifications={unreadNotifications} onNavigate={() => {}} />
          <form action={signOut}><button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-[#C7DEDC] w-full mt-2"><LogOut size={16} /> Sign out</button></form>
        </div>
      ) : (
        <div className="no-print hidden md:flex md:flex-col items-center w-16 flex-shrink-0 bg-navy text-white py-3">
          <Image src="/ew-mark.svg" width={36} height={36} alt="Evergreen Water" className="rounded-xl flex-shrink-0 mb-1.5" priority unoptimized />
          <button type="button" onClick={togglePinned} title="Pin sidebar open" className="w-8 h-8 flex items-center justify-center rounded-lg text-[#C7DEDC] hover:bg-white/10 mb-3"><ChevronRight size={16} /></button>
          <RailNav entries={entries} pathname={pathname} unreadNotifications={unreadNotifications} />
          <div className="flex flex-col items-center gap-1 mt-2"><ThemeToggle className="text-[#C7DEDC] hover:bg-white/10" /><form action={signOut}><button title="Sign out" className="w-9 h-9 flex items-center justify-center rounded-lg text-[#C7DEDC] hover:bg-white/10"><LogOut size={16} /></button></form></div>
        </div>
      )}
    </>
  );
}
