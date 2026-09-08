drop policy if exists p_business_isolation on customers;
create policy p_business_isolation on customers as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on customer_prices;
create policy p_business_isolation on customer_prices as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on customer_complaints;
create policy p_business_isolation on customer_complaints as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on customer_ledger_entries;
create policy p_business_isolation on customer_ledger_entries as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on deliveries;
create policy p_business_isolation on deliveries as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on delivery_items;
create policy p_business_isolation on delivery_items as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on bottle_transactions;
create policy p_business_isolation on bottle_transactions as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on bottle_reconciliations;
create policy p_business_isolation on bottle_reconciliations as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on inventory_items;
create policy p_business_isolation on inventory_items as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on inventory_movements;
create policy p_business_isolation on inventory_movements as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on invoices;
create policy p_business_isolation on invoices as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on invoice_items;
create policy p_business_isolation on invoice_items as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on orders;
create policy p_business_isolation on orders as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on order_items;
create policy p_business_isolation on order_items as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on payments;
create policy p_business_isolation on payments as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on expenses;
create policy p_business_isolation on expenses as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on expense_categories;
create policy p_business_isolation on expense_categories as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on expense_category_account_map;
create policy p_business_isolation on expense_category_account_map as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on products;
create policy p_business_isolation on products as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on product_prices;
create policy p_business_isolation on product_prices as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on profiles;
create policy p_business_isolation on profiles as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on vehicles;
create policy p_business_isolation on vehicles as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on vehicle_fuel_logs;
create policy p_business_isolation on vehicle_fuel_logs as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on vehicle_maintenance_logs;
create policy p_business_isolation on vehicle_maintenance_logs as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on routes;
create policy p_business_isolation on routes as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on zones;
create policy p_business_isolation on zones as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on employee_advances;
create policy p_business_isolation on employee_advances as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on employee_attendance;
create policy p_business_isolation on employee_attendance as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on employee_salary_records;
create policy p_business_isolation on employee_salary_records as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on production_batches;
create policy p_business_isolation on production_batches as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on chart_of_accounts;
create policy p_business_isolation on chart_of_accounts as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on journal_entries;
create policy p_business_isolation on journal_entries as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on journal_lines;
create policy p_business_isolation on journal_lines as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on cash_accounts;
create policy p_business_isolation on cash_accounts as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on cash_transactions;
create policy p_business_isolation on cash_transactions as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on audit_logs;
create policy p_business_isolation on audit_logs as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on notifications;
create policy p_business_isolation on notifications as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on suppliers;
create policy p_business_isolation on suppliers as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on supplier_payments;
create policy p_business_isolation on supplier_payments as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on purchases;
create policy p_business_isolation on purchases as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on purchase_items;
create policy p_business_isolation on purchase_items as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

drop policy if exists p_business_isolation on automation_rules;
create policy p_business_isolation on automation_rules as restrictive for all using (business_id = fn_current_business_id()) with check (business_id = fn_current_business_id());

-- The tenant table itself: a user may read only their own business's row
-- (no per-business RLS beyond that yet — Platform Owner admin work is a
-- later phase). This is a normal permissive policy, not restrictive: there
-- was no existing policy on `businesses` to layer under (it's brand new),
-- so it needs to actually grant access, not just narrow an existing grant.
drop policy if exists p_businesses_select_own on businesses;
create policy p_businesses_select_own on businesses for select
  using (id = fn_current_business_id());
