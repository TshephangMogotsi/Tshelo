# Google Play reviewer access

Tshelo normally signs users in with a phone number and SMS one-time password.
Google Play requires reusable credentials that bypass one-time passwords, so the
app provides a separate email/password entry point for one dedicated reviewer
account.

## Provision the account

1. Apply `20260924090000_google_play_reviewer_guard.sql` to Supabase.
2. Choose a dedicated mailbox and a unique password of at least 16 characters.
   Do not reuse a personal or customer account.
3. Run the provisioner from a secure terminal. The service-role key must never
   be committed or added to an Expo public environment variable.

```sh
EXPO_PUBLIC_SUPABASE_URL='https://YOUR_PROJECT.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='YOUR_SERVICE_ROLE_KEY' \
GOOGLE_PLAY_REVIEW_EMAIL='play-review@YOUR_DOMAIN' \
GOOGLE_PLAY_REVIEW_PASSWORD='a-unique-16-character-or-longer-password' \
node scripts/provision-google-play-reviewer.mjs
```

The script creates or updates the Auth user, marks it with the admin-only
`google_play_reviewer` flag, and creates a completed Tshelo profile. Do not
remove that flag: the mobile review login rejects accounts that do not have it.

## Play Console instructions

On **App content → Sign-in details**, use:

- Name: `Google Play reviewer access`
- Username: the `GOOGLE_PLAY_REVIEW_EMAIL` value
- Password: the `GOOGLE_PLAY_REVIEW_PASSWORD` value
- Other information:

  `On the Tshelo sign-in screen, tap “Google Play reviewer access”. Enter the email and password above. This sample account has no access to customer data. Purchases, payout actions, mobile-money verification, and token transactions are disabled.`

The review account may be retained for future release reviews. Rotate its
password in the provisioner and update Play Console whenever the credential is
changed.
