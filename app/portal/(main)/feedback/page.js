import { Star } from "lucide-react";
import { requirePortalCustomer } from "@/app/portal/actions";
import { fmtDate } from "@/lib/format";
import FeedbackForm from "@/components/portal/FeedbackForm";

export const dynamic = "force-dynamic";

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={13} className={i <= n ? "fill-amber text-amber" : "text-line"} />)}
    </div>
  );
}

export default async function PortalFeedbackPage() {
  const { supabase, customerId } = await requirePortalCustomer();

  const [{ data: feedback }, { data: deliveries }] = await Promise.all([
    supabase.from("customer_feedback").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("deliveries").select("id, delivery_no, delivery_date").eq("customer_id", customerId).order("delivery_date", { ascending: false }).limit(20),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-semibold">Feedback</h1>
      <FeedbackForm deliveries={deliveries} />

      <div>
        <h2 className="text-xs font-bold text-slate uppercase tracking-wide mb-2">Your Past Feedback</h2>
        <div className="flex flex-col gap-2.5">
          {(feedback || []).length === 0 && <div className="bg-card border border-line rounded-2xl p-5 text-xs text-slate text-center">No feedback given yet.</div>}
          {(feedback || []).map((f) => (
            <div key={f.id} className="bg-card border border-line rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <Stars n={f.overall_rating} />
                <span className="text-[10.5px] text-slate">{fmtDate(f.created_at)}</span>
              </div>
              {f.comment && <p className="text-xs mt-2">{f.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
