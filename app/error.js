"use client";
import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

// Route-segment error boundary — catches a render/data-fetch failure
// anywhere under this segment so one bad query shows a friendly screen
// instead of a blank page. Never render error.message/stack here: Next.js
// already strips server-thrown error details down to a safe `digest` in
// production, but a client-thrown error's raw message can still carry
// stuff (a query string, a field value) that shouldn't be shown back.
export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-foam p-6">
      <div className="bg-card border border-line rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        <div className="w-12 h-12 rounded-full bg-coralSoft flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-coral" />
        </div>
        <h2 className="font-display text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-slate mb-5">
          This page hit an unexpected error. Your data is safe — nothing was lost. Try again, or head back to the dashboard.
        </p>
        {error?.digest && <p className="text-[11px] text-slate mb-5 font-mono-num">Reference: {error.digest}</p>}
        <div className="flex gap-2 justify-center">
          <button onClick={() => reset()} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-aqua text-white font-bold text-sm">
            <RotateCw size={14} /> Try again
          </button>
          <a href="/dashboard" className="flex items-center px-4 py-2.5 rounded-xl border border-line text-sm font-semibold">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
