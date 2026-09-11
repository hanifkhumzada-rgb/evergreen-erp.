export function pdfContentDisposition(request, filename) {
  const preview = request && new URL(request.url).searchParams.get("preview") === "1";
  const safeName = String(filename || "document.pdf").replace(/[\r\n\"]/g, "-");
  return `${preview ? "inline" : "attachment"}; filename="${safeName}"`;
}
