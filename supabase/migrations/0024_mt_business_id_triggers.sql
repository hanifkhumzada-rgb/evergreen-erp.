create index if not exists idx_customers_business_id on customers(business_id);
drop trigger if exists trg_stamp_business_id on customers;
create trigger trg_stamp_business_id before insert on customers for each row execute function fn_stamp_business_id();

create index if not exists idx_customer_prices_business_id on customer_prices(business_id);
drop trigger if exists trg_stamp_business_id on customer_prices;
create trigger trg_stamp_business_id before insert on customer_prices for each row execute function fn_stamp_business_id();

create index if not exists idx_customer_complaints_business_id on customer_complaints(business_id);
drop trigger if exists trg_stamp_business_id on customer_complaints;
create trigger trg_stamp_business_id before insert on customer_complaints for each row execute function fn_stamp_business_id();

create index if not exists idx_customer_ledger_entries_business_id on customer_ledger_entries(business_id);
drop trigger if exists trg_stamp_business_id on customer_ledger_entries;
create trigger trg_stamp_business_id before insert on customer_ledger_entries for each row execute function fn_stamp_business_id();

create index if not exists idx_deliveries_business_id on deliveries(business_id);
drop trigger if exists trg_stamp_business_id on deliveries;
create trigger trg_stamp_business_id before insert on deliveries for each row execute function fn_stamp_business_id();

create index if not exists idx_delivery_items_business_id on delivery_items(business_id);
drop trigger if exists trg_stamp_business_id on delivery_items;
create trigger trg_stamp_business_id before insert on delivery_items for each row execute function fn_stamp_business_id();

create index if not exists idx_bottle_transactions_business_id on bottle_transactions(business_id);
drop trigger if exists trg_stamp_business_id on bottle_transactions;
create trigger trg_stamp_business_id before insert on bottle_transactions for each row execute function fn_stamp_business_id();

create index if not exists idx_bottle_reconciliations_business_id on bottle_reconciliations(business_id);
drop trigger if exists trg_stamp_business_id on bottle_reconciliations;
create trigger trg_stamp_business_id before insert on bottle_reconciliations for each row execute function fn_stamp_business_id();

create index if not exists idx_inventory_items_business_id on inventory_items(business_id);
drop trigger if exists trg_stamp_business_id on inventory_items;
create trigger trg_stamp_business_id before insert on inventory_items for each row execute function fn_stamp_business_id();

create index if not exists idx_inventory_movements_business_id on inventory_movements(business_id);
drop trigger if exists trg_stamp_business_id on inventory_movements;
create trigger trg_stamp_business_id before insert on inventory_movements for each row execute function fn_stamp_business_id();

create index if not exists idx_invoices_business_id on invoices(business_id);
drop trigger if exists trg_stamp_business_id on invoices;
create trigger trg_stamp_business_id before insert on invoices for each row execute function fn_stamp_business_id();

create index if not exists idx_invoice_items_business_id on invoice_items(business_id);
drop trigger if exists trg_stamp_business_id on invoice_items;
create trigger trg_stamp_business_id before insert on invoice_items for each row execute function fn_stamp_business_id();

create index if not exists idx_orders_business_id on orders(business_id);
drop trigger if exists trg_stamp_business_id on orders;
create trigger trg_stamp_business_id before insert on orders for each row execute function fn_stamp_business_id();

create index if not exists idx_order_items_business_id on order_items(business_id);
drop trigger if exists trg_stamp_business_id on order_items;
create trigger trg_stamp_business_id before insert on order_items for each row execute function fn_stamp_business_id();

create index if not exists idx_payments_business_id on payments(business_id);
drop trigger if exists trg_stamp_business_id on payments;
create trigger trg_stamp_business_id before insert on payments for each row execute function fn_stamp_business_id();

create index if not exists idx_expenses_business_id on expenses(business_id);
drop trigger if exists trg_stamp_business_id on expenses;
create trigger trg_stamp_business_id before insert on expenses for each row execute function fn_stamp_business_id();

create index if not exists idx_expense_categories_business_id on expense_categories(business_id);
drop trigger if exists trg_stamp_business_id on expense_categories;
create trigger trg_stamp_business_id before insert on expense_categories for each row execute function fn_stamp_business_id();

create index if not exists idx_expense_category_account_map_business_id on expense_category_account_map(business_id);
drop trigger if exists trg_stamp_business_id on expense_category_account_map;
create trigger trg_stamp_business_id before insert on expense_category_account_map for each row execute function fn_stamp_business_id();

create index if not exists idx_products_business_id on products(business_id);
drop trigger if exists trg_stamp_business_id on products;
create trigger trg_stamp_business_id before insert on products for each row execute function fn_stamp_business_id();

create index if not exists idx_product_prices_business_id on product_prices(business_id);
drop trigger if exists trg_stamp_business_id on product_prices;
create trigger trg_stamp_business_id before insert on product_prices for each row execute function fn_stamp_business_id();

create index if not exists idx_profiles_business_id on profiles(business_id);
drop trigger if exists trg_stamp_business_id on profiles;
create trigger trg_stamp_business_id before insert on profiles for each row execute function fn_stamp_business_id();

