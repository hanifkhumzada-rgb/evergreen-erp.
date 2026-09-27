import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { Th, Td, DocumentActionBar } from "@/components/ui";
import ListFilterBar from "@/components/ListFilterBar";
import Pager from "@/components/Pager";
import { pageFrom, rangeFor } from "@/lib/listParams";
import { auditFilters, applyAuditFilters } from "@/lib/listQueries";
import { exportAuditRows } from "@/lib/exportActions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function AuditLogsPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const filters = auditFilters(sp);
  const page = pageFrom(sp);
  const [from, to] = rangeFor(page, PAGE_SIZE);

  const [branding, { data: logs, count }, { data: modules }, { data: users }] = await Promise.all([
    getBrandingLite(supabase),
    applyAuditFilters(supabase.from("audit_logs").select("*, profiles(full_name)", { count: "exact" }), filters)
      .order("created_at", { ascending: false }).order("id").range(from, to),
    // Modules from recent activity — populates the filter dropdown without a
    // hardcoded list that would drift from reality.
    supabase.from("audit_logs").select("module").order("created_at", { ascending: false }).limit(1000),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);
  const moduleOptions = [...new Set((modules || []).map((m) => m.module).filter(Boolean))].sort();
  if (filters.module && !moduleOptions.includes(filters.module)) moduleOptions.push(filters.module);
  const total = count || 0;

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Audit Logs" meta={`${total} records\nGenerated ${fmtDate(new Date().toISOString())}`} />
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Audit Logs</h2>
      <p className="no-print text-slate text-sm mb-5">A record of who changed what, and when — for accountability across the whole team.</p>

      <ListFilterBar
        placeholder="Search action or module…"
        filters={[
          { name: "user", label: "All users", options: (users || []).map((u) => ({ value: u.id, label: u.full_name || "—" })) },
          { name: "module", label: "All modules", options: moduleOptions.map((m) => ({ value: m, label: m })) },
        ]}
        dateFilters={[{ name: "from", label: "From" }, { name: "to", label: "To" }]}
      />

      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <span className="text-xs text-slate">{total.toLocaleString()} matching records</span>
        <div className="flex-1" />
        <DocumentActionBar
          print
          excel={{ loadRows: exportAuditRows.bind(null, filters), sheetName: "Audit Logs", reportTitle: "Audit Logs", branding }}
          share={{ title: "Audit Logs" }}
        />
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>When</Th><Th>User</Th><Th>Module</Th><Th>Action</Th><Th>Record</Th></tr></thead>
          <tbody>
            {(logs || []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-slate">No audit activity matches this filter.</td></tr>}
            {(logs || []).map((l) => (
              <tr key={l.id} className="hover:bg-foam">
                <Td>{fmtDate(l.created_at)}</Td>
                <Td>{l.profiles?.full_name || "System"}</Td>
                <Td className="font-semibold">{l.module}</Td>
                <Td>{l.action}</Td>
                <Td className="text-xs text-slate">{l.record_id || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pager basePath="/audit-logs" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={total} label="Audit log pages" />
      <DocumentPrintFooter />
    </div>
  );
}
