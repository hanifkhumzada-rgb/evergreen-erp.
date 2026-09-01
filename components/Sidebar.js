"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { signOut } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Home, Users, ShoppingCart, Truck, Droplet, Package, Wallet, Receipt,
  BookOpen, UserCog, BarChart3, Settings, LogOut, Landmark, FileText,
  Scale, TrendingUp, ClipboardCheck, Car, Bot, Bell, MapPin, Menu, X,
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

const GROUPS = [
  {
    label: "OPERATIONS",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home, roles: ["owner", "manager", "accountant"] },
      { href: "/customers", label: "Customers", icon: Users, roles: ["owner", "manager"] },
      { href: "/sales", label: "Sales", icon: ShoppingCart, roles: ["owner", "manager", "accountant"] },
      { href: "/deliveries", label: "Deliveries", icon: Truck, roles: ["owner", "manager", "rider"] },
      { href: "/zones", label: "Zones & Routes", icon: MapPin, roles: ["owner", "manager"] },
      { href: "/inventory", label: "Inventory", icon: Package, roles: ["owner", "manager"] },
      { href: "/bottle-ledger", label: "Bottle Ledger", icon: Droplet, roles: ["owner", "manager"] },
      { href: "/fleet", label: "Fleet", icon: Car, roles: ["owner", "manager"] },
      { href: "/employees", label: "Employees", icon: UserCog, roles: ["owner", "manager"] },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { href: "/payments", label: "Payments", icon: Receipt, roles: ["owner", "accountant"] },
      { href: "/expenses", label: "Expenses", icon: Wallet, roles: ["owner", "manager", "accountant"] },
      { href: "/ledger", label: "Customer Ledger", icon: BookOpen, roles: ["owner", "accountant"] },
      { href: "/accounting/chart-of-accounts", label: "Chart of Accounts", icon: Landmark, roles: ["owner", "accountant"] },
      { href: "/accounting/journal", label: "Journal Entries", icon: FileText, roles: ["owner", "accountant"] },
      { href: "/accounting/trial-balance", label: "Trial Balance", icon: Scale, roles: ["owner", "accountant"] },
      { href: "/accounting/profit-loss", label: "Profit & Loss", icon: TrendingUp, roles: ["owner", "accountant"] },
      { href: "/accounting/balance-sheet", label: "Balance Sheet", icon: Scale, roles: ["owner", "accountant"] },
      { href: "/accounting/daily-closing", label: "Daily Closing", icon: ClipboardCheck, roles: ["owner", "accountant"] },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "manager", "accountant"] },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/ai", label: "Evergreen AI", icon: Bot, roles: ["owner", "manager", "accountant"] },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell, roles: ["owner", "manager", "accountant"] },
      { href: "/user-management", label: "User Management", icon: UserCog, roles: ["owner"] },
      { href: "/audit-logs", label: "Audit Logs", icon: FileText, roles: ["owner"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ["owner"] },
    ],
  },
];

export default function Sidebar({ role }) {
  const pathname = usePathname();
  const { open, setOpen } = useContext(SidebarContext);
  return (
    <>
      {open && <div className="no-print fixed inset-0 bg-navy/40 z-40 md:hidden" onClick={() => setOpen(false)} />}
      <div className={`no-print w-[230px] flex-shrink-0 bg-navy text-white flex flex-col p-3 fixed md:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-1.5 pb-4">
          <div className="w-8 h-8 rounded-lg bg-aqua flex items-center justify-center flex-shrink-0"><Droplet size={16} /></div>
          <span className="font-display font-semibold text-sm leading-tight flex-1">Evergreen<br />Plus Water</span>
          <ThemeToggle className="text-[#C7DEDC] hover:bg-white/10" />
        </div>
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
          {GROUPS.map((g) => {
            const items = g.items.filter((n) => n.roles.includes(role));
            if (!items.length) return null;
            return (
              <div key={g.label}>
                <div className="text-[10px] font-bold tracking-wider text-[#5F8B87] px-2.5 mb-1">{g.label}</div>
                <div className="flex flex-col gap-0.5">
                  {items.map((n) => {
                    const Icon = n.icon;
                    const active = pathname.startsWith(n.href);
                    return (
                      <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                        className={`relative flex items-center gap-2.5 px-2.5 py-1.75 rounded-lg text-[12.5px] font-semibold ${active ? "bg-aqua text-white" : "text-[#C7DEDC] hover:bg-white/5"}`}>
                        {active && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-[#047857]" />}
                        <Icon size={15} /> {n.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <form action={signOut}>
          <button className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-semibold text-[#C7DEDC] w-full mt-2">
            <LogOut size={16} /> Sign out
          </button>
        </form>
      </div>
    </>
  );
}
