-- Migration 0033 gave customer_notifications SELECT (self) and UPDATE
-- (self, marking read) but no INSERT policy at all — caught while wiring
-- Phase 4 app code: staff pushing an "issue status changed" notification
-- (updateCustomerIssueStatus, app/actions.js) and a customer's own
-- "thanks for your feedback" acknowledgment (submitCustomerFeedback,
-- app/portal/actions.js) would both silently fail under RLS with zero
-- permissive INSERT policy to satisfy. Two INSERT policies, matching who
-- actually needs to write here: staff with deliveries.edit (the same gate
-- already used for customer_issues/customer_feedback) for system-pushed
-- notifications, and a customer inserting only their own row for
-- self-service acknowledgments.
create policy p_customer_notifications_staff_insert on customer_notifications for insert
  with check (fn_has_permission('deliveries.edit'));
create policy p_customer_notifications_self_insert on customer_notifications for insert
  with check (customer_id = fn_current_customer_id());
