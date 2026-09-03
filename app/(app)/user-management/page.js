import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { Th, Td } from "@/components/ui";
import UserRoleSelect from "@/components/UserRoleSelect";
import UserActiveToggle from "@/components/UserActiveToggle";
import InviteUserForm from "@/components/InviteUserForm";
import DeleteUserButton from "@/components/DeleteUserButton";
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

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>Phone</Th><Th>Role</Th><Th>Status</Th><Th>Permissions</Th><Th>&nbsp;</Th></tr></thead>
          <tbody>
            {(users || []).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No users yet.</td></tr>}
            {(users || []).map((u) => (
              <tr key={u.id} className="hover:bg-foam">
                <Td className="font-semibold">{u.full_name}</Td>
                <Td>{u.phone || "—"}</Td>
                <Td><UserRoleSelect userId={u.id} currentRole={u.roles?.key} roles={roles || []} /></Td>
                <Td><UserActiveToggle userId={u.id} isActive={u.is_active} /></Td>
                <Td>
                  {u.id === user.id ? <span className="text-[11px] text-slate">—</span> : (
                    <Link href={`/user-management/permissions/${u.id}`} className="text-xs font-semibold text-aqua hover:underline">Manage</Link>
                  )}
                </Td>
                <Td><DeleteUserButton userId={u.id} userName={u.full_name} isSelf={u.id === user.id} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
