import ExcelJS from "exceljs";

// Switched from the `xlsx` package (SheetJS) to `exceljs` — SheetJS's
// installed Community Edition silently drops cell fill/font/border
// styling and frozen panes (Pro-only features; verified empirically:
// setting `.s` on a cell and writing produced no fill/font in the output
// file's styles.xml). exceljs is free and actively maintained with full
// styling support, so every export below now gets real bordered cells, a
// colored header row, a bold totals row, and a frozen header — not just
// column widths and number formats.
const CURRENCY_KEYWORDS = ["amount", "total", "balance", "revenue", "cost", "price", "rate", "paid",
  "outstanding", "credit", "debit", "discount", "fee", "cash", "collected", "billed", "sales", "salary"];

// Pulled from lib/pdf/theme.js's COLORS (same palette every branded PDF
// already uses) — ARGB (alpha-first) is exceljs's color format.
const BRAND = {
  navy: "FF073B3A",
  navyLight: "FF0E4F4D",
  aqua: "FF059669",
  foam: "FFF4FAF8",
  line: "FFDCEAE6",
  slate: "FF5C7D78",
  ink: "FF0B1F1D",
  white: "FFFFFFFF",
};

const THIN_BORDER = { style: "thin", color: { argb: BRAND.line } };
const ALL_SIDES_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

function isCurrencyColumn(key) {
  const k = key.toLowerCase();
  return CURRENCY_KEYWORDS.some((kw) => k.includes(kw));
}

// Excel sheet names: max 31 chars, and : \ / ? * [ ] are all invalid.
function safeSheetName(name) {
  return (name || "Sheet1").replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Sheet1";
}

function fmtGenerated() {
  return new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// The company logo for the letterhead — `branding.logo` (a data URI, the
// shape getBusinessBranding() returns for PDF routes) is used directly;
// most on-screen callers only carry getBrandingLite()'s plain
// `branding.logoUrl`, in which case it's fetched client-side (the public
// branding storage bucket allows this). Never lets a failed/missing logo
// break the export — just skips the image.
async function resolveLogoImage(branding) {
  try {
    if (branding?.logo) {
      const match = /^data:image\/(\w+);base64,(.+)$/.exec(branding.logo);
      if (match) return { base64: match[2], extension: match[1] === "jpeg" || match[1] === "jpg" ? "jpeg" : "png" };
    }
    if (branding?.logoUrl) {
      const res = await fetch(branding.logoUrl);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/png";
      const extension = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpeg" : "png";
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
      return { base64, extension };
    }
  } catch {
    // best-effort — a broken/unreachable logo never blocks the export
  }
  return null;
}

// Builds a branded workbook: logo + company name/tagline, report title,
// period + generated timestamp as the letterhead, then the data table —
// bordered cells throughout, a navy header row in white bold text, PKR
// number formatting on currency-looking columns, a bold totals row with
// a heavier top border, auto-fit column widths, and the header row (plus
// the letterhead above it) frozen so it stays visible while scrolling.
export async function buildBrandedWorkbook({ rows, sheetName, reportTitle, branding, period }) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const businessName = branding?.businessName || branding?.business_name || "Evergreen Water";
  const tagline = branding?.tagline || "Pure Drinking Water";
  const title = reportTitle || sheetName || "Report";

  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  wb.created = new Date();
  const ws = wb.addWorksheet(safeSheetName(sheetName));

  const logoImage = await resolveLogoImage(branding);
  const textCol = logoImage ? 2 : 1; // shift the letterhead text right one column so it doesn't sit under the logo
  if (logoImage) {
    const imageId = wb.addImage({ base64: logoImage.base64, extension: logoImage.extension });
    ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 44, height: 44 } });
  }

  ws.getCell(1, textCol).value = businessName;
  ws.getCell(1, textCol).font = { bold: true, size: 14, color: { argb: BRAND.navy } };
  ws.getCell(2, textCol).value = tagline;
  ws.getCell(2, textCol).font = { italic: true, size: 10, color: { argb: BRAND.slate } };
  ws.getCell(3, textCol).value = title;
  ws.getCell(3, textCol).font = { bold: true, size: 12, color: { argb: BRAND.ink } };
  ws.getCell(4, textCol).value = period ? `Period: ${period}` : "Period: All data";
  ws.getCell(4, textCol).font = { size: 9, color: { argb: BRAND.slate } };
  ws.getCell(5, textCol).value = `Generated: ${fmtGenerated()}`;
  ws.getCell(5, textCol).font = { size: 9, color: { argb: BRAND.slate } };

  const headerRowIdx = 7;
  const numericCols = columns.filter((c) => rows.length > 0 && rows.every((r) => typeof r[c] === "number"));

  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col;
    cell.font = { bold: true, color: { argb: BRAND.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.navy } };
    cell.border = ALL_SIDES_BORDER;
    cell.alignment = { vertical: "middle" };
  });
  headerRow.commit();

  rows.forEach((row, rIdx) => {
    const excelRow = ws.getRow(headerRowIdx + 1 + rIdx);
    columns.forEach((col, cIdx) => {
      const cell = excelRow.getCell(cIdx + 1);
      const value = row[col] ?? "";
      cell.value = value;
      cell.border = ALL_SIDES_BORDER;
      if (rIdx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.foam } };
      if (typeof value === "number") cell.numFmt = isCurrencyColumn(col) ? '"PKR" #,##0' : "#,##0";
    });
    excelRow.commit();
  });

  if (numericCols.length > 0) {
    const totalsRowIdx = headerRowIdx + 1 + rows.length;
    const totalsRow = ws.getRow(totalsRowIdx);
    columns.forEach((col, i) => {
      const cell = totalsRow.getCell(i + 1);
      if (i === 0) {
        cell.value = "Total";
      } else if (numericCols.includes(col)) {
        cell.value = rows.reduce((a, r) => a + (Number(r[col]) || 0), 0);
        cell.numFmt = isCurrencyColumn(col) ? '"PKR" #,##0' : "#,##0";
      }
      cell.font = { bold: true, color: { argb: BRAND.ink } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.foam } };
      cell.border = { ...ALL_SIDES_BORDER, top: { style: "medium", color: { argb: BRAND.navy } } };
    });
    totalsRow.commit();
  }

  // Auto-fit: widest of the header, every data value (stringified), and
  // the company/report title rows that share this column.
  columns.forEach((col, i) => {
    const headerLen = String(col).length;
    const dataLen = rows.reduce((max, r) => Math.max(max, String(r[col] ?? "").length), 0);
    const topRowLen = i + 1 === textCol ? Math.max(businessName.length, tagline.length, title.length) : 0;
    ws.getColumn(i + 1).width = Math.min(Math.max(headerLen, dataLen, topRowLen, 8) + 2, 42);
  });
  if (logoImage) ws.getColumn(1).width = Math.max(ws.getColumn(1).width || 0, 7);

  // Freeze the letterhead + header row so they stay visible while
  // scrolling through a long export.
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];

  return wb;
}

// Evergreen_Water_<ReportName>_<YYYY-MM-DD>.xlsx
export function brandedFilename(reportTitle) {
  const today = new Date().toISOString().slice(0, 10);
  const slug = (reportTitle || "Report").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  return `Evergreen_Water_${slug}_${today}.xlsx`;
}
