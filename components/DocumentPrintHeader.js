// The on-screen counterpart to lib/pdf/DocumentChrome.js's PdfShell — same
// three-column layout (logo left, brand identity centered, document
// type/number/period right), same data source (business_settings), so a
// printed page reads exactly like a generated PDF instead of a raw
// printout of the dashboard. Pure presentational (no data fetching) so it
// can be dropped into a Server Component page directly, or into a Client
// Component (ReportsBrowser, etc.) fed by a `branding` prop the page
// already fetched — `hidden print:flex` means it renders nothing during
// normal browsing (the app already has its own header/nav) and only
// appears in the printable output, right above the page's own content.
// Pages that ARE a document in their own right (the invoice view) rather
// than a dashboard with a print preview bolted on pass `printOnly={false}`
// so the same branded header shows on screen too, not just when printed.
export default function DocumentPrintHeader({ branding, title, meta, printOnly = true }) {
  const b = branding || {};
  const phones = [b.phone, b.phone2 || b.phone_2].filter(Boolean).join(" / ");
  const contact = [b.address, phones, b.email].filter(Boolean).join("   ·   ");

  return (
    <div className={`${printOnly ? "hidden print:flex" : "flex"} items-start justify-between gap-4 pb-3.5 mb-4 border-b-2 border-navy`}>
      <div className="w-16 flex-shrink-0">
        {/* Logo + company name are the primary brand element on every
            document — sized up noticeably from tagline/contact/meta text so
            they read as the letterhead's focal point, matching PdfShell. */}
        {(b.logoUrl || b.logo_url) && <img src={b.logoUrl || b.logo_url} alt="" className="w-16 h-16 rounded-xl object-contain" />}
      </div>
      <div className="flex-1 text-center">
        <div className="font-display text-2xl font-bold text-navy tracking-wide">{b.businessName || b.business_name || "Evergreen Water"}</div>
        {b.tagline && <div className="text-[9px] font-bold text-aqua uppercase tracking-widest mt-0.5">{b.tagline}</div>}
        {contact && <div className="text-[8.5px] text-slate mt-1.5">{contact}</div>}
      </div>
      <div className="w-44 flex-shrink-0 text-right">
        <div className="text-[11px] font-bold text-navy uppercase tracking-wide">{title}</div>
        {meta && <div className="text-[8.5px] text-slate mt-1 whitespace-pre-line">{meta}</div>}
      </div>
    </div>
  );
}

// Matching footer — generated date/time + the same "computer generated"
// note every PDF carries, so a printed page and a downloaded PDF of the
// same data look like the same document family.
export function DocumentPrintFooter() {
  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="hidden print:block mt-6 pt-2 border-t border-line text-center">
      <p className="text-[8px] text-slate">{`Generated ${generated}`}</p>
      <p className="text-[7.5px] text-slate italic mt-0.5">This is a computer-generated document and does not require a signature unless noted.</p>
    </div>
  );
}
