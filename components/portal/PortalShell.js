"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Truck, Wallet, FileText, Droplet, LifeBuoy, Star, User, LogOut, Grid2X2, X, ChevronRight, Bell } from "lucide-react";
import { portalSignOut } from "@/app/portal/actions";

const PRIMARY_NAV = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/deliveries", label: "Deliveries", icon: Truck },
  { href: "/portal/payments", label: "Payments", icon: Wallet },
  { href: "/portal/statement", label: "Statement", icon: FileText },
];
const MORE_NAV = [
  { href: "/portal/bottles", label: "My Bottles", sub: "Filled and empty bottle balance", icon: Droplet },
  { href: "/portal/support", label: "Help & Requests", sub: "Extra order, pause delivery or report issue", icon: LifeBuoy },
  { href: "/portal/feedback", label: "Feedback", sub: "Rate your Evergreen experience", icon: Star },
  { href: "/portal/profile", label: "My Profile", sub: "Contact and delivery information", icon: User },
];

export default function PortalShell({ customerName, customerCode, unreadCount, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);
  const handleSignOut = async () => { await portalSignOut(); router.replace("/portal/login"); router.refresh(); };
  const moreActive = MORE_NAV.some(({ href }) => pathname.startsWith(href));

  return <div className="min-h-screen app-shell-bg flex flex-col">
    <header className="sticky top-0 z-30 glass-bar border-b border-line px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0"><Image src="/ew-mark.svg" width={38} height={38} alt="Evergreen Water" className="rounded-xl shadow-sm flex-shrink-0" priority /><div className="min-w-0"><div className="text-sm font-bold leading-tight truncate">{customerName || "My Evergreen Water"}</div><div className="text-[10.5px] text-slate leading-tight mt-0.5">{customerCode ? `Customer ID · ${customerCode}` : "Customer portal"}</div></div></div>
      <div className="flex items-center gap-1.5"><Link href="/portal" aria-label="Notifications" className="relative w-9 h-9 grid place-items-center rounded-xl hover:bg-foam"><Bell size={17} className="text-slate" />{unreadCount > 0 ? <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-coral rounded-full ring-2 ring-card" /> : null}</Link><button type="button" onClick={handleSignOut} aria-label="Sign out" className="w-9 h-9 grid place-items-center rounded-xl hover:bg-coralSoft text-slate hover:text-coral"><LogOut size={17} /></button></div>
    </header>
    <main className="page-stage flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 pb-28">{children}</main>
    {moreOpen ? <div className="fixed inset-0 z-40 bg-navy/45 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)} /> : null}
    <section className={`fixed z-50 left-3 right-3 bottom-3 mx-auto max-w-md bg-card border border-line rounded-[24px] shadow-2xl transition-all duration-200 ${moreOpen ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0 pointer-events-none"}`} aria-hidden={!moreOpen}>
      <div className="p-4 border-b flex items-center justify-between"><div><p className="font-display font-semibold">More services</p><p className="text-[11px] text-slate">Manage your complete account</p></div><button type="button" onClick={() => setMoreOpen(false)} className="w-8 h-8 rounded-xl grid place-items-center bg-foam" aria-label="Close menu"><X size={16}/></button></div>
      <div className="p-2">{MORE_NAV.map(({href,label,sub,icon:Icon}) => <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-aquaSoft"><span className="w-10 h-10 rounded-xl bg-foam text-aqua grid place-items-center"><Icon size={19}/></span><span className="flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-[11px] text-slate">{sub}</span></span><ChevronRight size={16} className="text-slate"/></Link>)}</div>
    </section>
    <nav className="fixed bottom-3 left-3 right-3 z-30 no-print"><div className="grid grid-cols-5 max-w-md mx-auto bg-card/95 backdrop-blur-xl border border-line rounded-[22px] shadow-xl shadow-navy/10 p-1.5">
      {PRIMARY_NAV.map(({ href, label, icon: Icon }) => { const active = href === "/portal" ? pathname === "/portal" : pathname.startsWith(href); return <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 rounded-2xl ${active ? "bg-navy text-white shadow-md" : "text-slate"}`}><Icon size={18} strokeWidth={active ? 2.5 : 2}/><span className="text-[9px] font-semibold">{label}</span></Link>; })}
      <button type="button" onClick={() => setMoreOpen(true)} className={`flex flex-col items-center gap-0.5 py-2 rounded-2xl ${moreActive || moreOpen ? "bg-navy text-white shadow-md" : "text-slate"}`}><Grid2X2 size={18}/><span className="text-[9px] font-semibold">More</span></button>
    </div></nav>
  </div>;
}
