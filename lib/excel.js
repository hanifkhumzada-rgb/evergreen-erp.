import * as XLSX from "xlsx";

// The installed `xlsx` package is SheetJS's free Community Edition —
// cell fill/font/border styling and frozen panes are Pro-only features
// and are silently dropped on write (verified empirically: setting `.s`
// on a cell and writing produces no fill/font in the output file's
// styles.xml). So this deliberately does NOT attempt colored/bold
// headers or a frozen header row — those would just be a no-op. What CE
// genuinely writes and this uses: column widths (`!cols`), per-cell
// number formats (`.z`), and plain data/text rows for the letterhead.
const CURRENCY_KEYWORDS = ["amount", "total", "balance", "revenue", "cost", "price", "rate", "paid",
  "outstanding", "credit", "debit", "discount", "fee", "cash", "collected", "billed", "sales", "salary"];

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

// Builds a branded workbook: company name/tagline, report title, period +
// generated timestamp as the first few rows, then the data table (with a
// numeric-column totals row), auto-fit column widths, and PKR-style
// number formatting on columns whose name looks like a money figure.
export function buildBrandedWorkbook({ rows, sheetName, reportTitle, branding, period }) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const businessName = branding?.businessName || branding?.business_name || "Evergreen Water";
  const tagline = branding?.tagline || "Pure Drinking Water";

  const aoa = [
    [businessName],
    [tagline],
    [reportTitle || sheetName || "Report"],
    [period ? `Period: ${period}` : "Period: All data"],
    [`Generated: ${fmtGenerated()}`],
    [],
    columns,
  ];

  rows.forEach((row) => aoa.push(columns.map((c) => row[c] ?? "")));

  const numericCols = columns.filter((c) => rows.length > 0 && rows.every((r) => typeof r[c] === "number"));
  if (numericCols.length > 0) {
    aoa.push(columns.map((c, i) => (i === 0 ? "Total" : (numericCols.includes(c) ? rows.reduce((a, r) => a + (Number(r[c]) || 0), 0) : ""))));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const headerRowIdx = 6; // 0-indexed row of the column-header row within aoa

  // Number format on every numeric cell in currency-named columns
  // (thousands separator on every other numeric column, still an
  // improvement over an unformatted raw float).
  columns.forEach((col, colIdx) => {
    const isCurrency = isCurrencyColumn(col);
    const isNumeric = numericCols.includes(col);
    if (!isNumeric) return;
    const fmt = isCurrency ? '"PKR" #,##0' : "#,##0";
    for (let r = headerRowIdx + 1; r < aoa.length; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: colIdx });
      if (ws[addr]) ws[addr].z = fmt;
    }
  });

  // Auto-fit: widest of the header, every data value (stringified), and
  // the company/report title rows that share column A.
  ws["!cols"] = columns.map((col, i) => {
    const headerLen = String(col).length;
    const dataLen = rows.reduce((max, r) => Math.max(max, String(r[col] ?? "").length), 0);
    const topRowLen = i === 0 ? Math.max(businessName.length, tagline.length, String(reportTitle || "").length) : 0;
    return { wch: Math.min(Math.max(headerLen, dataLen, topRowLen, 8) + 2, 42) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheetName));
  return wb;
}

// Evergreen_Water_<ReportName>_<YYYY-MM-DD>.xlsx
export function brandedFilename(reportTitle) {
  const today = new Date().toISOString().slice(0, 10);
  const slug = (reportTitle || "Report").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  return `Evergreen_Water_${slug}_${today}.xlsx`;
}
