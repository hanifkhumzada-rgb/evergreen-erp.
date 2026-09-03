import { getCurrentProfile } from "@/lib/session";
import Link from "next/link";
import { pkr } from "@/lib/format";
import { Badge, KPI, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import CustomerForm from "@/components/CustomerForm";
import BulkImportButton from "@/components/BulkImportButton";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { bulkImportCustomers, deleteCustomer } from "@/app/actions";
import { Truck, Wallet, FilePlus, UserCircle2, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  active: { text: "Active", tone: "green" },
  inactive: { text: "Inactive", tone: "slate" },
  on_hold: { text: "On Hold", tone: "amber" },
  blacklisted: { text: "Blacklisted", tone: "coral" },
  archived: { text: "Archived", tone: "slate" },
};

// Same field set as the Customer Master form — the template's columns line
// up 1:1 with CustomerForm.js's sections so a filled-in template needs no
// extra translation on either side.
const CUSTOMER_IMPORT_FIELDS = [
  { key: "Customer Code", label: "Customer Code", required: false },
  { key: "Name", label: "Customer Name", required: true },
  { key: "Company", label: "Company", required: false },
  { key: "Contact Person", label: "Contact Person", required: false },
  { key: "Mobile", label: "Mobile", required: true },
  { key: "Alternate Phone", label: "Alternate Phone", required: false },
  { key: "WhatsApp", label: "WhatsApp", required: false },
  { key: "Email", label: "Email", required: false },
  { key: "Customer Type", label: "Customer Type", required: false },
  { key: "Address", label: "Address", required: false },
  { key: "Area", label: "Area", required: false },
  { key: "Zone", label: "Zone", required: false },
  { key: "Route", label: "Route", required: false },
  { key: "Delivery Days", label: "Delivery Days", required: false },
  { key: "Driver", label: "Driver", required: false },
  { key: "Vehicle", label: "Vehicle", required: false },
  { key: "Product", label: "Product / Bottle Size", required: false },
  { key: "Quantity", label: "Quantity", required: false },
  { key: "Rate", label: "Rate", required: false },
  { key: "Discount", label: "Discount", required: false },
  { key: "Payment Terms", label: "Payment Terms", required: false },
  { key: "Payment Frequency", label: "Payment Frequency (Daily/Weekly/Monthly/Custom)", required: false },
  { key: "Credit Limit", label: "Credit Limit", required: false },
  { key: "Opening Balance", label: "Opening Balance", required: false },
  { key: "Opening Bottle Balance", label: "Opening Bottle Balance", required: false },
  { key: "Status", label: "Status", required: false },
  { key: "Notes", label: "Notes", required: false },
];
const CUSTOMER_SAMPLE_ROW = {
  "Customer Code": "", Name: "Ali Traders", Company: "Ali Traders", "Contact Person": "Ali Khan",
  Mobile: "03001234567", "Alternate Phone": "", WhatsApp: "03001234567", Email: "", "Customer Type": "Shop",
  Address: "Shop 4, Main Bazaar", Area: "Gulberg", Zone: "North Zone", Route: "Route 3",
  "Delivery Days": "Mon, Wed, Fri", Driver: "", Vehicle: "", Product: "19L", Quantity: 5,
  Rate: "", Discount: "", "Payment Terms": "Cash on Delivery", "Payment Frequency": "Monthly", "Credit Limit": "",
  "Opening Balance": "", "Opening Bottle Balance": 0, Status: "Active", Notes: "",
};

const CUSTOMER_TYPES_FILTER = ["Home", "Office", "Corporate", "Shop", "Other"];

export default async function CustomersPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || "").trim().toLowerCase();
  const zoneFilter = sp.zone || "";
  const statusFilter = sp.status || "";
  const typeFilter = sp.type || "";

  const { supabase, profile } = await getCurrentProfile();
  const [{ data: customers }, { data: zones }, { data: balances }, { data: products }, { data: vehicles }, { data: riders }, { data: routes }, { data: canDelete }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").order("created_at", { ascending: false }),
    supabase.from("zones").select("*"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.from("routes").select("id, name").eq("is_active", true).order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "customers.delete" }),
  ]);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const allRows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  const canManageFinancial = ["owner", "admin"].includes(profile?.roles?.key);

  // KPI SUMMARY — computed over the full customer set, independent of the
  // table's active filters (same convention as the Delivery/Payment
  // workspaces: KPIs describe the whole book, the table below is scoped).
  const monthStartISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const newThisMonth = allRows.filter((c) => c.created_at >= monthStartISO).length;
  const totalOutstanding = allRows.reduce((a, c) => a + Math.max(c.balance, 0), 0);
  const customersDue = allRows.filter((c) => c.balance > 0).length;

  const rows = allRows.filter((c) => {
    if (zoneFilter && c.zone_id !== zoneFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (typeFilter && c.customer_type !== typeFilter) return false;
    if (q) {
      const haystack = [c.code, c.name, c.mobile, c.alternate_phone, c.whatsapp_number, c.route, c.zones?.name]
        .filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const exportRows = rows.map((c) => ({
    "Customer ID": c.code, Name: c.name, Phone: c.mobile, Zone: c.zones?.name, Type: c.customer_type, Balance: c.balance, Status: STATUS_BADGE[c.status]?.text || (c.is_active ? "Active" : "Inactive"),
  }));

  const formProps = { zones: zones || [], products: products || [], vehicles: vehicles || [], riders: riders || [], routes: routes || [], canManageFinancial };
  const hasFilters = q || zoneFilter || statusFilter || typeFilter;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Customers</h2>
      <p className="text-slate text-sm mb-4">Customer workspace — book, balances, and quick actions in one place.</p>

      <div className="flex flex-wrap gap-3.5 mb-5">
        <KPI label="TOTAL CUSTOMERS" value={allRows.length} tone="navy" />
        <KPI label="NEW THIS MONTH" value={newThisMonth} tone="aqua" />
        <KPI label="OUTSTANDING" value={pkr(totalOutstanding)} tone="coral" sub="total receivable across all customers" />
        <KPI label="CUSTOMERS DUE" value={customersDue} tone="amber" sub="with an outstanding balance" />
      </div>

      <form className="no-print flex flex-wrap gap-2.5 mb-4 items-center" action="/customers">
        <input
          type="text" name="q" defaultValue={sp.q || ""}
          placeholder="Search name, ID, phone, route…"
          className="px-3 py-2 rounded-xl border border-line bg-card text-xs w-56"
        />
        <select name="zone" defaultValue={zoneFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All zones</option>
          {(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select name="type" defaultValue={typeFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All types</option>
          {CUSTOMER_TYPES_FILTER.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter} className="px-3 py-2 rounded-xl border border-line bg-card text-xs">
          <option value="">All statuses</option>
          {Object.entries(STATUS_BADGE).map(([v, b]) => <option key={v} value={v}>{b.text}</option>)}
        </select>
        <button type="submit" className="px-3.5 py-2 rounded-xl border border-line bg-card text-xs font-semibold">Filter</button>
        {hasFilters && <Link href="/customers" className="text-xs text-slate hover:text-aqua">Clear</Link>}
      </form>
      {/* Deliberately a sibling <div>, not inside the filter <form> above —
          every trigger button here (BulkImportButton/ExportExcelButton/
          PrintButton/CustomerForm's "New Customer") is a plain <button>
          without type="button" set at the component level, so nesting it
          inside a <form> makes clicking it ALSO submit that form (a real
          navigation to /customers), racing and killing the just-opened
          modal. That was the cause of "New Customer opens then crashes". */}
      <div className="no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="flex-1" />
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Customer Code, Name*, Company, Contact Person, Mobile*, Alternate Phone, WhatsApp, Email, Customer Type, Address, Area, Zone, Route, Delivery Days, Driver, Vehicle, Product, Quantity, Rate, Discount, Payment Terms, Payment Frequency, Credit Limit, Opening Balance, Opening Bottle Balance, Status, Notes"
          action={bulkImportCustomers}
          sampleRow={CUSTOMER_SAMPLE_ROW}
          previewType="customers"
          expectedFields={CUSTOMER_IMPORT_FIELDS}
          duplicateKey="Mobile"
          existingValues={(customers || []).map((c) => c.mobile).filter(Boolean)}
        />
        <ExportExcelButton rows={exportRows} filename="evergreen-customers.xlsx" sheetName="Customers" />
        <PrintButton />
        <CustomerForm mode="create" {...formProps} />
      </div>
      <p className="no-print text-xs text-slate mb-2">{rows.length} of {allRows.length} customers</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Customer ID</Th><Th>Name</Th><Th>Phone</Th><Th>Zone</Th><Th>Type</Th><Th>Balance</Th><Th>Status</Th><Th className="no-print">Quick Actions</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate">No customers match.</td></tr>}
            {rows.map((c) => {
              const badge = STATUS_BADGE[c.status] || (c.is_active ? STATUS_BADGE.active : STATUS_BADGE.inactive);
              return (
                <tr key={c.id} className="hover:bg-foam">
                  <Td className="font-mono-num text-slate">{c.code || "—"}</Td>
                  <Td><Link href={`/customers/${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                  <Td>{c.mobile}</Td>
                  <Td>{c.zones?.name || "—"}</Td>
                  <Td>{c.customer_type}</Td>
                  <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                  <Td><Badge text={badge.text} tone={badge.tone} /></Td>
                  <Td className="no-print">
                    <div className="flex gap-1.5">
                      <Link href={`/deliveries?customer=${c.id}`} title="Deliver" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-aqua hover:bg-aquaSoft"><Truck size={15} /></Link>
                      <Link href={`/payments?customer=${c.id}`} title="Collect Payment" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-green hover:bg-greenSoft"><Wallet size={15} /></Link>
                      <Link href={`/invoices?customer=${c.id}`} title="Create Invoice" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-navy hover:bg-foam"><FilePlus size={15} /></Link>
                      <Link href={`/customers/${c.id}`} title="View Profile" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-slate hover:bg-foam"><UserCircle2 size={15} /></Link>
                      {canDelete && (
                        <ReasonConfirmButton action={deleteCustomer} id={c.id} label="" icon={Trash2}
                          confirmText={`Permanently delete ${c.name}?`}
                          detailText="This can't be undone. Blocked automatically if this customer has any delivery, invoice, payment, or ledger history — archive instead in that case."
                          confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
