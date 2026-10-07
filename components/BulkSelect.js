"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Trash2, Archive, UserX, X, Loader2, Check, Minus } from "lucide-react";

// Multi-select + bulk actions for any list page, dropped into existing
// server-rendered tables:
//   <BulkSelectProvider actions={[...]} noun="payment">
//     <table> <Th><SelectAllCheckbox /></Th> … <Td><RowCheckbox id=… label=… /></Td> </table>
//   </BulkSelectProvider>
// A bulk action runs the SAME server action as the single-row button
// (e.g. voidPayment(id, reason)) once per selected row, with the one reason
// entered here — so permissions, reason checks and audit logging are exactly
// what deleting/voiding one at a time does. Only rows that render a
// RowCheckbox (i.e. rows the single-row action is offered for) can be
// selected; "select all" covers those rows on the current page.
const ICONS = { ban: Ban, trash: Trash2, archive: Archive, "user-x": UserX };
const Ctx = createContext(null);
const CONCURRENCY = 3;

function pluralize(word) {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

export function BulkSelectProvider({ actions = [], noun = "record", scopeLabel = "on this page", children }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set());
  const [rows, setRows] = useState(() => new Map()); // id -> label (registration order kept)
  const [pending, setPending] = useState(null); // action being confirmed
  const [reason, setReason] = useState("");
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const register = useCallback((id, label) => {
    setRows((prev) => (prev.get(id) === label ? prev : new Map(prev).set(id, label)));
    return () => {
      setRows((prev) => { if (!prev.has(id)) return prev; const next = new Map(prev); next.delete(id); return next; });
      setSelected((prev) => { if (!prev.has(id)) return prev; const next = new Set(prev); next.delete(id); return next; });
    };
  }, []);

  const toggle = useCallback((id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }), []);
  const ids = useMemo(() => [...rows.keys()], [rows]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const toggleAll = useCallback(() => setSelected(allSelected ? new Set() : new Set(ids)), [allSelected, ids]);
  const clear = () => { setSelected(new Set()); setResult(null); };

  const plural = (n) => `${n} ${n === 1 ? noun : pluralize(noun)}`;

  const run = async () => {
    const trimmed = reason.trim();
    if (!trimmed) { setError("A reason is required."); return; }
    setError("");
    const targets = [...selected].filter((id) => rows.has(id));
    let done = 0, ok = 0;
    const failures = [];
    setProgress({ done, total: targets.length });
    const queue = [...targets];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const res = await pending.action(id, trimmed);
          if (res?.error) failures.push(`${rows.get(id) || id}: ${res.error}`); else ok++;
        } catch {
          failures.push(`${rows.get(id) || id}: network error`);
        }
        done++;
        setProgress({ done, total: targets.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    setProgress(null);
    setPending(null);
    setReason("");
    setResult({ label: pending.doneLabel || "Done", ok, failures });
    setSelected(new Set());
    router.refresh();
  };

  const value = useMemo(() => ({ selected, toggle, toggleAll, allSelected, ids, register }), [selected, toggle, toggleAll, allSelected, ids, register]);
  const count = selected.size;

  return (
    <Ctx.Provider value={value}>
      {(count > 0 || result) && (
        <div className="no-print sticky top-[72px] z-20 mb-2.5 flex flex-wrap items-center gap-2 rounded-2xl border border-aqua/30 bg-aquaSoft/95 px-3 py-2 shadow-sm backdrop-blur">
          {count > 0 ? (
            <>
              <span className="text-xs font-bold text-navy">{plural(count)} selected</span>
              {!allSelected && ids.length > count && (
                <button type="button" onClick={toggleAll} className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-aqua hover:underline">
                  Select all {ids.length} {scopeLabel}
                </button>
              )}
              <div className="flex-1" />
              {actions.map((a) => {
                const Icon = ICONS[a.icon] || Trash2;
                return (
                  <button key={a.key || a.label} type="button" onClick={() => { setPending(a); setError(""); }}
                    className="flex min-h-[36px] items-center gap-1.5 rounded-xl bg-coral px-3 text-xs font-bold text-white shadow-sm hover:opacity-90">
                    <Icon size={14} /> {a.label} Selected
                  </button>
                );
              })}
              <button type="button" onClick={clear} className="flex min-h-[36px] items-center gap-1 rounded-xl border border-line bg-card px-3 text-xs font-semibold">
                <X size={13} /> Cancel
              </button>
            </>
          ) : (
            <>
              <span className={`text-xs font-semibold ${result.failures.length ? "text-coral" : "text-green"}`}>
                {result.label}: {result.ok} succeeded{result.failures.length ? `, ${result.failures.length} failed` : ""}.
              </span>
              {result.failures.length > 0 && <span className="text-[11px] text-slate">{result.failures.slice(0, 3).join(" · ")}{result.failures.length > 3 ? " …" : ""}</span>}
              <div className="flex-1" />
              <button type="button" onClick={() => setResult(null)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-card" aria-label="Dismiss"><X size={14} /></button>
            </>
          )}
        </div>
      )}

      {children}

      {pending && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => !progress && setPending(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 text-sm font-semibold">{pending.label} {plural(count)}?</p>
            <p className="mb-3 text-xs text-slate">{pending.detailText || "Each one is processed exactly like the single-row action, with this reason recorded in the audit log."}</p>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate">Reason (required, applied to each)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} autoFocus disabled={Boolean(progress)}
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-aqua focus:ring-2 focus:ring-aqua/20"
                placeholder="e.g. Duplicate entries, entered in error…" />
            </label>
            {error && <p className="mb-3 text-xs text-coral">{error}</p>}
            {progress && (
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs text-slate"><Loader2 size={13} className="animate-spin" /> {pending.busyLabel || "Working…"} {progress.done} of {progress.total}</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-foam"><div className="h-full rounded-full bg-coral transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={Boolean(progress)} className="flex-1 rounded-xl border border-line py-2 text-sm font-semibold disabled:opacity-60">Cancel</button>
              <button type="button" onClick={run} disabled={Boolean(progress)} className="flex-1 rounded-xl bg-coral py-2 text-sm font-bold text-white disabled:opacity-60">
                {progress ? "Please wait…" : `${pending.confirmLabel || pending.label} (${count})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

// Header checkbox: selects/deselects every selectable row on this page.
export function SelectAllCheckbox({ scopeLabel = "on this page" }) {
  const ctx = useContext(Ctx);
  const count = ctx?.ids.length || 0;
  const some = ctx ? ctx.ids.some((id) => ctx.selected.has(id)) : false;
  if (!ctx) return null;
  return (
    <button type="button" role="checkbox" aria-checked={ctx.allSelected ? "true" : some ? "mixed" : "false"} onClick={ctx.toggleAll} disabled={!count}
      title={count ? `Select all ${count} ${scopeLabel}` : "Nothing selectable here"}
      aria-label={`Select all ${count} ${scopeLabel}`}
      className={`no-print inline-grid h-7 w-7 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${ctx.allSelected || some ? "border-aqua bg-aqua text-white" : "border-line bg-card text-transparent hover:border-aqua/50"}`}>
      {some && !ctx.allSelected ? <Minus size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
    </button>
  );
}

// Per-row checkbox; rendering it is what makes a row selectable.
export function RowCheckbox({ id, label }) {
  const ctx = useContext(Ctx);
  const register = ctx?.register;
  useEffect(() => (register ? register(id, label) : undefined), [register, id, label]);
  if (!ctx) return null;
  const checked = ctx.selected.has(id);
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => ctx.toggle(id)}
      aria-label={`Select ${label || "row"}`}
      className={`no-print inline-grid h-7 w-7 place-items-center rounded-lg border transition-colors ${checked ? "border-aqua bg-aqua text-white shadow-sm" : "border-line bg-card text-transparent hover:border-aqua/50 hover:bg-aquaSoft"}`}>
      <Check size={14} strokeWidth={3} />
    </button>
  );
}
