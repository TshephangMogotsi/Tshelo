-- Receipt images contain sensitive financial information and must never be
-- readable with the anonymous key. Authenticated fund-member access remains
-- governed by the receipts_select_member policy.
drop policy if exists "Public receipt read" on storage.objects;
