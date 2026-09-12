import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import Sidebar, { SidebarProvider, SidebarToggleButton } from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import OfflineIndicator from "@/components/OfflineIndicator";
import StaffLocationTracker from "@/components/StaffLocationTracker";
import QuickAdd from "@/components/QuickAdd";
import NavigationControls from "@/components/NavigationControls";
import { Bell, Command } from "lucide-react";

export default async function AppLayout({ children }) {
  const { supabase, user, profile, roleKey } = await getCurrentProfile();
  if (!user) redirect("/login");
  // A customer-portal session (role 'customer') landing on a staff route —
  // sent to /portal instead. This used to be middleware's job via its own
  // extra `profiles` query on every navigation; doing it here instead
  // reuses getCurrentProfile()'s own fetch, at zero extra cost.
  if (roleKey === "customer") redirect("/portal");

  const unreadNotificationsRes = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
  const unreadNotifications = unreadNotificationsRes.count || 0;

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h2 className="font-display text-xl font-semibold mb-2">No profile found</h2>
          <p className="text-slate text-sm max-w-md">
            Your login exists in Supabase Auth but has no row in the <code>profiles</code> table yet, so no role is assigned.
            Ask the Owner to add one, or run <code>npm run seed</code> if this is the first setup.
          </p>
        </div>
      </div>
    );
  }

  const embeddedRole = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;
  const roleLabel = embeddedRole?.name || (roleKey ? roleKey[0].toUpperCase() + roleKey.slice(1) : "—");

  return (
    <SidebarProvider>
    <div className="min-h-screen app-shell-bg flex">
      <Sidebar role={roleKey} unreadNotifications={unreadNotifications} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-line glass-bar">
          <div className="flex items-center gap-3">
            <SidebarToggleButton />
            <NavigationControls />
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate"><span className="w-2 h-2 rounded-full bg-green animate-pulse" /> Live workspace</div>
            <StaffLocationTracker />
          </div>
          <div className="flex items-center gap-4">
            <OfflineIndicator />
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-line bg-foam/70 px-2 py-1"><Command size={13} className="text-slate" /><GlobalSearch /></div>
            <Link href="/notifications" className="relative p-1.5 -m-1.5 rounded-lg hover:bg-foam transition-colors" aria-label="Notifications">
              <Bell size={17} className="text-slate" />
              {unreadNotifications > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-coral ring-2 ring-card" />
              )}
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aqua to-navyLight text-white flex items-center justify-center text-xs font-bold shadow-sm ring-2 ring-card flex-shrink-0">
                {profile.full_name?.[0]?.toUpperCase()}
              </div>
              <div className="text-xs hidden sm:block">
                <div className="font-semibold leading-tight">{profile.full_name}</div>
                <div className="text-slate leading-tight">{roleLabel}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="page-stage p-4 sm:p-6 lg:p-8 overflow-y-auto"><div className="mx-auto w-full max-w-[1600px]">{children}</div></main>
        <QuickAdd role={roleKey} />
      </div>
    </div>
    </SidebarProvider>
  );
}
