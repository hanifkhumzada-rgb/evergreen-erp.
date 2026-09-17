import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import InviteUserForm from "@/components/InviteUserForm";
import UserRosterTable from "@/components/UserRosterTable";
import { Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  const { supabase, user } = await getCurrentProfile();
  const [{ data: users }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*, roles(key, name)").order("created_at"),
    supabase.from("roles").select("*").order("name"),
  ]);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">User Management</h2>
      <p className="text-slate text-sm mb-5">Every login, their role, and active status — role changes take effect immediately since access is enforced at the database level.</p>

      <div className="no-print flex justify-end gap-2 mb-4">
        <Link href="/user-management/permissions" className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-card text-sm font-semibold hover:bg-foam">
          <Settings2 size={15} /> Manage Permissions
        </Link>
        <InviteUserForm roles={roles || []} />
      </div>

      <UserRosterTable users={users || []} roles={roles || []} selfId={user.id} />
    </div>
  );
}
