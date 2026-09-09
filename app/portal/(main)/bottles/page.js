import { Droplet } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABEL = {
  in_stock: "In Stock", with_customer: "With You", damaged: "Damaged", lost: "Lost", warehouse: "Warehouse",
};

export default async function PortalBottlesPage() {
  const { supabase, customerId } = await requirePortalCustomer();

  const [{ data: balances }, { data: history }, { data: customer }] = await Promise.all([
    supabase.from("v_customer_bottle_balance").select("product_name, bottles_with_customer").eq("customer_id", customerId),
    supabase.from("bottle_transactions").select("txn_date, quantity, from_state, to_state, remarks, products(name)")
      .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(40),
    supabase.from("customers").select("bottle_limit").eq("id", customerId).maybeSingle(),
  ]);

  const totalBalance = (balances || []).reduce((sum, b) => sum + (Number(b.bottles_with_customer) || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-semibold">Bottle Balance</h1>

      <div className="bg-navyLight text-white rounded-2xl p-4">
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#BFE3E0]"><Droplet size={12} /> Total With You</div>
        <div className="font-mono-num text-2xl font-bold mt-1">{totalBalance} bottles</div>
        {customer?.bottle_limit && <div className="text-[11px] text-[#9CC9C5] mt-1">Limit: {customer.bottle_limit} bottles</div>}
      </div>

      {(balances || []).length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {balances.map((b, i) => (
            <div key={i} className="bg-card border border-line rounded-2xl p-4">
              <div className="text-xs text-slate">{b.product_name}</div>
              <div className="font-mono-num text-xl font-bold mt-1">{b.bottles_with_customer}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2">Recent Activity</h2>
        <div className="flex flex-col gap-2">
          {(history || []).length === 0 && <div className="bg-card border border-line rounded-2xl p-5 text-xs text-slate text-center">No bottle activity yet.</div>}
          {(history || []).map((t, i) => (
            <div key={i} className="bg-card border border-line rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold">{t.products?.name} — {LABEL[t.from_state] || t.from_state} → {LABEL[t.to_state] || t.to_state}</div>
                <div className="text-[11px] text-slate mt-0.5">{fmtDate(t.txn_date)}{t.remarks ? ` · ${t.remarks}` : ""}</div>
              </div>
              <span className="text-sm font-mono-num font-bold">{t.to_state === "with_customer" ? "+" : t.from_state === "with_customer" ? "-" : ""}{t.quantity}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
