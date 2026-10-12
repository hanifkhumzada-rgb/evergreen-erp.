import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { getUserEmailsForManagement } from "@/app/actions";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import PermissionMatrix from "@/components/PermissionMatrix";

export const dynamic = "force-dynamic";

export default async function UserPermissionsPage({ params }) {
  const { userId } = await params;
  const { supabase, user, roleKey } = await getCurrentProfile();

  if (roleKey !== "owner") {
    return <div><BackLink /><p className="mt-4 text-sm text-coral">Only an Owner can customize user-specific permissions.</p></div>;
  }

  if (userId === user.id) {
    return (
      <div>
        <BackLink />
        <p className="text-coral text-sm mt-4">You can&apos;t manage your own permissions from this screen — ask another Owner to make changes for your account.</p>
      </div>
    );
  }

  const [{ data: target }, { data: permissions }, emailsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, is_active, role_id, roles(id, key, name)").eq("id", userId).maybeSingle(),
    supabase.from("permissions").select("id, key, module, description").order("module").order("key"),
    getUserEmailsForManagement(),
  ]);

  if (!target) {
    return (
      <div>
        <BackLink />
        <p className="text-coral text-sm mt-4">User not found.</p>
      </div>
    );
  }

  if (target.roles?.key === "owner") {
    return <div><BackLink /><p className="mt-4 text-sm text-coral">Owner permissions are protected and cannot be overridden.</p></div>;
  }

  const [{ data: roleDefaults }, { data: overrides }, { data: copyUsers }, { data: allRoleDefaults }, { data: allOverrides }, { data: auditRows }] = await Promise.all([
    supabase.from("role_permissions").select("permission_id").eq("role_id", target.role_id),
    supabase.from("user_permission_overrides").select("permission_id, allow").eq("user_id", userId),
    supabase.from("profiles").select("id, full_name, role_id, roles(key, name)").neq("id", userId).neq("id", user.id).eq("is_active", true).order("full_name"),
    supabase.from("role_permissions").select("role_id, permission_id"),
    supabase.from("user_permission_overrides").select("user_id, permission_id, allow"),
    supabase.from("audit_logs").select("id, created_at, old_value, new_value, profiles(full_name)").eq("module", "permissions").eq("record_id", userId).order("created_at", { ascending: false }).limit(20),
  ]);

  const roleDefaultIds = new Set((roleDefaults || []).map((r) => r.permission_id));
  const overrideByPermId = new Map((overrides || []).map((o) => [o.permission_id, o.allow]));
  const email = (emailsRes.users || []).find((u) => u.id === userId)?.email || "—";

  const rows = (permissions || []).map((p) => ({
    id: p.id,
    key: p.key,
    module: p.module,
    description: p.description,
    roleDefault: roleDefaultIds.has(p.id),
    override: overrideByPermId.has(p.id) ? overrideByPermId.get(p.id) : null, // true | false | null
  }));

  const defaultsByRole = new Map();
  for (const row of allRoleDefaults || []) {
    if (!defaultsByRole.has(row.role_id)) defaultsByRole.set(row.role_id, new Set());
    defaultsByRole.get(row.role_id).add(row.permission_id);
  }
  const overridesByUser = new Map();
  for (const row of allOverrides || []) {
    if (!overridesByUser.has(row.user_id)) overridesByUser.set(row.user_id, new Map());
    overridesByUser.get(row.user_id).set(row.permission_id, row.allow);
  }
  const copySources = (copyUsers || []).filter((entry) => entry.roles?.key !== "owner" && entry.roles?.key !== "customer").map((entry) => {
    const defaults = defaultsByRole.get(entry.role_id) || new Set();
    const custom = overridesByUser.get(entry.id) || new Map();
    return {
      id: entry.id,
      name: entry.full_name,
      role: entry.roles?.name || "—",
      effective: Object.fromEntries((permissions || []).map((permission) => [permission.key, custom.has(permission.id) ? custom.get(permission.id) : defaults.has(permission.id)])),
    };
  });

  const history = (auditRows || []).map((entry) => ({
    id: entry.id,
    at: entry.created_at,
    actor: entry.profiles?.full_name || "System",
    permission: entry.new_value?.permission || entry.old_value?.permission || "Permissions",
    from: entry.old_value?.override ?? null,
    to: entry.new_value?.override ?? null,
    reason: entry.new_value?.reason || "—",
  }));

  return (
    <div>
      <BackLink />
      <h2 className="font-display text-2xl font-semibold mt-3 mb-1 flex items-center gap-2"><ShieldCheck size={22} className="text-aqua" /> {target.full_name}</h2>
      <p className="text-slate text-sm mb-5">
        {email} · Role: <strong className="text-ink">{target.roles?.name}</strong> · {target.is_active ? "Active" : "Inactive"}
        {!target.is_active && <span className="text-amber ml-1">(a deactivated user has no access at all, regardless of the toggles below)</span>}
      </p>
      <PermissionMatrix userId={userId} rows={rows} copySources={copySources} history={history} />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/user-management/permissions" className="no-print flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-ink w-fit">
      <ArrowLeft size={14} /> Back to all users
    </Link>
  );
}
