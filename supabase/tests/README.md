# Supabase permission integration tests

These tests are intended for a migrated disposable Supabase/Postgres database.
They create fixtures inside a transaction and finish with `ROLLBACK`, so no
test records persist.

Run the granular admin matrix with:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/fund_admin_permission_matrix.sql
```

Do not point `TEST_DATABASE_URL` at production. The script temporarily changes
permission-definition rows before rolling the transaction back.