create index if not exists idx_vehicles_business_id on vehicles(business_id);
drop trigger if exists trg_stamp_business_id on vehicles;
create trigger trg_stamp_business_id before insert on vehicles for each row execute function fn_stamp_business_id();

create index if not exists idx_vehicle_fuel_logs_business_id on vehicle_fuel_logs(business_id);
drop trigger if exists trg_stamp_business_id on vehicle_fuel_logs;
create trigger trg_stamp_business_id before insert on vehicle_fuel_logs for each row execute function fn_stamp_business_id();

create index if not exists idx_vehicle_maintenance_logs_business_id on vehicle_maintenance_logs(business_id);
drop trigger if exists trg_stamp_business_id on vehicle_maintenance_logs;
create trigger trg_stamp_business_id before insert on vehicle_maintenance_logs for each row execute function fn_stamp_business_id();

create index if not exists idx_routes_business_id on routes(business_id);
drop trigger if exists trg_stamp_business_id on routes;
create trigger trg_stamp_business_id before insert on routes for each row execute function fn_stamp_business_id();

create index if not exists idx_zones_business_id on zones(business_id);
drop trigger if exists trg_stamp_business_id on zones;
create trigger trg_stamp_business_id before insert on zones for each row execute function fn_stamp_business_id();

create index if not exists idx_employee_advances_business_id on employee_advances(business_id);
drop trigger if exists trg_stamp_business_id on employee_advances;
create trigger trg_stamp_business_id before insert on employee_advances for each row execute function fn_stamp_business_id();

create index if not exists idx_employee_attendance_business_id on employee_attendance(business_id);
drop trigger if exists trg_stamp_business_id on employee_attendance;
create trigger trg_stamp_business_id before insert on employee_attendance for each row execute function fn_stamp_business_id();

create index if not exists idx_employee_salary_records_business_id on employee_salary_records(business_id);
drop trigger if exists trg_stamp_business_id on employee_salary_records;
create trigger trg_stamp_business_id before insert on employee_salary_records for each row execute function fn_stamp_business_id();

create index if not exists idx_production_batches_business_id on production_batches(business_id);
drop trigger if exists trg_stamp_business_id on production_batches;
create trigger trg_stamp_business_id before insert on production_batches for each row execute function fn_stamp_business_id();

create index if not exists idx_chart_of_accounts_business_id on chart_of_accounts(business_id);
drop trigger if exists trg_stamp_business_id on chart_of_accounts;
create trigger trg_stamp_business_id before insert on chart_of_accounts for each row execute function fn_stamp_business_id();

create index if not exists idx_journal_entries_business_id on journal_entries(business_id);
drop trigger if exists trg_stamp_business_id on journal_entries;
create trigger trg_stamp_business_id before insert on journal_entries for each row execute function fn_stamp_business_id();

create index if not exists idx_journal_lines_business_id on journal_lines(business_id);
drop trigger if exists trg_stamp_business_id on journal_lines;
create trigger trg_stamp_business_id before insert on journal_lines for each row execute function fn_stamp_business_id();

create index if not exists idx_cash_accounts_business_id on cash_accounts(business_id);
drop trigger if exists trg_stamp_business_id on cash_accounts;
create trigger trg_stamp_business_id before insert on cash_accounts for each row execute function fn_stamp_business_id();

create index if not exists idx_cash_transactions_business_id on cash_transactions(business_id);
drop trigger if exists trg_stamp_business_id on cash_transactions;
create trigger trg_stamp_business_id before insert on cash_transactions for each row execute function fn_stamp_business_id();

create index if not exists idx_audit_logs_business_id on audit_logs(business_id);
drop trigger if exists trg_stamp_business_id on audit_logs;
create trigger trg_stamp_business_id before insert on audit_logs for each row execute function fn_stamp_business_id();

create index if not exists idx_notifications_business_id on notifications(business_id);
drop trigger if exists trg_stamp_business_id on notifications;
create trigger trg_stamp_business_id before insert on notifications for each row execute function fn_stamp_business_id();

create index if not exists idx_suppliers_business_id on suppliers(business_id);
drop trigger if exists trg_stamp_business_id on suppliers;
create trigger trg_stamp_business_id before insert on suppliers for each row execute function fn_stamp_business_id();

create index if not exists idx_supplier_payments_business_id on supplier_payments(business_id);
drop trigger if exists trg_stamp_business_id on supplier_payments;
create trigger trg_stamp_business_id before insert on supplier_payments for each row execute function fn_stamp_business_id();

create index if not exists idx_purchases_business_id on purchases(business_id);
drop trigger if exists trg_stamp_business_id on purchases;
create trigger trg_stamp_business_id before insert on purchases for each row execute function fn_stamp_business_id();

create index if not exists idx_purchase_items_business_id on purchase_items(business_id);
drop trigger if exists trg_stamp_business_id on purchase_items;
create trigger trg_stamp_business_id before insert on purchase_items for each row execute function fn_stamp_business_id();

create index if not exists idx_automation_rules_business_id on automation_rules(business_id);
drop trigger if exists trg_stamp_business_id on automation_rules;
create trigger trg_stamp_business_id before insert on automation_rules for each row execute function fn_stamp_business_id();

