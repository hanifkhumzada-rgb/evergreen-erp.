import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { getUserEmailsForManagement } from "@/app/actions";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import PermissionMatrix from "@/components/PermissionMatrix";

export const dynamic = "force-dynamic";

export default async function UserPermissionsPage({ params }) {
  const { userId } = params;
  const { supabase, user } = await getCurrentProfile();

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

  const [{ data: roleDefaults }, { data: overrides }] = await Promise.all([
    supabase.from("role_permissions").select("permission_id").eq("role_id", target.role_id),
    supabase.from("user_permission_overrides").select("permission_id, allow").eq("user_id", userId),
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

  return (
    <div>
      <BackLink />
      <h2 className="font-display text-2xl font-semibold mt-3 mb-1 flex items-center gap-2"><ShieldCheck size={22} className="text-aqua" /> {target.full_name}</h2>
      <p className="text-slate text-sm mb-5">
        {email} · Role: <strong className="text-ink">{target.roles?.name}</strong> · {target.is_active ? "Active" : "Inactive"}
        {!target.is_active && <span className="text-amber ml-1">(a deactivated user has no access at all, regardless of the toggles below)</span>}
      </p>
      <PermissionMatrix userId={userId} rows={rows} />
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
