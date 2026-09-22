import { getCurrentProfile } from "@/lib/session";
import { ENTRY_TYPES } from "@/components/smart-entry/fieldConfig";
import SmartEntryClient from "@/components/smart-entry/SmartEntryClient";

export const dynamic = "force-dynamic";

// Mirrors fn_smart_entry_required_permission() in
// supabase/migrations/20260914120000_smart_entry_engine.sql — kept in sync
// by hand since one lives in SQL (the real gate) and this one only decides
// which type tabs to show; the RPC call is what actually enforces it.
const REQUIRED_PERMISSION = {
  customer: "customers.create", delivery: "deliveries.create", payment: "payments.create",
  expense: "expenses.create", bottle: "bottles.manage", inventory_purchase: "purchases.manage",
  employee_salary: "employees.manage", invoice_adjustment: "invoices.create", complaint_feedback: "customers.edit",
};

export default async function SmartEntryPage() {
  // getCurrentProfile() is cached per request — layout.js already paid for
  // fn_erp_workspace_context() (which itself calls fn_my_permission_keys()
  // and resolves the role key), so this reuses that instead of re-issuing
  // both RPCs a second time.
  const { supabase, roleKey, permissions: permList } = await getCurrentProfile();

  const [customersRes, productsRes, zonesRes, categoriesRes, cashRes, staffRes, inventoryRes, pendingRes, recentRes] = await Promise.all([
    supabase.from("customers").select("id, code, name, mobile, is_active, zone_id, zones(name)").order("name"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("zones").select("id, name").order("name"),
    supabase.from("expense_categories").select("id, name").order("name"),
    supabase.from("cash_accounts").select("id, name").eq("is_active", true).order("name"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").neq("roles.key", "customer").eq("is_active", true).order("full_name"),
    supabase.from("inventory_items").select("id, name").eq("is_active", true).order("name"),
    supabase.from("smart_entries").select("*, creator:profiles!smart_entries_created_by_fkey(full_name)").eq("status", "pending_approval").order("submitted_at", { ascending: true }),
    supabase.from("smart_entries").select("*, creator:profiles!smart_entries_created_by_fkey(full_name), approver:profiles!smart_entries_approved_by_fkey(full_name)").order("created_at", { ascending: false }).limit(100),
  ]);

  const permissions = new Set(permList || []);
  const isOwner = roleKey === "owner";
  const canApprove = isOwner || permissions.has("smart_entry.approve");

  if (!isOwner && !permissions.has("smart_entry.view")) {
    return (
      <div className="rounded-2xl border border-line bg-card p-8 text-center">
        <h2 className="font-display text-xl font-semibold mb-2">Smart Entry</h2>
        <p className="text-slate text-sm">You don&apos;t have access to Smart Entry. Ask the Owner to grant the &quot;Open Smart Entry&quot; permission.</p>
      </div>
    );
  }

  const allowedTypes = ENTRY_TYPES.filter((t) => isOwner || permissions.has(REQUIRED_PERMISSION[t.value]));

  const customers = (customersRes.data || []).map((c) => ({ id: c.id, code: c.code, name: c.name, mobile: c.mobile, is_active: c.is_active, zone_id: c.zone_id, zone_name: c.zones?.name }));

  const lookups = {
    customers,
    products: productsRes.data || [],
    zones: zonesRes.data || [],
    expenseCategories: categoriesRes.data || [],
    cashAccounts: cashRes.data || [],
    employees: staffRes.data?.map((p) => ({ id: p.id, name: p.full_name })) || [],
    riders: staffRes.data?.map((p) => ({ id: p.id, name: p.full_name })) || [],
    inventoryItems: inventoryRes.data || [],
  };

  const shapeEntry = (e) => ({ ...e, creator_name: e.creator?.full_name, approver_name: e.approver?.full_name });

  return (
    <div>
      <h2 className="no-print font-display text-2xl font-semibold mb-1">Smart Entry</h2>
      <p className="no-print text-slate text-sm mb-5">One place to record every daily transaction — with strict validation, draft/approval workflow and automatic posting to the right modules.</p>
      {allowedTypes.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-8 text-center text-slate text-sm">No entry types are enabled for your account yet.</div>
      ) : (
        <SmartEntryClient
          allowedTypes={allowedTypes}
          canApprove={canApprove}
          isOwner={isOwner}
          lookups={lookups}
          pendingEntries={(pendingRes.data || []).map(shapeEntry)}
          recentEntries={(recentRes.data || []).map(shapeEntry)}
        />
      )}
    </div>
  );
}
