"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X, ChevronLeft, ChevronRight, CheckCircle2, Info, Loader2, SkipForward } from "lucide-react";
import { Badge, Th, Td } from "@/components/ui";
import WhatsAppButton from "@/components/WhatsAppButton";
import { waHref } from "@/lib/whatsapp";
import { sendBulkPaymentReminders } from "@/app/actions";

const pkr = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-PK")}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const AUTO_ADVANCE_MS = 1500;

// Daily Payment Recovery Center list with multi-select bulk reminders.
// - WhatsApp configured (Twilio): one click sends all selected via the
//   normal notification pipeline (logged in notification_logs).
// - Not configured: WhatsApp does not allow one-click bulk sending from a
//   normal number, so we say so and offer a tap-through queue — each tap
//   opens that customer's chat with the reminder pre-filled, then the queue
//   moves on to the next customer.
export default function RecoveryReminderTable({ rows, whatsappConfigured, canAutoSend, bucketLabel, bucketTone, priorityTone }) {
  const [selected, setSelected] = useState(() => new Set());
  const [queue, setQueue] = useState(null); // { items, index, done:Set }
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const selectable = useMemo(() => rows.filter((r) => r.balance > 0), [rows]);
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.customerId));
  const selectedRows = rows.filter((r) => selected.has(r.customerId));
  const selectedTotal = selectedRows.reduce((a, r) => a + r.balance, 0);
  const withPhone = selectedRows.filter((r) => waHref(r.mobile, r.message));
  const autoMode = whatsappConfigured && canAutoSend;

  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.customerId)));

  const sendAll = async () => {
    if (!selectedRows.length) return;
    if (!window.confirm(`Send a WhatsApp payment reminder to ${selectedRows.length} customer${selectedRows.length === 1 ? "" : "s"} now?`)) return;
    setSending(true); setResult(null);
    try {
      const res = await sendBulkPaymentReminders(selectedRows.map((r) => r.customerId));
      setResult(res);
      if (res?.ok) setSelected(new Set());
    } catch {
      setResult({ error: "Network error — please check your connection and try again." });
    }
    setSending(false);
  };

  const startQueue = () => {
    if (!withPhone.length) return;
    setQueue({ items: withPhone, index: 0, done: new Set() });
  };

  return (
    <div className="mb-6">
      {rows.length > 0 && (
        <div className="no-print mb-2.5 flex flex-wrap items-center gap-2.5 rounded-2xl border border-line bg-card px-3 py-2.5">
          <label className="flex min-h-[40px] items-center gap-2 text-xs font-semibold">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-[#059669]" aria-label="Select all customers with a balance" />
            {selected.size ? `${selected.size} selected · ${pkr(selectedTotal)}` : `Select all ${selectable.length} in this list`}
          </label>
          <div className="flex-1" />
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="min-h-[40px] rounded-xl px-2 text-xs text-slate hover:text-aqua">Clear</button>
          )}
          <button type="button" disabled={!selected.size || sending || (!autoMode && !withPhone.length)}
            onClick={autoMode ? sendAll : startQueue}
            className="flex min-h-[40px] items-center gap-2 rounded-xl bg-[#059669] px-3.5 text-xs font-bold text-white shadow-sm disabled:opacity-45">
            {sending ? <Loader2 size={15} className="animate-spin" /> : autoMode ? <Send size={15} /> : <MessageCircle size={15} />}
            {autoMode ? "Send Reminders to Selected" : "Remind Selected via WhatsApp"}
          </button>
        </div>
      )}

      {!autoMode && selected.size > 0 && (
        <div className="no-print mb-2.5 flex gap-2.5 rounded-2xl border border-amber/30 bg-amberSoft/60 px-3.5 py-3 text-[12px] text-ink">
          <Info size={16} className="mt-0.5 shrink-0 text-amber" />
          <div>
            <p className="font-semibold">WhatsApp automatic sending is not connected{whatsappConfigured ? " for your account" : ""}.</p>
            <p className="mt-0.5 text-slate">
              {whatsappConfigured
                ? "Automatic bulk sending needs Owner/Settings access."
                : "WhatsApp only allows true one-click bulk messages through its paid Business (Cloud) API — set it up in Settings → Integrations to enable that."}
              {" "}Until then, the queue opens each selected customer&apos;s chat with the reminder already written — just tap Send in WhatsApp and it moves to the next customer.
              {selectedRows.length > withPhone.length && ` ${selectedRows.length - withPhone.length} selected customer(s) have no phone number and will be skipped.`}
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className={`no-print mb-2.5 rounded-2xl border px-3.5 py-3 text-[12px] ${result.error ? "border-coral/30 bg-coralSoft text-coral" : "border-green/30 bg-greenSoft text-ink"}`}>
          {result.error ? result.error : (
            <>
              <p className="font-semibold">Reminders sent: {result.sent}{result.failed ? ` · failed: ${result.failed}` : ""}{result.skipped ? ` · skipped: ${result.skipped}` : ""}</p>
              {result.failures?.length > 0 && <p className="mt-1 text-slate">{result.failures.join(" · ")}</p>}
              <p className="mt-1 text-slate">Each message is logged in the <Link href="/communication" className="font-semibold text-aqua">Communication Center</Link>.</p>
            </>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-line rounded-2xl">
          <table className="w-full text-[13.5px] border-collapse">
            <thead><tr className="bg-foam"><Th className="no-print w-10"><HeaderCheckbox checked={allSelected} partial={selected.size > 0 && !allSelected} onChange={toggleAll} count={selectable.length} /></Th><Th>Priority</Th><Th>Customer</Th><Th>Amount Due</Th><Th>Due Date</Th><Th>Frequency</Th><Th>Last Payment</Th><Th>Status</Th><Th className="no-print">&nbsp;</Th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.customerId} className={`hover:bg-foam ${selected.has(d.customerId) ? "bg-aquaSoft/50" : ""}`}>
                  <Td className="no-print">
                    <input type="checkbox" checked={selected.has(d.customerId)} onChange={() => toggle(d.customerId)} disabled={d.balance <= 0}
                      className="h-4 w-4 accent-[#059669]" aria-label={`Select ${d.name}`} />
                  </Td>
                  <Td><Badge text={d.priority} tone={priorityTone[d.priority]} /></Td>
                  <Td><Link href={`/customers/${d.customerId}`} className="font-semibold text-navy hover:text-aqua">{d.name}</Link>{d.isHighOutstanding && <div className="text-[10px] text-amber mt-0.5">High outstanding</div>}</Td>
                  <Td className="text-coral font-semibold">{pkr(d.balance)}</Td>
                  <Td>{fmtDate(d.dueDate)}</Td>
                  <Td>{d.freq}</Td>
                  <Td>{d.lastPayment ? fmtDate(d.lastPayment) : "never"}</Td>
                  <Td><Badge text={bucketLabel[d.bucket] || "Upcoming"} tone={bucketTone[d.bucket] || "slate"} /></Td>
                  <Td className="no-print"><WhatsAppButton phone={d.mobile} message={d.message} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {queue && <ReminderQueue queue={queue} setQueue={setQueue} onFinish={() => { setQueue(null); setSelected(new Set()); }} />}
    </div>
  );
}

// One-at-a-time tap-through: "Open WhatsApp" is a real link the Owner taps
// (browsers block pop-ups that aren't a direct tap), after which the queue
// auto-advances to the next customer so they can keep tapping through.
function ReminderQueue({ queue, setQueue, onFinish }) {
  const { items, index, done } = queue;
  const current = items[index];
  const [countdown, setCountdown] = useState(null);
  const timer = useRef(null);
  const finished = index >= items.length;

  useEffect(() => () => clearInterval(timer.current), []);
  useEffect(() => { clearInterval(timer.current); setCountdown(null); }, [index]);

  const go = (nextIndex) => setQueue((q) => ({ ...q, index: Math.max(0, Math.min(nextIndex, q.items.length)) }));

  const opened = () => {
    setQueue((q) => ({ ...q, done: new Set(q.done).add(current.customerId) }));
    let left = AUTO_ADVANCE_MS / 1000;
    setCountdown(left);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      left -= 0.5;
      if (left <= 0) { clearInterval(timer.current); go(index + 1); }
      else setCountdown(left);
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="WhatsApp reminder queue">
      <div className="w-full max-w-md rounded-3xl bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate">WhatsApp reminders</p>
            <p className="font-display text-lg font-semibold">{finished ? "All done" : `Customer ${index + 1} of ${items.length}`}</p>
          </div>
          <button type="button" onClick={onFinish} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-foam" aria-label="Close queue"><X size={18} /></button>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-foam">
          <div className="h-full rounded-full bg-[#059669] transition-all" style={{ width: `${(Math.min(index, items.length) / items.length) * 100}%` }} />
        </div>

        {finished ? (
          <div className="text-center">
            <CheckCircle2 size={36} className="mx-auto mb-2 text-green" />
            <p className="text-sm font-semibold">Opened {done.size} of {items.length} chats.</p>
            <p className="mt-1 text-xs text-slate">Make sure you tapped Send in each WhatsApp chat.</p>
            <button type="button" onClick={onFinish} className="mt-4 min-h-[44px] w-full rounded-xl bg-navy text-sm font-bold text-white">Finish</button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-line bg-foam/60 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{current.name}</p>
                  <p className="text-xs text-slate">{current.mobile}</p>
                </div>
                <span className="shrink-0 font-mono-num text-sm font-bold text-coral">{pkr(current.balance)}</span>
              </div>
              <p className="mt-2.5 max-h-28 overflow-y-auto whitespace-pre-line text-[12px] text-ink">{current.message}</p>
            </div>
            <a href={waHref(current.mobile, current.message)} target="_blank" rel="noopener noreferrer" onClick={opened}
              className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-bold text-[#053B36] shadow">
              <MessageCircle size={18} /> {done.has(current.customerId) ? "Open chat again" : "Open WhatsApp chat"}
            </a>
            <p className="mt-2 h-4 text-center text-[11px] text-slate">
              {countdown ? `Moving to the next customer in ${countdown.toFixed(1)}s…` : "Tap Send in WhatsApp, then come back here."}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="flex min-h-[44px] items-center gap-1 rounded-xl border border-line px-3 text-xs font-semibold disabled:opacity-40"><ChevronLeft size={15} /> Back</button>
              <button type="button" onClick={() => go(index + 1)} className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl border border-line text-xs font-semibold">
                {done.has(current.customerId) ? <>Next <ChevronRight size={15} /></> : <>Skip <SkipForward size={14} /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HeaderCheckbox({ checked, partial, onChange, count }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = partial; }, [partial]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange} disabled={!count}
      aria-label={`Select all ${count} customers in this list`} title={`Select all ${count} in this list`}
      className="h-4 w-4 cursor-pointer align-middle accent-[#059669] disabled:opacity-40" />
  );
}
