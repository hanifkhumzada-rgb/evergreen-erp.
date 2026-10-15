"use server";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendTwilioMessage, isTwilioConfigured } from "@/lib/twilio";
import { requirePortalCustomer } from "@/lib/portal/session";

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

export async function requestPortalOtp(customerCode, customerName, mobile) {
  const trimmedCode = String(customerCode || "").trim().toUpperCase().replace(/\s+/g, "");
  const trimmedName = String(customerName || "").trim();
  const trimmed = String(mobile || "").trim();
  if (!trimmedCode) return { ok: false, error: "Enter your Customer ID." };
  if (!trimmedName) return { ok: false, error: "Enter your registered customer name." };
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
  const { data: candidate, error: lookupError } = await admin
    .from("customers").select("id, name, mobile, is_active")
    .ilike("code", trimmedCode).maybeSingle();
  if (lookupError) {
    console.error("[portal OTP] customer lookup failed", { code: lookupError.code, message: lookupError.message });
    return { ok: false, error: "Customer Portal could not verify your account right now. Please try again shortly." };
  }
  const candidateDigits = (candidate?.mobile || "").replace(/\D/g, "").slice(-10);
  const normalizedName = (value) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
  const nameMatches = normalizedName(candidate?.name) === normalizedName(trimmedName);
  if (!candidate || !candidate.is_active || !nameMatches || !digits || candidateDigits !== digits) {
    // Make repeated guessing slower without revealing which of the three
    // identity fields was wrong.
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { ok: false, error: "Customer ID, name and mobile number don't match our records." };
  }

  // Evergreen Water currently uses the no-SMS portal mode requested by
  // the Owner. All three registered identity fields have already matched
  // the same active customer above; the resulting real Supabase session
  // remains customer-bound and every portal read is still restricted by
  // the existing customer RLS policies.
  const configured = isTwilioConfigured();
  if (!configured) {
    const session = await startPortalSession(admin, candidate.id);
    return session.ok ? { ...session, directLogin: true } : session;
  }

  const { data, error } = await admin.rpc("fn_request_customer_otp", { p_mobile: trimmed });
  if (error || !data?.[0]) {
    return { ok: false, error: "No active customer account found for that mobile number." };
  }
  const { customer_id: customerId, otp_code: otpCode } = data[0];

  const { data: customer } = await admin.from("customers").select("business_id, mobile").eq("id", customerId).maybeSingle();
  const toNumber = customer?.mobile || trimmed;
  const body = `Your Evergreen Water verification code is ${otpCode}. It expires in 5 minutes. Do not share this code with anyone.`;

  const sendResult = await sendTwilioMessage({ channel: "sms", toNumber, body });

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

async function createPortalRequest({ issueType, description, duplicateKey }) {
  const { supabase, customerId } = await requirePortalCustomer();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: duplicate } = await supabase
    .from("customer_issues")
    .select("id")
    .eq("customer_id", customerId)
    .eq("issue_type", issueType)
    .in("status", ["open", "under_review"])
    .ilike("description", `%Request key: ${duplicateKey}%`)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();
  if (duplicate) return { ok: false, error: "A matching request is already pending. Please wait for our team to review it." };

  const { error } = await supabase.from("customer_issues").insert({
    customer_id: customerId,
    issue_type: issueType,
    description: `${description}\nRequest key: ${duplicateKey}`,
  });
  if (error) return { ok: false, error: "We couldn't submit your request. Please try again." };
  revalidatePath("/portal");
  revalidatePath("/portal/support");
  return { ok: true };
}

