# Production administrator onboarding — 30 October 2026

## Completed

The user approved these account-to-role assignments in the working session:

| Administrator | Account email | Active platform role |
| --- | --- | --- |
| Nono | nbokete@data-sentinels.com | super_admin |
| Syntiche | dev@data-sentinels.com | operations |

Both production Auth accounts were created and the exact active roles verified
against production project `albihofmlafjzbusancu`. Both email addresses remain
unconfirmed and neither account has a verified MFA factor. No email ownership,
consent, onboarding completion or MFA success was asserted on their behalf.

Role provisioning was recorded in `public.audit_log` with action
`platform_admin.provisioned`, source `operator_via_codex`, user authorization
context, and a null application actor. No existing administrator was impersonated.

The signup trigger checks approval metadata during insertion, but the Auth admin
creation API applies supplied custom app metadata after insertion. Initial API
attempts therefore failed. Provisioning used a temporary signup exception matching
only the exact generated Auth ID and email for each approved account. The original
`handle_new_user()` definition was restored immediately and its exact definition
compared successfully before role grants. General beta registration remains closed.
This one-off operation does not repair the separate beta-registration provisioning
path, which uses the same metadata-dependent creation pattern.

The live login route returned HTTP 200 and contained the email sign-in option.
The anonymous MFA route returned HTTP 307. Hosted TOTP enrolment and verification
and the email provider are enabled; email auto-confirmation is disabled.

## Email sign-in configuration

The user explicitly approved the production-wide template change after the initial
automatic approval rejection. Both confirmation and magic-link templates were
updated to include the email OTP and read back successfully. No verification,
MFA, expiry or rate-limit settings were changed. Sanitized settings evidence is
in [admin-email-templates-2026-10-30.json](releases/admin-email-templates-2026-10-30.json).

Production generates eight-digit email codes with a 3,600-second lifetime. The
website previously limited every code to six digits. The focused form change
accepts 6–10 numeric digits for email, with the Auth service enforcing the actual
configured code. Phone and authenticator codes remain six digits. Email-code
submission and method-switching tests and the admin typecheck passed.

The saved HTML for both `mailer_templates_confirmation_content` and
`mailer_templates_magic_link_content` is:

```html
<h2>Your Tshelo sign-in code</h2>
<p>Enter this code on the Tshelo sign-in page to verify your email address:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
<p>Keep this code private. If you did not request it, you can ignore this email.</p>
```

The form fix was promoted to production as deployment
`dpl_BmztocNXrTT8aiTqzcPntW615btW`. Its source reuses the preceding production
source hashes with only `admin/components/login-form.tsx` changed. The first
staging attempt failed to resolve shared files; the corrected candidate included
the admin root and shared-source setting explicitly and built successfully.
Production checks passed: login 200 with the updated email-code bundle; anonymous
MFA access redirects to login; admin audit API rejects anonymous access with 401;
beta registration remains closed with 403. Evidence:
[admin-email-otp-deployment-2026-10-30.json](releases/admin-email-otp-deployment-2026-10-30.json).

## Enrolment messages sent

The prepared instructions were sent individually to both approved addresses via
Tshelo's configured Resend sender. Both send requests returned HTTP 200 and
message IDs. This confirms provider acceptance, not inbox access or completed
sign-in. Delivery checks, where available, are recorded in
[admin-enrolment-emails-2026-10-30.json](releases/admin-enrolment-emails-2026-10-30.json).

Subject: Tshelo administrator access — email verification and MFA setup

Message content, personalised with each administrator's name, email and role:

> Hi [name],
>
> Your Tshelo [super administrator / operations administrator] account has been
> created using this email address.
>
> 1. Open https://tshelo-admin.vercel.app/login, choose Email, and use this address.
>    Choose sign-in rather than Create an account.
> 2. Request a sign-in code and enter the eight-digit code delivered to your inbox. This
>    verifies your email address; no password is needed for this flow.
> 3. Continue to https://tshelo-admin.vercel.app/mfa and select Set up authenticator.
> 4. Scan the QR code using your authenticator app and enter its six-digit code.
> 5. Sign out and sign back in to confirm that the authenticator challenge works.
>
> Keep email codes, authenticator codes and setup keys private. If you cannot
> finish setup or lose access to your authenticator, contact the Tshelo team.

## Production database enforcement — deployed

Migration `20261022120000_require_platform_admin_mfa.sql` was applied and recorded
atomically on 30 October 2026, following the user's request to complete enforcement
and confirmation that neither new administrator had enrolled. No unrelated pending
migration was applied. All four active platform administrators must now have aal2
for platform database privileges; this includes the two pre-existing accounts.
Enforcement was not deferred until enrolment because the self-only role lookup and
own-profile access needed by enrolment remain available at aal1. No bypass was added.

Before commit, a rollback-only production transaction exercised the exact migration
with synthetic JWT claims under the authenticated database role. For each active
administrator, missing/aal1/invalid assurance denied the read helper and all four
privileged mutation RPCs. Self-role lookup and own-profile access remained available.
Aal2 claims permitted the active-admin read helper. The same assertions ran inside
the commit transaction; independent post-deployment verification is recorded in
[platform-admin-mfa-production-2026-10-30.json](releases/platform-admin-mfa-production-2026-10-30.json).
The local 12-test database suite passed, including all four role permissions,
inactive-admin denial and assurance downgrade. Synthetic claims do not establish
real hosted enrolment, real aal2 sign-in or inbox ownership.

At deployment, four administrators were active and none had a verified MFA factor.
Nono and Syntiche still need to complete their own email verification, authenticator
enrolment and repeat sign-in. The two pre-existing accounts also need confirmed
emails before authenticator enrolment; their identities were not reassigned.

The [recovery runbook](platform-admin-mfa-recovery-2026-10-30.md) names the previously
nominated approvers and documents identity verification, privileged suspension,
provider reset, residual token expiry and restoration. It does not claim a completed
owner/operator rehearsal. No real factor reset was performed for this rollout.

Technical reference for the metadata timing:
https://github.com/supabase/auth/blob/master/internal/api/admin.go
