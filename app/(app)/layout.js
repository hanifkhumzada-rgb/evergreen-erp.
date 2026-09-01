import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Bell } from "lucide-react";

export default async function AppLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, roles(key, name)").eq("id", user.id).single();

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

  const roleLabel = profile.roles?.name || "—";

  return (
    <div className="min-h-screen bg-foam flex">
      <Sidebar role={profile.roles?.key} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="no-print flex items-center justify-between px-6 py-3.5 border-b border-line bg-card">
          <div className="text-sm text-slate">Live data — Evergreen Plus Water</div>
          <div className="flex items-center gap-4">
            <Bell size={17} className="text-slate" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-aqua text-white flex items-center justify-center text-xs font-bold">
                {profile.full_name?.[0]?.toUpperCase()}
              </div>
              <div className="text-xs">
                <div className="font-semibold">{profile.full_name}</div>
                <div className="text-slate">{roleLabel}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="p-7 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
