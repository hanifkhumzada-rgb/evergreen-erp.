"use client";

import { useMemo, useState } from "react";
import { Sparkles, X } from "lucide-react";

const DEFAULT_WORDS = ["Muhammad", "Mohammad", "Ahmed", "Ahmad", "Abdullah", "Abdul", "Hussain", "Hassan", "Khan", "Khumzada", "Sarfaraz", "Building", "Apartment", "Floor", "Street", "Block", "Garden", "Delivery", "Payment", "Receipt", "Maintenance", "Electricity", "Salary", "Salaries", "Labour", "Packaging", "Easypaisa", "JazzCash"];

function distance(a, b) {
  const left = a.toLowerCase(); const right = b.toLowerCase();
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
}

function suggestionFor(value, dictionary) {
  const words = String(value || "").trim().split(/\s+/);
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word.length < 4 || dictionary.some((item) => item.toLowerCase() === word.toLowerCase())) continue;
    const match = dictionary.map((item) => ({ item, score: distance(word, item) })).sort((a, b) => a.score - b.score)[0];
    if (match && match.score <= (word.length > 7 ? 2 : 1)) {
      const next = [...words]; next[index] = match.item;
      return next.join(" ");
    }
  }
  return "";
}

export default function SpellingAssistInput({ value, onChange, dictionary = DEFAULT_WORDS, className = "in", ...props }) {
  const [ignored, setIgnored] = useState("");
  const suggestion = useMemo(() => {
    const next = suggestionFor(value, dictionary);
    return next && next !== ignored ? next : "";
  }, [value, dictionary, ignored]);
  return <div>
    <input {...props} value={value ?? ""} onChange={(event) => { setIgnored(""); onChange(event.target.value, event); }} className={className} spellCheck />
    {suggestion && <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]"><span className="inline-flex items-center gap-1 text-amber"><Sparkles size={11} /> Did you mean <strong>{suggestion}</strong>?</span><button type="button" onClick={() => onChange(suggestion)} className="font-bold text-aqua">Accept</button><button type="button" onClick={() => setIgnored(suggestion)} className="inline-flex items-center text-slate"><X size={10} /> Ignore</button></div>}
  </div>;
}
