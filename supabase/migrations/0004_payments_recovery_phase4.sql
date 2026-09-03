-- Phase 4 (Payments + Recovery) additions.
-- payments.notes — the spec's payment record explicitly includes a free-text
-- note distinct from `reference`. Additive only.
alter table payments add column if not exists notes text;