export async function submitWaterDeliveryRequest(formData) {
  const quantity = Math.trunc(Number(formData.get("quantity")));
  const preferredDate = String(formData.get("preferred_date") || "").trim();
  const address = String(formData.get("address") || "").trim().slice(0, 300);
  const remarks = String(formData.get("remarks") || "").trim().slice(0, 500);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return { ok: false, error: "Enter a quantity between 1 and 20 bottles." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) return { ok: false, error: "Select a preferred delivery date." };
  const today = new Date().toISOString().slice(0, 10);
  if (preferredDate < today) return { ok: false, error: "Preferred date cannot be in the past." };
  if (!address) return { ok: false, error: "Enter the delivery address." };
  return createPortalRequest({
    issueType: "Water Delivery Request",
    duplicateKey: `${preferredDate}-${quantity}`,
    description: `Quantity: ${quantity} x 19L\nPreferred date: ${preferredDate}\nDelivery address: ${address}${remarks ? `\nRemarks: ${remarks}` : ""}`,
  });
}

export async function submitPaymentConfirmation(formData) {
  const method = String(formData.get("method") || "").trim().slice(0, 50);
  const amount = Number(formData.get("amount"));
  const paymentDate = String(formData.get("payment_date") || "").trim();
  const reference = String(formData.get("reference") || "").trim().slice(0, 100);
  if (!method || !Number.isFinite(amount) || amount <= 0 || !paymentDate || !reference) return { ok: false, error: "Complete all payment fields, including the transaction reference." };
  return createPortalRequest({
    issueType: "Payment Confirmation",
    duplicateKey: reference.toLowerCase(),
    description: `Method: ${method}\nAmount: PKR ${amount.toFixed(2)}\nPayment date: ${paymentDate}\nTransaction reference: ${reference}\nStatus: Pending verification — do not post to ledger until verified.`,
  });
}

export async function submitProfileCorrection(formData) {
  const field = String(formData.get("field") || "").trim().slice(0, 50);
  const requestedValue = String(formData.get("requested_value") || "").trim().slice(0, 300);
  const reason = String(formData.get("reason") || "").trim().slice(0, 300);
  if (!field || !requestedValue) return { ok: false, error: "Select a field and enter the correct information." };
  return createPortalRequest({
    issueType: "Profile Correction Request",
    duplicateKey: `${field}-${requestedValue}`.toLowerCase(),
    description: `Field: ${field}\nRequested value: ${requestedValue}${reason ? `\nReason: ${reason}` : ""}\nStatus: Requires staff verification before customer master update.`,
  });
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

  // The "thanks" notification and the low-rating owner-alert lookup are
  // independent of each other (neither needs the other's result), so they
  // run together instead of one after the other.
  const thanksPromise = supabase.from("customer_notifications").insert({
    customer_id: customerId, title: "Thanks for your feedback!",
    message: "We've received your feedback and appreciate you taking the time to share it.",
    type: "feedback",
  }).then(() => {}, () => {}); // best-effort

  // A low rating is worth the Owner's attention the same way any other
  // automated alert is — reuses the existing `notifications` table (the
  // Owner's alert feed) rather than inventing a second one.
  const alertPromise = overall <= 2
    ? (async () => {
        const admin = createAdminClient();
        const { data: customer } = await admin.from("customers").select("name, business_id").eq("id", customerId).maybeSingle();
        await admin.from("notifications").insert({
          business_id: customer?.business_id,
          severity: "warning",
          title: "Low customer rating received",
          message: `${customer?.name || "A customer"} left a ${overall}-star rating${comment ? `: "${comment}"` : "."}`,
        });
      })()
    : Promise.resolve();

  await Promise.all([thanksPromise, alertPromise]);

  revalidatePath("/portal/feedback");
  return { ok: true };
}

export async function markCustomerNotificationRead(notificationId) {
  const { supabase } = await requirePortalCustomer();
  await supabase.from("customer_notifications").update({ is_read: true }).eq("id", notificationId);
  revalidatePath("/portal");
}

export async function markAllCustomerNotificationsRead() {
  const { supabase, customerId } = await requirePortalCustomer();
  await supabase.from("customer_notifications").update({ is_read: true })
    .eq("customer_id", customerId).eq("is_read", false);
  revalidatePath("/portal");
  revalidatePath("/portal/notifications");
}
