# Country waitlist / Cloudflare Turnstile — 20 October 2026

The Turnstile integration is deployed at
**https://tshelo-admin.vercel.app/waitlist**. Safari displayed Cloudflare's
**“Success!”** on that hostname without a manual challenge interaction.
After explicit launch approval, country/email collection was enabled and a real
browser submission passed end to end. Exactly one clearly labeled synthetic
`example.invalid` contact was retained for review, with the correct country and
12-month expiry and no phone number. No customer account or real mailbox was used.

## Configuration and implementation

The existing `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` supplied by the
colleague are used directly. The site key is public and is passed to the form;
the verifier secret stays server-only. The older
`WAITLIST_TURNSTILE_SECRET_KEY` name remains supported as an override.

`WAITLIST_TURNSTILE_HOSTNAME` is set to `tshelo-admin.vercel.app` and a random
server-only `WAITLIST_RATE_LIMIT_KEY` was added. The collection flag was initially false and was set to true only after the user
explicitly approved public collection and the synthetic QA test. Secret values were not printed, committed, copied into browser props or
written to the release evidence. No Cloudflare account setting was modified by
this work; the browser result confirms the supplied widget works on this host.

The public form renders 12 eligible non-launch countries from the public country
catalogue. It collects only country and email, includes a required availability
request checkbox, and discloses the purpose, maximum 12-month retention, earlier
removal after notification/sign-up, absence of marketing subscription and a
privacy-policy link. These controls were reviewed with collection off before activation.

Turnstile uses explicit rendering with action `country_waitlist`. Expired/error
callbacks discard tokens. Retries require a fresh token, repeated submissions
are guarded, user input survives errors, and widgets are removed on completion
or unmount. The backend validates success, expected hostname and action through
Cloudflare Siteverify before the server-only submission RPC. Existing input
validation, hashed durable rate limits and duplicate handling remain intact.

## Deployment and tests

The current production source was downloaded from deployment
`dpl_G8PMDw2Uze1ehg2aCkDUardWRi1Z` and used as the isolated release baseline.
Only four runtime files were overlaid: the waitlist page, its CSS module, the form
component and the backend secret-name compatibility change. Other local changes
were not overlaid. The resulting deployment was staged, checked, then promoted.

Initial non-collecting deployment: `dpl_7UsDMtRZXSrq7PasnostWhHehWHA`.
Approved activation redeployed that exact source with the updated production
flag; no source changes were added. Active deployment:
`dpl_6RCb45M48KH64ZdEYKYi4DcEotR5`, production, READY.
Immutable URL: https://tshelo-admin-jx2eiwzdd-diginav.vercel.app.
[Deployment details](https://vercel.com/diginav/tshelo-admin/6RCb45M48KH64ZdEYKYi4DcEotR5).

The isolated typecheck, lint and production build passed. Lint retains two
existing unrelated unused-variable warnings. All 61 website tests and eight
waitlist API tests passed. These include disabled collection after verification,
expired/error tokens, fresh-token retry, wrong hostname/action, unavailable
verifier, required server configuration and secret-name compatibility. The
runtime dependency audit returned zero vulnerabilities; five previously known
development-only advisories remain in the unchanged dependency tree.

Staged checks returned 200 for the form and login, 503 for disabled waitlist
collection and 401 for unauthenticated receipt completion. The retention cleanup
and failure monitor were healthy on 20 October, with no open incidents.

[Sanitized verification](releases/2026-10-20-turnstile-verification.json),
[source manifest](releases/2026-10-20-turnstile-manifest.json) and
[four-file patch](releases/2026-10-20-turnstile-release.patch) preserve the review
evidence. This was a CLI deployment; the new code/evidence is not committed or
pushed. The local ignored environment example was also updated with the names
used by this integration; the configuration names are documented here for Git.

## Approved activation and live end-to-end result

Automatic approval review initially rejected public activation before the
promised end-to-end check and explicit launch authorization. The rejected command
did not execute. The user then explicitly approved public country/email
collection and one labeled synthetic submission. `WAITLIST_ENABLED` was changed
to true and the exact reviewed source was redeployed.

Safari completed the real production widget without a manually clicked challenge.
The labeled Kenya entry was submitted through the form and displayed “Your
request has been received. Thank you for your interest in Tshelo.” Production runtime logs recorded HTTP 200 for the submission, request
`9l9ls-1792495523104-b085b5d9c134`. The QA address had zero rows before submission and
exactly one afterward. The saved country was
KEN, phone was NULL, notification/sign-up flags remained false, and expiry was
exactly creation time plus 12 calendar months. The labeled QA row is retained;
no launch email or marketing enrollment was sent or implemented.

The production API rejected a missing CAPTCHA payload with 400 and rejected an
invalid token with 400 and the verification message, without accepting another
entry. No production test keys or verifier bypasses were used. A direct live
replay of the successful token was not exercised; single-use handling and
rejected verifier responses are covered by the existing tests.

[Live QA evidence](releases/2026-10-20-turnstile-live-qa.json) records the synthetic
label, browser result and aggregate database checks without tokens or secrets.
The checked 15-minute window returned zero runtime error records for the active
deployment. External email/paging monitoring remains separate from the working database
cleanup monitor. Native CAPTCHA and `app.tshelo.com` routing were not changed.

Implementation follows Cloudflare's
[widget rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/)
and [server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
documentation.
