"use client";
import { useState, useTransition } from "react";
import { markAttendance } from "@/app/actions";

const OPTIONS = [
  { status: "present", label: "P", tone: "text-green border-green" },
  { status: "absent", label: "A", tone: "text-coral border-coral" },
  { status: "leave", label: "L", tone: "text-amber border-amber" },
];

// Today's attendance, one click — matches the "minimum clicks" principle
// used for delivery-boy actions elsewhere in the app.
export default function AttendanceButtons({ employeeId, today, initialStatus }) {
  const [marked, setMarked] = useState(initialStatus || null);
  const [isPending, startTransition] = useTransition();

  const mark = (status) => {
    const fd = new FormData();
    fd.set("employee_id", employeeId);
    fd.set("status", status);
    fd.set("attendance_date", today);
    startTransition(async () => {
      const res = await markAttendance(fd);
      if (!res?.error) setMarked(status);
    });
  };

  return (
    <div className="flex gap-1">
      {OPTIONS.map((o) => (
        <button
          key={o.status}
          type="button"
          disabled={isPending}
          onClick={() => mark(o.status)}
          className={`w-6 h-6 rounded-md border text-[10px] font-bold ${marked === o.status ? `${o.tone} bg-foam` : "border-line text-slate"} disabled:opacity-50`}
          title={o.label === "P" ? "Present" : o.label === "A" ? "Absent" : "Leave"}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
