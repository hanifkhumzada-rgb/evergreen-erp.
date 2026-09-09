"use client";
import { useRouter } from "next/navigation";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function StatementPeriodPicker({ month, year }) {
  const router = useRouter();
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const update = (nextMonth, nextYear) => router.push(`/portal/statement?month=${nextMonth}&year=${nextYear}`);

  return (
    <div className="flex gap-2">
      <select value={month} onChange={(e) => update(Number(e.target.value), year)} className="flex-1 px-3 py-2.5 rounded-xl border border-line bg-card text-sm">
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select value={year} onChange={(e) => update(month, Number(e.target.value))} className="px-3 py-2.5 rounded-xl border border-line bg-card text-sm">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
