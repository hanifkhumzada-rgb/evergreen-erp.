// Evergreen Water document design system — the building blocks every
// printable document (Invoice, Receipt, Statement, Ledger, Vouchers,
// Delivery Slip, Adjustment, Daily Closing) is assembled from, so they all
// share one header, typography, colour, spacing, footer and status system
// while their bodies stay purpose-specific.
//
// Pure presentational — NO "use client", no hooks — so Server Components
// can render documents directly. Styles live in app/ew-documents.css.
import { statusInfo, TONE_CLASS } from "@/lib/ew/status";

export function EwStatusBadge({ status, label, tone }) {
  const info = statusInfo(status);
  const t = tone || info.tone;
  return <span className={TONE_CLASS[t] || TONE_CLASS.blue}>{label || info.label}</span>;
}

// The A4 sheet. `landscape` switches the printed page orientation via a
// named @page (see ew-documents.css).
export function EwPaper({ children, landscape = false, className = "" }) {
  return (
    <article className={`ew-paper ${landscape ? "ew-paper-landscape" : ""} ${className}`}>
      <div className="ew-paper-accent" aria-hidden="true" />
      {children}
    </article>
  );
}

function Logo({ branding }) {
  const src = branding?.logoUrl || "/ew-mark.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Evergreen Water logo" className="ew-logo" />;
}

// Header: EW logo + company identity on the left; the large document title
// + subtitle on the right; then an optional meta box (No./Date/Status…).
export function EwDocHeader({ branding, title, subtitle, meta = [], status }) {
  const b = branding || {};
  const phones = [b.phone, b.phone2].filter(Boolean).join(" · ");
  return (
    <header className="ew-head">
      <div className="ew-head-brand">
        <Logo branding={b} />
        <div className="min-w-0">
          <div className="ew-company">{(b.businessName || "Evergreen Water").toUpperCase()}</div>
          <div className="ew-tagline">{b.tagline || "Pure Drinking Water"}</div>
          <div className="ew-contact">
            {b.address ? <span>{b.address}</span> : null}
            {phones ? <span>☎ {phones}</span> : null}
            {b.email ? <span>✉ {b.email}</span> : null}
            {b.ntn ? <span>NTN {b.ntn}</span> : null}
          </div>
        </div>
      </div>
      <div className="ew-head-title">
        <div className="ew-doc-title">{title}</div>
        {subtitle ? <div className="ew-doc-subtitle">{subtitle}</div> : null}
        {meta.length > 0 || status ? (
          <dl className="ew-meta">
            {meta.filter(Boolean).map((m) => (
              <div key={m.label} className="ew-meta-row"><dt>{m.label}</dt><dd>{m.value ?? "—"}</dd></div>
            ))}
            {status ? <div className="ew-meta-row"><dt>Status</dt><dd><EwStatusBadge status={status} /></dd></div> : null}
          </dl>
        ) : null}
      </div>
    </header>
  );
}

export function EwSection({ title, children, className = "", aside }) {
  return (
    <section className={`ew-section ${className}`}>
      {title ? <div className="ew-section-head"><h3 className="ew-section-title">{title}</h3>{aside}</div> : null}
      {children}
    </section>
  );
}

// Label/value grid for party details (customer, employee, supplier…).
export function EwInfoGrid({ items = [], columns = 3 }) {
  return (
    <dl className={`ew-info-grid ew-cols-${columns}`}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className={it.wide ? "ew-info-wide" : ""}>
          <dt>{it.label}</dt>
          <dd className={it.strong ? "ew-strong" : ""}>{it.value === null || it.value === undefined || it.value === "" ? "—" : it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Row of summary tiles (Billing Summary, Bottle Summary…). `highlight`
// paints the tile in the brand blue (used for the key outstanding figure).
export function EwStatTiles({ items = [], cols }) {
  return (
    <div className={`ew-tiles ${cols ? `ew-tiles-${cols}` : ""}`}>
      {items.filter(Boolean).map((it) => (
        <div key={it.label} className={`ew-tile ${it.highlight ? "ew-tile-hl" : ""} ${it.tone ? `ew-tile-${it.tone}` : ""}`}>
          <div className="ew-tile-label">{it.label}</div>
          <div className="ew-tile-value">{it.value}</div>
          {it.sub ? <div className="ew-tile-sub">{it.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

// columns: [{ key, label, align, width, render? }]
export function EwTable({ columns, rows, empty = "No entries.", footer, dense = false }) {
  return (
    <div className="ew-table-wrap">
      <table className={`ew-table ${dense ? "ew-table-dense" : ""}`}>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={{ width: c.width, textAlign: c.align || "left" }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="ew-empty">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.id || r.key || i}>
              {columns.map((c) => <td key={c.key} style={{ textAlign: c.align || "left" }}>{c.render ? c.render(r, i) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
        {footer ? <tfoot>{footer}</tfoot> : null}
      </table>
    </div>
  );
}

// Right-aligned amount summary. lines: [{ label, value, tone, strong, total }]
export function EwAmountSummary({ lines = [] }) {
  return (
    <div className="ew-amounts">
      {lines.filter(Boolean).map((l) => (
        <div key={l.label} className={`ew-amount-row ${l.total ? "ew-amount-total" : ""} ${l.strong ? "ew-strong" : ""} ${l.tone ? `ew-text-${l.tone}` : ""}`}>
          <span>{l.label}</span><span className="ew-num">{l.value}</span>
        </div>
      ))}
    </div>
  );
}

export function EwNote({ title, children }) {
  if (!children) return null;
  return (
    <div className="ew-note">
      <div className="ew-note-title">{title}</div>
      <div className="ew-note-body">{children}</div>
    </div>
  );
}

export function EwSignatures({ branding, labels = ["Authorized Signature"] }) {
  return (
    <div className="ew-signs">
      {labels.map((label, i) => (
        <div key={label} className="ew-sign">
          {i === labels.length - 1 && branding?.signatureUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={branding.signatureUrl} alt="" className="ew-sign-img" />
            : <div className="ew-sign-space" />}
          <div className="ew-sign-line" />
          <div className="ew-sign-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function EwDocFooter({ branding, reference, generatedAt }) {
  const b = branding || {};
  const generated = generatedAt || new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  return (
    <footer className="ew-foot">
      <div className="ew-foot-wave" aria-hidden="true" />
      <div className="ew-foot-band">
        <div>
          <div className="ew-foot-thanks">Thank you for choosing {b.businessName || "Evergreen Water"}</div>
          <div className="ew-foot-small">{b.footerNote || "Pure, safe drinking water delivered to your door."}</div>
        </div>
        <div className="ew-foot-right">
          {reference ? <div>{reference}</div> : null}
          <div>Generated {generated}</div>
          <div className="ew-foot-small">Computer-generated document</div>
        </div>
      </div>
    </footer>
  );
}

// A full "this document has no record" placeholder inside the viewer.
export function EwMissing({ title = "Record not found", message = "This record does not exist or you do not have access to it." }) {
  return (
    <div className="ew-missing">
      <div className="ew-missing-title">{title}</div>
      <p>{message}</p>
    </div>
  );
}
