# Tshelo administrator account recovery - 30 October 2026

Use this procedure when an administrator loses their phone, cannot use their
authenticator, or believes someone else has accessed their account. The aim is
to help the right person regain access while keeping everyone else out.

## Who handles the request

Nono is the nominated person to approve recovery. Masimba is the backup and must
approve any request involving Nono's own account. Nobody may approve their own
reset. Engineering makes the changes in Supabase and keeps a record of the work.
Masimba's recovery contact is security@data-sentinels.com. Confirm his agreement
to the backup role and his availability when arranging the rehearsal.

## Recovering an account

1. Confirm who is asking. Contact the administrator using a company phone number
   or another contact method already on record. Do not rely only on an email from
   the affected inbox or a new number supplied in the request. Record the problem,
   the account involved and Nono's or Masimba's approval before starting the reset.

2. Pause administrator access. Engineering must find the correct Auth user ID,
   record the person's current role, and set `platform_admins.is_active` to false.
   Keep the account and role record. Check that an existing signed-in session can
   no longer perform administrator actions, then record the suspension in the audit log.

3. Check the email account. If the person's inbox or usual sign-in method may
   have been compromised, help them secure it and verify ownership before restoring
   access. The ordinary Tshelo contact-recovery feature does not cover platform
   administrators; engineering must use the approved provider account controls.

4. Remove the lost authenticator. Using secured Supabase operator access,
   engineering must identify and remove only the factor approved for reset. Revoke
   the person's existing sessions using Supabase's supported controls. Never ask
   them to send authenticator codes, setup keys or screenshots of the setup QR code.

5. Make sure old sessions cannot be reused. Keep administrator access paused
   until the old access tokens have expired or are confirmed invalid. Engineering
   must check the current token lifetime and allow for clock differences. Removing
   an authenticator or signing someone out does not guarantee that every issued
   token stops working immediately. If unsure, leave access paused.

6. Let the administrator set up MFA again. Once the old tokens are no longer
   usable and the approver agrees, engineering may restore the saved original role.
   The administrator must sign in on their own device at
   https://tshelo-admin.vercel.app/login, verify their email, then open
   https://tshelo-admin.vercel.app/mfa and set up their authenticator.
   Administrator actions remain blocked until MFA verification succeeds. Do not
   disable MFA enforcement to get past this step.

7. Test before handing access back. Ask the administrator to sign out, sign in
   again and complete the authenticator challenge. Engineering must check that
   the old factor and old sessions cannot restore access, that the new session
   has verified MFA (`aal2`), and that the person has only their original role's
   permissions. If a check fails or the account may still be compromised, pause
   administrator access again.

8. Close the request together. Record who requested, approved and carried out
   the recovery, how identity was checked, what changed, when it happened and
   the test results. Do not record codes or setup secrets. Tell the administrator
   and the approver the outcome, and obtain the approver's agreement before closing.

## If everyone is locked out

Engineering must use the separately secured Supabase or hosting operator account.
The same identity checks and approval rules still apply. Nono and Masimba do not
need access to the Tshelo dashboard to approve a recovery request.

If engineering cannot access the provider account either, recover that account
through the provider's own recovery process first. Do not create a public bypass,
use a fixed sign-in code, or switch off database MFA enforcement. Tshelo's current
setup does not provide emergency recovery codes.

## Practise the procedure before relying on it

Nono, Masimba and the engineer who would handle a reset should run through this
procedure together. Confirm that the contact details on record work, that the
approver is available, and that the engineer can access the secured provider account.

Use a dedicated test account in an isolated Supabase test environment. Do not
reset a real administrator's authenticator just to practise. Work through the
full sequence: approve the request, pause access, remove the test factor, revoke
sessions, wait for old tokens to expire, restore the original role and enrol again.

The rehearsal passes only when all of these checks succeed:
- Administrator actions are blocked while access is paused, even from an old MFA-verified session.
- The old factor and old sessions cannot be used to regain administrator access.
- The test account can enrol a new authenticator and sign in again successfully.
- The account retains its original permissions, and actions without MFA are denied.
- The request, approval, changes and results are recorded without exposing secrets.

Record the date, people involved, test environment, token-expiry waiting time and
any problems found. Nono or Masimba and the engineer should agree that the test
passed. Fix any failures and repeat the affected steps before calling recovery ready.

## Where we stand

This procedure has been written, but the recovery rehearsal has not yet been run.
The production checks on 30 October confirmed that database permissions require
MFA and that enrolment access remains available. Those checks did not reset a
real authenticator or prove that recovery works from start to finish.

References:
- https://supabase.com/docs/guides/auth/auth-mfa
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/reference/javascript/auth-admin-mfa-deletefactor
