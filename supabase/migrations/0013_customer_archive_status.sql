-- Section 11: customers get a real Active/Inactive/Archived status
-- alongside the existing on_hold/blacklisted values (kept, not replaced —
-- archiving is a distinct action from those). Deliberately NOT selectable
-- from the plain status dropdown in CustomerForm — archiving goes through
-- its own action (mandatory reason + audit log), not a casual field edit.
alter table customers drop constraint customers_status_check;
alter table customers add constraint customers_status_check
  check (status = any (array['active', 'inactive', 'on_hold', 'blacklisted', 'archived']));
