"use client";

// A small IndexedDB-backed queue for form submissions made while offline —
// IndexedDB rather than localStorage because it handles structured records
// (not just strings) and survives a lot more reliably across tab closes/
// reloads on flaky mobile connections, which is exactly the situation this
// exists for (a rider losing signal mid-route). No external library: the
// native IndexedDB API is small enough for what this needs (add/list/
// update/remove by id) that adding a dependency for it isn't worth it.
const DB_NAME = "evergreen-offline-queue";
const DB_VERSION = 1;
const STORE = "queue";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB not available")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// type: "delivery" | "payment" | "expense" — label: a short human-readable
// summary shown in the pending-sync indicator (e.g. "Delivery — Amir").
export async function enqueueOfflineItem({ type, label, payload }) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add({
      type, label, payload, createdAt: Date.now(), attempts: 0, error: null,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getAllOfflineItems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.createdAt - b.createdAt));
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function removeOfflineItem(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateOfflineItem(id, patch) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) store.put({ ...getReq.result, ...patch });
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

// Fired whenever the queue's contents change (enqueue/remove/update) so
// the header's pending-count indicator can refresh without polling.
export function notifyOfflineQueueChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("offline-queue-changed"));
}
