"use server";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendTwilioMessage, isTwilioConfigured } from "@/lib/twilio";

// Customer Portal auth — OTP over SMS (Twilio, Phase 3), bridged into a
// REAL Supabase Auth session (not a custom cookie/session system). This
// is the one place that bridge happens; every portal page after login
// just uses the normal cookie-aware client and relies on RLS
// (fn_current_customer_id(), migration 0033) for isolation, exactly like
// every staff page relies on fn_current_business_id().
//
// The synthetic email below is never sent anywhere — it only exists
// because Supabase Auth requires a unique identifier per user. It's
// deterministic from customer_id, so it never needs to be looked up or
// stored anywhere new.
function portalEmailFor(customerId) {
  return `customer-${customerId}@portal.evergreenwater.internal`;
}

async function startPortalSession(admin, customerId) {
  const { data: customer } = await admin.from("customers").select("business_id, name").eq("id", customerId).maybeSingle();
  if (!customer) return { ok: false, error: "Customer record not found." };

  const { data: existing } = await admin.from("customer_portal_users").select("id").eq("customer_id", customerId).maybeSingle();
  const rotatedPassword = crypto.randomBytes(24).toString("base64url");
  const email = portalEmailFor(customerId);
  let authUserId = existing?.id;

  if (authUserId) {
    const { error: updateErr } = await admin.auth.admin.updateUserById(authUserId, { password: rotatedPassword });
    if (updateErr) return { ok: false, error: "Could not start your session. Please try again." };
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password: rotatedPassword, email_confirm: true,
      user_metadata: { portal_customer: true, customer_id: customerId },
    });
    if (createErr || !created?.user) return { ok: false, error: "Could not create your portal account. Please try again." };
    authUserId = created.user.id;

    const { data: customerRole } = await admin.from("roles").select("id").eq("key", "customer").single();
    const { error: profileErr } = await admin.from("profiles").insert({
      id: authUserId, full_name: customer.name, role_id: customerRole.id,
      business_id: customer.business_id, is_active: true,
    });
    if (profileErr) return { ok: false, error: "Could not create your portal profile. Please try again." };

    const { error: portalUserErr } = await admin.from("customer_portal_users").insert({
      id: authUserId, customer_id: customerId, business_id: customer.business_id,
    });
    if (portalUserErr) return { ok: false, error: "Could not link your portal account. Please try again." };
  }

  await admin.from("customer_portal_users").update({ last_login_at: new Date().toISOString() }).eq("id", authUserId);
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: rotatedPassword });
  if (signInErr) return { ok: false, error: "Could not start your session. Please try again." };
  return { ok: true };
}

export async function requestPortalOtp(customerIdentifier, mobile) {
  const trimmedIdentifier = String(customerIdentifier || "").trim();
  const trimmed = String(mobile || "").trim();
  if (!trimmedIdentifier) return { ok: false, error: "Enter your Customer ID or name." };
  if (trimmed.replace(/\D/g, "").length < 7) return { ok: false, error: "Enter a valid mobile number." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("[portal OTP] server configuration error", error?.message);
    return { ok: false, error: "Customer Portal is temporarily unavailable. Please ask the Owner to check portal setup." };
  }

  // Two-factor identity check the login screen asks for — Customer ID
  // *and* the registered mobile number must both match the same active
  // customer — before an OTP is even issued. Same trailing-10-digit
  // normalization as fn_request_customer_otp() itself, since
  // customers.mobile is stored inconsistently across rows.
  const digits = trimmed.replace(/\D/g, "").slice(-10);
  const normalizedCode = trimmedIdentifier.toUpperCase().replace(/\s+/g, "");
  let { data: candidate, error: lookupError } = await admin
    .from("customers").select("id, mobile, is_active")
    .ilike("code", normalizedCode).maybeSingle();

  // If no customer code matched, accept an exact customer name. Names
  // are only usable when unique; duplicate names must use Customer ID so
  // one customer's registered mobile can never select another account.
  if (!lookupError && !candidate) {
    const { data: nameMatches, error: nameError } = await admin
      .from("customers").select("id, mobile, is_active")
      .ilike("name", trimmedIdentifier).eq("is_active", true).limit(2);
    lookupError = nameError;
    if (nameMatches?.length > 1) {
      return { ok: false, error: "More than one customer has this name. Please use your Customer ID." };
    }
    candidate = nameMatches?.[0] || null;
  }
  if (lookupError) {
    console.error("[portal OTP] customer lookup failed", { code: lookupError.code, message: lookupError.message });
    return { ok: false, error: "Customer Portal could not verify your account right now. Please try again shortly." };
  }
  const candidateDigits = (candidate?.mobile || "").replace(/\D/g, "").slice(-10);
  if (!candidate || !candidate.is_active || !digits || candidateDigits !== digits) {
    return { ok: false, error: "Customer ID/name and mobile number don't match our records." };
  }

  const { data, error } = await admin.rpc("fn_request_customer_otp", { p_mobile: trimmed });
  if (error || !data?.[0]) {
    return { ok: false, error: "No active customer account found for that mobile number." };
  }
  const { customer_id: customerId, otp_code: otpCode } = data[0];

  const { data: customer } = await admin.from("customers").select("business_id, mobile").eq("id", customerId).maybeSingle();
  const toNumber = customer?.mobile || trimmed;
  const body = `Your Evergreen Water verification code is ${otpCode}. It expires in 5 minutes. Do not share this code with anyone.`;

  const configured = isTwilioConfigured();
  const sendResult = configured
    ? await sendTwilioMessage({ channel: "sms", toNumber, body })
    : { ok: false, error: "SMS not configured" };

  // Best-effort audit trail in the same notification_logs table every
  // other send goes through — never blocks the OTP flow either way.
  // related_type/related_id are left null (the idempotency unique index
  // only applies when both are set) so repeated OTP requests never
  // collide with each other.
  try {
    await admin.from("notification_logs").insert({
      business_id: customer?.business_id, customer_id: customerId, template_key: "otp_verification",
      channel: "sms", to_number: toNumber, message_body: body,
      status: sendResult.ok ? "sent" : "failed",
      provider_message_sid: sendResult.sid || null,
      error_message: sendResult.ok ? null : sendResult.error,
      sent_at: sendResult.ok ? new Date().toISOString() : null,
    });
  } catch {}

  // Temporary owner-approved testing mode: the customer ID + registered
  // mobile match above is used to start the isolated Supabase customer
  // session while SMS is unavailable. Remove this fallback when Twilio
  // goes live so OTP becomes mandatory again.
  if (!configured) {
    const session = await startPortalSession(admin, customerId);
    return session.ok ? { ...session, testingMode: true } : session;
  }
  if (!sendResult.ok) return { ok: false, error: "Couldn't send the verification code. Please try again shortly." };
  return { ok: true };
}

