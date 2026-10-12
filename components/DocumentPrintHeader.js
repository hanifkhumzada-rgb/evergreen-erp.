"use client";

import { useEffect, useState } from "react";

// The on-screen/printed counterpart to lib/pdf/DocumentChrome.js — the same
// Evergreen document design every generated PDF uses: centered official
// branding followed by a compact Ocean Blue document-title band. Used by
// every report/list page's
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
  return (
    <div className={`${printOnly ? "hidden print:block" : "block"} mb-5 overflow-hidden rounded-2xl border border-[#D8E5F1] bg-white print:rounded-none`} style={PRINT_EXACT}>
      <div className="px-5 pb-4 pt-4 text-center sm:px-7">
        <div className="mx-auto grid h-[52px] w-[52px] place-items-center rounded-xl bg-[#103B64] p-1" style={PRINT_EXACT}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="EW" className="h-11 w-11 rounded-lg object-contain" />
        </div>
        <div className="mt-1 font-display text-[22px] font-bold leading-tight tracking-wide text-[#103B64]">{b.businessName || b.business_name || "Evergreen Water"}</div>
        <div className="mt-0.5 text-[11px] font-semibold tracking-wide text-[#00A6C8]">{b.tagline || "Pure Drinking Water"}</div>
        {contact.length > 0 && <div className="mt-1 text-[8px] leading-snug text-[#60758D]">{contact.join("  ·  ")}</div>}
      </div>
      <div className="grid min-h-10 grid-cols-[1fr_auto_1fr] items-center gap-3 border-t-2 border-[#00A6C8] bg-[#EAF6FB] px-5 py-2" style={PRINT_EXACT}>
        <span aria-hidden="true" />
        <div className="font-display text-center text-sm font-bold uppercase tracking-[0.1em] text-[#103B64]">{title}</div>
        {meta ? <div className="whitespace-pre-line text-right text-[8px] leading-snug text-[#60758D]">{meta}</div> : <span />}
      </div>
    </div>
  );
}

// Matching footer — dark brand bar with the generated date/time and the
// same "computer-generated" note every PDF carries.
export function DocumentPrintFooter() {
  const [generated, setGenerated] = useState("");
  useEffect(() => {
    setGenerated(new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  }, []);
  return (
    <div className="hidden print:flex mt-6 items-center justify-between rounded-lg bg-[#103B64] px-4 py-2" style={PRINT_EXACT}>
      <p className="text-[8px] font-bold text-[#9EF0D0]">{generated ? `Generated ${generated}` : "Generated when printed"}</p>
      <p className="text-[7.5px] text-[#D7EFEC]">Computer-generated document · does not require a signature unless noted</p>
    </div>
  );
}
