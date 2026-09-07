"use client";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { pkr } from "@/lib/format";

const COLORS = ["#0E9E97", "#DE9B33", "#D95A44", "#0B3142", "#2E9E6B", "#8CB8B4", "#C98C4B", "#B0473A"];

export function SalesTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0E9E97" stopOpacity={0.35} /><stop offset="100%" stopColor="#0E9E97" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2EAEA" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => pkr(v)} />
        <Area type="monotone" dataKey="sales" stroke="#0E9E97" fill="url(#g1)" strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DeliveriesTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2EAEA" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v} bottles`} />
        <Bar dataKey="bottles" fill="#2E9E6B" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ZoneRevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2EAEA" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => pkr(v)} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExpensePie({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => pkr(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
