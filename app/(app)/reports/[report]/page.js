import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandingLite } from "@/lib/pdf/business";
import { buildReport, REPORTS } from "@/lib/ew/reports";
import ReportViewer from "@/components/ew/ReportViewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { report } = await params;
  return { title: `${REPORTS[report]?.title || "Report"} · Evergreen Water ERP` };
}

// Interactive Report Viewer route: /reports/sales, /reports/collections, …
export default async function InteractiveReportPage({ params, searchParams }) {
  const { report } = await params;
  if (!REPORTS[report]) notFound();
  const sp = (await searchParams) || {};
  const supabase = await createClient();
  const [spec, branding] = await Promise.all([buildReport(report, supabase, sp), getBrandingLite(supabase)]);
  if (!spec) notFound();
  return <ReportViewer spec={spec} branding={branding} />;
}
