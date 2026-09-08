// Single place every PDF route reads the letterhead's company name/address
// from, so all seven documents stay in sync with whatever the Owner has
// configured (business_settings, singleton row) instead of a name hardcoded
// per-document — falls back to the app's own name if settings are blank.
export async function getBusinessBranding(supabase) {
  const { data } = await supabase.from("business_settings").select("business_name, address").maybeSingle();
  return {
    businessName: data?.business_name || "Evergreen Plus Water",
    address: data?.address || null,
  };
}
