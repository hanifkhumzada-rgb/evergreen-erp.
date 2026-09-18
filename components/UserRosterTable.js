"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Th, Td } from "@/components/ui";
import UserRoleSelect from "@/components/UserRoleSelect";
import UserActiveToggle from "@/components/UserActiveToggle";
import DeleteUserButton from "@/components/DeleteUserButton";
import { Search } from "lucide-react";

// Mirrors the search box on /user-management/permissions (UserPicker) so
// the two sibling pages over the same user list behave consistently.
export default function UserRosterTable({ users, roles, selfId }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => (status === "all" || Boolean(u.is_active) === (status === "active")) && (!needle ||
      u.full_name?.toLowerCase().includes(needle) ||
      u.phone?.toLowerCase().includes(needle) ||
      u.roles?.name?.toLowerCase().includes(needle) ||
      u.roles?.key?.toLowerCase().includes(needle))
    );
  }, [users, q, status]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 rounded-xl border border-line bg-foam p-3 text-xs">
        <span><strong>{users.length}</strong> users · <strong>{users.filter(u => u.is_active).length}</strong> active · {filtered.length} shown</span>
        <select aria-label="Filter user status" value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-line bg-card p-2"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, or role…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-2 focus:ring-aqua/20"
        />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>Phone</Th><Th>Role</Th><Th>Status</Th><Th>Permissions</Th><Th>&nbsp;</Th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate">No users match.</td></tr>}
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-foam">
                <Td className="font-semibold">{u.full_name}</Td>
                <Td>{u.phone || "—"}</Td>
                <Td><UserRoleSelect userId={u.id} currentRole={u.roles?.key} roles={roles || []} /></Td>
                <Td><UserActiveToggle userId={u.id} isActive={u.is_active} /></Td>
                <Td>
                  {u.id === selfId ? <span className="text-[11px] text-slate">—</span> : (
                    <Link href={`/user-management/permissions/${u.id}`} className="text-xs font-semibold text-aqua hover:underline">Manage</Link>
                  )}
                </Td>
                <Td><DeleteUserButton userId={u.id} userName={u.full_name} isSelf={u.id === selfId} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
