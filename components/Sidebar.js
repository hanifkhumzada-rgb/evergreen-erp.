"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { signOut } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Home, Users, ShoppingCart, Truck, Droplet, Package, Wallet, Receipt,
  BookOpen, UserCog, BarChart3, Settings, LogOut, Landmark, FileText,
  Scale, TrendingUp, ClipboardCheck, Car, Bot, Bell, MapPin, Menu, X, FileDown,
  ChevronRight, ChevronLeft, Factory,
} from "lucide-react";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [open, setOpen] = useState(false);
  return <SidebarContext.Provider value={{ open, setOpen }}>{children}</SidebarContext.Provider>;
}

export function SidebarToggleButton() {
  const { open, setOpen } = useContext(SidebarContext);
  return (
    <button onClick={() => setOpen(!open)} className="no-print md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-foam" aria-label="Toggle menu">
      {open ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
}

// Same nav items as before, just regrouped: Dashboard / Reports / Evergreen AI
// stay single direct links, everything else nests under one of four flyout
// groups (Sales & Operations, Inventory & Bottles, Fleet & Team, Finance) or
// the Settings group.
const NAV = [
  { type: "link", href: "/dashboard", label: "Dashboard", icon: Home, roles: ["owner", "manager", "accountant"] },
  {
    type: "group", key: "sales-ops", label: "Sales & Operations", icon: ShoppingCart,
    items: [
      { href: "/customers", label: "Customers", icon: Users, roles: ["owner", "manager"] },
      { href: "/sales", label: "Sales", icon: ShoppingCart, roles: ["owner", "manager", "accountant"] },
      { href: "/deliveries", label: "Deliveries", icon: Truck, roles: ["owner", "manager", "rider"] },
      { href: "/zones", label: "Zones & Routes", icon: MapPin, roles: ["owner", "manager"] },
    ],
  },
  {
    type: "group", key: "inventory-bottles", label: "Inventory & Bottles", icon: Package,
    items: [
      { href: "/inventory", label: "Inventory", icon: Package, roles: ["owner", "manager"] },
      { href: "/bottle-ledger", label: "Bottle Ledger", icon: Droplet, roles: ["owner", "manager"] },
    ],
  },
  {
    type: "group", key: "fleet-team", label: "Fleet & Team", icon: Car,
    items: [
      { href: "/fleet", label: "Fleet", icon: Car, roles: ["owner", "manager"] },
      { href: "/employees", label: "Employees", icon: UserCog, roles: ["owner", "manager"] },
    ],
  },
  {
    type: "group", key: "finance", label: "Finance", icon: Landmark,
    items: [
      { href: "/payments", label: "Payments", icon: Receipt, roles: ["owner", "accountant"] },
      { href: "/expenses", label: "Expenses", icon: Wallet, roles: ["owner", "manager", "accountant"] },
      { href: "/production", label: "Production & Filling", icon: Factory, roles: ["owner", "manager", "accountant"] },
      { href: "/ledger", label: "Customer Ledger", icon: BookOpen, roles: ["owner", "accountant"] },
      { href: "/accounting/chart-of-accounts", label: "Chart of Accounts", icon: Landmark, roles: ["owner", "accountant"] },
      { href: "/accounting/journal", label: "Journal Entries", icon: FileText, roles: ["owner", "accountant"] },
      { href: "/accounting/trial-balance", label: "Trial Balance", icon: Scale, roles: ["owner", "accountant"] },
      { href: "/accounting/profit-loss", label: "Profit & Loss", icon: TrendingUp, roles: ["owner", "accountant"] },
      { href: "/accounting/balance-sheet", label: "Balance Sheet", icon: Scale, roles: ["owner", "accountant"] },
      { href: "/accounting/daily-closing", label: "Daily Closing", icon: ClipboardCheck, roles: ["owner", "accountant"] },
    ],
  },
  { type: "link", href: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "manager", "accountant"] },
  { type: "link", href: "/ai", label: "Evergreen AI", icon: Bot, roles: ["owner", "manager", "accountant"] },
  {
    type: "group", key: "settings", label: "Settings", icon: Settings,
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell, roles: ["owner", "manager", "accountant"] },
      { href: "/user-management", label: "User Management", icon: UserCog, roles: ["owner"] },
      { href: "/audit-logs", label: "Audit Logs", icon: FileText, roles: ["owner"] },
      { href: "/settings/export", label: "Export Data", icon: FileDown, roles: ["owner"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["owner"] },
    ],
  },
];

