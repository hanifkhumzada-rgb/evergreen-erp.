// Which staff routes each user may open. Shared by the sidebar (what to
// show) and app/(app)/layout.js (what to actually render), so hiding a
// link and blocking the page can never drift apart.
//
// This is a UI/UX layer only — Supabase RLS remains the real data
// boundary on every table. Before this guard, a Delivery Boy who typed
// /reports or /dashboard into the address bar got the page (with RLS
// already limiting the rows); now they get a clear "no access" screen.

// Permission-based routes (respect per-user permission overrides).
export const PERMISSION_BY_HREF = {
  "/smart-entry": "smart_entry.view",
  "/customers": "customers.view",
  "/deliveries": "deliveries.view",
  "/delivery-corrections": "deliveries.edit",
  "/bottle-ledger": "bottles.view",
  "/inventory": "inventory.view",
  "/sales": "invoices.view",
  "/invoices": "invoices.view",
  "/payments": "payments.view",
  "/expenses": "expenses.view",
  "/ledger": "customers.view",
  "/fleet": "vehicles.view",
  "/tracking": "gps.view",
  "/reports": "reports.view",
  "/ai": "ai.view",
  "/user-management": "users.manage",
  "/user-management/permissions": "users.manage",
  "/audit-logs": "audit.view",
  "/settings/export": "settings.manage",
  "/settings": "settings.manage",
};

const OWNER_ROLES = ["owner", "admin"];

// Routes without a dedicated permission key: same role lists the sidebar
// uses for them.
const ROLES_BY_PREFIX = {
  "/dashboard": [...OWNER_ROLES, "manager", "accountant"],
  "/operations": [...OWNER_ROLES, "manager", "accountant"],
  "/accounting": [...OWNER_ROLES, "accountant"],
  "/production": [...OWNER_ROLES, "manager", "accountant"],
  "/zones": [...OWNER_ROLES, "manager"],
  "/employees": [...OWNER_ROLES, "manager"],
  "/marketing": [...OWNER_ROLES, "manager"],
  "/issues": [...OWNER_ROLES, "manager"],
  "/customer-feedback": [...OWNER_ROLES, "manager"],
  "/documents": [...OWNER_ROLES, "manager", "accountant"],
  "/automation": OWNER_ROLES,
  "/communication": OWNER_ROLES,
};

// Longest registered prefix that matches on a path-segment boundary.
function matchPrefix(pathname, prefixes) {
  let best = null;
  for (const prefix of prefixes) {
    if ((pathname === prefix || pathname.startsWith(prefix + "/")) && (!best || prefix.length > best.length)) best = prefix;
  }
  return best;
}

export function canAccessPath(pathname, roleKey, permissions = []) {
  if (!pathname) return true;
  const permPrefix = matchPrefix(pathname, Object.keys(PERMISSION_BY_HREF));
  if (permPrefix) return new Set(permissions).has(PERMISSION_BY_HREF[permPrefix]);
  const rolePrefix = matchPrefix(pathname, Object.keys(ROLES_BY_PREFIX));
  if (rolePrefix) return ROLES_BY_PREFIX[rolePrefix].includes(roleKey);
  return true;
}

// Where a user lands when a route isn't theirs (e.g. a Delivery Boy
// sent to /dashboard after login).
export function homePathFor(roleKey, permissions = []) {
  if (canAccessPath("/dashboard", roleKey, permissions)) return "/dashboard";
  if (canAccessPath("/deliveries", roleKey, permissions)) return "/deliveries";
  if (canAccessPath("/smart-entry", roleKey, permissions)) return "/smart-entry";
  return null;
}
