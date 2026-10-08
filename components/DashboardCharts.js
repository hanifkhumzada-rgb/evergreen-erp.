"use client";
import { AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { pkr } from "@/lib/format";

// Theme tokens from app/globals.css — SVG attributes accept var(), so the
// charts follow the selected Appearance (Ocean Blue, Evergreen, Dark)
// exactly like every button, badge and KPI card.
const tok = (name) => `rgb(var(--rgb-${name}))`;
const AQUA = tok("accent");
const GREEN = tok("green");
const NAVY = tok("navy");
const AMBER = tok("amber");
const CORAL = tok("coral");
const HIGHLIGHT = tok("highlight");
const COLORS = [AQUA, AMBER, CORAL, NAVY, GREEN, HIGHLIGHT, tok("navy-light"), tok("slate")];
const GRID = tok("line");

const AXIS_TICK = { fontSize: 11, fill: tok("slate") };
const TOOLTIP_STYLE = { borderRadius: 12, border: `1px solid ${GRID}`, background: tok("card"), color: tok("ink"), boxShadow: "0 4px 16px rgb(var(--rgb-navy) / 0.1)", fontSize: 12.5 };

export function SalesTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AQUA} stopOpacity={0.35} /><stop offset="100%" stopColor={AQUA} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => pkr(v)} contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="sales" stroke={AQUA} fill="url(#g1)" strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BusinessFlowChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={18} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
        <Tooltip formatter={(v, name) => [pkr(v), name]} contentStyle={TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="sales" name="Sales" stroke={AQUA} strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="collections" name="Collections" stroke={GREEN} strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Expenses" stroke={CORAL} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CustomerTypeChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => [`${v} customers`, "Customers"]} contentStyle={TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RatingTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs><linearGradient id="gRating" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AMBER} stopOpacity={0.35} /><stop offset="100%" stopColor={AMBER} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="week" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 5]} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v} ★`} contentStyle={TOOLTIP_STYLE} />
        <Area type="monotone" dataKey="avgRating" stroke={AMBER} fill="url(#gRating)" strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DeliveriesTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => `${v} bottles`} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="bottles" fill={GREEN} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ZoneRevenueChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={90} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => pkr(v)} contentStyle={TOOLTIP_STYLE} />
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
        <Tooltip formatter={(v) => pkr(v)} contentStyle={TOOLTIP_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  );
}
