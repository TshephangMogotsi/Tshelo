# Tshelo Admin

Private web console for platform-wide Tshelo operations. It shares Supabase Auth
and the production data model with the mobile application, but platform staff
access is controlled by the separate `platform_admins` allowlist.

The same phone-OTP page also supports existing mobile-app users. Staff are
routed to the admin dashboard; regular users are routed to the read-only
`/account` area and remain subject to the existing Supabase row-level policies.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the same Supabase project URL used by the mobile app.
3. Prefer a publishable key. The legacy public anon key also works during the
   project's key migration.
4. From this directory, run `npm install` and `npm run dev`.

The console does not need a Supabase secret key for its current reads or
privileged mutations. Requests use the caller's JWT so Row Level Security and
`auth.uid()` remain available; narrow database RPCs authorize and audit the
platform-admin mutations atomically.

## Enable the database model

Apply the repository migrations through the normal Supabase deployment flow:

```sh
supabase db push
```

## Add the first administrator

The person must already have a Tshelo account. After applying the migration,
run this once using a trusted database session, replacing the phone number:

```sql
insert into public.platform_admins (user_id, role, created_by)
select id, 'super_admin', id
from public.users
where phone = '+26771000000'
on conflict (user_id) do update
set role = excluded.role,
    is_active = true,
    updated_at = now();
```

Available roles are `support`, `operations`, `finance`, and `super_admin`.
Administrators sign in using the same phone OTP flow as the mobile app. Public
account creation is disabled in the admin login request.

## Deploy from the existing GitHub repository

Create a Vercel project from the existing `Tshelo` repository and set:

- Root Directory: `admin`
- Production Branch: `main`
- Framework Preset: Next.js
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only Vercel Secret
  `SUPABASE_SERVICE_ROLE_KEY` (required for verified account-closure requests).
- Optional token checkout: `NEXT_PUBLIC_TOKEN_PORTAL_URL` must be an HTTPS
  checkout URL. The checkout service must create the order and only credit
  tokens after its verified payment webhook completes.

Interactive browser components use the same-origin API.

## Sign-in recovery configuration

Recovery remains disabled until the owner explicitly enables
`TSHELO_RECOVERY_ENABLED=true`. It requires the contact-recovery and verified
email-sync migrations, `SUPABASE_SERVICE_ROLE_KEY`, and a server-only random
`RECOVERY_CHALLENGE_SECRET` of at least 32 characters. Email recovery also
requires `RECOVERY_EMAIL_API_KEY` (Resend) and `RECOVERY_EMAIL_FROM` from an
approved, verified sender. Never prefix these with `NEXT_PUBLIC_`.

Phone recovery additionally fails closed until hosted Supabase phone
auto-confirm is verified disabled and `RECOVERY_SMS_AUTOCONFIRM_DISABLED=true`
is set. Auth templates must deliver one-time codes, and Twilio must support the
recipient's destination. Email recovery using phone proof fails closed until
hosted static/test OTP numbers have been audited, their E.164 values are placed
in server-only `RECOVERY_STATIC_OTP_BLOCKLIST`, and
`RECOVERY_STATIC_OTP_AUDITED=true` is set. Keep that denylist synchronized with
the hosted test-number configuration; static codes cannot prove phone ownership.
Recovery is unavailable to platform administrators and accounts with an
enrolled MFA factor;
their approved MFA recovery procedure applies separately. Activate only after
the client lifts the access hold and the operator completes the outstanding
production-readiness checks. Changing environment variables requires a new web
deployment. Mobile email sign-in and the recovery-settings link require a new
native build and distribution.

The server verifies the current verified contact's OTP for the signed-in Auth
user. Phone replacement uses Supabase's phone-change OTP. Email replacement
uses a separate short-lived email code and, after both contacts are verified,
uses the restricted server admin API to update the existing Auth user without
changing Supabase's global secure-email-change setting. Challenge digests are
private, expire after ten minutes, and are single-use with bounded attempts.
The new migrations must be applied together before enabling the endpoint.
Successful recovery attempts revoke refresh sessions and send security notices;
existing access tokens can remain usable until their configured expiry.

Add the deployed URL to the Supabase Auth redirect allowlist. No GitHub
organization or second repository is required.
