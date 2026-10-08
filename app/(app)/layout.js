import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { canAccessPath, homePathFor } from "@/lib/navAccess";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import Sidebar, { SidebarProvider, SidebarToggleButton } from "@/components/Sidebar";
import GlobalSearch from "@/components/GlobalSearch";
import OfflineIndicator from "@/components/OfflineIndicator";
import StaffLocationTracker from "@/components/StaffLocationTracker";
import QuickAdd from "@/components/QuickAdd";
import NavigationControls from "@/components/NavigationControls";
import { Bell, Command } from "lucide-react";
import WorkspaceIdentity from "@/components/WorkspaceIdentity";
import ErpAppearance from "@/components/ErpAppearance";
import MobileBottomNav from "@/components/MobileBottomNav";
import LiveUsers from "@/components/LiveUsers";
import ErpRefreshButton from "@/components/ErpRefreshButton";

export default async function AppLayout({ children }) {
  const { user, profile, roleKey, permissions: effectivePermissions, unreadNotifications } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (roleKey === "customer") redirect("/portal");


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

  const pathname = headers().get("x-pathname") || "";
  const allowed = canAccessPath(pathname, roleKey, effectivePermissions);
  if (!allowed) {
    // Landing somewhere you can't use (e.g. a Delivery Boy sent to
    // /dashboard after login) goes straight to your own home page.
    const home = homePathFor(roleKey, effectivePermissions);
    if (home && pathname === "/dashboard") redirect(home);
  }

  const embeddedRole = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;
  const roleLabel = embeddedRole?.name || (roleKey ? roleKey[0].toUpperCase() + roleKey.slice(1) : "—");

  return (
    <ErpAppearance><SidebarProvider>
    <div className="min-h-screen app-shell-bg flex">
      <Sidebar role={roleKey} permissions={effectivePermissions} unreadNotifications={unreadNotifications} profileName={profile.full_name} roleLabel={roleLabel} />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="workspace-topbar topbar-branded no-print sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <SidebarToggleButton />
            <NavigationControls />
            <WorkspaceIdentity />
            <div className="topbar-muted hidden xl:flex items-center gap-2 text-xs"><span className="topbar-live-dot w-2 h-2 rounded-full animate-pulse" /> Live workspace</div>
            <StaffLocationTracker />
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="topbar-search flex items-center gap-2 rounded-xl px-2 py-1"><Command size={13} className="topbar-muted hidden md:block" /><GlobalSearch /></div>
            <ErpRefreshButton />
            <OfflineIndicator />
            <div className="hidden sm:block">
              <LiveUsers
                userId={user.id}
                businessId={profile.business_id}
                name={profile.full_name}
                role={roleLabel}
                canView={["owner", "admin"].includes(roleKey)}
              />
            </div>
            <Link href="/notifications" className="topbar-icon-btn relative grid h-10 w-10 place-items-center rounded-xl transition-colors" aria-label={unreadNotifications > 0 ? `Notifications (${unreadNotifications} unread)` : "Notifications"}>
              <Bell size={17} />
              {unreadNotifications > 0 && <span className="topbar-dot absolute top-2 right-2 w-2 h-2 rounded-full bg-coral" />}
            </Link>
            <span className="topbar-divider hidden sm:block" aria-hidden="true" />
            <div className="flex items-center gap-2.5">
              <div className="topbar-avatar w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {profile.full_name?.[0]?.toUpperCase()}
              </div>
              <div className="text-xs hidden sm:block">
                <div className="max-w-[9rem] truncate whitespace-nowrap font-semibold leading-tight">{profile.full_name}</div>
                <div className="topbar-muted leading-tight">{roleLabel}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="page-stage flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto"><div className="mx-auto w-full max-w-[1600px]">{allowed ? children : (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-line bg-card p-8 text-center">
            <h2 className="font-display text-xl font-semibold mb-2">You don&apos;t have access to this page</h2>
            <p className="text-slate text-sm mb-5">Your role doesn&apos;t include this module. Ask the Owner if you need it.</p>
            {homePathFor(roleKey, effectivePermissions) && <Link href={homePathFor(roleKey, effectivePermissions)} className="inline-flex min-h-[40px] items-center rounded-xl bg-navy px-4 text-sm font-semibold text-white">Go to my workspace</Link>}
          </div>
        )}</div></main>
        <QuickAdd role={roleKey} permissions={effectivePermissions} />
        <MobileBottomNav role={roleKey} permissions={effectivePermissions} />
      </div>
    </div>
    </SidebarProvider></ErpAppearance>
  );
}
