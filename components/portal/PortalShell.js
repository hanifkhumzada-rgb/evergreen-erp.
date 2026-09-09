"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Truck, Wallet, FileText, Droplet, LifeBuoy, Star, User, LogOut } from "lucide-react";
import { portalSignOut } from "@/app/portal/actions";

const NAV = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/deliveries", label: "Deliveries", icon: Truck },
  { href: "/portal/payments", label: "Payments", icon: Wallet },
  { href: "/portal/statement", label: "Statement", icon: FileText },
  { href: "/portal/bottles", label: "Bottles", icon: Droplet },
  { href: "/portal/support", label: "Support", icon: LifeBuoy },
  { href: "/portal/feedback", label: "Feedback", icon: Star },
  { href: "/portal/profile", label: "Profile", icon: User },
];

export default function PortalShell({ customerName, customerCode, unreadCount, children }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await portalSignOut();
    router.replace("/portal/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-foam flex flex-col">
      <div className="sticky top-0 z-20 bg-navy text-white px-4 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/icon-192.png" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate">{customerName || "My Evergreen Water"}</div>
            {customerCode && <div className="text-[10.5px] text-[#9CC9C5] leading-tight">ID: {customerCode}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold bg-coral text-white rounded-full w-5 h-5 flex items-center justify-center">{unreadCount > 9 ? "9+" : unreadCount}</span>
          )}
          <button onClick={handleSignOut} aria-label="Sign out" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto p-4 pb-24">{children}</div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-line overflow-x-auto no-print">
        <div className="flex min-w-max sm:min-w-0 sm:justify-around max-w-2xl mx-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex flex-col items-center gap-1 px-3.5 py-2.5 flex-shrink-0 ${active ? "text-aqua" : "text-slate"}`}>
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[9.5px] font-semibold whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
