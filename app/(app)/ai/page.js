"use client";
import { useState } from "react";
import { Bot } from "lucide-react";
import { askAI } from "@/app/actions";
import { Badge } from "@/components/ui";

const SUGGESTIONS = [
  "What is my net profit this month?",
  "What are my total receivables?",
  "Which customers owe the most?",
  "What is my inventory value?",
  "How much did we collect today?",
  "What was today's closing difference?",
  "What is my bottle liability?",
  "Which zone generates the most revenue?",
  "Which vehicle costs the most?",
  "Which driver performs best?",
  "Customers overdue by more than 30 days?",
  "Which zone is most profitable?",
  "Which customers reduced their orders?",
  "Which expenses increased this month?",
  "Who should I follow up with?",
  "Predict next month's sales",
  "Which products need reordering?",
];

export default function AiPage() {
  const [log, setLog] = useState([{ from: "ai", text: "Hi, I'm Evergreen AI. I answer only from your real Supabase data, and I respect your role's permissions." }]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (question) => {
    setLog((l) => [...l, { from: "user", text: question }]);
    setQ("");
    setBusy(true);
    const res = await askAI(question);
    setBusy(false);
    setLog((l) => [...l, { from: "ai", text: res.text }]);
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold mb-1">Evergreen AI</h2>
      <p className="text-slate text-sm mb-2">Answers only from your live database. Never fabricates numbers, never bypasses your role's permissions.</p>
      <Badge text="Automated Daily Business Brief & anomaly detection — Coming Soon" tone="amber" />
      <div className="border border-line rounded-2xl p-5 mt-4 max-w-2xl">
        <div className="flex flex-col gap-2.5 max-h-80 overflow-y-auto mb-3">
          {log.map((m, i) => (
            <div key={i} className={`${m.from === "ai" ? "self-start bg-foam" : "self-end bg-aquaSoft"} px-3 py-2 rounded-xl text-sm max-w-[85%]`}>{m.text}</div>
          ))}
          {busy && <div className="self-start bg-foam px-3 py-2 rounded-xl text-sm text-slate">Thinking…</div>}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="text-[11.5px] px-2.5 py-1.5 rounded-full border border-line bg-card">{s}</button>)}
        </div>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q && ask(q)}
            placeholder="Ask about profit, receivables, bottles, zones..." className="flex-1 px-3 py-2.5 rounded-lg border border-line text-sm outline-none" />
          <button onClick={() => q && ask(q)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-aqua text-white text-sm font-bold"><Bot size={15} /> Ask</button>
        </div>
      </div>
    </div>
  );
}
