"use client";

import { Check, Droplets, Laptop, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Stored in localStorage "ew-theme"; app/layout.js applies the same value
// before first paint. "blue" (EW Ocean Blue) is the default when nothing
// has been chosen yet.
export const DEFAULT_THEME = "blue";
const OPTIONS = [
  { value: "light", label: "Evergreen Light", description: "Bright green professional workspace", icon: Sun },
  { value: "blue", label: "EW Ocean Blue", badge: "Recommended", description: "Premium navy, ocean blue and aqua", icon: Droplets },
  { value: "dark", label: "Evergreen Dark", description: "Comfortable low-light workspace", icon: Moon },
  { value: "system", label: "System", description: "Follow this device (light or dark)", icon: Laptop },
];

function applyTheme(preference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = preference === "dark" || (preference === "system" && systemDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = preference;
}

export default function ThemeSelector({ compact = false, className = "" }) {
  const [preference, setPreference] = useState(DEFAULT_THEME);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    let saved = DEFAULT_THEME;
    try { saved = localStorage.getItem("ew-theme") || localStorage.getItem("theme") || DEFAULT_THEME; } catch {}
    const valid = OPTIONS.some((option) => option.value === saved) ? saved : DEFAULT_THEME;
    setPreference(valid);
    applyTheme(valid);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => { if (document.documentElement.dataset.theme === "system") applyTheme("system"); };
    media.addEventListener?.("change", syncSystem);
    return () => media.removeEventListener?.("change", syncSystem);
  }, []);

  useEffect(() => {
    const close = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (value) => {
    setPreference(value);
    try {
      localStorage.setItem("ew-theme", value);
      localStorage.removeItem("theme");
    } catch {}
    applyTheme(value);
    setOpen(false);
  };

  if (!compact) {
    return <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>{OPTIONS.map(({ value, label, badge, description, icon: Icon }) => {
      const selected = preference === value;
      return <button key={value} type="button" aria-pressed={selected} onClick={() => choose(value)} className={`relative flex min-h-[92px] items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? "border-aqua bg-aquaSoft" : "border-line bg-card hover:bg-foam"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-aqua text-white" : "bg-foam text-slate"}`}><Icon size={18} /></span><span><span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">{label}{badge ? <span className="rounded-full bg-aqua px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">{badge}</span> : null}</span><span className="mt-1 block text-xs leading-relaxed text-slate">{description}</span></span>{selected ? <Check size={16} className="absolute right-3 top-3 text-aqua" /> : null}</button>;
    })}</div>;
  }

  const selected = OPTIONS.find((option) => option.value === preference) || OPTIONS[1];
  const SelectedIcon = selected.icon;
  return <div ref={rootRef} className={`relative ${className}`}><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="erp-sidebar-link w-full"><Palette size={16} /><span className="flex-1 text-left">Appearance</span><SelectedIcon size={14} /></button>{open ? <div className="absolute bottom-full left-0 z-[80] mb-2 w-64 overflow-hidden rounded-2xl border border-line bg-card p-2 text-ink shadow-2xl">{OPTIONS.map(({ value, label, badge, description, icon: Icon }) => <button key={value} type="button" onClick={() => choose(value)} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${preference === value ? "bg-aquaSoft" : "hover:bg-foam"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${preference === value ? "bg-aqua text-white" : "bg-foam text-slate"}`}><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{label}{badge ? <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-aqua">{badge}</span> : null}</span><span className="block truncate text-[10px] text-slate">{description}</span></span>{preference === value ? <Check size={14} className="text-aqua" /> : null}</button>)}</div> : null}</div>;
}
