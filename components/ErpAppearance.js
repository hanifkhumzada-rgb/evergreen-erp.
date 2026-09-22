"use client";
import { useEffect, useState } from "react";
import { Palette, RotateCcw, X } from "lucide-react";

const DEFAULT = "#059669";
const PRESETS = [
  { value: DEFAULT, label: "Evergreen" },
  { value: "#087F9C", label: "Water Aqua" },
  { value: "#2563EB", label: "Ocean Blue" },
  { value: "#7C3AED", label: "Royal Violet" },
  { value: "#BE185D", label: "Berry" },
  { value: "#334155", label: "Slate" },
];
export default function ErpAppearance({ children }) {
  const [colour, setColour] = useState(DEFAULT);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ew-erp-accent");
      if (/^#[0-9a-f]{6}$/i.test(saved || "")) setColour(saved);
    } catch { /* Appearance still works when device storage is unavailable. */ }
  }, []);
  const rgb = [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16));
  // Keep white labels readable even when a very pale colour is chosen.
  const brightness = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  const scale = brightness > 105 ? 105 / brightness : 1;
  const accent = colour === DEFAULT ? DEFAULT : `rgb(${rgb.map(v => Math.round(v * scale)).join(",")})`;
  const navy = colour === DEFAULT ? "#073B3A" : `rgb(${rgb.map(v => Math.round(v * .3)).join(",")})`;
  const accentSoft = `rgba(${rgb.map(v => Math.round(v * scale)).join(",")},.12)`;
  const save = value => { setColour(value); try { localStorage.setItem("ew-erp-accent", value); } catch { /* Device-only setting. */ } };
  return <div className="erp-appearance" style={{ "--erp-accent": accent, "--erp-accent-soft": accentSoft, "--erp-navy": navy, "--erp-navy-light": accent }}>
    {children}
    <div className="no-print fixed bottom-24 right-4 z-[60]">
      {open && <section aria-label="ERP appearance" className="mb-2 w-64 rounded-2xl border border-line bg-card p-4 shadow-xl text-ink">
        <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-sm">Your ERP colour</h3><button type="button" aria-label="Close appearance" onClick={() => setOpen(false)}><X size={16} /></button></div>
        <p className="text-xs text-slate mb-3">Evergreen is the official default. Your choice is saved on this device; status colours and Customer Portal stay unchanged.</p>
        <div className="grid grid-cols-3 gap-2 mb-3">{PRESETS.map(({ value, label }) => <button key={value} type="button" title={label} aria-label={`Use ${label} theme`} aria-pressed={colour === value} onClick={() => save(value)} className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[10px] font-semibold ${colour === value ? "border-aqua bg-aquaSoft text-ink" : "border-line bg-card text-slate"}`}><span className="h-4 w-4 shrink-0 rounded-full" style={{ background: value }} />{label}</button>)}</div>
        <label className="flex items-center justify-between text-xs font-semibold">Custom colour<input type="color" value={colour} onChange={e => save(e.target.value)} aria-label="Custom theme colour" /></label>
        <button type="button" onClick={() => save(DEFAULT)} className="mt-3 flex items-center gap-1 text-xs text-aqua"><RotateCcw size={13} /> Evergreen default</button>
      </section>}
      <button type="button" aria-label="Choose ERP theme colour" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-card text-aqua shadow-lg"><Palette size={18} /></button>
    </div>
  </div>;
}
