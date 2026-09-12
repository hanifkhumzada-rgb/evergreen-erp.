"use client";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, File, FileSpreadsheet, Printer, UploadCloud, X } from "lucide-react";

const MAX_BYTES = 15 * 1024 * 1024;

export default function DocumentPreview() {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const kind = useMemo(() => {
    if (!file) return "none";
    if (file.type === "application/pdf") return "pdf";
    if (file.type.startsWith("image/")) return "image";
    if (/\.(xlsx?|csv)$/i.test(file.name)) return "sheet";
    return "file";
  }, [file]);

  const choose = async (next) => {
    setError(""); setSheet(null);
    if (!next) return;
    if (next.size > MAX_BYTES) { setError("File 15MB se choti honi chahiye."); return; }
    if (url) URL.revokeObjectURL(url);
    setFile(next);
    setUrl(URL.createObjectURL(next));
    if (/\.(xlsx?|csv)$/i.test(next.name)) {
      try {
        const mod = await import("xlsx");
        const XLSX = mod.default?.utils ? mod.default : mod;
        const wb = XLSX.read(await next.arrayBuffer());
        const ws = wb.Sheets[wb.SheetNames[0]];
        setSheet(XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(0, 100));
      } catch { setError("Spreadsheet preview read nahi ho saka."); }
    }
  };

  const clear = () => { if (url) URL.revokeObjectURL(url); setFile(null); setUrl(""); setSheet(null); setError(""); };
  const printFile = () => {
    if (!url) return;
    if (kind === "pdf" || kind === "image") {
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (popup) popup.addEventListener("load", () => popup.print(), { once: true });
      return;
    }
    window.print();
  };

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-5">
      <section className="no-print rounded-2xl border bg-card p-5 h-fit">
        <div className="w-11 h-11 rounded-2xl bg-aquaSoft text-aqua flex items-center justify-center mb-4"><UploadCloud size={22} /></div>
        <h2 className="font-display text-lg font-semibold">Open a document</h2>
        <p className="text-xs text-slate mt-1 mb-5">PDF, image, Excel ya CSV ko upload se pehle safely preview karein.</p>
        <label className="block border-2 border-dashed border-line hover:border-aqua rounded-2xl p-6 text-center cursor-pointer transition-colors bg-foam/50">
          <input className="sr-only" type="file" accept=".pdf,image/*,.xlsx,.xls,.csv" onChange={(e) => choose(e.target.files?.[0])} />
          <UploadCloud className="mx-auto text-aqua" size={26} />
          <span className="block text-sm font-semibold mt-2">Choose file</span>
          <span className="block text-[11px] text-slate mt-1">Maximum 15MB</span>
        </label>
        {error ? <p className="text-xs text-coral bg-coralSoft rounded-xl p-3 mt-4">{error}</p> : null}
        {file ? <><div className="mt-4 flex items-center gap-3 rounded-xl border p-3"><File size={18} className="text-aqua" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{file.name}</p><p className="text-[10px] text-slate">{(file.size / 1024).toFixed(0)} KB</p></div><button type="button" onClick={clear} aria-label="Close preview"><X size={16} /></button></div><div className="grid grid-cols-2 gap-2 mt-3"><a href={url} download={file.name} className="flex items-center justify-center gap-1.5 rounded-xl bg-aqua text-white py-2.5 text-xs font-bold"><Download size={14} /> Download</a><button type="button" onClick={printFile} className="flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-xs font-bold"><Printer size={14} /> Print</button></div></> : null}
      </section>

      <section className="rounded-2xl border bg-card overflow-hidden min-h-[560px]">
        <div className="h-14 border-b flex items-center justify-between px-5"><div className="flex items-center gap-2 font-semibold text-sm"><Eye size={17} className="text-aqua" /> Smart Preview</div><span className="text-[10px] text-slate uppercase tracking-widest">Local & private</span></div>
        {!file ? <div className="h-[500px] grid place-items-center text-center p-8"><div><File size={42} className="mx-auto text-line" /><p className="text-sm font-semibold mt-3">Preview area</p><p className="text-xs text-slate mt-1">Select a file to see it here.</p></div></div> : null}
        {kind === "pdf" ? <iframe title={file.name} src={url} className="w-full h-[620px] border-0" /> : null}
        {kind === "image" ? <div className="p-5 flex justify-center bg-foam"><img src={url} alt={file.name} className="max-h-[620px] max-w-full rounded-xl object-contain" /></div> : null}
        {kind === "sheet" && sheet ? <div className="overflow-auto max-h-[620px] content-auto"><table className="w-full text-xs border-collapse"><tbody>{sheet.map((row, i) => <tr key={i} className={i === 0 ? "sticky top-0 bg-navy text-white font-bold" : "odd:bg-foam"}>{row.map((cell, j) => <td key={j} className="px-3 py-2 border whitespace-nowrap">{String(cell)}</td>)}</tr>)}</tbody></table></div> : null}
        {kind === "file" ? <div className="h-[500px] grid place-items-center text-center"><div><FileSpreadsheet size={42} className="mx-auto text-aqua" /><p className="mt-3 text-sm">Preview available nahi hai.</p><a href={url} download={file.name} className="text-xs text-aqua font-semibold mt-2 inline-block">Download file</a></div></div> : null}
      </section>
    </div>
  );
}
