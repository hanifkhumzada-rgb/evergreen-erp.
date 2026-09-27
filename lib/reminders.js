// Payment-reminder text shared by the Recovery Center's bulk flows: the
// automatic (Twilio) send and the manual wa.me queue build the exact same
// message. It reuses the `payment_reminder` notification template the
// reminder cron already sends, then adds the Customer Portal statement link
// (a wa.me link can't attach a PDF, so the customer opens it online).
import { renderTemplate } from "@/lib/twilio";

export const FALLBACK_REMINDER_TEMPLATE =
  "Hi {{customer_name}}, this is a reminder from Evergreen Water — your outstanding balance is PKR {{amount}}. Please arrange payment at your earliest convenience. Thank you!";

export function formatAmount(balance) {
  return Math.round(Number(balance) || 0).toLocaleString("en-PK");
}

export function portalStatementUrl(origin) {
  return `${String(origin || "").replace(/\/+$/, "")}/portal/statement`;
}

export function statementLine(origin) {
  return origin ? `View your statement & payment status: ${portalStatementUrl(origin)}` : "";
}

export function buildReminderMessage({ template, name, balance, origin }) {
  const body = renderTemplate(template || FALLBACK_REMINDER_TEMPLATE, { customer_name: name || "Customer", amount: formatAmount(balance) });
  const link = statementLine(origin);
  return link ? `${body}\n\n${link}` : body;
}
