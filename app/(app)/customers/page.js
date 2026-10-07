import { getCurrentProfile } from "@/lib/session";
import Link from "@/components/ErpNavLink";
import { pkr, fmtDate } from "@/lib/format";
import { Badge, KPI, DocumentActionBar, RecordStamp, RowActionMenu, Th, Td } from "@/components/ui";
import CustomerForm from "@/components/CustomerForm";
import BulkImportButton from "@/components/BulkImportButton";
import ReasonConfirmButton from "@/components/ReasonConfirmButton";
import { BulkSelectProvider, SelectAllCheckbox, RowCheckbox } from "@/components/BulkSelect";
import { bulkImportCustomers, deleteCustomer } from "@/app/actions";
import { getBrandingLite } from "@/lib/pdf/business";
import DocumentPrintHeader, { DocumentPrintFooter } from "@/components/DocumentPrintHeader";
import ListFilterBar from "@/components/ListFilterBar";
import Pager from "@/components/Pager";
import { fetchAll } from "@/lib/fetchAll";
import { pageFrom, rangeFor } from "@/lib/listParams";
import { CUSTOMER_LIST_COLUMNS, applyCustomerFilters, customerFilters } from "@/lib/listQueries";
import { exportCustomerRows } from "@/lib/exportActions";
import { Truck, Wallet, FilePlus, UserCircle2, Phone, MapPin, ChevronRight } from "lucide-react";

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
//
// Required set kept deliberately small for bulk import (unlike the regular
// New/Edit Customer form, where phone etc. stay required) — the Owner is
// importing ~200+ real customers at once and most rows won't have every
// field filled in yet. Only what's needed to place a customer on a route
// and bill them blocks a row: Name, Address, Area, Zone, Route, Rate, and
// Payment Frequency. Area and Zone are genuinely different columns here
// (area is a free-text locality like "Gulberg"; zone_id is the formal
// operational zone) so both are listed and required separately.
const CUSTOMER_IMPORT_FIELDS = [
  { key: "Customer Code", label: "Customer Code", required: false },
  { key: "Name", label: "Customer Name", required: true },
  { key: "Company", label: "Company", required: false },
  { key: "Contact Person", label: "Contact Person", required: false },
  { key: "Mobile", label: "Mobile", required: false },
  { key: "Alternate Phone", label: "Alternate Phone", required: false },
  { key: "WhatsApp", label: "WhatsApp", required: false },
  { key: "Email", label: "Email", required: false },
  { key: "Customer Type", label: "Customer Type", required: false },
  { key: "Building", label: "Building / Flat / Shop", required: false },
  { key: "Address", label: "Address", required: true },
  { key: "Area", label: "Area", required: true },
  { key: "Zone", label: "Zone", required: true },
  { key: "Route", label: "Route", required: true },
  { key: "Delivery Days", label: "Delivery Days", required: false },
  { key: "Driver", label: "Driver", required: false },
  { key: "Vehicle", label: "Vehicle", required: false },
  { key: "Product", label: "Product / Bottle Size", required: false },
  { key: "Quantity", label: "Quantity", required: false },
  { key: "Rate", label: "Rate", required: true },
  { key: "Discount", label: "Discount", required: false },
  { key: "Payment Terms", label: "Payment Terms", required: false },
  { key: "Payment Frequency", label: "Payment Frequency (Daily/Weekly/Monthly/Custom)", required: true },
  { key: "Credit Limit", label: "Credit Limit", required: false },
  { key: "Opening Balance", label: "Opening Balance", required: false },
  { key: "Opening Bottle Balance", label: "Opening Bottle Balance", required: false },
  { key: "Status", label: "Status", required: false },
  { key: "Notes", label: "Notes", required: false },
];
// Required columns are marked with a trailing "*" in the header itself —
// same no-space convention BulkImportButton's columnsHint below already
// used for Name*/Mobile*. The "*" is stripped out by the column-matching
// logic's normalize step, so a downloaded-then-reuploaded template still
// auto-maps correctly.
const CUSTOMER_SAMPLE_ROW = {
  "Customer Code": "", "Name*": "Ali Traders", Company: "Ali Traders", "Contact Person": "Ali Khan",
  Mobile: "03001234567", "Alternate Phone": "", WhatsApp: "03001234567", Email: "", "Customer Type": "Shop",
  Building: "Shop 4", "Address*": "Main Bazaar", "Area*": "Gulberg", "Zone*": "North Zone", "Route*": "Route 3",
  "Delivery Days": "Mon, Wed, Fri", Driver: "", Vehicle: "", Product: "19L", Quantity: 5,
  "Rate*": "", Discount: "", "Payment Terms": "Cash on Delivery", "Payment Frequency*": "Monthly", "Credit Limit": "",
  "Opening Balance": "", "Opening Bottle Balance": 0, Status: "Active", Notes: "",
};

