"use client";
import { createDelivery, createPayment, createExpense } from "@/app/actions";
import { getAllOfflineItems, removeOfflineItem, updateOfflineItem, notifyOfflineQueueChanged } from "@/lib/offlineQueue";

// The three highest-value forms this covers (Deliver, Collect Payment, Add
// Expense — the ones a rider/staff member is most likely to be mid-task on
// when signal drops). Each already lives behind a real server action;
// replaying a queued item just calls that SAME action again with the
// reconstructed FormData, going through the exact same duplicate-
// submission guards (createDelivery's 20s window, createPayment's
// matching guard added in the Phase 5 fixes) and business logic as a live
// submission — there's no parallel "offline" code path to keep in sync.
const HANDLERS = { delivery: createDelivery, payment: createPayment, expense: createExpense };

export function objectToFormData(obj) {
  const fd = new FormData();
  Object.entries(obj || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.set(k, String(v)); });
  return fd;
}

export function formDataToObject(fd) {
  return Object.fromEntries(fd.entries());
}

// A fetch-level failure (the request never reached the server at all) vs
// a real error the server itself returned. Only the former is safe to
// treat as "offline" — a returned {error: "..."} is queued nowhere near
// here (callers check that before ever reaching the catch block), so
// anything that throws its way here is either a network failure or a
// genuinely unexpected exception, and this is the best signal
// distinguishing them available from plain browser fetch semantics.
export function isConnectivityError(err) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = String(err?.message || err || "").toLowerCase();
  return err instanceof TypeError || /failed to fetch|network|load failed|connection/.test(msg);
}

let syncing = false;

// Replays every queued item, oldest first, against its real server action.
// Each item is independent: a success removes it, a real server-side
// error (a returned {error}, not a thrown exception) is recorded on the
// item and left in the queue for manual attention rather than retried
// forever, and a thrown exception (most likely "went offline again mid-
// replay") stops the whole pass — order is preserved either way since
// later items are never attempted before earlier ones resolve.
export async function syncOfflineQueue() {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  syncing = true;
  try {
    const items = await getAllOfflineItems();
    for (const item of items) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      const handler = HANDLERS[item.type];
      if (!handler) { await removeOfflineItem(item.id); continue; }
      try {
        const res = await handler(objectToFormData(item.payload));
        if (res?.error) {
          await updateOfflineItem(item.id, { error: res.error, attempts: (item.attempts || 0) + 1 });
        } else {
          await removeOfflineItem(item.id);
        }
      } catch (err) {
        if (isConnectivityError(err)) break; // offline again — stop, retry next time
        await updateOfflineItem(item.id, { error: err?.message || "Sync failed", attempts: (item.attempts || 0) + 1 });
      }
      notifyOfflineQueueChanged();
    }
  } finally {
    syncing = false;
    notifyOfflineQueueChanged();
  }
}
