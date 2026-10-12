# Live data classification — 12 October 2026

Project: `albihofmlafjzbusancu`. Complete review snapshot: 12 configuration rows
and 20 notification-template rows. No credentials, internal URLs or populated
personal information were found in this snapshot. This is an internal inventory;
the operational values below should not be published as client configuration.

“Public-safe” describes content suitable for general display, not an anonymous
database grant. The current database only exposes approved configuration keys to
authenticated clients. “Authenticated-only” is reserved for user-specific output
after authorization. “Server-only” means trusted backend/database operators;
ordinary users, including users with app admin roles, do not receive table access.
All writes to these two tables are restricted to trusted server access.

## Configuration: every live row

| Key | Reviewed value | Classification | Permitted audience and reason |
| --- | --- | --- | --- |
| `ai_training_monthly_cap` | `200` | Server-only | Internal reward cap; enforce on server. |
| `app_version_latest` | `"1.0.0"` | Public-safe | Authenticated clients; display upgrade availability. |
| `app_version_minimum` | `"1.0.0"` | Public-safe | Authenticated clients; display minimum supported version. |
| `auto_close_days_default` | `14` | Server-only | Internal lifecycle default. |
| `cooling_off_days` | `7` | Server-only | Internal lifecycle rule. |
| `high_value_threshold_bwp` | `250000` | Server-only | Internal manual-approval threshold. |
| `high_value_threshold_zar` | `500000` | Server-only | Internal manual-approval threshold. |
| `maintenance_message` | `"We'll be back shortly!"` | Public-safe | Authenticated clients; service availability message. |
| `maintenance_mode` | `false` | Public-safe | Authenticated clients; service availability status. |
| `max_invites_per_day` | `100` | Server-only | Internal abuse-control limit. |
| `max_invites_per_fund` | `500` | Server-only | Internal abuse-control limit. |
| `reports_limit_per_day` | `5` | Server-only | Internal resource-use limit. |

Controls: authenticated SELECT on `key` and `value` only; RLS explicitly allows
the four version/maintenance keys. Descriptions and updater metadata are private.
New keys are server-only until intentionally reviewed and allowlisted.

## Notification templates: every live row

All rows below have language `en` and `is_active=true`. Every template is
**server-only** because the app receives rendered notifications, not the template
catalog. Personalized rendered output requires recipient/fund authorization;
placeholders must not be filled with passwords, OTPs, bank account numbers or
unnecessary sensitive information. No template presently requests those values.

| Template code | Reviewed title | Reviewed body | Classification / reason |
| --- | --- | --- | --- |
| `contribution_confirmed` | Contribution Confirmed ✓ | Your contribution of {amount} to "{fund_name}" has been confirmed. | Server-only; personal payment confirmation. |
| `contribution_received` | Contribution Received 💰 | {contributor_name} contributed {amount} to "{fund_name}". | Server-only; member and financial details at rendering. |
| `expense_added` | Expense Added | {added_by} added an expense of {amount} for {description}. | Server-only; recorder, amount and free-text expense description. |
| `expense_query` | Question About Expense | {asker_name} has a question about {expense_description}. | Server-only; member and free-text expense details. |
| `fund_closed` | Fund Closed | "{fund_name}" has been closed. View the final report. | Server-only; fund lifecycle notification. |
| `fund_closing_3` | Fund Closing in 3 Days | "{fund_name}" will close in 3 days. Final call! | Server-only; fund lifecycle notification. |
| `fund_closing_7` | Fund Closing Soon | "{fund_name}" will close in 7 days. | Server-only; fund lifecycle notification. |
| `fund_created` | Fund Created 🎉 | Your fund "{fund_name}" is ready. Share it with family to start collecting. | Server-only; personalized fund details. |
| `fund_joined` | You Joined a Fund | You've joined "{fund_name}". You'll see all contributions and expenses. | Server-only; membership notification. |
| `member_joined` | New Member Joined | {member_name} has joined "{fund_name}". | Server-only; member identity. |
| `milestone_100` | Goal Reached! 🎉 | "{fund_name}" has reached 100% of the goal! | Server-only; fund progress. |
| `milestone_25` | 25% Milestone! 🎯 | "{fund_name}" has reached 25% of the goal! | Server-only; fund progress. |
| `milestone_50` | Halfway There! 🎯 | "{fund_name}" has reached 50% of the goal! | Server-only; fund progress. |
| `milestone_75` | Almost There! 🎯 | "{fund_name}" has reached 75% of the goal! | Server-only; fund progress. |
| `pledge_reminder` | Pledge Reminder | Friendly reminder: You pledged {amount} to "{fund_name}". | Server-only; personal financial commitment. |
| `referral_signup` | Referral Bonus! 🎁 | {referred_name} signed up using your code! You both earned {tokens} tokens. | Server-only; referral identity and reward. |
| `rich_auntie_tagged` | You're a Rich Auntie! 👑 | You've been recognized for sponsoring {item} ({amount}) in "{fund_name}". | Server-only; sponsorship and amount. |
| `succession_request` | Fund Access Requested | Someone is requesting access to "{fund_name}". Please respond. | Server-only; fund access workflow. |
| `trust_badge_earned` | Trust Badge Earned! ✅ | Congratulations! You've earned the Verified Organizer badge. | Server-only; account-specific recognition. |
| `welcome` | Welcome to Tshelo! 👋 | Hi {user_name}, you're all set! Create your first fund or join one to get started. | Server-only; personalized welcome. |

Controls: no SELECT or write grants to PUBLIC, anon or authenticated on the
template table. Trusted senders render the templates. Template classification
does not itself prove the authorization or redaction of every rendered message;
changes to template variables or senders require another review.

## SMS-log review and protection

The live `sms_logs` table had **zero rows** at review. There were no stored raw
messages, parsing errors, OTP/credential markers or long phone/account digit runs.
No messages or personal data were exported. This does not audit provider logs,
historical backups, application telemetry or notification payloads.

The current app does not read or write this table, and its SMS watcher is disabled.
All SMS-log columns are now server-only; owner access has also been removed.
No client processing-history view is needed by the current app.

Retention/minimization rule: on every future INSERT or UPDATE, a database trigger
replaces the raw body with `[message content not retained]` and replaces non-null
free-text parsing errors with `[processing error details not retained]`. This
applies even to trusted service-role writes. Structured amounts, references,
matching IDs and processing status remain available to servers and are themselves
financial/personal data. They must not be populated with OTPs or credentials.
No raw-message history is needed to support the disabled feature.

No existing rows were deleted or rewritten. No expiry schedule for structured
financial records has been introduced; that requires a retention policy for the
future SMS-processing feature. Before enabling it, the sender/parser must avoid
logging message bodies to telemetry and implement structured-data validation.

Verification: the database test checks denial of raw/column reads and writes for
both client roles, redaction on service-role INSERT and UPDATE, and preservation
of structured processing fields. The classification reflects the live snapshot
above; new config keys/templates require review.

Deployed verification: migration `20261012130000` is recorded remotely; both
client roles lack column read access; service-role access is preserved; the
INSERT/UPDATE content-minimization trigger is enabled. The table remains empty.
