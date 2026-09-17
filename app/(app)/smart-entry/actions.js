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
// isolation is exactly why this loops over the single-row RPCs instead of
// batching them into one call.
export async function bulkSubmitSmartEntries(entryType, rows) {
  const supabase = await createClient();
  const results = [];
  let saved = 0, failed = 0, pending = 0;
  for (const row of rows) {
    let entryId = row.entryId;
    if (entryId) {
      const { error: updateError } = await supabase.rpc("fn_smart_entry_update", { p_id: entryId, p_payload: row.payload });
      if (updateError) { failed++; results.push({ rowId: row.__rowId, ok: false, error: updateError.message, payload: row.payload }); continue; }
    } else {
      const idempotencyKey = row.__key || undefined;
      const { data: created, error: createError } = await supabase.rpc("fn_smart_entry_create", {
        p_entry_type: entryType, p_payload: row.payload, p_source: "bulk", p_idempotency_key: idempotencyKey,
      });
      if (createError) {
        failed++;
        results.push({ rowId: row.__rowId, ok: false, error: createError.message, payload: row.payload });
        continue;
      }
      entryId = created.id;
    }
    const { data: submitted, error: submitError } = await supabase.rpc("fn_smart_entry_submit", { p_id: entryId });
    if (submitError) {
      failed++;
      results.push({ rowId: row.__rowId, ok: false, error: submitError.message, payload: row.payload, entryId });
      continue;
    }
    if (submitted.status === "failed") {
      failed++;
      results.push({ rowId: row.__rowId, ok: false, entry: submitted, payload: row.payload, errors: submitted.validation_errors });
    } else if (submitted.status === "pending_approval") {
      pending++;
      results.push({ rowId: row.__rowId, ok: true, entry: submitted, payload: row.payload });
    } else {
      saved++;
      results.push({ rowId: row.__rowId, ok: true, entry: submitted, payload: row.payload });
    }
  }
  revalidateEverything();
  return { total: rows.length, saved, pending, failed, results };
}

// Bulk "Save Draft" — persists every row as a draft, no validation/posting.
export async function bulkSaveDraftSmartEntries(entryType, rows) {
  const supabase = await createClient();
  const results = [];
  for (const row of rows) {
    const { data, error } = await supabase.rpc("fn_smart_entry_create", {
      p_entry_type: entryType, p_payload: row.payload, p_source: "bulk", p_idempotency_key: row.__key || undefined,
    });
    results.push(error ? { rowId: row.__rowId, ok: false, error: error.message } : { rowId: row.__rowId, ok: true, entry: data });
  }
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
