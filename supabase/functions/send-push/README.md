# send-push

Delivers a push notification via Expo whenever a row is inserted into
`public.notifications`. Triggered by a Supabase Database Webhook (not a SQL
trigger — webhooks are dashboard-configured, so this can't be scripted).

## 1. Deploy the function

```
npx supabase functions deploy send-push --project-ref albihofmlafjzbusancu
```

## 2. Set a shared secret (recommended)

Pick any random string, e.g. from a password generator, then:

```
npx supabase secrets set PUSH_WEBHOOK_SECRET=<your-random-string> --project-ref albihofmlafjzbusancu
```

You'll paste the same value into the webhook's custom header in step 3. This
stops anyone who finds the function's URL from sending arbitrary push
messages to your users — only the dashboard-configured webhook will know the
secret. If you skip this, the function still requires no other auth, so
don't skip it.

> Security note: the function now fails closed with HTTP 503 if this secret is
> missing. A previous credential was committed in the historical baseline and
> must be rotated; deleting it from the current file does not remove it from Git
> history.

## 3. Create the Database Webhook

In the Supabase dashboard: **Database → Webhooks → Create a new hook**

- **Name:** `send-push`
- **Table:** `notifications`
- **Events:** `Insert` only
- **Type:** `Supabase Edge Function`
- **Edge Function:** `send-push`
- **HTTP Headers:** add `x-webhook-secret: <the same random string from step 2>`

Save. Supabase will now POST every new `notifications` row to this function
automatically, in the shape:

```json
{ "type": "INSERT", "table": "notifications", "record": { ...the row... } }
```

Do not recreate this integration as a SQL trigger containing a literal secret.
The dashboard-managed webhook keeps the authentication header out of migration
files and `pg_get_triggerdef()` output.

## 4. Test it

Insert a test row directly (bypassing the phase-1 triggers) to confirm
delivery end-to-end once you have a device token in `push_tokens`:

```sql
insert into public.notifications (user_id, type, title, body, data)
values ('<your user id>', 'expense_added', 'Test push', 'If you see this, push works.', '{}');
```

If nothing arrives, check the webhook's delivery log in the dashboard
(Database → Webhooks → send-push → Logs) and the function's logs
(Edge Functions → send-push → Logs).
