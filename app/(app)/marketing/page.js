import Link from "next/link";
import { getCurrentProfile } from "@/lib/session";
import { Megaphone, MessageCircle, Users, Target, Sparkles, ArrowRight, CalendarClock } from "lucide-react";

export const metadata = { title: "Marketing Studio | Evergreen Water" };

export default async function MarketingPage() {
  const { supabase } = await getCurrentProfile();
  const [{ count: active }, { count: overdue }, { count: monthly }] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("v_customer_balance").select("customer_id", { count: "exact", head: true }).gt("balance", 0),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("is_active", true).ilike("payment_frequency", "monthly"),
  ]);
  const segments = [
    { name: "All active customers", count: active || 0, icon: Users, tone: "bg-aquaSoft text-aqua", use: "Offers & service updates" },
    { name: "Payment follow-up", count: overdue || 0, icon: Target, tone: "bg-amberSoft text-amber", use: "Friendly outstanding reminder" },
    { name: "Monthly customers", count: monthly || 0, icon: CalendarClock, tone: "bg-greenSoft text-green", use: "Statement & loyalty campaign" },
  ];
  return <div>
    <div className="rounded-[28px] bg-gradient-to-br from-navy to-[#087C69] text-white p-6 sm:p-8 mb-6 relative overflow-hidden">
      <div className="absolute right-[-40px] top-[-60px] w-60 h-60 rounded-full bg-white/10" />
      <div className="relative max-w-2xl"><div className="flex items-center gap-2 text-[#9EF0D0] text-xs font-bold uppercase tracking-widest"><Sparkles size={15} /> Growth workspace</div><h1 className="font-display text-3xl font-semibold mt-3">Marketing Studio</h1><p className="text-[#CDE7E3] text-sm mt-2">Customer segments, WhatsApp campaigns, offers aur follow-ups ko ek jagah se plan karein.</p></div>
    </div>
    <div className="grid sm:grid-cols-3 gap-4 mb-6">{segments.map(({name,count,icon:Icon,tone,use}) => <div key={name} className="card-lift rounded-2xl border bg-card p-5"><div className={`w-10 h-10 rounded-xl grid place-items-center ${tone}`}><Icon size={19}/></div><p className="font-mono-num text-2xl font-bold mt-4">{count}</p><p className="font-semibold text-sm">{name}</p><p className="text-xs text-slate mt-1">{use}</p></div>)}</div>
    <div className="grid lg:grid-cols-2 gap-5">
      <section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2 mb-4"><MessageCircle size={18} className="text-aqua"/><h2 className="font-display text-lg font-semibold">Campaign shortcuts</h2></div><div className="space-y-2">{["Delivery service update", "Monthly payment reminder", "New customer welcome", "Referral offer", "Holiday schedule notice"].map(x => <Link href="/communication" key={x} className="w-full flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold hover:bg-aquaSoft hover:border-aqua/30 transition-colors"><span>{x}</span><ArrowRight size={15} className="text-slate"/></Link>)}</div></section>
      <section className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2 mb-4"><Megaphone size={18} className="text-aqua"/><h2 className="font-display text-lg font-semibold">Automation-ready campaigns</h2></div><p className="text-sm text-slate">Templates approval ke baad WhatsApp Cloud API se scheduled campaign, delivery notice aur payment reminder automatically send ho sakta hai.</p><div className="mt-5 rounded-2xl bg-foam p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate">Recommended next campaign</p><p className="font-semibold mt-2">Monthly statement + friendly payment reminder</p><p className="text-xs text-slate mt-1">Audience: customers with due balance · Quiet hours respected</p></div><Link href="/communication" className="inline-flex items-center gap-2 mt-5 text-sm font-semibold text-aqua">Open Communication Center <ArrowRight size={15}/></Link></section>
    </div>
  </div>;
}
