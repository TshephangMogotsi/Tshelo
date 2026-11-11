# Tshelo work done summary — 7 October 2026

## Ready in the app source

### Fund workspace search and filters

The Home screen already provides fund search and filters for status and type. Fund workspaces now also provide local search and filters on their busiest lists:

- **Contributions:** search by contributor, payment method, reference, or note; filter by received, pledged, member, guest, or refunded.
- **Expenses:** search by vendor, description, recorder, category, or note; filter by recorded, sponsored, needs review, or a specific category.
- **Members:** search by name, phone number, or role; filter by organiser, admin, or member.

### Receipt scan confirmation and review

After a user photographs or uploads a receipt:

1. The review screen shows the extracted **vendor**, **total amount**, and **date**.
2. The user can correct the vendor and receipt items before saving.
3. They must tick **“I checked the extracted details against the receipt”** before a scanned receipt can be saved.
4. A scan with unclear, missing, inferred, or inconsistent details shows an amber **“Scan needs review”** card with an explanation.
5. An unreadable image also enters the review state, so the user can complete the expense manually instead of assuming the scan succeeded.

The receipt parser now requests an explicit review decision and reasons from the model. The mobile app also treats a missing vendor, date, or total as needing review, including while an older API deployment is still in use.

## Notification work completed earlier

- Notification settings with a master switch and controls for fund invites, contributions, expenses, deadlines, and event reminders.
- Automatic reminder rules: contribution deadlines at 7, 3, and 1 days; event reminders at 7 and 1 days.
- Push preference handling in the notification sender. Security notifications remain enabled, and inbox activity remains visible even where push is disabled.
- Database migrations and the `send-push` Edge Function deployment were completed.

To send scheduled reminders automatically, enable **pg_cron** in Supabase: **Integrations → Cron**. The mobile settings screen appears after the next mobile release.

## Test checklist for the next app build

### Search and filters

1. Open Home and search for a fund by name; change the active/closed and type filters.
2. Open a fund's **Money** tab. Search for a contributor, then try Received, Pledged, Members, Guests, and Refunded.
3. Open **Expenses**. Search for a vendor or recorder, then try Sponsored, Needs review, and a category.
4. Open **Members**. Search by name or phone number, then try Organisers, Admins, and Members.
5. Use **Clear search & filters** and confirm the full list returns.

### Receipt scans

1. Record an expense and choose **Scan receipt** or **Upload receipt**.
2. Confirm the extracted vendor, amount, and date appear above the editable receipt items.
3. Verify **Confirm & Save Expense** is disabled until the acknowledgement checkbox is selected.
4. Test a clear receipt and confirm it displays the standard extracted-details card.
5. Test a faded, partial, unrelated, or unreadable image and confirm it displays the amber **Scan needs review** warning before allowing a manual correction and save.

## Validation completed

- Search/filter work: TypeScript check, focused filter tests, and diff check passed.
- Receipt work: TypeScript and diff checks passed. Additional test suites were intentionally skipped to conserve usage.
