"use client";

import { Check, Droplets, Laptop, Moon, Palette, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const OPTIONS = [
  { value: "light", label: "Evergreen Light", description: "Bright professional workspace", icon: Sun },
  { value: "blue", label: "EW Blue", description: "Clean blue and aqua workspace", icon: Droplets },
  { value: "dark", label: "Evergreen Dark", description: "Comfortable low-light workspace", icon: Moon },
  { value: "system", label: "System", description: "Follow this device", icon: Laptop },
];

function applyTheme(preference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = preference === "dark" || (preference === "system" && systemDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = preference;
}

export default function ThemeSelector({ compact = false, className = "" }) {
  const [preference, setPreference] = useState("system");
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("ew-theme") || localStorage.getItem("theme") || "system";
    const valid = OPTIONS.some((option) => option.value === saved) ? saved : "system";
    setPreference(valid);
    applyTheme(valid);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => { if ((localStorage.getItem("ew-theme") || "system") === "system") applyTheme("system"); };
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
    localStorage.setItem("ew-theme", value);
    localStorage.removeItem("theme");
    applyTheme(value);
    setOpen(false);
  };

  if (!compact) {
    return <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>{OPTIONS.map(({ value, label, description, icon: Icon }) => {
      const selected = preference === value;
      return <button key={value} type="button" aria-pressed={selected} onClick={() => choose(value)} className={`relative flex min-h-[92px] items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? "border-aqua bg-aquaSoft" : "border-line bg-card hover:bg-foam"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-aqua text-white" : "bg-foam text-slate"}`}><Icon size={18} /></span><span><span className="block text-sm font-bold text-ink">{label}</span><span className="mt-1 block text-xs leading-relaxed text-slate">{description}</span></span>{selected ? <Check size={16} className="absolute right-3 top-3 text-aqua" /> : null}</button>;
    })}</div>;
  }

  const selected = OPTIONS.find((option) => option.value === preference) || OPTIONS[2];
  const SelectedIcon = selected.icon;
  return <div ref={rootRef} className={`relative ${className}`}><button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold text-[#C7DEDC] hover:bg-white/5"><Palette size={16} /><span className="flex-1 text-left">Appearance</span><SelectedIcon size={14} /></button>{open ? <div className="absolute bottom-full left-0 z-[80] mb-2 w-64 overflow-hidden rounded-2xl border border-line bg-card p-2 text-ink shadow-2xl">{OPTIONS.map(({ value, label, description, icon: Icon }) => <button key={value} type="button" onClick={() => choose(value)} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${preference === value ? "bg-aquaSoft" : "hover:bg-foam"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${preference === value ? "bg-aqua text-white" : "bg-foam text-slate"}`}><Icon size={15} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{label}</span><span className="block truncate text-[10px] text-slate">{description}</span></span>{preference === value ? <Check size={14} className="text-aqua" /> : null}</button>)}</div> : null}</div>;
}
