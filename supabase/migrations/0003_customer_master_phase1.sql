-- Phase 1 (Customer Master) additions.
-- Two fields the spec calls out that the earlier Customer Master rebuild
-- didn't add: a payment collection cadence (Daily/Weekly/Monthly/Custom —
-- distinct from payment_terms, which is a billing/credit term like "Cash on
-- Delivery" or "Monthly Credit") and a secondary contact number.
-- Additive only — no existing column is touched or dropped.

alter table customers add column if not exists alternate_phone text;
alter table customers add column if not exists payment_frequency text not null default 'Monthly';

alter table customers drop constraint if exists customers_payment_frequency_check;
alter table customers add constraint customers_payment_frequency_check
  check (payment_frequency in ('Daily', 'Weekly', 'Monthly', 'Custom'));

-- Speeds up Customer Master search by ID (findCustomerId, bulk-import
-- lookups, the new customers-list search box) now that it's a real filter
-- path rather than only single-row lookups.
create index if not exists idx_customers_code on customers(code);
