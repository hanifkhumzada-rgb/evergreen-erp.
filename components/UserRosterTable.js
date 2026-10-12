"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Th, Td, Badge } from "@/components/ui";
import UserRoleSelect from "@/components/UserRoleSelect";
import UserActiveToggle from "@/components/UserActiveToggle";
import DeleteUserButton from "@/components/DeleteUserButton";
import { Eye, Pencil, Search, Settings2 } from "lucide-react";

const lastLogin = (value) => value
  ? new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Never";

function AccessSummary({ summary }) {
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-ink">{summary?.allowed || 0}/{summary?.total || 0} allowed</span>
        {!!summary?.overrides && <span className="text-aqua">{summary.overrides} custom</span>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-aqua" style={{ width: `${summary?.total ? (summary.allowed / summary.total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function UserActions({ user, selfId, canManagePermissions }) {
  const isSelf = user.id === selfId;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link href={`/employees/${user.id}`} title="View employee" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-foam"><Eye size={13} /> View</Link>
      <Link href={`/employees/${user.id}`} title="Edit employee" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-semibold hover:bg-foam"><Pencil size={13} /> Edit</Link>
      {isSelf ? <span className="px-2 text-[11px] text-slate">Your account</span> : canManagePermissions ? (
        <Link href={`/user-management/permissions/${user.id}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-aqua/30 bg-aquaSoft px-2.5 text-xs font-semibold text-ocean hover:bg-aqua/15"><Settings2 size={13} /> Permissions</Link>
      ) : null}
      <DeleteUserButton userId={user.id} userName={user.full_name} isSelf={isSelf} />
    </div>
  );
}

export default function UserRosterTable({ users, roles, selfId, canManagePermissions = false }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((user) =>
      (status === "all" || Boolean(user.is_active) === (status === "active")) &&
      (role === "all" || user.roles?.key === role) &&
      (!needle || [user.full_name, user.email, user.phone, user.authPhone, user.roles?.name, user.roles?.key]
        .some((value) => value?.toLowerCase().includes(needle)))
    );
  }, [users, q, status, role]);

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-foam p-3 sm:grid-cols-[minmax(220px,1fr)_170px_170px]">
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, email, phone, or role…" className="in w-full pl-9" />
        </label>
        <select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)} className="in">
          <option value="all">All roles</option>
          {roles.filter((item) => item.key !== "customer").map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="in">
          <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="mb-3 text-xs text-slate"><strong className="text-ink">{filtered.length}</strong> of {users.length} users · {users.filter((user) => user.is_active).length} active</div>

      <div className="space-y-3 md:hidden">
        {filtered.map((user) => (
          <article key={user.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">{user.full_name}</h3><p className="text-xs text-slate">{user.email}</p><p className="text-xs text-slate">{user.phone || user.authPhone || "No phone"}</p></div>
              <Badge text={user.is_active ? "Active" : "Inactive"} tone={user.is_active ? "green" : "slate"} />
            </div>
            <div className="my-4 grid grid-cols-2 gap-3 text-xs">
              <div><span className="block text-slate">Role</span><span className="font-semibold">{user.roles?.name || "—"}</span></div>
              <div><span className="block text-slate">Last login</span><span className="font-semibold">{lastLogin(user.lastSignInAt)}</span></div>
            </div>
            <AccessSummary summary={user.accessSummary} />
            <div className="mt-4 border-t border-line pt-3"><UserActions user={user} selfId={selfId} canManagePermissions={canManagePermissions} /></div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
        <table className="w-full min-w-[1120px] border-collapse text-[13px]">
          <thead><tr className="bg-foam"><Th>User</Th><Th>Email / Phone</Th><Th>Role</Th><Th>Status</Th><Th>Last Login</Th><Th>Access Summary</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-slate">No users match these filters.</td></tr>}
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-foam/70">
                <Td className="font-semibold">{user.full_name}</Td>
                <Td><span className="block">{user.email}</span><span className="text-xs text-slate">{user.phone || user.authPhone || "—"}</span></Td>
                <Td><UserRoleSelect userId={user.id} currentRole={user.roles?.key} roles={roles || []} /></Td>
                <Td><UserActiveToggle userId={user.id} isActive={user.is_active} /></Td>
                <Td className="whitespace-nowrap text-slate">{lastLogin(user.lastSignInAt)}</Td>
                <Td><AccessSummary summary={user.accessSummary} /></Td>
                <Td><UserActions user={user} selfId={selfId} canManagePermissions={canManagePermissions} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
