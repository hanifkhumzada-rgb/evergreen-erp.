import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";

export const dynamic = "force-dynamic";

// Landing page for a signed-in customer-role login whose portal link was
// removed or disabled. Lives outside the (main) portal layout so it never
// needs a customer id (and can't loop back into the staff app).
export default async function PortalNoAccessPage() {
  const { supabase, user, customerId } = await getPortalSession();
  if (!user) redirect("/portal/login");
  if (customerId) redirect("/portal");
  const { data: profile } = await supabase.from("profiles").select("roles(key)").eq("id", user.id).maybeSingle();
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
