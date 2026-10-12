"use client";
import { useEffect, useMemo, useState } from "react";
import { bulkSetUserPermissionOverrides, resetUserPermissionOverrides } from "@/app/actions";
import { CheckCircle2, ChevronDown, Clock3, Copy, RotateCcw, Search, ShieldCheck, XCircle } from "lucide-react";

const ACTIONS = ["View", "Create", "Edit", "Delete", "Approve", "Export"];
const CATEGORY_ORDER = [
  "Dashboard & Smart Entry", "Customers & Deliveries", "Bottles & Inventory", "Sales & Finance",
  "Employees & Routes", "Reports", "Approvals", "Administration & Settings",
];

function permissionAction(key) {
  const action = key.split(".").slice(1).join(".");
  if (action === "view") return "View";
  if (action === "create") return "Create";
  if (["edit", "manage", "manage_financial"].includes(action)) return "Edit";
  if (action === "delete") return "Delete";
  if (action === "approve") return "Approve";
  if (action.startsWith("export")) return "Export";
  return "Edit";
}

function permissionCategory(module, key) {
  const value = `${module} ${key}`.toLowerCase();
  if (/dashboard|smart_entry/.test(value)) return "Dashboard & Smart Entry";
  if (/customer|deliver/.test(value)) return "Customers & Deliveries";
  if (/bottle|inventory|production|product/.test(value)) return "Bottles & Inventory";
  if (/sale|invoice|payment|expense|journal|account|cash|bank/.test(value)) return "Sales & Finance";
  if (/employee|route|vehicle|gps|attendance|advance/.test(value)) return "Employees & Routes";
  if (/report|export/.test(value)) return "Reports";
  if (/approv|reverse|void/.test(value)) return "Approvals";
  return "Administration & Settings";
}

const moduleLabel = (module) => module.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const sensitive = (key) => ["users.manage", "settings.manage"].includes(key) || key.endsWith(".delete") || key.endsWith(".approve");
const formatState = (value) => value === true ? "Allow" : value === false ? "Deny" : "Inherit";

function StateSelect({ value, inherited, onChange, label }) {
  const selectValue = value === "mixed" ? "mixed" : value === null ? "inherit" : value ? "allow" : "deny";
  return (
    <select aria-label={label} value={selectValue}
      onChange={(event) => onChange(event.target.value === "inherit" ? null : event.target.value === "allow")}
      className={`min-h-10 w-full min-w-[92px] rounded-lg border px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-aqua/20 ${
        value === true ? "border-green/30 bg-greenSoft text-green" : value === false ? "border-coral/30 bg-coralSoft text-coral" : "border-line bg-foam text-slate"
      }`}>
      {value === "mixed" && <option value="mixed" disabled>Mixed values</option>}
      <option value="inherit">Inherit ({inherited ? "Allow" : "Deny"})</option>
      <option value="allow">Allow</option>
      <option value="deny">Deny</option>
    </select>
  );
}

function SummaryCard({ label, value, tone = "text-ink" }) {
  return <div className="rounded-xl border border-line bg-card px-3 py-2.5"><div className="text-[10px] font-semibold uppercase tracking-wide text-slate">{label}</div><div className={`mt-0.5 text-xl font-bold ${tone}`}>{value}</div></div>;
}

