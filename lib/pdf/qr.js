import QRCode from "qrcode";

// QR codes on customer-facing PDFs point at the matching Customer Portal
// page (login returns the customer straight to it). Never throws: a QR
// failure just omits the code instead of breaking the document.
export function portalUrlFor(request, path) {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/+$/, "");
  return `${origin}${path}`;
}

export async function qrDataUri(url) {
  return QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: "M", color: { dark: "#073B3AFF", light: "#FFFFFFFF" } }).catch(() => null);
}

// { dataUri, url, title, text } ready for PdfShell's `qr` prop.
export async function portalQr(request, path, { title = "View online", text } = {}) {
  const url = portalUrlFor(request, path);
  const dataUri = await qrDataUri(url);
  return dataUri ? { dataUri, url, title, text } : null;
}
