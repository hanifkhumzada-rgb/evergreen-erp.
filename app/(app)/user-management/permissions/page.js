import { getCurrentProfile } from "@/lib/session";
import { getUserEmailsForManagement } from "@/app/actions";
import { ShieldCheck } from "lucide-react";
import UserPicker from "@/components/UserPicker";

export const dynamic = "force-dynamic";

export default async function PermissionsPickerPage() {
  const { supabase, user } = await getCurrentProfile();
  const [{ data: users }, emailsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, is_active, roles(key, name)").order("full_name"),
    getUserEmailsForManagement(),
  ]);
  const emailById = new Map((emailsRes.users || []).map((u) => [u.id, u.email]));

  const rows = (users || []).map((u) => ({
    id: u.id,
    name: u.full_name,
    email: emailById.get(u.id) || "—",
    role: u.roles?.name || "—",
    isActive: u.is_active,
    isSelf: u.id === user.id,
  }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1 flex items-center gap-2"><ShieldCheck size={22} className="text-aqua" /> Permissions</h2>
      <p className="text-slate text-sm mb-5">Grant or revoke individual module permissions for any user — an override always wins over their role&apos;s default, and every change is enforced at the database level, not just hidden in the menu.</p>
      {emailsRes.error && <p className="text-coral text-xs mb-4">{emailsRes.error}</p>}
      <UserPicker rows={rows} />
    </div>
  );
}
