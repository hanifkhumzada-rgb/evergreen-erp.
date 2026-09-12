"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";

const RECOVERY_TOKEN = "21926c69f0f69c26ce91f72b945899eafa3e7f9b50366574b6e3c8e9db3b7989";
const OWNER_USER_ID = "4a7cf748-db26-4c25-8c05-f6c95da287d9";

export async function restoreOwnerLogin(formData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (token !== RECOVERY_TOKEN) {
    throw new Error("This recovery link is invalid.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(OWNER_USER_ID, { password });
  if (error) {
    console.error("[owner-recovery] password restore failed", {
      userId: OWNER_USER_ID,
      error: error.message,
    });
    throw new Error("Owner login could not be restored.");
  }

  console.info("[owner-recovery] owner login restored", { userId: OWNER_USER_ID });
  redirect("/login?reset=success");
}
