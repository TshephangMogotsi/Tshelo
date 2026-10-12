-- Run after all migrations; catches accidental grants/RLS omissions in new tables.
SELECT public.assert_application_table_security();
