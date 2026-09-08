-- Central branding settings — extends the existing business_settings
-- singleton (already the source of truth for invoice/receipt/etc. number
-- prefixes) with everything the premium document redesign needs: tagline,
-- tax/registration number, a second contact number, free-text bank/payment
-- details, signature + stamp images (logo_url already existed, unused
-- until now), and the footer note/terms shown on generated documents.
alter table business_settings add column if not exists tagline text not null default 'Pure Drinking Water';
alter table business_settings add column if not exists ntn text;
alter table business_settings add column if not exists phone_2 text;
alter table business_settings add column if not exists bank_details text;
alter table business_settings add column if not exists signature_url text;
alter table business_settings add column if not exists stamp_url text;
alter table business_settings add column if not exists payment_terms text;
alter table business_settings add column if not exists footer_note text not null default 'Thank you for choosing Evergreen Water — Pure Drinking Water, delivered.';

-- Storage for the logo/signature/stamp images the Settings UI lets the
-- Owner upload. Public read (these are letterhead assets embedded in every
-- generated document and shown in-app without auth — nothing sensitive),
-- writes restricted to whoever holds settings.manage — same permission
-- already gating business_settings itself (migration that added
-- p_settings_update).
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

create policy p_branding_public_read on storage.objects for select
  using (bucket_id = 'branding');

create policy p_branding_manage_write on storage.objects for insert
  with check (bucket_id = 'branding' and fn_has_permission('settings.manage'));

create policy p_branding_manage_update on storage.objects for update
  using (bucket_id = 'branding' and fn_has_permission('settings.manage'));

create policy p_branding_manage_delete on storage.objects for delete
  using (bucket_id = 'branding' and fn_has_permission('settings.manage'));