export async function verifyPortalOtpAndSignIn(mobile, code) {
  const trimmed = String(mobile || "").trim();
  const trimmedCode = String(code || "").trim();
  if (!trimmedCode) return { ok: false, error: "Enter the 6-digit code." };

  const admin = createAdminClient();
  const { data: customerId, error } = await admin.rpc("fn_verify_customer_otp", { p_mobile: trimmed, p_code: trimmedCode });
  if (error || !customerId) {
    const msg = error?.message || "";
    if (msg.includes("Too many")) return { ok: false, error: "Too many incorrect attempts. Request a new code." };
    if (msg.includes("Incorrect")) return { ok: false, error: "Incorrect code. Please try again." };
    if (msg.includes("No active OTP")) return { ok: false, error: "That code has expired. Request a new one." };
    return { ok: false, error: "Verification failed. Request a new code." };
  }

  return startPortalSession(admin, customerId);
}

export async function portalSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// --- Authenticated portal actions below ---

export async function requirePortalCustomer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: customerId } = await supabase.rpc("fn_current_customer_id");
  if (!customerId) throw new Error("Not a customer session");
  return { supabase, user, customerId };
}

export async function submitCustomerIssue(formData) {
  const { supabase, customerId } = await requirePortalCustomer();
  const deliveryId = formData.get("delivery_id") || null;
  const issueType = String(formData.get("issue_type") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!issueType || !description) return { ok: false, error: "Please fill in all fields." };

  const { error } = await supabase.from("customer_issues").insert({
    customer_id: customerId, delivery_id: deliveryId || null, issue_type: issueType, description,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/support");
  return { ok: true };
}

export async function submitCustomerFeedback(formData) {
  const { supabase, customerId } = await requirePortalCustomer();
  const overall = Number(formData.get("overall_rating"));
  if (!overall || overall < 1 || overall > 5) return { ok: false, error: "Please give an overall rating." };
  const deliveryRating = formData.get("delivery_rating") ? Number(formData.get("delivery_rating")) : null;
  const productRating = formData.get("product_rating") ? Number(formData.get("product_rating")) : null;
  const timelinessRating = formData.get("timeliness_rating") ? Number(formData.get("timeliness_rating")) : null;
  const comment = String(formData.get("comment") || "").trim() || null;
  const deliveryId = formData.get("delivery_id") || null;
  const riderId = formData.get("rider_id") || null;

  const { error } = await supabase.from("customer_feedback").insert({
    customer_id: customerId, delivery_id: deliveryId || null, rider_id: riderId || null,
    overall_rating: overall, delivery_rating: deliveryRating, product_rating: productRating,
    timeliness_rating: timelinessRating, comment,
  });
  if (error) return { ok: false, error: error.message };

  try {
    await supabase.from("customer_notifications").insert({
      customer_id: customerId, title: "Thanks for your feedback!",
      message: "We've received your feedback and appreciate you taking the time to share it.",
      type: "feedback",
    });
  } catch { /* best-effort */ }

  // A low rating is worth the Owner's attention the same way any other
  // automated alert is — reuses the existing `notifications` table (the
  // Owner's alert feed) rather than inventing a second one.
  if (overall <= 2) {
    const admin = createAdminClient();
    const { data: customer } = await admin.from("customers").select("name, business_id").eq("id", customerId).maybeSingle();
    await admin.from("notifications").insert({
      business_id: customer?.business_id,
      severity: "warning",
      title: "Low customer rating received",
      message: `${customer?.name || "A customer"} left a ${overall}-star rating${comment ? `: "${comment}"` : "."}`,
    });
  }

  revalidatePath("/portal/feedback");
  return { ok: true };
}

export async function markCustomerNotificationRead(notificationId) {
  const { supabase } = await requirePortalCustomer();
  await supabase.from("customer_notifications").update({ is_read: true }).eq("id", notificationId);
  revalidatePath("/portal");
}
