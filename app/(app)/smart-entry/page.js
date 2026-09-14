import { createClient } from "@/lib/supabase/server";
import SmartEntryWorkspace from "@/components/SmartEntryWorkspace";

export const dynamic = "force-dynamic";

export default async function SmartEntryPage() {
  const supabase = await createClient();
  const [{data:customers},{data:products},{data:categories},{data:employees},{data:entries},{data:rules}] = await Promise.all([
    supabase.from("customers").select("id,code,name,mobile,is_active,status,zone_id,zones(name),default_product_id").order("name").limit(1500),
    supabase.from("products").select("id,name,size_label,sku").eq("is_active",true).order("name"),
    supabase.from("expense_categories").select("id,name").order("name"),
    supabase.from("profiles").select("id,full_name,roles(key)").eq("is_active",true).order("full_name"),
    supabase.from("smart_entries").select("id,entry_no,entry_type,status,payload,validation_errors,warnings,created_at,decision_reason,profiles!smart_entries_created_by_fkey(full_name)").order("created_at",{ascending:false}).limit(100),
    supabase.from("smart_entry_approval_rules").select("entry_type,requires_approval"),
  ]);
  return <SmartEntryWorkspace customers={customers||[]} products={products||[]} categories={categories||[]} employees={employees||[]} initialEntries={entries||[]} rules={rules||[]} />;
}
