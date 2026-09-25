"use client";

import { Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

const DEFAULT = "#059669";
const PRESETS = [
  { value: DEFAULT, label: "Evergreen", description: "Official Evergreen Water theme" },
  { value: "#087F9C", label: "Water Aqua", description: "Cool aqua accent" },
  { value: "#2563EB", label: "Ocean Blue", description: "Clear blue accent" },
  { value: "#334155", label: "Slate", description: "Neutral low-colour accent" },
];

export default function AppearanceSettings() {
  const [colour, setColour] = useState(DEFAULT);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ew-erp-accent");
      if (PRESETS.some((preset) => preset.value === saved)) setColour(saved);
    } catch {
      setColour(DEFAULT);
    }
  }, []);

  const save = (value) => {
    setColour(value);
    try {
      localStorage.setItem("ew-erp-accent", value);
    } catch {
      // The selected theme still applies for this session.
    }
    window.dispatchEvent(new CustomEvent("ew:appearance-change", { detail: value }));
  };

  return (
    <section id="appearance" className="max-w-3xl rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="appearance-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-aqua">Workspace</p>
          <h3 id="appearance-title" className="mt-1 font-display text-xl font-semibold">Appearance</h3>
          <p className="mt-1 text-sm text-slate">Evergreen is the official default. This device-only preference never changes portal or status colours.</p>
        </div>
        {colour !== DEFAULT && (
          <button type="button" onClick={() => save(DEFAULT)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-aqua hover:bg-foam">
            <RotateCcw size={15} /> Restore default
          </button>
        )}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {PRESETS.map((preset) => {
          const selected = colour === preset.value;
          return (
            <button key={preset.value} type="button" aria-pressed={selected} onClick={() => save(preset.value)} className={`flex min-h-[72px] items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selected ? "border-aqua bg-aquaSoft" : "border-line bg-card hover:bg-foam"}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: preset.value }}>
                {selected && <Check size={18} />}
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{preset.label}</span>
                <span className="block text-xs text-slate">{preset.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