const CUSTOMER_TYPES_FILTER = ["Home", "Office", "Corporate", "Shop", "Other"];

// Each rendered customer costs ~20 KB of HTML + RSC payload (a mobile card
// and a desktop row, each with several icons). Measured on production with
// 18 customers the page was already 384 KB, so ~300 customers would ship
// ~6 MB. Search, filters, KPIs and Excel export still cover the full set —
// only the rendered list is paged.
const PAGE_SIZE = 50;

export default async function CustomersPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const filters = customerFilters(sp);
  const { q, zone: zoneFilter, status: statusFilter, type: typeFilter } = filters;
  const requestedPage = pageFrom(sp);
  const [from, to] = rangeFor(requestedPage, PAGE_SIZE);

  const { supabase, profile } = await getCurrentProfile();
  const monthStartISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  // Search, filters and paging run in the database: only the visible page
  // of customers is loaded. KPIs describe the whole book via count queries
  // and the (small, numeric) balance view.
  const [branding, { data: customers, count: matchingCount }, { count: totalCount }, { count: newThisMonth }, { data: zones }, { data: balances }, { data: mobiles }, { data: products }, { data: vehicles }, { data: riders }, { data: routes }, { data: canDelete }] = await Promise.all([
    getBrandingLite(supabase),
    applyCustomerFilters(supabase.from("customers").select(CUSTOMER_LIST_COLUMNS, { count: "exact" }), filters)
      .order("created_at", { ascending: false }).order("id").range(from, to),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("customers").select("id", { count: "exact", head: true }).gte("created_at", monthStartISO),
    supabase.from("zones").select("id, name").order("name"),
    fetchAll(() => supabase.from("v_customer_balance").select("customer_id, balance").order("customer_id"), { label: "customer balances" }),
    fetchAll(() => supabase.from("customers").select("mobile").not("mobile", "is", null).order("mobile"), { label: "customer mobiles" }),
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("vehicles").select("id, registration_no").eq("is_active", true).order("registration_no"),
    supabase.from("profiles").select("id, full_name, roles!inner(key)").eq("roles.key", "rider").eq("is_active", true).order("full_name"),
    supabase.from("routes").select("id, name").eq("is_active", true).order("name"),
    supabase.rpc("fn_has_permission", { perm_key: "customers.delete" }),
  ]);

  const balanceMap = {};
  (balances || []).forEach((b) => { balanceMap[b.customer_id] = Number(b.balance); });
  const canManageFinancial = ["owner", "admin"].includes(profile?.roles?.key);
  const totalOutstanding = (balances || []).reduce((a, b) => a + Math.max(Number(b.balance), 0), 0);
  const customersDue = (balances || []).filter((b) => Number(b.balance) > 0).length;
  const allCount = totalCount || 0;
  const matching = matchingCount || 0;
  const page = requestedPage;
  const pageRows = (customers || []).map((c) => ({ ...c, balance: balanceMap[c.id] || 0 }));
  const exportAction = exportCustomerRows.bind(null, filters);

  const formProps = { zones: zones || [], products: products || [], vehicles: vehicles || [], riders: riders || [], routes: routes || [], canManageFinancial };

  return (
    <div>
      <DocumentPrintHeader branding={branding} title="Customers" meta={`${matching} of ${allCount} customers\nGenerated ${fmtDate(new Date().toISOString())}`} />
      <div className="no-print flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl font-semibold mb-1">Customers</h2>
          <p className="text-slate text-sm">Customer workspace — book, balances, and quick actions in one place.</p>
        </div>
        <CustomerForm mode="create" initialOpen={sp.quick === "new"} {...formProps} />
      </div>

      <div className="no-print dashboard-kpi-grid mb-5">
        <KPI label="TOTAL CUSTOMERS" value={allCount} tone="navy" />
        <KPI label="NEW THIS MONTH" value={newThisMonth} tone="aqua" />
        <KPI label="OUTSTANDING" value={pkr(totalOutstanding)} tone="coral" sub="total receivable across all customers" />
        <KPI label="CUSTOMERS DUE" value={customersDue} tone="amber" sub="with an outstanding balance" />
      </div>

      <ListFilterBar
        placeholder="Search name, ID, phone, area, address, route…"
        filters={[
          { name: "zone", label: "All zones", options: (zones || []).map((z) => ({ value: z.id, label: z.name })) },
          { name: "type", label: "All types", options: CUSTOMER_TYPES_FILTER.map((t) => ({ value: t, label: t })) },
          { name: "status", label: "All statuses", options: Object.entries(STATUS_BADGE).map(([value, b]) => ({ value, label: b.text })) },
        ]}
      />
      {/* Deliberately a sibling <div>, not inside the filter <form> above —
          every trigger button here (BulkImportButton/DocumentActionBar/
          CustomerForm's "New Customer") is a plain <button>
          without type="button" set at the component level, so nesting it
          inside a <form> makes clicking it ALSO submit that form (a real
          navigation to /customers), racing and killing the just-opened
          modal. That was the cause of "New Customer opens then crashes". */}
      <div className="erp-toolbar no-print flex flex-wrap gap-2.5 mb-4 items-center">
        <div className="mr-auto min-w-[150px]"><p className="text-xs font-bold text-ink">Customer directory</p><p className="text-[11px] text-slate">{matching} matching · {allCount} total</p></div>
        <BulkImportButton
          label="Bulk Import"
          columnsHint="Customer Code, Name*, Company, Contact Person, Mobile, Alternate Phone, WhatsApp, Email, Customer Type, Building, Address*, Area*, Zone*, Route*, Delivery Days, Driver, Vehicle, Product, Quantity, Rate*, Discount, Payment Terms, Payment Frequency*, Credit Limit, Opening Balance, Opening Bottle Balance, Status, Notes"
          action={bulkImportCustomers}
          sampleRow={CUSTOMER_SAMPLE_ROW}
          previewType="customers"
          expectedFields={CUSTOMER_IMPORT_FIELDS}
          duplicateKey="Mobile"
          existingValues={(mobiles || []).map((c) => c.mobile).filter(Boolean)}
        />
        <DocumentActionBar
          print
          excel={{ loadRows: exportAction, sheetName: "Customers", reportTitle: "Customers", branding }}
          share={{ title: "Customers" }}
        />
      </div>
      <div className="no-print mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-slate">
          {`${matching} of ${allCount} customers`}
        </p>
        <p className="hidden text-[11px] text-slate sm:block">Tap a customer to open their complete 360° profile.</p>
      </div>

      <BulkSelectProvider noun="customer" actions={canDelete ? [{ key: "delete", label: "Delete", icon: "trash", action: deleteCustomer, confirmLabel: "Delete", busyLabel: "Deleting", doneLabel: "Delete", detailText: "Each customer is deleted exactly as with the single Delete button. Customers with any delivery, invoice, payment or ledger history are refused automatically (archive them instead) and listed as failed." }] : []}>
      {canDelete && pageRows.length > 0 && (
        <div className="no-print mb-2 flex items-center gap-2 md:hidden">
          <SelectAllCheckbox /><span className="text-xs text-slate">Select all {pageRows.length} on this page</span>
        </div>
      )}
      <div className="no-print grid gap-3 md:hidden">
        {pageRows.length === 0 && <div className="rounded-2xl border border-line bg-card p-8 text-center text-sm text-slate">No customers match your search or filters.</div>}
        {pageRows.map((c) => {
          const badge = STATUS_BADGE[c.status] || (c.is_active ? STATUS_BADGE.active : STATUS_BADGE.inactive);
          return (
            <article key={c.id} className="customer-mobile-card rounded-2xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                {canDelete && <span className="pt-1"><RowCheckbox id={c.id} label={c.name} /></span>}
                <Link href={`/customers/${c.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-ink">{c.name}</span>
                  <span className="mt-0.5 block font-mono-num text-xs text-slate">{c.code || "No customer ID"}</span>
                </Link>
                <Badge text={badge.text} tone={badge.tone} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5 text-slate"><Phone size={13} className="shrink-0" /><span className="truncate">{c.mobile || "No phone"}</span></span>
                <span className="flex min-w-0 items-center gap-1.5 text-slate"><MapPin size={13} className="shrink-0" /><span className="truncate">{c.zones?.name || c.area || "No zone"}</span></span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate">Outstanding</span>
                  <span className={c.balance > 0 ? "font-mono-num text-sm font-bold text-coral" : "font-mono-num text-sm font-bold text-green"}>{pkr(c.balance)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link href={`/deliveries?customer=${c.id}`} aria-label={`New delivery for ${c.name}`} className="grid h-9 w-9 place-items-center rounded-xl bg-aquaSoft text-aqua"><Truck size={15} /></Link>
                  <Link href={`/payments?customer=${c.id}`} aria-label={`Receive payment from ${c.name}`} className="grid h-9 w-9 place-items-center rounded-xl bg-greenSoft text-green"><Wallet size={15} /></Link>
                  <Link href={`/customers/${c.id}`} aria-label={`View ${c.name} profile`} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-navy"><ChevronRight size={17} /></Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
        <table className="w-full text-[13.5px] border-collapse">
          <thead><tr className="bg-foam">{canDelete && <Th className="no-print w-10"><SelectAllCheckbox /></Th>}<Th>Customer ID</Th><Th>Name</Th><Th>Phone</Th><Th>Zone</Th><Th>Type</Th><Th>Balance</Th><Th>Status</Th><Th>Details</Th><Th className="no-print">Actions</Th></tr></thead>
          <tbody>
            {pageRows.length === 0 && <tr><td colSpan={canDelete ? 10 : 9} className="text-center py-8 text-slate">No customers match.</td></tr>}
            {pageRows.map((c) => {
              const badge = STATUS_BADGE[c.status] || (c.is_active ? STATUS_BADGE.active : STATUS_BADGE.inactive);
              return (
                <tr key={c.id} className="hover:bg-foam">
                  {canDelete && <Td className="no-print"><RowCheckbox id={c.id} label={c.name} /></Td>}
                  <Td className="font-mono-num text-slate">{c.code || "—"}</Td>
                  <Td><Link href={`/customers/${c.id}`} className="font-semibold text-navy hover:text-aqua">{c.name}</Link></Td>
                  <Td>{c.mobile}</Td>
                  <Td>{c.zones?.name || "—"}</Td>
                  <Td>{c.customer_type}</Td>
                  <Td><span className={c.balance > 0 ? "text-coral font-semibold" : "text-green font-semibold"}>{pkr(c.balance)}</span></Td>
                  <Td><Badge text={badge.text} tone={badge.tone} /></Td>
                  <Td><RecordStamp date={c.created_at} user={c.creator?.full_name} updatedAt={c.updated_at} updatedBy={c.updater?.full_name} /></Td>
                  <Td className="no-print">
                    <RowActionMenu label={`Actions for ${c.name}`}>
                      <Link href={`/deliveries?customer=${c.id}`} title="Deliver" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-aqua hover:bg-aquaSoft"><Truck size={15} /></Link>
                      <Link href={`/payments?customer=${c.id}`} title="Collect Payment" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-green hover:bg-greenSoft"><Wallet size={15} /></Link>
                      <Link href={`/invoices?customer=${c.id}`} title="Create Invoice" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-navy hover:bg-foam"><FilePlus size={15} /></Link>
                      <Link href={`/customers/${c.id}`} title="View Profile" className="w-9 h-9 flex items-center justify-center rounded-lg border border-line text-slate hover:bg-foam"><UserCircle2 size={15} /></Link>
                      {canDelete && (
                        <ReasonConfirmButton action={deleteCustomer} id={c.id} label="Delete" icon="trash"
                          confirmText={`Permanently delete ${c.name}?`}
                          detailText="This can't be undone. Blocked automatically if this customer has any delivery, invoice, payment, or ledger history — archive instead in that case."
                          confirmLabel="Confirm Delete" busyLabel="Deleting…" />
                      )}
                    </RowActionMenu>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </BulkSelectProvider>
      <Pager basePath="/customers" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={matching} label="Customer pages" />
      <DocumentPrintFooter />
    </div>
  );
}
