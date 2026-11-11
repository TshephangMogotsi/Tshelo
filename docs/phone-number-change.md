# Verified sign-in number changes

Signed-in members open Profile → Security → Change phone number and first verify
an SMS code delivered to the current registered number. They then select a
country, enter the new national number and verify a separate SMS code there.
Supabase's authenticated `updateUser({ phone })` / `verifyOtp({ type:
'phone_change' })` flow changes the existing Auth user. It never creates or
merges accounts.

The database trigger syncs the confirmed Auth phone to `public.users.phone`
within the same transaction. Pending changes leave the profile untouched.
Conflicts fail the transaction. An Auth-table reservation trigger prevents more than one
account reserving the same pending phone number and rejects number changes unless the
account authenticated using its current number in the last ten minutes. All existing user IDs, funds, memberships,
contributions, balances, country/currency preferences and payment details remain
unchanged. A new sign-in number does not verify or replace a mobile-money account.

This flow requires a signed-in session and access to SMS on the new number.
Recovery for signed-out members who have lost their old number is separate.
The new number cannot already belong to another account. Leaving the screen
before verification does not complete the change; restarting the flow requests
a new code. Resends have a 60-second UI cooldown in addition to Auth rate limits.
On success the account receives a durable in-app security notification. It is
not an SMS or email notification to the former number.

## Release requirements

The initial profile-sync migration was deployed to the linked Supabase project
on 2026-10-06 and the trigger is enabled with direct execution denied to
anon/authenticated roles. The two-step verification and security-notification
hardening migration (`20261006130000`) is pending deployment. SMS verification
is pending the user's manual test. The mobile update has not been published.

1. Apply `20261006140000_require_fresh_phone_change_auth.sql` before releasing the strengthened flow.
2. Confirm Supabase phone authentication and the SMS provider are enabled, with
   SMS auto-confirm disabled. Keep provider rate limits enabled. Never test
   auto-confirm with customer accounts.
3. With a disposable account and two controlled numbers, test: invalid/expired
   code; unchanged old login before verification; successful new login after
   verification; old login rejection; unchanged user ID, funds and contributions;
   and rejection of a number already registered to another account.
4. Confirm profile phone matches the new Auth number and check native iOS/Android
   keyboard and country-picker behaviour. Web account settings are a separate UI
   and do not yet expose this native-app flow.

## Local validation

`npm run typecheck`

`npx jest lib/__tests__/changePhone.test.ts screens/main/__tests__/ChangePhoneScreen.test.js --runInBand`

`node scripts/test-phone-change-db.mjs`

The database check executes the real migration in isolated PostgreSQL (PGlite).
It checks pending changes, linked-data preservation, conflict rollback,
verification requirements and denied direct profile-phone/trigger access.
