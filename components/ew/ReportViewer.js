"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Printer, FileDown, FileSpreadsheet, Share2, RefreshCw, Search, X, Loader2, ChevronLeft, ChevronRight, MessageCircle, SlidersHorizontal } from "lucide-react";
import PeriodBar from "@/components/ew/PeriodBar";
import DetailDrawer from "@/components/ew/DetailDrawer";
import { useErpBack, useEwChrome, printWithTitle, shareOrCopy } from "@/components/ew/useErpBack";
import { statusInfo, TONE_CLASS } from "@/lib/ew/status";
import { pkr, amt, qty, fmtDate } from "@/lib/format";

const PAGE = 50;
const BTN = "ew-tool-btn";

function Badge({ status }) {
  const i = statusInfo(status);
  return <span className={TONE_CLASS[i.tone]}>{i.label}</span>;
}

export function fmtCell(value, type) {
  if (value === null || value === undefined || value === "") return "—";
  switch (type) {
    case "money": return amt(value);
    case "pkr": return pkr(value);
    case "int": case "number": return qty(value);
    case "date": return fmtDate(value);
    case "status": return <Badge status={value} />;
    default: return String(value);
  }
}

const isNum = (t) => ["money", "pkr", "int", "number"].includes(t);

// Interactive Report Viewer. Everything about a report arrives as one
// serialisable `spec` from its Server Component:
//   { key, title, period, range, updatedAt, cards, charts, columns, rows,
//     totals, filters, filterValues, landscape, note, emptyText, presets }
// Search is instant over the loaded rows (debounced 300 ms), paging is
// client-side, filters/date range re-query the server via the URL, and a
// row click opens the right-side Detail Drawer without leaving the report.
export default function ReportViewer({ spec, branding, children }) {
  useEwChrome("report");
  const goBack = useErpBack("/reports");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { const t = setTimeout(() => { setQuery(input.trim().toLowerCase()); setPage(1); }, 300); return () => clearTimeout(t); }, [input]);
  useEffect(() => { setPage(1); }, [spec.rows]);

  const columns = spec.columns || [];
  const rows = useMemo(() => {
    if (!query) return spec.rows || [];
    const keys = columns.map((c) => c.key);
    return (spec.rows || []).filter((r) => (r._search || keys.map((k) => r[k]).join(" ")).toString().toLowerCase().includes(query));
  }, [spec.rows, query, columns]);

  // Totals: server totals for the unfiltered view; recomputed when searching.
  const totals = useMemo(() => {
    if (!spec.totals) return null;
    if (!query) return spec.totals;
    const t = {};
    columns.forEach((c) => { if (isNum(c.type) && c.total !== false && spec.totals[c.key] !== undefined) t[c.key] = rows.reduce((a, r) => a + (Number(r[c.key]) || 0), 0); });
    return t;
  }, [spec.totals, query, rows, columns]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);
  const flash = (m) => { setNote(m); setTimeout(() => setNote(""), 2600); };

  const setFilter = (name, value) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(name, value); else params.delete(name);
    start(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };
  const activeFilters = (spec.filters || []).filter((f) => spec.filterValues?.[f.name]);
  const filterSummary = [
    ...activeFilters.map((f) => [f.label, (f.options.find((o) => o.value === spec.filterValues[f.name]) || {}).label || spec.filterValues[f.name]]),
    ...(query ? [["Search", input.trim()]] : []),
  ];

  const doExcel = async () => {
    setBusy("excel");
    try {
      const { downloadEwWorkbook } = await import("@/lib/ew/excel");
      const xcols = columns.filter((c) => c.excel !== false).map((c) => ({ key: c.key, label: c.label, type: c.type === "pkr" ? "money" : c.type === "status" ? "text" : (c.type || "text"), noTotal: c.total === false }));
      const xrows = rows.map((r) => Object.fromEntries(xcols.map((c) => [c.key, c.type === "text" && columns.find((x) => x.key === c.key)?.type === "status" ? statusInfo(r[c.key]).label : r[c.key]])));
      const sheets = [{ name: spec.title, columns: xcols, rows: xrows, totals: totals ? Object.fromEntries(Object.entries(totals)) : undefined }];
      if (spec.cards?.length) sheets.push({ name: "Summary", columns: [{ key: "k", label: "Measure", type: "text" }, { key: "v", label: "Value", type: "number" }, { key: "s", label: "Note", type: "text" }], rows: spec.cards.map((c) => ({ k: c.label, v: typeof c.raw === "number" ? c.raw : null, s: c.raw === undefined ? String(c.value) : (c.sub || "") })) });
      (spec.excelExtra || []).forEach((s) => sheets.push(s));
      await downloadEwWorkbook({ title: spec.title, period: spec.period, filters: filterSummary, sheets, businessName: branding?.businessName || "Evergreen Water" });
    } catch (e) { alert(`Excel export failed: ${e?.message || "unknown error"}`); } finally { setBusy(""); }
  };

  const shareText = [`*${branding?.businessName || "Evergreen Water"} — ${spec.title}*`, spec.period, ...(spec.cards || []).slice(0, 6).map((c) => `${c.label}: ${c.value}`)].join("\n");
  const doShare = async () => { const r = await shareOrCopy({ title: spec.title, text: shareText }); if (r === "copied") flash("Summary copied to clipboard."); };
  const generated = new Date(spec.updatedAt || Date.now()).toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  const primary = columns.find((c) => c.primary) || columns[0];
  const secondary = columns.find((c) => c.secondary);
  const statusCol = columns.find((c) => c.type === "status");

  return (
    <div className="ew-report">
      {/* ---------- screen ---------- */}
      <div className="ew-screen-only ew-report">
        <div className="ew-report-head">
          <div className="flex items-start gap-3 min-w-0">
            <button type="button" onClick={goBack} className={`${BTN} ew-tool-back`} style={{ width: "auto", padding: "0 12px" }}><ArrowLeft size={16} /><span style={{ display: "inline" }}>Back</span></button>
            <div className="min-w-0">
              <h1 className="ew-report-title">{spec.title}</h1>
              <div className="ew-report-meta"><span><b>Period:</b> {spec.period}</span><span>Last updated {generated}</span>{pending ? <span className="inline-flex items-center gap-1 text-aqua"><Loader2 size={12} className="animate-spin" /> Updating…</span> : null}</div>
            </div>
          </div>
        </div>

        <div className="ew-report-toolbar no-print">
          {spec.presets !== false ? <PeriodBar current={spec.range?.key} from={spec.range?.from} to={spec.range?.to} omit={spec.omitPresets || []} extra={spec.extraPresets || []} compact /> : null}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
            <label className="relative flex items-center" style={{ minWidth: 170, flex: "1 1 170px", maxWidth: 280 }}>
              <Search size={15} className="absolute left-2.5 text-slate" aria-hidden="true" />
              <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={spec.searchPlaceholder || "Search…"} aria-label="Search report" className="ew-input w-full" style={{ paddingLeft: 30 }} />
              {input ? <button type="button" onClick={() => setInput("")} className="absolute right-1 grid h-8 w-8 place-items-center text-slate" aria-label="Clear search"><X size={14} /></button> : null}
            </label>
            {spec.filters?.length ? <button type="button" onClick={() => setShowFilters((v) => !v)} className={BTN} aria-expanded={showFilters} title="Filters"><SlidersHorizontal size={16} /><span>Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}</span></button> : null}
            <button type="button" onClick={() => start(() => router.refresh())} className={BTN} title="Refresh"><RefreshCw size={16} className={pending ? "animate-spin" : ""} /><span>Refresh</span></button>
            <button type="button" onClick={() => printWithTitle(`${spec.title} ${spec.period}`)} className={BTN} title="Print"><Printer size={16} /><span>Print</span></button>
            <button type="button" onClick={() => { flash("Choose “Save as PDF” as the printer to download."); setTimeout(() => printWithTitle(`${spec.title} ${spec.period}`), 350); }} className={BTN} title="Download PDF"><FileDown size={16} /><span>PDF</span></button>
            <button type="button" onClick={doExcel} disabled={busy === "excel"} className={BTN} title="Download Excel">{busy === "excel" ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}<span>Excel</span></button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className={`${BTN} ew-tool-wa`} title="Share summary on WhatsApp"><MessageCircle size={16} /><span>WhatsApp</span></a>
            <button type="button" onClick={doShare} className={`${BTN} ew-tool-icon`} title="Share" aria-label="Share"><Share2 size={16} /></button>
          </div>
          {showFilters && spec.filters?.length ? (
            <div className="flex w-full flex-wrap items-center gap-2 border-t border-line pt-2">
              {spec.filters.map((f) => (
                <select key={f.name} aria-label={f.label} value={spec.filterValues?.[f.name] || ""} onChange={(e) => setFilter(f.name, e.target.value)} className="ew-input" style={{ maxWidth: 220 }}>
                  <option value="">{`All ${f.label.toLowerCase()}`}</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ))}
              {activeFilters.length ? <button type="button" className="text-xs font-semibold text-slate hover:text-aqua" onClick={() => {
                const params = new URLSearchParams(sp.toString());
                spec.filters.forEach((f) => params.delete(f.name));
                start(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
              }}>Clear filters</button> : null}
            </div>
          ) : null}
        </div>

        {filterSummary.length ? (
          <div className="flex flex-wrap gap-1.5 text-[11.5px]">
            {filterSummary.map(([k, v]) => <span key={k} className="rounded-full border border-line bg-card px-2.5 py-1 text-slate"><b className="text-ink">{k}:</b> {v}</span>)}
          </div>
        ) : null}

        {spec.cards?.length ? (
          <div className="ew-cards">
            {spec.cards.map((c, i) => (
              <div key={c.label} className={`ew-card ${i === 0 || c.primary ? "ew-card-primary" : ""} ${c.tone ? `ew-card-${c.tone}` : ""}`}>
                <div className="ew-card-label">{c.label}</div>
                <div className="ew-card-value">{c.value}</div>
                {c.sub ? <div className="ew-card-sub">{c.sub}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        {children}

        {spec.viewTabs ? (
          <div className="ew-presets" role="tablist" aria-label="View">
            {spec.viewTabs.options.map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={spec.viewTabs.current === value} onClick={() => setFilter(spec.viewTabs.name, value)} className={`ew-preset ${spec.viewTabs.current === value ? "ew-preset-on" : ""}`}>{label}</button>
            ))}
          </div>
        ) : null}

        {spec.statement ? (
          <div className="ew-panel" style={{ maxWidth: 640 }}>
            <div className="ew-panel-head"><div className="ew-panel-title">Profit Statement · {spec.period}</div></div>
            <div className="ew-pl">
              {spec.statement.map((l) => (
                <div key={l.label} className={`ew-pl-row ${l.kind === "rev" ? "ew-pl-rev" : l.kind === "net" ? `ew-pl-net ${l.value >= 0 ? "ew-text-green" : "ew-text-red"}` : "ew-pl-exp"}`}>
                  <span>{l.label}</span><span>{pkr(l.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {(spec.charts || []).filter((ch) => ch.items?.length).length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {spec.charts.filter((ch) => ch.items?.length).map((ch) => {
              const max = Math.max(...ch.items.map((i) => Math.abs(Number(i.value) || 0)), 1);
              return (
                <div key={ch.title} className="ew-panel">
                  <div className="ew-panel-head"><div className="ew-panel-title">{ch.title}</div>{ch.note ? <span className="text-[11px] text-slate">{ch.note}</span> : null}</div>
                  <div className="ew-bars">
                    {ch.items.map((i) => (
                      <div key={i.label} className="ew-bar-row">
                        <span className="ew-bar-label" title={i.label}>{i.label}</span>
                        <span className="ew-bar-track"><span className="ew-bar-fill" style={{ width: `${Math.max(2, (Math.abs(Number(i.value) || 0) / max) * 100)}%`, ...(i.color ? { background: i.color } : {}) }} /></span>
                        <span className="ew-bar-value">{i.display ?? i.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {spec.hideTable ? null : (
          <div className="ew-panel">
            <div className="ew-panel-head">
              <div className="ew-panel-title">{spec.tableTitle || "Details"}</div>
              <span className="text-[11.5px] text-slate">{rows.length.toLocaleString()} record{rows.length === 1 ? "" : "s"}{query ? ` matching “${input.trim()}”` : ""}{spec.rowNote ? ` · ${spec.rowNote}` : ""}</span>
            </div>
            {rows.length === 0 ? (
              <div className="ew-report-empty">{query ? "No records match your search." : (spec.emptyText || "No records for the selected period and filters.")}</div>
            ) : (
              <>
                <div className="ew-rtable-wrap ew-mobile-cards overflow-x-auto" style={{ maxHeight: "70vh" }}>
                  <table className="ew-rtable">
                    <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: isNum(c.type) ? "right" : "left" }}>{c.label}</th>)}</tr></thead>
                    <tbody>
                      {shown.map((r) => (
                        <tr key={r._id || r.id} className={`${r._kind ? "ew-clickable" : ""} ${drawer && drawer.id === r._id ? "ew-row-active" : ""}`}
                          onClick={r._kind ? () => setDrawer({ kind: r._kind, id: r._id, title: r[primary.key] }) : undefined}
                          tabIndex={r._kind ? 0 : undefined}
                          onKeyDown={r._kind ? (e) => { if (e.key === "Enter") setDrawer({ kind: r._kind, id: r._id, title: r[primary.key] }); } : undefined}>
                          {columns.map((c) => <td key={c.key} style={{ textAlign: isNum(c.type) ? "right" : "left", fontWeight: c.primary ? 700 : undefined, color: c.primary && r._kind ? "var(--ew-blue)" : undefined }}>{fmtCell(r[c.key], c.type)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                    {totals ? (
                      <tfoot><tr>{columns.map((c, i) => <td key={c.key} style={{ textAlign: isNum(c.type) ? "right" : "left" }}>{i === 0 ? "Grand Total" : totals[c.key] !== undefined ? fmtCell(totals[c.key], c.type) : ""}</td>)}</tr></tfoot>
                    ) : null}
                  </table>
                </div>
                <div className="ew-rcards ew-mobile-cards">
                  {shown.map((r) => (
                    <button key={r._id || r.id} type="button" className="ew-rcard" disabled={!r._kind} onClick={() => r._kind && setDrawer({ kind: r._kind, id: r._id, title: r[primary.key] })}>
                      <div className="ew-rcard-top">
                        <div className="min-w-0"><div className="ew-rcard-title">{fmtCell(r[primary.key], primary.type)}</div>{secondary ? <div className="ew-rcard-sub">{fmtCell(r[secondary.key], secondary.type)}</div> : null}</div>
                        {statusCol ? <Badge status={r[statusCol.key]} /> : null}
                      </div>
                      <dl className="ew-rcard-grid">
                        {columns.filter((c) => c !== primary && c !== secondary && c !== statusCol && !c.hideOnCard).slice(0, 6).map((c) => <div key={c.key}><dt>{c.label}</dt><dd>{fmtCell(r[c.key], c.type)}</dd></div>)}
                      </dl>
                    </button>
                  ))}
                  {totals ? (
                    <div className="ew-rcard" style={{ background: "color-mix(in srgb, var(--ew-aqua) 12%, var(--card))" }}>
                      <div className="ew-rcard-title">Grand Total</div>
                      <dl className="ew-rcard-grid">{columns.filter((c) => totals[c.key] !== undefined).map((c) => <div key={c.key}><dt>{c.label}</dt><dd>{fmtCell(totals[c.key], c.type)}</dd></div>)}</dl>
                    </div>
                  ) : null}
                </div>
                {pages > 1 ? (
                  <div className="ew-pager no-print">
                    <span>Page {page} of {pages} · showing {shown.length} of {rows.length.toLocaleString()}</span>
                    <span className="flex gap-1.5">
                      <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={`${BTN} ew-tool-icon`} aria-label="Previous page"><ChevronLeft size={16} /></button>
                      <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className={`${BTN} ew-tool-icon`} aria-label="Next page"><ChevronRight size={16} /></button>
                    </span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
        {spec.note ? <p className="text-[11.5px] text-slate">{spec.note}</p> : null}
      </div>

      {/* ---------- print / PDF layout ---------- */}
      <ReportPrint spec={spec} branding={branding} rows={rows} totals={totals} filterSummary={filterSummary} generated={generated} />

      {note ? <div className="ew-toast no-print" role="status">{note}</div> : null}
      {drawer ? <DetailDrawer {...drawer} onClose={() => setDrawer(null)} /> : null}
    </div>
  );
}

function ReportPrint({ spec, branding, rows, totals, filterSummary, generated }) {
  const b = branding || {};
  const columns = (spec.columns || []).filter((c) => c.print !== false);
  return (
    <div className="ew-print-only ew-report-print">
      {spec.landscape ? <style>{"@media print{@page{size:A4 landscape;margin:9mm 10mm 13mm}}"}</style> : null}
      <div className="ew-paper" style={{ width: "auto", minHeight: 0, boxShadow: "none", padding: 0 }}>
        <div className="ew-paper-accent" />
        <header className="ew-head">
          <div className="ew-head-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.logoUrl || "/ew-mark.svg"} alt="" className="ew-logo" />
            <div>
              <div className="ew-company">{(b.businessName || "Evergreen Water").toUpperCase()}</div>
              <div className="ew-tagline">{b.tagline || "Pure Drinking Water"}</div>
              <div className="ew-contact">{b.address ? <span>{b.address}</span> : null}{b.phone ? <span>☎ {b.phone}</span> : null}</div>
            </div>
          </div>
          <div className="ew-head-title">
            <div className="ew-doc-title" style={{ fontSize: 24 }}>{spec.title}</div>
            <dl className="ew-meta">
              <div className="ew-meta-row"><dt>Period</dt><dd>{spec.period}</dd></div>
              <div className="ew-meta-row"><dt>Generated</dt><dd>{generated}</dd></div>
              {filterSummary.map(([k, v]) => <div key={k} className="ew-meta-row"><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
        </header>
        {spec.cards?.length ? (
          <section className="ew-section"><h3 className="ew-section-title">Summary</h3>
            <div className="ew-tiles" style={{ marginTop: 6 }}>{spec.cards.map((c, i) => <div key={c.label} className={`ew-tile ${i === 0 ? "ew-tile-hl" : ""}`}><div className="ew-tile-label">{c.label}</div><div className="ew-tile-value">{c.value}</div>{c.sub ? <div className="ew-tile-sub">{c.sub}</div> : null}</div>)}</div>
          </section>
        ) : null}
        {spec.statement ? (
          <section className="ew-section"><h3 className="ew-section-title">Profit Statement</h3>
            <div className="ew-amounts" style={{ marginTop: 6, maxWidth: 420 }}>
              {spec.statement.map((l) => <div key={l.label} className={`ew-amount-row ${l.kind === "net" ? "ew-amount-total" : ""} ${l.kind === "rev" ? "ew-strong" : ""}`}><span>{l.label}</span><span className="ew-num">{pkr(l.value)}</span></div>)}
            </div>
          </section>
        ) : null}
        {(spec.charts || []).filter((ch) => ch.items?.length && ch.print !== false).map((ch) => (
          <section key={ch.title} className="ew-section"><h3 className="ew-section-title">{ch.title}</h3>
            <table className="ew-table ew-table-dense" style={{ marginTop: 6 }}><tbody>{ch.items.map((i) => <tr key={i.label}><td>{i.label}</td><td style={{ textAlign: "right" }}>{i.display ?? i.value}</td></tr>)}</tbody></table>
          </section>
        ))}
        {spec.hideTable ? null : (
          <section className="ew-section"><h3 className="ew-section-title">{spec.tableTitle || "Details"} ({rows.length})</h3>
            <div className="ew-table-wrap" style={{ marginTop: 6 }}>
              <table className="ew-table ew-table-dense">
                <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: isNum(c.type) ? "right" : "left" }}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rows.length === 0 ? <tr><td colSpan={columns.length} className="ew-empty">{spec.emptyText || "No records for the selected period and filters."}</td></tr> : rows.map((r) => (
                    <tr key={r._id || r.id}>{columns.map((c) => <td key={c.key} style={{ textAlign: isNum(c.type) ? "right" : "left" }}>{fmtCell(r[c.key], c.type)}</td>)}</tr>
                  ))}
                </tbody>
                {totals ? <tfoot><tr>{columns.map((c, i) => <td key={c.key} style={{ textAlign: isNum(c.type) ? "right" : "left" }}>{i === 0 ? "GRAND TOTAL" : totals[c.key] !== undefined ? fmtCell(totals[c.key], c.type) : ""}</td>)}</tr></tfoot> : null}
              </table>
            </div>
          </section>
        )}
        <footer className="ew-foot"><div className="ew-foot-wave" /><div className="ew-foot-band"><div><div className="ew-foot-thanks">{b.businessName || "Evergreen Water"} · {spec.title}</div><div className="ew-foot-small">Computer-generated report from live ERP records</div></div><div className="ew-foot-right"><div>{spec.period}</div><div>Generated {generated}</div></div></div></footer>
      </div>
    </div>
  );
}
