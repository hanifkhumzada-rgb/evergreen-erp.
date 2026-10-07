import ThemeSelector from "@/components/ThemeSelector";

export default function AppearanceSettings() {
  return (
    <section id="appearance" className="max-w-3xl rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="appearance-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-aqua">Workspace</p>
          <h3 id="appearance-title" className="mt-1 font-display text-xl font-semibold">Appearance</h3>
          <p className="mt-1 text-sm text-slate">Choose Evergreen Light, professional EW Blue, Evergreen Dark, or follow this device. Printed documents remain white and professional.</p>
        </div>
      </div>
      <ThemeSelector className="mt-5" />
    </section>
  );
}
