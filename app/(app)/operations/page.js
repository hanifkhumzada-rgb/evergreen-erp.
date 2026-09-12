import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, KPI } from "@/components/ui";
import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, ClipboardCheck, Droplet, FileSpreadsheet, Receipt, Truck, Users, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

const today = () => new Date().toISOString().slice(0, 10);

export default async function OperationsPage() {
  const supabase = await createClient();
  const date = today();
  const [
    customers, missingRoutes, deliveries, payments, expenses, closings, riders, routes,
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true).is("route_id", null),
    supabase.from("deliveries").select("id,status,amount,amount_collected").eq("delivery_date", date),
    supabase.from("payments").select("amount").eq("payment_date", date),
    supabase.from("expenses").select("amount").eq("expense_date", date).neq("status", "rejected"),
    supabase.from("cash_transactions").select("id").eq("reference_type", "daily_closing").eq("txn_date", date).limit(1),
    supabase.from("profiles").select("id, roles!inner(key)", { count: "exact", head: true }).eq("is_active", true).eq("roles.key", "rider"),
    supabase.from("routes").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  const deliveryRows = deliveries.data || [];
  const delivered = deliveryRows.filter((row) => row.status === "delivered").length;
  const pending = deliveryRows.filter((row) => ["pending", "rescheduled"].includes(row.status)).length;
  const collected = (payments.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const spent = (expenses.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const isClosed = Boolean(closings.data?.length);

  const steps = [
    { href: "/settings/export", title: "1. Import & verify data", text: "Excel/CSV import, coloured Excel export and backup.", icon: FileSpreadsheet, done: (customers.count || 0) > 0 },
    { href: "/deliveries", title: "2. Run deliveries", text: `${delivered} completed · ${pending} pending today`, icon: Truck, done: deliveryRows.length > 0 && pending === 0 },
    { href: "/payments", title: "3. Record collections", text: `PKR ${collected.toLocaleString()} received today`, icon: Receipt, done: collected > 0 },
    { href: "/expenses", title: "4. Record expenses", text: `PKR ${spent.toLocaleString()} entered today`, icon: Wallet, done: (expenses.data || []).length > 0 },
    { href: "/bottles", title: "5. Reconcile bottles", text: "Check customer, rider and warehouse bottle balance.", icon: Droplet, done: false },
    { href: "/accounting/daily-closing", title: "6. Close the day", text: isClosed ? "Today is closed and recorded." : "Cash, expenses and variance are awaiting closing.", icon: ClipboardCheck, done: isClosed },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div><div className="flex items-center gap-2"><CalendarCheck className="text-aqua" size={23} /><h1 className="font-display text-2xl font-semibold">Daily Operations</h1></div><p className="text-sm text-slate mt-1">Morning setup se daily closing tak ek connected workspace.</p></div>
        <Badge text={isClosed ? "Day Closed" : "Day In Progress"} tone={isClosed ? "green" : "amber"} />
      </div>

      <div className="flex flex-wrap gap-3.5 mb-5">
        <KPI label="ACTIVE CUSTOMERS" value={customers.count || 0} tone="navy" href="/customers" />
        <KPI label="DELIVERED TODAY" value={delivered} tone="green" href="/deliveries" />
        <KPI label="PENDING TODAY" value={pending} tone={pending ? "amber" : "slate"} href="/deliveries" />
        <KPI label="ACTIVE ROUTES" value={routes.count || 0} tone="aqua" href="/zones" />
      </div>

      {(missingRoutes.count || 0) > 0 || (riders.count || 0) === 0 ? <div className="mb-5 rounded-2xl border border-amber/20 bg-amberSoft p-4 flex gap-3"><AlertTriangle className="text-amber flex-shrink-0" size={20} /><div><p className="text-sm font-semibold">Setup attention required</p><p className="text-xs text-slate mt-1">{missingRoutes.count || 0} active customers have no route; {riders.count || 0} active delivery staff found. Assigning these makes scheduling and automation reliable.</p><Link href="/customers" className="inline-flex items-center gap-1 text-xs font-bold text-aqua mt-2">Review customers <ArrowRight size={13} /></Link></div></div> : null}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {steps.map((step) => { const Icon = step.icon; return <Link key={step.href} href={step.href} prefetch className="card-lift rounded-2xl border border-line bg-card p-5 flex items-start gap-4"><div className={`w-11 h-11 rounded-2xl grid place-items-center flex-shrink-0 ${step.done ? "bg-greenSoft text-green" : "bg-aquaSoft text-aqua"}`}>{step.done ? <CheckCircle2 size={21} /> : <Icon size={21} />}</div><div className="min-w-0 flex-1"><h2 className="font-semibold text-sm">{step.title}</h2><p className="text-xs text-slate mt-1 leading-relaxed">{step.text}</p></div><ArrowRight size={16} className="text-slate flex-shrink-0 mt-1" /></Link>; })}
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-3.5">
        <Link href="/customers" className="rounded-2xl border border-line bg-foam p-4 flex items-center gap-3"><Users size={19} className="text-aqua" /><span className="text-sm font-semibold">Customer master & schedules</span><ArrowRight size={15} className="ml-auto text-slate" /></Link>
        <Link href="/reports" className="rounded-2xl border border-line bg-foam p-4 flex items-center gap-3"><CheckCircle2 size={19} className="text-aqua" /><span className="text-sm font-semibold">Management reports & health</span><ArrowRight size={15} className="ml-auto text-slate" /></Link>
      </div>
    </div>
  );
}
