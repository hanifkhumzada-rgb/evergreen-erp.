// The on-screen/printed counterpart to lib/pdf/DocumentChrome.js — the same
// Evergreen document design every generated PDF uses: a teal→emerald
// gradient band with a water-wave edge, the logo on a white tile + company
// identity on the left, the document title (and number/period) large on the
// right, and a dark brand footer bar. Used by every report/list page's
// Print / Save as PDF (Trial Balance, P&L, Balance Sheet, Sales, Payments,
// Expenses, Deliveries, Bottles, Inventory, …) so a printed page looks like
// the same document family as the downloaded PDFs.
//
// Pure presentational (no data fetching) — works in Server and Client
// Components. `hidden print:block` means it only appears in printed output
// (the app has its own header on screen); pages that ARE a document (the
// invoice view) pass `printOnly={false}` to show it on screen too.
// print-color-adjust keeps the band's colours when printing (browsers drop
// backgrounds by default).
const PRINT_EXACT = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

export default function DocumentPrintHeader({ branding, title, meta, printOnly = true }) {
  const b = branding || {};
  const phones = [b.phone, b.phone2 || b.phone_2].filter(Boolean).join(" / ");
  const contact = [b.address, [phones, b.email].filter(Boolean).join("  ·  ")].filter(Boolean);
  const logo = b.logoUrl || b.logo_url || "/icon-192.png";
  const long = String(title || "").length > 18;

  return (
    <div className={`${printOnly ? "hidden print:block" : "block"} relative mb-5 overflow-hidden rounded-2xl print:rounded-none`} style={PRINT_EXACT}>
      <div className="relative px-6 pb-9 pt-5 text-white sm:px-7"
        style={{ ...PRINT_EXACT, background: "linear-gradient(115deg, #063D3B 0%, #07564D 60%, #087C69 100%)" }}>
        <div className="flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white p-1" style={PRINT_EXACT}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="h-12 w-12 rounded-xl object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-xl font-bold leading-tight tracking-wide">{b.businessName || b.business_name || "Evergreen Water"}</div>
              {b.tagline && <div className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.18em] text-[#9EF0D0]">{b.tagline}</div>}
              {contact.map((line) => <div key={line} className="mt-1 text-[8.5px] leading-snug text-[#D7EFEC]">{line}</div>)}
            </div>
          </div>
          <div className="max-w-[45%] shrink-0 text-right">
            <div className={`font-display font-bold uppercase leading-tight ${long ? "text-base tracking-wider" : "text-2xl tracking-[0.12em]"}`}>{title}</div>
            {meta && <div className="mt-1.5 whitespace-pre-line text-[9px] leading-snug text-[#D7EFEC]">{meta}</div>}
          </div>
        </div>
        {/* water-wave lower edge */}
        <svg aria-hidden="true" viewBox="0 0 600 40" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-8 w-full">
          <path d="M0 22 C 120 6, 220 44, 340 26 S 520 10, 600 24 L 600 40 L 0 40 Z" fill="#fff" fillOpacity="0.12" />
          <path d="M0 34 C 150 20, 260 46, 400 34 S 540 26, 600 36 L 600 40 L 0 40 Z" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

// Matching footer — dark brand bar with the generated date/time and the
// same "computer-generated" note every PDF carries.
export function DocumentPrintFooter() {
  const generated = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="hidden print:flex mt-6 items-center justify-between rounded-lg bg-[#073B3A] px-4 py-2" style={PRINT_EXACT}>
      <p className="text-[8px] font-bold text-[#9EF0D0]">{`Generated ${generated}`}</p>
      <p className="text-[7.5px] text-[#D7EFEC]">Computer-generated document · does not require a signature unless noted</p>
    </div>
  );
}
