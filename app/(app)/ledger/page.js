import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr } from "@/lib/format";
import { ExportExcelButton, PrintButton, DownloadPdfButton, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const supabase = await createClient();
  const [{ data: customers }, { data: balances }] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
  ]);
  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const rows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  const exportRows = rows.map((c) => ({ Customer: c.name, Opening: c.opening_balance, CurrentBalance: c.balance, CreditLimit: c.credit_limit }));

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Customer Ledger</h2>
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <ExportExcelButton rows={exportRows} filename="evergreen-ledger.xlsx" sheetName="Ledger" />
        <DownloadPdfButton href="/api/pdf/outstanding" label="Download Outstanding PDF" />
        <PrintButton />
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Customer</Th><Th>Opening</Th><Th>Current Balance</Th><Th>Credit Limit</Th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-foam">
                <Td><Link href={`/customers/${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                <Td>{pkr(c.opening_balance)}</Td>
                <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                <Td>{pkr(c.credit_limit)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
