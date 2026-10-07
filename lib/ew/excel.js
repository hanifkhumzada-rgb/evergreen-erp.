// Structured Excel export for EW documents and reports.
//
// Real typed cells — money and quantities stay NUMERIC (with a number
// format), dates are real Excel dates — never text or images. Every sheet
// carries the report title, period, applied filters and generation time
// above the data, and a bold totals row below it.
//
// Uses exceljs (already the app's Excel engine, see lib/excel.js): the
// community SheetJS build cannot write cell styles, so exceljs gives the
// same real-numeric output plus the branded header row. Loaded only on
// demand (dynamic import from the click handler).
import ExcelJS from "exceljs";

const NAVY = "FF0B2E59";
const BLUE = "FF0A5DA8";
const AQUA_SOFT = "FFE6F6FA";
const LINE = "FFD5E3EE";

const FORMATS = {
  money: '#,##0;[Red]-#,##0',
  number: '#,##0.##',
  int: '#,##0',
  date: 'dd-mmm-yyyy',
  text: '@',
};

function toCell(value, type) {
  if (value === null || value === undefined || value === "") return null;
  if (type === "money" || type === "number" || type === "int") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "date") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return String(value);
}

function safeName(name) {
  return (name || "Sheet1").replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Sheet1";
}

export function excelFilename(title) {
  const slug = String(title || "Report").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  return `Evergreen_Water_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

// sheets: [{ name, columns: [{ key, label, type }], rows, totals }]
//   totals: true → sum every money/number/int column; or an object of
//   { key: value } for explicit totals; or omitted for none.
export async function buildEwWorkbook({ title, period, filters = [], sheets = [], businessName = "Evergreen Water" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = businessName;
  wb.created = new Date();
  const generated = new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(safeName(sheet.name || title));
    const cols = sheet.columns || [];
    const width = Math.max(cols.length, 2);

    const letter = ws.addRow([businessName.toUpperCase()]);
    letter.font = { bold: true, size: 15, color: { argb: NAVY } };
    ws.mergeCells(letter.number, 1, letter.number, width);
    const t = ws.addRow([sheet.title || title]);
    t.font = { bold: true, size: 13, color: { argb: BLUE } };
    ws.mergeCells(t.number, 1, t.number, width);
    if (period) {
      const p = ws.addRow([`Period: ${period}`]);
      p.font = { size: 10, color: { argb: "FF4A6075" } };
      ws.mergeCells(p.number, 1, p.number, width);
    }
    const activeFilters = (filters || []).filter(([, v]) => v);
    if (activeFilters.length) {
      const f = ws.addRow([`Filters: ${activeFilters.map(([k, v]) => `${k}: ${v}`).join(" · ")}`]);
      f.font = { size: 10, color: { argb: "FF4A6075" } };
      ws.mergeCells(f.number, 1, f.number, width);
    }
    const g = ws.addRow([`Generated: ${generated}`]);
    g.font = { size: 9, italic: true, color: { argb: "FF6B7F92" } };
    ws.mergeCells(g.number, 1, g.number, width);
    ws.addRow([]);

    const header = ws.addRow(cols.map((c) => c.label));
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
    });
    header.height = 22;
    const headerRowNumber = header.number;

    const rows = sheet.rows || [];
    rows.forEach((r) => {
      const row = ws.addRow(cols.map((c) => toCell(r[c.key], c.type)));
      cols.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (FORMATS[c.type]) cell.numFmt = FORMATS[c.type];
        if (["money", "number", "int"].includes(c.type)) cell.alignment = { horizontal: "right" };
        cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
      });
    });

    if (sheet.totals && rows.length) {
      const values = cols.map((c, i) => {
        if (i === 0) return "TOTAL";
        if (sheet.totals !== true) return sheet.totals[c.key] ?? null;
        if (["money", "number", "int"].includes(c.type) && !c.noTotal) return rows.reduce((a, r) => a + (Number(r[c.key]) || 0), 0);
        return null;
      });
      const tr = ws.addRow(values);
      tr.font = { bold: true, color: { argb: NAVY } };
      cols.forEach((c, i) => {
        const cell = tr.getCell(i + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AQUA_SOFT } };
        cell.border = { top: { style: "medium", color: { argb: BLUE } } };
        if (FORMATS[c.type] && i > 0) cell.numFmt = FORMATS[c.type];
      });
    } else if (!rows.length) {
      const e = ws.addRow(["No records for the selected period / filters."]);
      e.font = { italic: true, color: { argb: "FF6B7F92" } };
    }

    cols.forEach((c, i) => {
      const longest = Math.max(String(c.label).length, ...rows.slice(0, 500).map((r) => String(r[c.key] ?? "").length));
      ws.getColumn(i + 1).width = Math.min(48, Math.max(10, longest + 3));
    });
    ws.views = [{ state: "frozen", ySplit: headerRowNumber }];
  }
  return wb;
}

export async function downloadEwWorkbook(spec) {
  const wb = await buildEwWorkbook(spec);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = excelFilename(spec.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
