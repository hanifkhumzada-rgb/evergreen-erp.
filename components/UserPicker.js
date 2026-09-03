"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Th, Td, Badge } from "@/components/ui";
import { Search, Settings2 } from "lucide-react";

export default function UserPicker({ rows }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      r.name?.toLowerCase().includes(needle) ||
      r.email?.toLowerCase().includes(needle) ||
      r.id?.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate pointer-events-none" />
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or user ID…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-line bg-card text-sm outline-none focus:border-aqua focus:ring-2 focus:ring-aqua/20"
        />
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>&nbsp;</Th></tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No users match.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-foam">
                <Td className="font-semibold">{r.name}</Td>
                <Td className="text-slate">{r.email}</Td>
                <Td>{r.role}</Td>
                <Td><Badge text={r.isActive ? "Active" : "Inactive"} tone={r.isActive ? "green" : "slate"} /></Td>
                <Td>
                  {r.isSelf ? (
                    <span className="text-[11px] text-slate">Your own account</span>
                  ) : (
                    <Link href={`/user-management/permissions/${r.id}`}
                      className="flex items-center gap-1.5 w-fit px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold hover:bg-foam">
                      <Settings2 size={13} /> Manage
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
