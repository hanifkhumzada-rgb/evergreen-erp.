import { User, Phone, MapPin, Droplet } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";

export const dynamic = "force-dynamic";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-line last:border-0">
      <Icon size={15} className="text-aqua mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-[10.5px] text-slate uppercase tracking-wide font-semibold">{label}</div>
        <div className="text-sm mt-0.5">{value || "—"}</div>
      </div>
    </div>
  );
}

export default async function PortalProfilePage() {
  const { supabase, customerId } = await requirePortalCustomer();
  const { data: customer } = await supabase.from("customers")
    .select("name, code, mobile, whatsapp_number, address, area, zones(name), payment_frequency, delivery_frequency, registration_date")
    .eq("id", customerId).maybeSingle();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-semibold">My Profile</h1>
      <div className="bg-card border border-line rounded-2xl p-5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-aqua to-navyLight text-white flex items-center justify-center text-lg font-bold mb-3">
          {customer?.name?.[0]?.toUpperCase()}
        </div>
        <Row icon={User} label="Name" value={customer?.name} />
        <Row icon={User} label="Customer ID" value={customer?.code} />
        <Row icon={Phone} label="Mobile" value={customer?.mobile} />
        <Row icon={MapPin} label="Address" value={[customer?.address, customer?.area, customer?.zones?.name].filter(Boolean).join(", ")} />
        <Row icon={Droplet} label="Delivery Frequency" value={customer?.delivery_frequency} />
        <Row icon={Droplet} label="Payment Frequency" value={customer?.payment_frequency} />
      </div>
      <p className="text-[11px] text-slate text-center">To update your details, please contact Evergreen Water directly.</p>
    </div>
  );
}
