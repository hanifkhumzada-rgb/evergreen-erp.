"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, MoreVertical, RefreshCw, X } from "lucide-react";

export function useUnsavedForm(open) {
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!open) setDirty(false);
  }, [open]);
  useEffect(() => {
    if (!open || !dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);
  const requestClose = (close) => {
    if (!dirty || window.confirm("Discard unsaved changes?")) { setDirty(false); close(); }
  };
  return { dirty, markDirty: () => setDirty(true), resetDirty: () => setDirty(false), requestClose };
}

export function EntryFormHeader({ title, subtitle, status = "New", reference, onClose, onRefresh, actions = [] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);
  return (
    <div className="erp-form-header sticky -top-5 sm:-top-6 z-20 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-5 border-b border-line bg-card/95 px-4 sm:px-6 py-3.5 backdrop-blur">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="erp-form-icon" aria-label="Back"><ChevronLeft size={19} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base sm:text-lg font-semibold">{title}</h3>
            <span className="rounded-full bg-aquaSoft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-aqua">{status}</span>
          </div>
          <p className="truncate text-[11px] text-slate">{reference ? `${reference} · ` : ""}{subtitle}</p>
        </div>
        {onRefresh && <button type="button" onClick={onRefresh} className="erp-form-icon hidden sm:grid" title="Refresh form"><RefreshCw size={16} /></button>}
        {actions.length > 0 && <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="erp-form-icon" aria-label="More actions"><MoreVertical size={18} /></button>
          {menuOpen && <div className="absolute right-0 top-11 z-30 min-w-44 overflow-hidden rounded-xl border border-line bg-card p-1.5 shadow-xl">
            {actions.map((action) => <button key={action.label} type="button" onClick={() => { action.onClick(); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-foam">{action.icon}{action.label}</button>)}
          </div>}
        </div>}
        <button type="button" onClick={onClose} className="erp-form-icon" aria-label="Close"><X size={18} /></button>
      </div>
    </div>
  );
}

export function EntrySection({ title, description, children, columns = 2 }) {
  return (
    <section className="erp-form-section">
      <div className="mb-3">
        <h4 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-navy">{title}</h4>
        {description && <p className="mt-0.5 text-[11px] text-slate">{description}</p>}
      </div>
      <div className={`grid grid-cols-1 gap-x-3 gap-y-1 ${columns === 3 ? "lg:grid-cols-3" : columns === 1 ? "" : "sm:grid-cols-2"}`}>{children}</div>
    </section>
  );
}

export function EntrySummary({ items }) {
  return <section className="erp-form-summary">{items.map((item) => <div key={item.label}><span>{item.label}</span><strong className={item.tone || ""}>{item.value}</strong></div>)}</section>;
}

export function EntryFormActions({ busy, primaryLabel, onCancel, allowSaveAndNew = true, allowSaveAndView = false }) {
  return (
    <div className="erp-form-actions sticky -bottom-5 sm:-bottom-6 z-20 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-5 flex flex-wrap justify-end gap-2 border-t border-line bg-card/95 px-5 sm:px-6 py-3 backdrop-blur">
      <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate hover:bg-foam">Cancel</button>
      {allowSaveAndNew && <button type="submit" name="submit_intent" value="save_new" disabled={busy} className="rounded-xl border border-aqua px-4 py-2.5 text-xs font-bold text-aqua disabled:opacity-50">Save &amp; New</button>}
      {allowSaveAndView && <button type="submit" name="submit_intent" value="save_view" disabled={busy} className="rounded-xl border border-navy/20 px-4 py-2.5 text-xs font-bold text-navy disabled:opacity-50">Save &amp; View</button>}
      <button type="submit" name="submit_intent" value="save" disabled={busy} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-aqua px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50">
        {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{busy ? "Saving…" : primaryLabel}
      </button>
    </div>
  );
}