export default function PermissionMatrix({ userId, rows, copySources = [], history = [] }) {
  const initial = useMemo(() => new Map(rows.map((row) => [row.key, row.override])), [rows]);
  const [staged, setStaged] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [showEffective, setShowEffective] = useState(false);
  const [copyUser, setCopyUser] = useState("");

  const dirtyRows = useMemo(() => rows.filter((row) => staged.get(row.key) !== baseline.get(row.key)), [rows, staged, baseline]);
  const dirty = dirtyRows.length > 0;

  useEffect(() => {
    const warn = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const categories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const grouped = new Map();
    for (const row of rows) {
      if (needle && !`${row.module} ${row.key} ${row.description}`.toLowerCase().includes(needle)) continue;
      const category = permissionCategory(row.module, row.key);
      if (!grouped.has(category)) grouped.set(category, new Map());
      const modules = grouped.get(category);
      if (!modules.has(row.module)) modules.set(row.module, new Map());
      const actions = modules.get(row.module);
      const action = permissionAction(row.key);
      if (!actions.has(action)) actions.set(action, []);
      actions.get(action).push(row);
    }
    return CATEGORY_ORDER.map((name) => ({ name, modules: [...(grouped.get(name) || new Map()).entries()] })).filter((item) => item.modules.length);
  }, [rows, query]);

  const effectiveAllowed = (row) => (staged.get(row.key) ?? row.roleDefault) === true;
  const summary = {
    total: rows.length,
    allowed: rows.filter(effectiveAllowed).length,
    denied: rows.filter((row) => !effectiveAllowed(row)).length,
    inherited: rows.filter((row) => staged.get(row.key) === null).length,
    unsaved: dirtyRows.length,
  };
  const needsReason = dirtyRows.some((row) => sensitive(row.key));

  const setRows = (permissionRows, value) => {
    setStaged((previous) => {
      const next = new Map(previous);
      permissionRows.forEach((row) => next.set(row.key, value));
      return next;
    });
    setMessage("");
  };

  const groupValue = (permissionRows) => {
    const values = [...new Set(permissionRows.map((row) => staged.get(row.key)))];
    return values.length === 1 ? values[0] : "mixed";
  };

  const groupInherited = (permissionRows) => permissionRows.every((row) => row.roleDefault);

  const save = async () => {
    if (needsReason && !reason.trim()) { setError("A reason is required for approval, deletion, users, or settings access changes."); return; }
    if (!window.confirm(`Save ${dirtyRows.length} permission change${dirtyRows.length === 1 ? "" : "s"}? Effective access will be refreshed immediately.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await bulkSetUserPermissionOverrides(userId, dirtyRows.map((row) => ({ permissionKey: row.key, allow: staged.get(row.key) })), reason);
      if (result?.error) setError(result.error);
      else { setBaseline(new Map(staged)); setMessage(`${result?.changed ?? dirtyRows.length} permission changes saved atomically.`); setReason(""); }
    } catch { setError("Network error — no partial changes were saved. Please try again."); }
    setBusy(false);
  };

  const resetDefaults = async () => {
    if (!window.confirm("Reset every custom override for this user to their role defaults?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await resetUserPermissionOverrides(userId);
      if (result?.error) setError(result.error);
      else {
        const defaults = new Map(rows.map((row) => [row.key, null]));
        setStaged(defaults); setBaseline(defaults); setReason(""); setMessage("All overrides cleared. Role defaults are now effective.");
      }
    } catch { setError("Network error — reset was not applied."); }
    setBusy(false);
  };

  const copyPermissions = () => {
    const source = copySources.find((entry) => entry.id === copyUser);
    if (!source || !window.confirm(`Copy effective access from ${source.name}? This stages explicit Allow/Deny overrides; review and Save to apply.`)) return;
    setStaged(new Map(rows.map((row) => [row.key, Boolean(source.effective[row.key])])));
    setMessage(`Copied from ${source.name}. Review the unsaved changes before saving.`);
  };

  const renderModule = ([module, actions], mobile = false) => {
    const allModuleRows = [...actions.values()].flat();
    if (mobile) return (
      <details key={module} className="rounded-xl border border-line bg-card" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-semibold">
          {moduleLabel(module)} <ChevronDown size={15} className="text-slate" />
        </summary>
        <div className="space-y-2 border-t border-line p-3">
          {ACTIONS.filter((action) => actions.has(action)).map((action) => {
            const permissionRows = actions.get(action);
            return <div key={action} className="grid grid-cols-[85px_1fr] items-center gap-2"><span className="text-xs font-medium">{action}</span><StateSelect value={groupValue(permissionRows)} inherited={groupInherited(permissionRows)} onChange={(value) => setRows(permissionRows, value)} label={`${moduleLabel(module)} ${action}`} /></div>;
          })}
          <button type="button" onClick={() => setRows(allModuleRows, true)} className="min-h-10 w-full rounded-lg border border-line text-xs font-semibold hover:bg-foam">Allow all for this module</button>
        </div>
      </details>
    );
    return (
      <tr key={module} className="border-t border-line hover:bg-foam/50">
        <td className="px-3 py-3 align-top"><div className="font-semibold">{moduleLabel(module)}</div><button type="button" onClick={() => setRows(allModuleRows, true)} className="mt-1 text-[11px] font-semibold text-aqua hover:underline">Allow module</button></td>
        {ACTIONS.map((action) => {
          const permissionRows = actions.get(action);
          return <td key={action} className="px-2 py-2 align-top">{permissionRows ? <StateSelect value={groupValue(permissionRows)} inherited={groupInherited(permissionRows)} onChange={(value) => setRows(permissionRows, value)} label={`${moduleLabel(module)} ${action}`} /> : <span className="block py-2 text-center text-slate/40">—</span>}</td>;
        })}
      </tr>
    );
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryCard label="Available" value={summary.total} />
        <SummaryCard label="Allowed" value={summary.allowed} tone="text-green" />
        <SummaryCard label="Denied" value={summary.denied} tone="text-coral" />
        <SummaryCard label="Inherited" value={summary.inherited} tone="text-slate" />
        <SummaryCard label="Unsaved" value={summary.unsaved} tone={summary.unsaved ? "text-amber" : "text-slate"} />
      </div>

      <div className="mb-4 rounded-2xl border border-line bg-foam p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)_auto]">
          <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search module or permission…" className="in w-full pl-9" /></label>
          <div className="flex gap-2"><select value={copyUser} onChange={(event) => setCopyUser(event.target.value)} className="in min-w-0 flex-1" aria-label="Copy permissions from user"><option value="">Copy from another user…</option>{copySources.map((source) => <option key={source.id} value={source.id}>{source.name} · {source.role}</option>)}</select><button type="button" disabled={!copyUser} onClick={copyPermissions} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line bg-card px-3 text-xs font-semibold disabled:opacity-40"><Copy size={13} /> Copy</button></div>
          <button type="button" onClick={() => setShowEffective((value) => !value)} className="min-h-10 rounded-lg border border-line bg-card px-3 text-xs font-semibold"><ShieldCheck size={14} className="mr-1 inline" />{showEffective ? "Hide" : "Show"} Effective Access</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setRows(rows.filter((row) => permissionAction(row.key) === "View"), true)} className="min-h-10 rounded-lg border border-line bg-card px-3 text-xs font-semibold">Select All View</button>
          <button type="button" onClick={() => setRows(rows, null)} className="min-h-10 rounded-lg border border-line bg-card px-3 text-xs font-semibold">Clear Overrides</button>
          <button type="button" onClick={resetDefaults} disabled={busy} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-line bg-card px-3 text-xs font-semibold text-coral disabled:opacity-50"><RotateCcw size={13} /> Reset to Role Defaults</button>
          <span className="self-center text-[11px] text-slate">Bulk actions affect the selected scope only and remain unsaved until Save Changes.</span>
        </div>
      </div>

      {showEffective && <div className="mb-4 rounded-xl border border-aqua/25 bg-aquaSoft p-3 text-xs"><strong>Effective access after saving:</strong> {rows.filter(effectiveAllowed).map((row) => row.key).join(", ") || "No permissions"}</div>}
      {message && <p role="status" className="mb-3 rounded-xl bg-greenSoft p-3 text-xs font-semibold text-green">{message}</p>}
      {error && <p role="alert" className="mb-3 rounded-xl bg-coralSoft p-3 text-xs font-semibold text-coral">{error}</p>}

      <div className="space-y-3">
        {categories.map((category) => (
          <details key={category.name} open className="overflow-hidden rounded-2xl border border-line bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-navy px-4 py-3 text-sm font-semibold text-white"><span>{category.name}</span><span className="flex items-center gap-2 text-[11px] font-normal text-white/70">{category.modules.length} modules <ChevronDown size={15} /></span></summary>
            <div className="space-y-2 p-3 md:hidden">{category.modules.map((module) => renderModule(module, true))}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-xs"><thead><tr className="bg-foam text-left text-[10px] uppercase tracking-wide text-slate"><th className="px-3 py-2">Module</th>{ACTIONS.map((action) => <th key={action} className="px-2 py-2">{action}</th>)}</tr></thead><tbody>{category.modules.map((module) => renderModule(module))}</tbody></table></div>
          </details>
        ))}
      </div>

      {categories.length === 0 && <div className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-slate">No permissions match your search.</div>}

      <div className="sticky bottom-3 z-20 mt-5 rounded-2xl border border-line bg-card/95 p-3 shadow-xl backdrop-blur">
        {needsReason && <label className="mb-3 block"><span className="mb-1 block text-xs font-semibold">Reason for sensitive changes <span className="text-coral">*</span></span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why deletion, approval, users, or settings access is changing" className="in w-full" /></label>}
        <div className="flex flex-wrap items-center justify-between gap-2"><span className={`text-xs font-semibold ${dirty ? "text-amber" : "text-slate"}`}>{dirty ? `${dirtyRows.length} unsaved change${dirtyRows.length === 1 ? "" : "s"}` : "All changes saved"}</span><div className="flex gap-2"><button type="button" disabled={!dirty || busy} onClick={() => { setStaged(new Map(baseline)); setReason(""); setError(""); }} className="min-h-10 rounded-lg border border-line px-4 text-xs font-semibold disabled:opacity-40">Cancel</button><button type="button" disabled={!dirty || busy} onClick={save} className="min-h-10 rounded-lg bg-aqua px-4 text-xs font-bold text-white disabled:opacity-40">{busy ? "Saving…" : "Save Changes"}</button></div></div>
      </div>

      <details className="mt-5 rounded-2xl border border-line bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold"><Clock3 size={15} className="text-aqua" /> Permission Change History ({history.length})</summary>
        <div className="overflow-x-auto border-t border-line"><table className="w-full min-w-[680px] text-xs"><thead><tr className="bg-foam text-left text-slate"><th className="px-3 py-2">Date & Time</th><th className="px-3 py-2">Changed By</th><th className="px-3 py-2">Permission</th><th className="px-3 py-2">Old</th><th className="px-3 py-2">New</th><th className="px-3 py-2">Reason</th></tr></thead><tbody>{history.length ? history.map((entry) => <tr key={entry.id} className="border-t border-line"><td className="whitespace-nowrap px-3 py-2">{new Date(entry.at).toLocaleString("en-PK")}</td><td className="px-3 py-2">{entry.actor}</td><td className="px-3 py-2 font-semibold">{entry.permission}</td><td className="px-3 py-2">{formatState(entry.from)}</td><td className="px-3 py-2">{entry.to === true ? <span className="inline-flex items-center gap-1 text-green"><CheckCircle2 size={12} />Allow</span> : entry.to === false ? <span className="inline-flex items-center gap-1 text-coral"><XCircle size={12} />Deny</span> : "Inherit"}</td><td className="px-3 py-2 text-slate">{entry.reason}</td></tr>) : <tr><td colSpan={6} className="px-3 py-8 text-center text-slate">No permission changes recorded yet.</td></tr>}</tbody></table></div>
      </details>
    </div>
  );
}
