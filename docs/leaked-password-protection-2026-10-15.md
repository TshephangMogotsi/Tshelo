# Leaked-password protection — 15 October 2026

Project: Tshelo (`albihofmlafjzbusancu`), production, Data Sentinels organisation.

## Live change

The signed-in dashboard showed a Pro organisation and the Email provider's
**Prevent use of leaked passwords** switch was off. Enabled that switch and
saved. Reopened the Email provider panel and verified the switch was on with
Save disabled (no unsaved changes). No other Auth settings were changed.

Location: Authentication → Sign In / Providers → Email.

## Live test

Sent one POST request to the project's public `/auth/v1/signup` endpoint using
its publishable key, a unique synthetic address under `example.invalid`, and
the known compromised test password `password123` (above the configured
six-character minimum). No existing user's credentials or session were used.

Observed response:

```json
{
  "http_status": 422,
  "error_code": "weak_password",
  "message": "Password is known to be weak and easy to guess, please choose a different one.",
  "weak_password": { "reasons": ["pwned"] },
  "user_returned": false
}
```

This verifies active leaked-password enforcement, rather than a minimum-length
failure or a settings-only change. No user or session was returned. No real
mailbox was supplied, and the test did not enter the successful sign-up path.

## Application scope and limits

- Normal mobile registration/login uses phone OTP (`RegisterScreen.tsx`,
  `LoginScreen.tsx`, `OTPScreen.tsx`). There is no user-chosen password to check
  in these flows.
- The admin login form uses phone or email OTP (`admin/components/login-form.tsx`).
  This protection does not replace platform-admin MFA.
- The Google Play reviewer screen uses password sign-in. No existing reviewer
  credentials were changed or tested during this check.
- No password-reset/change UI was found in the reviewed app paths. A real
  recovery-link/password-update flow and existing-user password login were not
  exercised. The live test above verifies password sign-up rejection only.
- This is a hosted Auth configuration change, not a SQL migration; no app build
  or website deployment is needed to activate the setting.

Supabase documents leaked-password protection for Pro and above, using the
HaveIBeenPwned Pwned Passwords API, for password creation/change:
[Password security](https://supabase.com/docs/guides/auth/password-security).
