// Every generated PDF opens in the browser's native viewer by default
// (page thumbnails, zoom, print and download icons all come for free) —
// only an explicit `?download=1` forces a hard save-to-disk. This is the
// opposite of the old default (attachment unless `?preview=1`), flipped
// because "click a PDF link" should mean "view it", not "save a file".
export function pdfContentDisposition(request, filename) {
  const forceDownload = request && new URL(request.url).searchParams.get("download") === "1";
  const safeName = String(filename || "document.pdf").replace(/[\r\n\"]/g, "-");
  return `${forceDownload ? "attachment" : "inline"}; filename="${safeName}"`;
}
