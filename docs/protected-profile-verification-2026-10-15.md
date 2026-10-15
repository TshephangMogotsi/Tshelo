# Item 1 — protected-profile database verification, 15 October 2026

Project: Tshelo (`albihofmlafjzbusancu`), production. This closes verification of
the database access/reset/notification controls. The complete original item still
depends on the held app/web rollout and ownership re-verification implementation;
those are not certified by this database test.

## Ready-to-post update

> **Item 1 database protection verified live on 15 October.** A normal signed-in
> user could not directly update any protected field from the review. Thirty
> explicit assignments were rejected, including verification flags, bans/locks,
> token balance, trust, consent timestamps/values, and payment details. Exhaustive
> checks also denied updates to all 53 columns outside the profile allowlist.
>
> The ten permitted profile/preference fields remain editable on the caller's own
> row; another user's profile cannot be changed. Bank and mobile-money changes
> use the controlled database routine, reset the matching verification flag and
> timestamp, and create an owner notification. Independent bank/mobile changes
> preserve the other account's verification. Unchanged details produce no
> duplicate notification. All synthetic records and notifications were rolled
> back.
>
> This verifies the database fix on production using synthetic authenticated
> sessions. Released app/web flow testing and ownership re-verification remain
> open; this is not a staging or real-device notification delivery test.

## Live permissions

RLS is enabled on `public.users`. `users_update_own` requires both the existing
and resulting row ID to equal `auth.uid()`. The effective authenticated UPDATE
allowlist is exactly:

`name`, `email`, `avatar_url`, `country_code`, `preferred_currency`, `language`,
`notifications_enabled`, `profile_completed`, `onboarding_completed`,
`notification_preferences`.

The original hardening, profile/consent routine, encryption, and service-function
grant correction migrations are all recorded remotely:
`20260722090000`, `20261009110000`, `20261013100000`, `20261015210000`.

## Denied normal-user attempts

All 30 explicit assignments raised insufficient privilege (SQLSTATE 42501):

| Group | Fields |
| --- | --- |
| Verification | `bank_account_verified`, `mobile_money_verified`, `bank_account_verified_at`, `mobile_money_verified_at` |
| Moderation | `is_banned`, `locked_until` |
| Financial/trust | `token_balance`, `trust_score`, `trust_level` |
| Consent timestamps | `terms_accepted_at`, `privacy_accepted_at`, `marketing_consent_at`, `data_processing_consent_at` |
| Consent values | `terms_version`, `privacy_version`, `marketing_consent`, `marketing_email_enabled`, `marketing_sms_enabled`, `marketing_push_enabled`, `data_processing_consent` |
| Bank details | `bank_name`, `bank_account_number`, `bank_account_name`, `bank_branch_code` |
| Mobile-money details | `mobile_money_provider`, `mobile_money_number`, `mobile_money_name` |
| Encryption internals | `bank_account_number_ciphertext`, `mobile_money_number_ciphertext`, `payment_identifier_key_version` |

A second catalog-driven loop attempted own-row `SET column=column` against
**every one of the 53 columns outside the ten-field allowlist**. Every attempt
was denied with insufficient privilege, covering identity, phone/security,
moderation metadata, timestamps and future sensitive columns present today as
well as the explicit review list. This proves the UPDATE boundary even for a
no-op assignment. The first loop additionally supplies concrete forged values.

## Permitted edits and payment behaviour

- Updated all ten allowed profile/preferences fields on the synthetic own row
  and verified the resulting values. Cross-user name UPDATE affected zero rows,
  and a full trusted snapshot of the other synthetic profile remained unchanged.
- Payment RPC rejected both verification-flag injection and a supplied `user_id`
  targeting the other profile with `PAYMENT_DETAILS_INVALID`.
- **Bank only:** bank verification became false and its timestamp NULL; mobile
  verification and encrypted mobile identifier remained unchanged.
- **Mobile only:** mobile verification became false and its timestamp NULL; bank
  verification and encrypted bank identifier remained unchanged.
- **Both:** both verification flags became false and both timestamps NULL.
- Exactly three `payment_details_changed` owner notices were created, one for
  each real change, with the correct bank/mobile change indicators. They contained
  no new account numbers and none were addressed to the other fixture user.
- Repeating unchanged bank details preserved ciphertext and did not add a notice.
- Retired plaintext number columns remained NULL.
- The in-app notification rows were created even with `notifications_enabled`
  false and all routine-category preferences false. This does not establish push,
  SMS or email delivery; the rollback prevents real notification dispatch.

The fixture explicitly seeded verified synthetic payment details using trusted
database access, then performed the attacks/profile/payment actions as
`authenticated` with the synthetic user's JWT claims. Trusted access was used
only for fixture setup, an independent verification-state reset and final
isolation checks. No real user session or payment identifier was used or output.

## Reproduce and remaining closure work

```sh
supabase db query --linked --file security/fixtures/transactional-protected-profile-rls.sql --output json
```

The script strictly fails on unexpected outcomes. An intentional exception
subtransaction rolls back all fixtures before returning aggregate PASS results;
`fixtures_rolled_back` was true. No live policy/function was changed by this test.

The payment routine currently accepts an authenticated caller without the fresh
OTP/provider challenge used by the separate phone-change flow. It resets
verification but does not complete ownership re-verification. Keep this dependency
explicit, together with the held web/mobile rollout. Consent audit completeness
also has separate known gaps recorded in
[the consent verification](membership-consent-verification-2026-10-15.md).
