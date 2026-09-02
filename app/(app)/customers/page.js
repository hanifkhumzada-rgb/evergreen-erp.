import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pkr } from "@/lib/format";
import { Badge, ExportExcelButton, PrintButton, Th, Td } from "@/components/ui";
import CustomerForm from "@/components/CustomerForm";
import BulkImportButton from "@/components/BulkImportButton";
import { bulkImportCustomers } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  active: { text: "Active", tone: "green" },
  inactive: { text: "Inactive", tone: "slate" },
  on_hold: { text: "On Hold", tone: "amber" },
  blacklisted: { text: "Blacklisted", tone: "coral" },
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: customers }, { data: zones }, { data: balances }, { data: products }, { data: vehicles }, { data: riders }, { data: profile }] = await Promise.all([
    supabase.from("customers").select("*, zones(name)").order("created_at", { ascending: false }),
    supabase.from("zones").select("*"),
    supabase.from("v_customer_balance").select("customer_id, balance"),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.from("profiles").select("roles(key)").eq("id", user.id).single(),
  ]);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const allRows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  const canManageFinancial = ["owner", "admin"].includes(profile?.roles?.key);

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

  const formProps = { zones: zones || [], products: products || [], vehicles: vehicles || [], riders: riders || [], canManageFinancial };
  const hasFilters = q || zoneFilter || statusFilter || typeFilter;

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-4">Customers</h2>
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
      </form>
      <p className="no-print text-xs text-slate mb-2">{rows.length} of {allRows.length} customers</p>
      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam"><Th>Customer ID</Th><Th>Name</Th><Th>Phone</Th><Th>Zone</Th><Th>Type</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate">No customers match.</td></tr>}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
