"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function revalidateEverything() {
  // A posted Smart Entry can touch almost any module (customers, deliveries,
  // payments, expenses, bottles, inventory, employees, invoices, ledger) —
  // revalidating the specific set of pages it might have changed is cheaper
  // than force-dynamic everywhere, but there are enough of them that this
  // flat list is clearer than trying to compute it per entry type.
  for (const path of [
    "/smart-entry", "/dashboard", "/customers", "/deliveries", "/payments",
    "/expenses", "/bottles", "/bottle-ledger", "/inventory", "/employees",
    "/invoices", "/sales", "/ledger", "/customer-feedback", "/issues",
  ]) revalidatePath(path);
}

// Draft only — no validation, nothing posted. Used by "Save Draft".
export async function saveDraftSmartEntry(entryType, payload, idempotencyKey, source = "single") {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_smart_entry_create", {
    p_entry_type: entryType, p_payload: payload, p_source: source, p_idempotency_key: idempotencyKey || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/smart-entry");
  return { ok: true, entry: data };
}

// Create (if new) + validate + post immediately or route to pending approval.
export async function createAndSubmitSmartEntry(entryType, payload, idempotencyKey, source = "single") {
  const supabase = await createClient();
  const { data: created, error: createError } = await supabase.rpc("fn_smart_entry_create", {
    p_entry_type: entryType, p_payload: payload, p_source: source, p_idempotency_key: idempotencyKey || null,
  });
  if (createError) return { error: createError.message };

  const { data: submitted, error: submitError } = await supabase.rpc("fn_smart_entry_submit", { p_id: created.id });
  if (submitError) return { error: submitError.message, entry: created };
  revalidateEverything();
  return { ok: true, entry: submitted };
}

// Bulk: one smart_entries row per input row, each independently created +
// submitted. A bad row never blocks or rolls back a good one — that
// isolation only requires each row's own outcome to be independent, not
// that the round trips themselves run one at a time, so every row's
// mini-pipeline runs concurrently instead of serially (order preserved in
// `results` via Promise.all).
export async function bulkSubmitSmartEntries(entryType, rows) {
  const supabase = await createClient();
  const outcomes = await Promise.all(rows.map(async (row) => {
    let entryId = row.entryId;
    if (entryId) {
      const { error: updateError } = await supabase.rpc("fn_smart_entry_update", { p_id: entryId, p_payload: row.payload });
      if (updateError) return { bucket: "failed", result: { rowId: row.__rowId, ok: false, error: updateError.message, payload: row.payload } };
    } else {
      const idempotencyKey = row.__key || undefined;
      const { data: created, error: createError } = await supabase.rpc("fn_smart_entry_create", {
        p_entry_type: entryType, p_payload: row.payload, p_source: "bulk", p_idempotency_key: idempotencyKey,
      });
      if (createError) {
        return { bucket: "failed", result: { rowId: row.__rowId, ok: false, error: createError.message, payload: row.payload } };
      }
      entryId = created.id;
    }
    const { data: submitted, error: submitError } = await supabase.rpc("fn_smart_entry_submit", { p_id: entryId });
    if (submitError) {
      return { bucket: "failed", result: { rowId: row.__rowId, ok: false, error: submitError.message, payload: row.payload, entryId } };
    }
    if (submitted.status === "failed") {
      return { bucket: "failed", result: { rowId: row.__rowId, ok: false, entry: submitted, payload: row.payload, errors: submitted.validation_errors } };
    }
    if (submitted.status === "pending_approval") {
      return { bucket: "pending", result: { rowId: row.__rowId, ok: true, entry: submitted, payload: row.payload } };
    }
    return { bucket: "saved", result: { rowId: row.__rowId, ok: true, entry: submitted, payload: row.payload } };
  }));

  const results = outcomes.map((o) => o.result);
  const saved = outcomes.filter((o) => o.bucket === "saved").length;
  const pending = outcomes.filter((o) => o.bucket === "pending").length;
  const failed = outcomes.filter((o) => o.bucket === "failed").length;
  revalidateEverything();
  return { total: rows.length, saved, pending, failed, results };
}

// Bulk "Save Draft" — persists every row as a draft, no validation/posting.
export async function bulkSaveDraftSmartEntries(entryType, rows) {
  const supabase = await createClient();
  const results = await Promise.all(rows.map(async (row) => {
    const { data, error } = await supabase.rpc("fn_smart_entry_create", {
      p_entry_type: entryType, p_payload: row.payload, p_source: "bulk", p_idempotency_key: row.__key || undefined,
    });
    return error ? { rowId: row.__rowId, ok: false, error: error.message } : { rowId: row.__rowId, ok: true, entry: data };
  }));
  revalidatePath("/smart-entry");
  return { results };
}

export async function checkSmartEntry(entryType, payload) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_smart_entry_check", { p_entry_type: entryType, p_payload: payload });
  if (error) return { error: error.message };
  return { ok: true, ...data };
}

export async function updateAndRetrySmartEntry(id, payload) {
  const supabase = await createClient();
  const { error: updateError } = await supabase.rpc("fn_smart_entry_update", { p_id: id, p_payload: payload });
  if (updateError) return { error: updateError.message };
  const { data, error } = await supabase.rpc("fn_smart_entry_submit", { p_id: id });
  if (error) return { error: error.message };
  revalidateEverything();
  return { ok: true, entry: data };
}

export async function submitSmartEntry(id) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_smart_entry_submit", { p_id: id });
  if (error) return { error: error.message };
  revalidateEverything();
  return { ok: true, entry: data };
}

export async function approveSmartEntry(id) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_smart_entry_approve", { p_id: id });
  if (error) return { error: error.message };
  revalidateEverything();
  return { ok: true, entry: data };
}

export async function rejectSmartEntry(id, reason) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_smart_entry_reject", { p_id: id, p_reason: reason });
  if (error) return { error: error.message };
  revalidatePath("/smart-entry");
  return { ok: true, entry: data };
}

export async function deleteSmartEntry(id, reason) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_smart_entry_delete", { p_id: id, p_reason: reason || null });
  if (error) return { error: error.message };
  revalidatePath("/smart-entry");
  return { ok: true };
}

export async function reverseSmartEntry(id, reason) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_smart_entry_reverse", { p_id: id, p_reason: reason });
  if (error) return { error: error.message };
  revalidateEverything();
  return { ok: true };
}
