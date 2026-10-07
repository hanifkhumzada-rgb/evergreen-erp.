"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ExternalLink, Loader2, FileText } from "lucide-react";
import { getRecordDetail } from "@/app/(app)/reports/actions";
import { statusInfo, TONE_CLASS } from "@/lib/ew/status";
import { fmtDateTime } from "@/lib/format";

// Right-side Detail Drawer. Loads one transaction (with its customer,
// payment/invoice links, entered-by, approval and audit history) through a
// server action — the report stays open and scrolled behind it.
export default function DetailDrawer({ kind, id, title, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: "" });
    getRecordDetail(kind, id)
      .then((res) => { if (alive) setState({ loading: false, data: res?.error ? null : res, error: res?.error || "" }); })
      .catch((e) => { if (alive) setState({ loading: false, data: null, error: e?.message || "Could not load details." }); });
    return () => { alive = false; };
  }, [kind, id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const d = state.data;
  const st = d?.status ? statusInfo(d.status) : null;

  return (
    <div className="no-print" data-ew-drawer-open>
      <div className="ew-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="ew-drawer" role="dialog" aria-modal="true" aria-label={`${d?.title || title || "Transaction"} details`}>
        <div className="ew-drawer-head">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#BFE6F2]">{d?.typeLabel || "Transaction Details"}</div>
            <div className="truncate text-lg font-extrabold">{d?.title || title || "…"}</div>
            {st ? <span className={`${TONE_CLASS[st.tone]} mt-1`}>{st.label}</span> : null}
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Close details"><X size={18} /></button>
        </div>
        <div className="ew-drawer-body">
          {state.loading ? <div className="flex items-center gap-2 text-sm text-slate"><Loader2 size={16} className="animate-spin" /> Loading details…</div> : null}
          {state.error ? <p className="rounded-xl bg-coralSoft px-3 py-2 text-sm text-coral">{state.error}</p> : null}
          {d?.sections?.filter((s) => s.fields?.some((f) => f.value !== undefined)).map((s) => (
            <section key={s.title}>
              <h3 className="ew-drawer-section-title">{s.title}</h3>
              <dl className="ew-dl">
                {s.fields.filter((f) => f.value !== undefined).map((f) => (
                  <div key={f.label} className={f.wide ? "ew-dl-wide" : ""}><dt>{f.label}</dt><dd>{f.value === null || f.value === "" ? "—" : f.value}</dd></div>
                ))}
              </dl>
            </section>
          ))}
          {d?.lines?.length ? (
            <section>
              <h3 className="ew-drawer-section-title">{d.linesTitle || "Lines"}</h3>
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-[12.5px]">
                  <tbody>{d.lines.map((l, i) => <tr key={i} className="border-t border-line first:border-t-0"><td className="px-3 py-2">{l.label}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{l.value}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}
          {d?.links?.length ? (
            <section>
              <h3 className="ew-drawer-section-title">Related Documents</h3>
              <div className="flex flex-wrap gap-2">
                {d.links.map((l) => <Link key={l.href} href={l.href} className="ew-tool-btn"><FileText size={15} /><span style={{ display: "inline" }}>{l.label}</span></Link>)}
              </div>
            </section>
          ) : null}
          {d ? (
            <section>
              <h3 className="ew-drawer-section-title">Audit History</h3>
              {d.audit?.length ? (
                <div className="ew-audit">
                  {d.audit.map((a, i) => (
                    <div key={i} className="ew-audit-item">
                      <div className="font-semibold text-ink">{a.action}</div>
                      <div className="text-slate">{fmtDateTime(a.at)}{a.by ? ` · ${a.by}` : ""}</div>
                      {a.note ? <div className="mt-0.5 text-slate">{a.note}</div> : null}
                    </div>
                  ))}
                </div>
              ) : <p className="text-[12.5px] text-slate">No audit entries recorded for this transaction.</p>}
            </section>
          ) : null}
        </div>
        <div className="ew-drawer-foot">
          {d?.fullHref ? <Link href={d.fullHref} className="ew-tool-btn ew-tool-back flex-1"><ExternalLink size={16} /><span style={{ display: "inline" }}>View Full Record</span></Link> : null}
          <button type="button" onClick={onClose} className="ew-tool-btn flex-1"><X size={16} /><span style={{ display: "inline" }}>Close</span></button>
        </div>
      </aside>
    </div>
  );
}
