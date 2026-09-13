import Link from "next/link";
import { Eye, Users, Truck, ReceiptText, Wallet, ArrowRight } from "lucide-react";

export const metadata = { title: "Record Preview | Evergreen Water" };

const AREAS = [
  { href: "/customers", label: "Customers", desc: "Customer profile ko read-only preview mein dekhein, phir zarurat par full profile open karein.", icon: Users },
  { href: "/deliveries", label: "Deliveries", desc: "Delivery history, bottle quantity aur collected cash verify karein. Wrong entry ho to correction workflow use karein.", icon: Truck },
  { href: "/invoices", label: "Invoices", desc: "Invoice ko preview karein, Print/PDF/Excel use karein aur full invoice sirf zarurat par open karein.", icon: ReceiptText },
  { href: "/expenses", label: "Expenses", desc: "Expense details ko safe preview mein verify karein before void/approval actions.", icon: Wallet },
];

export default function DocumentsPage() {
  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-aquaSoft text-aqua"><Eye size={22} /></div>
        <div>
          <h1 className="font-display text-2xl font-semibold">Smart Record Preview</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate">Preview ab separate file-upload tool nahi hai. ERP ke actual records ke andar View/Preview diya gaya hai, jahan se Print, PDF, Excel ya full record open kiya ja sakta hai.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {AREAS.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="card-lift group rounded-2xl border border-line bg-card p-5 transition hover:border-aqua/40 hover:bg-aquaSoft/20">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foam text-aqua"><Icon size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-navy">{label}</h2><ArrowRight size={16} className="text-slate transition group-hover:translate-x-0.5 group-hover:text-aqua" /></div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-foam/60 p-4 text-xs text-slate">
        Rule: <strong className="text-ink">Preview = read-only</strong>. Edit, Void, Delete ya financial correction alag controlled action se hoti hai, taake accidental changes na hon.
      </div>
    </div>
  );
}
