"use client";

import Link from "@/components/ErpNavLink";
import { usePathname } from "next/navigation";
import { Home, Users, Truck, Receipt, Menu } from "lucide-react";
import { PERMISSION_BY_HREF } from "@/lib/navAccess";
import { useSidebar } from "@/components/Sidebar";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home, roles: ["owner", "admin", "manager", "accountant"] },
  { href: "/customers", label: "Customers", icon: Users, roles: ["owner", "admin", "manager"] },
  { href: "/deliveries", label: "Deliveries", icon: Truck, roles: ["owner", "admin", "manager", "rider"] },
  { href: "/payments", label: "Payments", icon: Receipt, roles: ["owner", "admin", "accountant"] },
];

export default function MobileBottomNav({ role, permissions = [] }) {
  const pathname = usePathname();
  const { setOpen } = useSidebar();
  const normalizedRole = (Array.isArray(role) ? role[0]?.key : role?.key || role)?.toString().trim().toLowerCase();
  const permissionSet = new Set(permissions || []);
  const visibleItems = ITEMS.filter((item) => {
    const permission = PERMISSION_BY_HREF[item.href];
    return permission ? permissionSet.has(permission) : item.roles.includes(normalizedRole);
  });

  return (
    <nav aria-label="Mobile primary navigation" className="no-print fixed inset-x-2 bottom-2 z-40 flex min-h-16 items-stretch justify-around rounded-2xl border border-line bg-card/95 px-1 shadow-lg backdrop-blur-md md:hidden">
      {visibleItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-w-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${active ? "text-aqua" : "text-slate"}`}>
            <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={() => setOpen(true)} className="flex min-w-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate" aria-label="Open all ERP modules">
        <Menu size={19} strokeWidth={1.8} />
        <span>More</span>
      </button>
    </nav>
  );
}
