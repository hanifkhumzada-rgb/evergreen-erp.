import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { getUserEmailsForManagement } from "@/app/actions";
import InviteUserForm from "@/components/InviteUserForm";
import UserRosterTable from "@/components/UserRosterTable";
import { Settings2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  const { supabase, user, roleKey } = await getCurrentProfile();
  const [{ data: users }, { data: roles }, { data: permissions }, { data: rolePermissions }, { data: overrides }, authUsers] = await Promise.all([
    supabase.from("profiles").select("*, roles(key, name)").order("created_at"),
    supabase.from("roles").select("*").order("name"),
    supabase.from("permissions").select("id"),
    supabase.from("role_permissions").select("role_id, permission_id"),
    supabase.from("user_permission_overrides").select("user_id, permission_id, allow"),
    getUserEmailsForManagement(),
  ]);

  const authById = new Map((authUsers.users || []).map((entry) => [entry.id, entry]));
  const roleDefaults = new Map();
  for (const row of rolePermissions || []) {
    if (!roleDefaults.has(row.role_id)) roleDefaults.set(row.role_id, new Set());
    roleDefaults.get(row.role_id).add(row.permission_id);
  }
  const userOverrides = new Map();
  for (const row of overrides || []) {
    if (!userOverrides.has(row.user_id)) userOverrides.set(row.user_id, new Map());
    userOverrides.get(row.user_id).set(row.permission_id, row.allow);
  }
  const totalPermissions = (permissions || []).length;
  const roster = (users || []).map((entry) => {
    const auth = authById.get(entry.id) || {};
    const defaults = roleDefaults.get(entry.role_id) || new Set();
    const custom = userOverrides.get(entry.id) || new Map();
    const allowed = (permissions || []).filter((permission) => custom.has(permission.id) ? custom.get(permission.id) : defaults.has(permission.id)).length;
    return {
      ...entry,
      email: auth.email || "—",
      authPhone: auth.phone || null,
      lastSignInAt: auth.lastSignInAt || null,
      accessSummary: { allowed, total: totalPermissions, overrides: custom.size },
    };
  });

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">User Management</h2>
      <p className="text-slate text-sm mb-5">Every login, their role, and active status — role changes take effect immediately since access is enforced at the database level.</p>

      <div className="no-print flex justify-end gap-2 mb-4">
        {roleKey === "owner" && <Link href="/user-management/permissions" className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-line bg-card text-sm font-semibold hover:bg-foam">
          <Settings2 size={15} /> Manage Permissions
        </Link>}
        <InviteUserForm roles={(roles || []).filter((role) => roleKey === "owner" || role.key !== "owner")} />
      </div>

      {authUsers.error && <p className="mb-3 text-xs text-coral">{authUsers.error}</p>}
      <UserRosterTable users={roster} roles={(roles || []).filter((role) => roleKey === "owner" || role.key !== "owner")} selfId={user.id} canManagePermissions={roleKey === "owner"} />
    </div>
  );
}
