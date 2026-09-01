"use client";
import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const Icon = type === "success" ? CheckCircle2 : XCircle;
  return (
    <div
      className={`fixed bottom-6 right-6 flex items-center gap-2 bg-card border border-line rounded-xl pl-3 pr-4 py-3 shadow-lg z-[70] text-sm max-w-xs ${type === "success" ? "border-l-4 border-l-green" : "border-l-4 border-l-coral"}`}
    >
      <Icon size={16} className={`flex-shrink-0 ${type === "success" ? "text-green" : "text-coral"}`} />
      <span>{message}</span>
    </div>
  );
}
