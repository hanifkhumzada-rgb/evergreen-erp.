"use client";
import { useState } from "react";
import { enqueueOfflineItem, notifyOfflineQueueChanged } from "@/lib/offlineQueue";
import { formDataToObject, isConnectivityError } from "@/lib/offlineSync";

// Shared by DeliverSheet, AddPaymentForm, and AddExpenseForm — the three
// highest-value forms to cover first (a rider/staff member mid-task when
// signal drops). Wraps a server action so a submission that can't reach
// the network is queued to IndexedDB and reported as "saved offline"
// instead of failing outright; a submission that DOES reach the server
// (including one that comes back with a real validation {error}) behaves
// exactly as it always did — this only changes what happens when the
// request never got there at all.
//
// Deliberately conservative about what counts as "offline": genuinely
// offline (checked before ever attempting the call) is unambiguous. A
// mid-flight network failure is queued too (so a rider's work is never
// silently lost to a flaky connection), accepting the residual risk that
// if the request actually reached the server before the connection died,
// a later replay could double-submit outside the existing dedup guards'
// short time window — the same tradeoff createDelivery/createPayment's
// own guards already accept for a same-session double-tap, just over a
// longer gap. Worth calling out plainly rather than implying this is
// airtight.
export function useOfflineSubmit(type, serverAction, { label } = {}) {
  const [busy, setBusy] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);

  const submit = async (formData) => {
    setBusy(true);
    setOfflineSaved(false);

    const queueIt = async () => {
      const payload = formDataToObject(formData);
      await enqueueOfflineItem({ type, label: typeof label === "function" ? label(payload) : label, payload });
      notifyOfflineQueueChanged();
      setBusy(false);
      setOfflineSaved(true);
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueIt();
      return { ok: true, offline: true };
    }

    try {
      const res = await serverAction(formData);
      setBusy(false);
      return res;
    } catch (err) {
      if (isConnectivityError(err)) {
        await queueIt();
        return { ok: true, offline: true };
      }
      setBusy(false);
      throw err;
    }
  };

  return { submit, busy, offlineSaved };
}
