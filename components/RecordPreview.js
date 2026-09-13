"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Eye, FileSpreadsheet, Printer, X, ExternalLink, Image as ImageIcon } from "lucide-react";

const BTN = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-xs font-bold text-ink transition hover:border-aqua/40 hover:bg-aquaSoft/50";

function printableValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export default function RecordPreview({
  title,
  subtitle,
  fields = [],
  sections = [],
  imageSrc,
  imageAlt = "Preview",
  downloadHref,
  downloadLabel = "Download",
  openHref,
  openLabel = "Open Full Record",
  excelRows,
  excelTitle,
  triggerLabel = "Preview",
  triggerClassName = "",
  iconOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const allSections = useMemo(() => {
    const base = fields?.length ? [{ title: "Details", fields }] : [];
    return [...base, ...(sections || [])].filter((section) => section?.fields?.length);
  }, [fields, sections]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const exportExcel = async () => {
    if (!excelRows?.length) return;
    setExcelLoading(true);
    try {
      const { buildBrandedWorkbook, brandedFilename } = await import("@/lib/excel");
      const reportTitle = excelTitle || title || "Record";
      const wb = await buildBrandedWorkbook({ rows: excelRows, sheetName: "Preview", reportTitle });
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = brandedFilename(reportTitle);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Excel export failed: ${error?.message || "Unknown error"}`);
    } finally {
      setExcelLoading(false);
    }
  };

  const printPreview = () => {
    document.body.classList.add("record-preview-print");
    window.print();
    setTimeout(() => document.body.classList.remove("record-preview-print"), 250);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={triggerLabel}
        className={triggerClassName || (iconOnly ? "w-9 h-9 flex items-center justify-center rounded-lg border border-line text-slate hover:bg-foam" : BTN)}
      >
        <Eye size={15} />{iconOnly ? null : triggerLabel}
      </button>

      {open ? (
        <div className="no-print fixed inset-0 z-[120] bg-navy/65 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label={`${title || "Record"} preview`}>
          <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-[22px] border border-white/20 bg-card shadow-2xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-foam/70 px-3 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Eye size={16} className="text-aqua" />
                  <h2 className="truncate font-display text-base font-semibold sm:text-lg">{title || "Record Preview"}</h2>
                </div>
                {subtitle ? <p className="mt-0.5 truncate text-xs text-slate">{subtitle}</p> : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {downloadHref ? <a href={downloadHref} className={BTN}><Download size={14} />{downloadLabel}</a> : null}
                {excelRows?.length ? <button type="button" onClick={exportExcel} disabled={excelLoading} className={`${BTN} disabled:opacity-60`}><FileSpreadsheet size={14} />{excelLoading ? "Preparing…" : "Excel"}</button> : null}
                <button type="button" onClick={printPreview} className={BTN}><Printer size={14} />Print / PDF</button>
                {openHref ? <Link href={openHref} className={BTN}><ExternalLink size={14} />{openLabel}</Link> : null}
                <button type="button" onClick={() => setOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line hover:bg-foam" aria-label="Close preview"><X size={16} /></button>
              </div>
            </div>

            <div className="record-preview-content flex-1 overflow-y-auto bg-[#F7FAFA] p-3 sm:p-6">
              <div className="mx-auto max-w-4xl space-y-4">
                {imageSrc ? (
                  <section className="overflow-hidden rounded-2xl border border-line bg-card p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate"><ImageIcon size={14} />Image</div>
                    <img src={imageSrc} alt={imageAlt} className="mx-auto max-h-[420px] max-w-full rounded-xl object-contain" />
                  </section>
                ) : null}

                {allSections.map((section, sectionIndex) => (
                  <section key={`${section.title || "section"}-${sectionIndex}`} className="rounded-2xl border border-line bg-card p-4 sm:p-5">
                    {section.title ? <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate">{section.title}</h3> : null}
                    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                      {section.fields.map((field, index) => (
                        <div key={`${field.label}-${index}`} className={field.fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate">{field.label}</div>
                          <div className={`mt-1 text-sm ${field.emphasis ? "font-bold text-navy" : "font-medium text-ink"}`}>{printableValue(field.value)}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