function visibleEntries(role) {
  return NAV.map((entry) => {
    if (entry.type === "link") return entry.roles.includes(role) ? entry : null;
    const items = entry.items.filter((i) => i.roles.includes(role));
    return items.length ? { ...entry, items } : null;
  }).filter(Boolean);
}

function isEntryActive(entry, pathname) {
  if (entry.type === "link") return pathname.startsWith(entry.href);
  return entry.items.some((i) => pathname.startsWith(i.href));
}

function NotifBadge({ count }) {
  if (!count) return null;
  return (
    <span className="flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full bg-coral text-white text-[10px] font-bold flex-shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Full labeled nav list — used by the mobile off-canvas drawer, and by the
// desktop rail when pinned open.
function NavList({ entries, pathname, unreadNotifications, onNavigate }) {
  return (
    <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
      {entries.map((entry) => {
        const items = entry.type === "link" ? [entry] : entry.items;
        return (
          <div key={entry.type === "link" ? entry.href : entry.key}>
            {entry.type === "group" && (
              <div className="text-[10px] font-bold tracking-wider text-[#5F8B87] px-2.5 mb-1">{entry.label.toUpperCase()}</div>
            )}
            <div className="flex flex-col gap-0.5">
              {items.map((n) => {
                const Icon = n.icon;
                const active = pathname.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href} onClick={onNavigate}
                    className={`relative flex items-center gap-2.5 px-2.5 py-1.75 rounded-lg text-[12.5px] font-semibold transition-colors duration-150 ${active ? "bg-aqua text-white" : "text-[#C7DEDC] hover:bg-white/5"}`}>
                    {active && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-[#047857]" />}
                    <Icon size={15} /> <span className="flex-1">{n.label}</span>
                    {n.href === "/notifications" && <NotifBadge count={unreadNotifications} />}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Collapsed icon-only rail with flyout popovers — the default desktop view.
// Flyouts are fixed-positioned (measured from the clicked icon's rect) so
// they escape the rail's own overflow-y-auto clipping.
function RailNav({ entries, pathname, unreadNotifications }) {
  const containerRef = useRef(null);
  const [flyout, setFlyout] = useState(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setFlyout(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => { setFlyout(null); }, [pathname]);

  const toggleFlyout = (e, entry) => {
    if (flyout?.key === entry.key) { setFlyout(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyout({ key: entry.key, top: rect.top, left: rect.right + 8, entry });
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-1 flex-1 overflow-y-auto w-full">
      {entries.map((entry) => {
        const Icon = entry.icon;
        if (entry.type === "link") {
          const active = pathname.startsWith(entry.href);
          return (
            <Link key={entry.href} href={entry.href} title={entry.label}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors duration-150 flex-shrink-0 ${active ? "bg-aqua text-white" : "text-[#C7DEDC] hover:bg-white/10"}`}>
              <Icon size={19} />
            </Link>
          );
        }
        const active = isEntryActive(entry, pathname);
        const hasUnread = entry.items.some((i) => i.href === "/notifications") && unreadNotifications > 0;
        return (
          <button key={entry.key} type="button" title={entry.label} onClick={(e) => toggleFlyout(e, entry)}
            className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors duration-150 flex-shrink-0 ${active || flyout?.key === entry.key ? "bg-aqua text-white" : "text-[#C7DEDC] hover:bg-white/10"}`}>
            <Icon size={19} />
            {hasUnread && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral" />}
          </button>
        );
      })}

      {flyout && (
        <div style={{ position: "fixed", top: flyout.top, left: flyout.left }} className="z-[80] w-56 bg-card border border-line rounded-xl shadow-lg py-1.5 text-ink">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate border-b border-line mb-1">{flyout.entry.label.toUpperCase()}</div>
          {flyout.entry.items.map((n) => {
            const NIcon = n.icon;
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} onClick={() => setFlyout(null)}
                className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium ${active ? "text-aqua bg-aquaSoft" : "hover:bg-foam"}`}>
                <NIcon size={15} className="flex-shrink-0" /> <span className="flex-1">{n.label}</span>
                {n.href === "/notifications" && <NotifBadge count={unreadNotifications} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ role, unreadNotifications = 0 }) {
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

  const entries = visibleEntries(role);
  const expanded = mounted && pinned;

  return (
    <>
      {/* Mobile off-canvas drawer — unchanged hamburger trigger, always shows full labels */}
      {open && <div className="no-print fixed inset-0 bg-navy/40 z-40 md:hidden" onClick={() => setOpen(false)} />}
      <div className={`no-print md:hidden w-[230px] flex-shrink-0 bg-navy text-white flex flex-col p-3 fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-1.5 pb-4">
          <img src="/icon-192.png" alt="Evergreen Plus Water" className="w-8 h-8 rounded-lg flex-shrink-0" />
          <span className="font-display font-semibold text-sm leading-tight flex-1">Evergreen<br />Plus Water</span>
          <ThemeToggle className="text-[#C7DEDC] hover:bg-white/10" />
        </div>
        <NavList entries={entries} pathname={pathname} unreadNotifications={unreadNotifications} onNavigate={() => setOpen(false)} />
        <form action={signOut}>
          <button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-[#C7DEDC] w-full mt-2">
            <LogOut size={16} /> Sign out
          </button>
        </form>
      </div>

      {/* Desktop persistent sidebar — collapsed icon rail by default; the ">"
          arrow pins it open to the full labeled view (preference persisted). */}
      {expanded ? (
        <div className="no-print hidden md:flex md:flex-col w-[230px] flex-shrink-0 bg-navy text-white p-3">
          <div className="flex items-center gap-2 px-1.5 pb-4">
            <img src="/icon-192.png" alt="Evergreen Plus Water" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <span className="font-display font-semibold text-sm leading-tight flex-1">Evergreen<br />Plus Water</span>
            <ThemeToggle className="text-[#C7DEDC] hover:bg-white/10" />
            <button type="button" onClick={togglePinned} title="Collapse sidebar" className="w-7 h-7 flex items-center justify-center rounded-lg text-[#C7DEDC] hover:bg-white/10 flex-shrink-0">
              <ChevronLeft size={16} />
            </button>
          </div>
          <NavList entries={entries} pathname={pathname} unreadNotifications={unreadNotifications} onNavigate={() => {}} />
          <form action={signOut}>
            <button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-[#C7DEDC] w-full mt-2">
              <LogOut size={16} /> Sign out
            </button>
          </form>
        </div>
      ) : (
        <div className="no-print hidden md:flex md:flex-col items-center w-16 flex-shrink-0 bg-navy text-white py-3">
          <img src="/icon-192.png" alt="Evergreen Plus Water" className="w-8 h-8 rounded-lg flex-shrink-0 mb-1.5" />
          <button type="button" onClick={togglePinned} title="Pin sidebar open" className="w-8 h-8 flex items-center justify-center rounded-lg text-[#C7DEDC] hover:bg-white/10 mb-3 flex-shrink-0">
            <ChevronRight size={16} />
          </button>
          <RailNav entries={entries} pathname={pathname} unreadNotifications={unreadNotifications} />
          <div className="flex flex-col items-center gap-1 mt-2 flex-shrink-0">
            <ThemeToggle className="text-[#C7DEDC] hover:bg-white/10" />
            <form action={signOut}>
              <button title="Sign out" className="w-9 h-9 flex items-center justify-center rounded-lg text-[#C7DEDC] hover:bg-white/10">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
