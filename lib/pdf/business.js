import { getLogoDataUri } from "./logo";

// Bucket is public (migration 0029_business_branding_fields) so a plain
// fetch is enough — no storage client/auth needed here, and this keeps
// every PDF route's image handling identical to the bundled-icon fallback
// it already had (embed as a base64 data URI, not a remote <Image src>,
// since @react-pdf/renderer's own remote-fetch has been unreliable inside
// serverless runtimes).
async function urlToDataUri(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Single place every document generator (PDF routes, on-screen print
// headers, Excel exports) reads the company's letterhead from — one edit
// on the Settings page's Business Branding card updates every future
// document automatically. Falls back to sane defaults so a business that
// hasn't filled anything in yet still gets a presentable letterhead.
export async function getBusinessBranding(supabase) {
  const { data } = await supabase.from("business_settings").select("*").maybeSingle();

  const [logo, signature, stamp] = await Promise.all([
    urlToDataUri(data?.logo_url),
    urlToDataUri(data?.signature_url),
    urlToDataUri(data?.stamp_url),
  ]);

  return {
    // Flat legacy fields — kept so existing call sites (businessName,
    // address) keep working unchanged.
    businessName: data?.business_name || "Evergreen Water",
    address: data?.address || null,

    tagline: data?.tagline || "Pure Drinking Water",
    phone: data?.phone || null,
    phone2: data?.phone_2 || null,
    whatsapp: data?.whatsapp_number || null,
    email: data?.email || null,
    ntn: data?.ntn || null,
    bankDetails: data?.bank_details || null,
    paymentTerms: data?.payment_terms || null,
    footerNote: data?.footer_note || null,
    currency: data?.currency || "PKR",

    invoicePrefix: data?.invoice_prefix || "EGW-INV-",
    receiptPrefix: data?.receipt_prefix || "EGW-RCT-",
    deliveryPrefix: data?.delivery_prefix || "EGW-DEL-",
    orderPrefix: data?.order_prefix || "EGW-ORD-",
    bpvPrefix: data?.bpv_prefix || "BPV-",

    // Data URIs, ready to hand straight to a react-pdf <Image>. Logo falls
    // back to the bundled app icon (the only asset guaranteed to exist);
    // signature/stamp have no fallback — those sections just render blank
    // (a signing line) until the Owner uploads one.
    logo: logo || getLogoDataUri(),
    signatureImage: signature,
    stampImage: stamp,

    logoUrl: data?.logo_url || null,
    signatureUrl: data?.signature_url || null,
    stampUrl: data?.stamp_url || null,
  };
}

// Cheap counterpart for on-screen print headers (DocumentPrintHeader) —
// same shape's plain-URL fields as getBusinessBranding, minus the
// data-URI image fetch/conversion that only PDF generation needs.
export async function getBrandingLite(supabase) {
  const { data } = await supabase.from("business_settings")
    .select("business_name, tagline, logo_url, address, phone, phone_2, email").maybeSingle();
  return {
    businessName: data?.business_name || "Evergreen Water",
    tagline: data?.tagline || "Pure Drinking Water",
    logoUrl: data?.logo_url || null,
    address: data?.address || null,
    phone: data?.phone || null,
    phone2: data?.phone_2 || null,
    email: data?.email || null,
  };
}
