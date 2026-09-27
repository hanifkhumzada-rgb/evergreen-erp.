import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { getPortalSession } from "@/lib/portal/session";

export default async function PortalMainLayout({ children }) {
  const session = await getPortalSession();
  if (!session.user) redirect("/portal/login");
  const { supabase, customerId } = session;
  // Authenticated but not a customer-portal account (a staff login that
  // ended up here) — send them to their actual home instead of back to
  // the portal's login form. This used to be middleware's job via its
  // own extra `profiles` query on every navigation; doing it here
  // instead reuses the fn_current_customer_id() call getPortalSession()
  // already makes for its own needs, at zero extra cost.
  if (!customerId) {
    // A customer-role login whose portal link was removed/disabled has no
    // customer id AND is bounced away from the staff app, so redirecting to
    // /dashboard here looped forever (ERR_TOO_MANY_REDIRECTS). Only staff
    // go to the dashboard; a customer sees a clear message instead.
    const { data: profile } = await supabase.from("profiles").select("roles(key)").eq("id", session.user.id).maybeSingle();
    if (profile?.roles?.key && profile.roles.key !== "customer") redirect("/dashboard");
    return (
      <main className="min-h-screen grid place-items-center bg-foam p-6">
        <div className="max-w-sm rounded-2xl border border-line bg-card p-6 text-center">
          <h1 className="font-display text-lg font-semibold mb-2">Portal access is not active</h1>
          <p className="text-sm text-slate mb-4">Your customer portal account is not linked to an active customer. Please contact Evergreen Water to restore access.</p>
          <a href="/portal/login" className="inline-flex min-h-[40px] items-center rounded-xl bg-navy px-4 text-xs font-bold text-white">Back to sign in</a>
        </div>
      </main>
    );
  }
  const [{ data: customer }, { count: unread }] = await Promise.all([
    supabase.from("customers").select("id, name, code").eq("id", customerId).maybeSingle(),
    supabase.from("customer_notifications").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("is_read", false),
  ]);

  return (
    <PortalShell customerName={customer?.name} customerCode={customer?.code} unreadCount={unread || 0}>
      {children}
    </PortalShell>
  );
}
