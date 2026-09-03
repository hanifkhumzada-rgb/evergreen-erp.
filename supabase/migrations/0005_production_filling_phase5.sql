-- Phase 5 — Production & Filling.
-- A dedicated cost center for bottle filling runs, kept separate from the
-- general Expenses module per the spec ("this should NOT be mixed
-- unnecessarily with general expenses"). New, standalone, additive table —
-- does not touch expenses/expense_categories, so it carries no risk of
-- colliding with whatever constraints that table actually has on the live
-- database (which this repo's tracked migrations don't fully describe).
create table if not exists production_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text,
  batch_date date not null default current_date,
  product_id uuid references products(id),
  quantity_filled numeric(12,2) not null default 0,
  cost_per_bottle numeric(12,2) not null default 0,
  total_filling_cost numeric(12,2) generated always as (quantity_filled * cost_per_bottle) stored,
  caps_quantity numeric(12,2),
  cap_cost numeric(12,2),
  other_material_cost numeric(12,2) default 0,
  supplier text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_production_batches_date on production_batches(batch_date desc);
create index if not exists idx_production_batches_product on production_batches(product_id);

alter table production_batches enable row level security;
drop policy if exists p_production_batches_all on production_batches;
create policy p_production_batches_all on production_batches for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- Expenses: a lightweight receipt/attachment reference (URL or a physical
-- receipt number) — additive column, not a new file-storage integration
-- this sandbox has no way to verify against a real bucket.
alter table expenses add column if not exists receipt_reference text;
