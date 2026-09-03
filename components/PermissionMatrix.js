"use client";
import { useMemo, useState } from "react";
import { bulkSetUserPermissionOverrides, resetUserPermissionOverrides } from "@/app/actions";
import { Check, X, RotateCcw, ListChecks } from "lucide-react";

const ACTION_LABEL = { view: "View", create: "Create", edit: "Edit", delete: "Delete", manage: "Manage", manage_financial: "Financial", export_excel: "Export Excel", export_pdf: "Export PDF" };

function actionLabel(key) {
  const action = key.includes(".") ? key.split(".").slice(1).join(".") : key;
  return ACTION_LABEL[action] || action;
}

// The three-state toggle is inlined per-row below (Deny / Default / Grant).
// The middle "default" cell has no icon of its own — render the role's
// actual default state as plain text instead of an icon component.
function DefaultCell({ roleDefault, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center justify-center w-8 h-7 rounded-md border text-[10px] font-bold transition-colors ${
        active ? "bg-card border-line text-ink" : "border-transparent text-slate/40 hover:text-slate hover:bg-card"
      }`}
      title={`Use role default (currently ${roleDefault ? "granted" : "not granted"})`}
    >
      {roleDefault ? "✓" : "–"}
    </button>
  );
}

export default function PermissionMatrix({ userId, rows }) {
  const [staged, setStaged] = useState(() => new Map(rows.map((r) => [r.key, r.override])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const modules = useMemo(() => {
    const byModule = new Map();
    for (const r of rows) {
      if (!byModule.has(r.module)) byModule.set(r.module, []);
      byModule.get(r.module).push(r);
    }
    return [...byModule.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const dirty = useMemo(() => rows.some((r) => staged.get(r.key) !== r.override), [rows, staged]);

  const setOne = (key, value) => { setStaged((prev) => new Map(prev).set(key, value)); setSavedMsg(""); };
  const selectAll = () => { setStaged(new Map(rows.map((r) => [r.key, true]))); setSavedMsg(""); };
  const clearAll = () => { setStaged(new Map(rows.map((r) => [r.key, false]))); setSavedMsg(""); };
  const discard = () => { setStaged(new Map(rows.map((r) => [r.key, r.override]))); setSavedMsg(""); setError(""); };

  const save = async () => {
    setBusy(true); setError(""); setSavedMsg("");
    const updates = rows.filter((r) => staged.get(r.key) !== r.override).map((r) => ({ permissionKey: r.key, allow: staged.get(r.key) }));
    const res = await bulkSetUserPermissionOverrides(userId, updates);
    setBusy(false);
    if (res?.error) setError(res.error);
    else { setSavedMsg(`Saved ${updates.length} change${updates.length === 1 ? "" : "s"}.`); rows.forEach((r) => { r.override = staged.get(r.key); }); }
  };

  const resetToDefaults = async () => {
    if (!window.confirm("Clear every override for this user? Their access will go back to exactly their role's defaults.")) return;
    setBusy(true); setError(""); setSavedMsg("");
    const res = await resetUserPermissionOverrides(userId);
    setBusy(false);
    if (res?.error) setError(res.error);
    else {
      rows.forEach((r) => { r.override = null; });
      setStaged(new Map(rows.map((r) => [r.key, null])));
      setSavedMsg("Reset to role defaults.");
    }
  };

  const grantedBeyondDefault = rows.filter((r) => staged.get(r.key) === true && !r.roleDefault);
  const deniedBelowDefault = rows.filter((r) => staged.get(r.key) === false && r.roleDefault);

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2 mb-4">
        <button type="button" onClick={selectAll} disabled={busy} className="px-3 py-2 rounded-lg border border-line text-xs font-semibold hover:bg-foam disabled:opacity-50">Select All</button>
        <button type="button" onClick={clearAll} disabled={busy} className="px-3 py-2 rounded-lg border border-line text-xs font-semibold hover:bg-foam disabled:opacity-50">Clear All</button>
        <button type="button" onClick={() => setShowSummary((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-xs font-semibold hover:bg-foam">
          <ListChecks size={13} /> {showSummary ? "Hide" : "Show"} Summary
        </button>
        <button type="button" onClick={resetToDefaults} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-line text-xs font-semibold hover:bg-foam disabled:opacity-50 text-coral">
          <RotateCcw size={13} /> Reset to Role Defaults
        </button>
        <div className="flex-1" />
        {dirty && <button type="button" onClick={discard} disabled={busy} className="px-3 py-2 rounded-lg text-xs font-semibold text-slate hover:text-ink disabled:opacity-50">Discard changes</button>}
        <button type="button" onClick={save} disabled={busy || !dirty} className="px-4 py-2 rounded-lg bg-aqua text-white text-xs font-bold disabled:opacity-40">
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {error && <p className="text-coral text-xs mb-3">{error}</p>}
      {savedMsg && !dirty && <p className="text-green text-xs mb-3">{savedMsg}</p>}

      {showSummary && (
        <div className="border border-line rounded-2xl p-4 mb-4 bg-foam/40 text-xs">
          <p className="font-semibold mb-2">Summary of overrides {dirty && <span className="text-amber font-normal">(unsaved)</span>}</p>
          {grantedBeyondDefault.length === 0 && deniedBelowDefault.length === 0 && <p className="text-slate">No overrides — this user has exactly their role&apos;s default permissions.</p>}
          {grantedBeyondDefault.length > 0 && (
            <p className="mb-1"><span className="text-green font-semibold">Granted beyond role default ({grantedBeyondDefault.length}):</span> {grantedBeyondDefault.map((r) => r.key).join(", ")}</p>
          )}
          {deniedBelowDefault.length > 0 && (
            <p><span className="text-coral font-semibold">Denied below role default ({deniedBelowDefault.length}):</span> {deniedBelowDefault.map((r) => r.key).join(", ")}</p>
          )}
        </div>
      )}

      <div className="space-y-5">
        {modules.map(([module, perms]) => (
          <div key={module} className="border border-line rounded-2xl overflow-hidden">
            <div className="bg-foam px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate">{module}</div>
            <div className="divide-y divide-line">
              {perms.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{actionLabel(r.key)}</div>
                    <div className="text-[11px] text-slate truncate">{r.description}</div>
                  </div>
                  <div className="flex items-center gap-0.5 bg-foam/60 rounded-lg p-0.5 flex-shrink-0">
                    <button type="button" onClick={() => setOne(r.key, false)} title="Deny"
                      className={`flex items-center justify-center w-8 h-7 rounded-md border transition-colors ${staged.get(r.key) === false ? "bg-coralSoft border-coral/30 text-coral" : "border-transparent text-slate/50 hover:text-slate hover:bg-card"}`}>
                      <X size={13} />
                    </button>
                    <DefaultCell roleDefault={r.roleDefault} active={staged.get(r.key) === null} onClick={() => setOne(r.key, null)} />
                    <button type="button" onClick={() => setOne(r.key, true)} title="Grant"
                      className={`flex items-center justify-center w-8 h-7 rounded-md border transition-colors ${staged.get(r.key) === true ? "bg-greenSoft border-green/30 text-green" : "border-transparent text-slate/50 hover:text-slate hover:bg-card"}`}>
                      <Check size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
