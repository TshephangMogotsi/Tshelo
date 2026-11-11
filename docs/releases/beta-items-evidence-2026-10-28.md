# Beta delivery items — evidence as of 28 October 2026

This record separates implementation, builds, distribution and verified use.
Dates below are evidence dates, not promises or dates inferred from due dates.

## Android internal beta and listing name

- **24 September:** the [Play release tracker](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/docs/google-play-release-tracker.md) records version 1.0.1, version code 11, in internal testing and the store name as Tshelo. This is a historical record; it does not independently establish the claimed 25 September rename date or the current Play listing.
- **23 October:** [Android build 14](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970697522) completed, but was not submitted to Play as part of that workflow. No later store upload or install was independently verified.
- **28 October:** the developer confirmed the affected tester's app still crashes before opening. The cause and fix remain unresolved; a crash report and successful retest on that phone are outstanding.

## Web link and tester login

- **23 October:** [Web release workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828) passed and promoted `ce84009` to [the web app](https://tshelo-admin.vercel.app).
- **28 October:** direct email registration and onboarding were deployed to [Vercel deployment dpl_9BeZGiGaWt3M3GgFjZ62tMmqBLhD](https://vercel.com/diginav/tshelo-admin/9BeZGiGaWt3M3GgFjZ62tMmqBLhD). Registration is disabled while the client's admin-access/MFA hold remains; no end-to-end tester registration or login has been verified.
- The 17 supplied email addresses were added to sensitive production configuration on 28 October. This is an allowlist and did not create Supabase Auth accounts. The client reports none of the 17 currently has an account.

## Static OTP and tester lists

- **Date not yet evidenced:** the developer reports static OTPs configured for some testers and all testers added to the testing list. No dated configuration evidence, full-list reconciliation or successful tester login has been verified here.
- A Google Play testing list and a Supabase Auth account are separate. Adding an email to either the Play list or the website allowlist does not create an account. Client reports 17 accounts are absent.
- The Ghana Twilio registration was shown as **In review**, last updated 5 October, in the client-provided Twilio screenshot. No successful Ghana delivery has been verified.

## In-app feedback

- **23 October:** [commit 37da6d4](https://github.com/TshephangMogotsi/Tshelo/commit/37da6d4852e64e5cbf072e2e4c6166f35314cf0c) contains the support-ticket feedback implementation and tests.
- No proof that this implementation has been submitted to a testing track or verified on a tester's device. The earlier `ce84009` support screen opens an email draft and can display success even if no email was sent; it is not evidence that the newer support-ticket submission reached the queue.

## First app update

- **7 October:** the work summary describes source-level notification settings, search/filters and receipt review/flagging. It was subsequently included in [commit 37da6d4](https://github.com/TshephangMogotsi/Tshelo/commit/37da6d4852e64e5cbf072e2e4c6166f35314cf0c) on 23 October. Source evidence is not proof of tester delivery.
- **16 October:** [sanitized API evidence](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/docs/releases/2026-10-16-live-qa-evidence.json) records a synthetic receipt upload, provider parse, reviewed completion and expense save on the then-promoted web API. It is not a device UI or flagging test.
- **23 October:** [Android build 14 workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970697522) and [iOS build 11 workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970703090) passed on `ce84009`; neither was submitted to stores as part of those workflows. The newer `37da6d4` changes, including the new notification-settings screen and list filters, postdate those builds.
- PDF/report source exists, but the evidence reviewed does not establish a successful export on a tester device. No end-to-end push delivery or complete device-feature checklist has been verified.
- Web registration: deployed 28 October as above, but closed and not live-tested with a tester.

## Outstanding evidence

Play tester list export/date; actual Supabase account and static OTP coverage without exposing codes; tester login; store-track versions and installation; feedback-ticket receipt; device-level notification, PDF, search/filter and receipt confirm/flag checks; and approved date for the next release.

## Client-ready response

### Web app and tester login

- **23 October:** The [web release workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828) passed and deployed to **https://tshelo-admin.vercel.app**.
- **28 October:** Direct email registration and onboarding were deployed in [this web deployment](https://vercel.com/diginav/tshelo-admin/9BeZGiGaWt3M3GgFjZ62tMmqBLhD). Registration remains closed pending the requested admin-access and MFA verification. A tester registration and login have not yet been completed.

### Static OTP and the 17 beta sign-ups

- **28 October:** The 17 email addresses were added to the website's approved list. This did **not** create Supabase accounts; the list controls who may register once registration is enabled.
- Static OTPs were configured for some testers, and the tester list was reported as populated. Dated configuration evidence, a reconciliation of all 17 against the Play list, and a successful login record for each tester have not yet been established. There is no evidence yet to close this item.

### In-app feedback form

- **23 October:** The support-ticket feedback implementation was included in [commit `37da6d4`](https://github.com/TshephangMogotsi/Tshelo/commit/37da6d4852e64e5cbf072e2e4c6166f35314cf0c).
- It has not been verified in a distributed tester build or confirmed to reach the support queue. The earlier build's form opened an email draft; that is not evidence of the newer ticket submission working.

### First app update

- **7 October:** A work record describes source-level search and filters, notification settings, and receipt confirmation/review. Those changes were included in [commit `37da6d4` on 23 October](https://github.com/TshephangMogotsi/Tshelo/commit/37da6d4852e64e5cbf072e2e4c6166f35314cf0c).
- **16 October:** A synthetic [receipt API check](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/docs/releases/2026-10-16-live-qa-evidence.json) recorded upload, parsing, reviewed completion and expense save. It did not verify receipt flagging on a device.
- **23 October:** [Android build 14](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970697522) and [iOS build 11](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970703090) passed their build workflows. The newer notification-settings and list-filter changes postdate those builds. The workflows did not submit the builds to the stores.
- **28 October:** Web registration was deployed as noted above, but remains closed and untested with a tester.

Remaining delivery evidence is a tester-installed build and device checks for notifications, PDF, search/filters, receipt confirmation and flagging, and feedback submission. No completion date for those checks has been confirmed.

## Sign-in recovery, web parity and administrator MFA

### Sign-in recovery — promised 7 October

- **6 October:** the initial verified phone-change profile-sync migration was recorded as deployed; the [phone-change implementation](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/lib/changePhone.ts) requires access to the current number and the new number. Production migration history was checked on 28 October and contains the later `20261006130000` and `20261006140000` hardening migrations as well. The mobile flow has no recorded published-build/device confirmation.
- Email sign-in is present in the website source. Native email sign-in and the two alternate-contact recovery paths have since been implemented locally, including server-side source verification, a destination-code challenge and Auth email/profile synchronization. They are not activated. Focused type, mocked API and disposable database checks passed on 28 October; real OTP delivery and end-to-end recovery have not been verified. Production sender/secret configuration, migrations, static-OTP audit and a native release remain outstanding. No delivery date is confirmed.
- Do not describe static tester OTPs as an account-recovery backup-code system.

### Website versions of the 7 October mobile features — promised 8 October

- **23 October:** the [web release workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828) passed for `ce84009`. That source includes web notification, PDF/report and receipt-related screens. Source/build presence is not proof that each website feature matches mobile or works end to end.
- **16 October:** [synthetic receipt API evidence](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/docs/releases/2026-10-16-live-qa-evidence.json) includes upload, parsing, reviewed completion and expense save. It does not establish website UI parity for the receipt review flag.
- **28 October:** [web registration/onboarding deployment](https://vercel.com/diginav/tshelo-admin/9BeZGiGaWt3M3GgFjZ62tMmqBLhD) was promoted. Tester registration remains closed pending the client's hold and has not been verified end to end.
- A feature-by-feature comparison and authenticated browser checks for the exact 7 October scope are outstanding. No completion date is confirmed.

### Platform administrator MFA — reported done 22 October

- **22–23 October:** enrollment/challenge and application/database authorization were implemented. Five disposable-environment scenarios passed on **23 October**: [MFA browser/Auth/API/database run 39893841865](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39893841865). This is not a production test.
- **23 October:** the [web release](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828) included the `/mfa` enrollment UI in its source. The site subsequently received other releases.
- **28 October production read-only check:** migration `20261022120000` is not recorded, and `is_platform_admin` does not require `aal2`. There are two active platform-admin records, zero with a verified MFA factor; both lack a confirmed Auth email. Their recorded roles are super admin and support; the check did not establish the identity of either person. Production database MFA enforcement and enrollment are **not complete**.
- The client requested Nono as super admin and Syntiche as operations; their named assignments and confirmed work-email association have not been established by this check. Nono and Masimba have been nominated as primary and backup recovery approvers; that does not itself grant admin access.
- **Enrollment steps once the production prerequisites and client-approved rollout are ready:** (1) ensure each nominated admin has the correct active role and a confirmed Auth email; (2) enable/verify hosted TOTP enrollment and coordinate the matching database migration and approved recovery plan; (3) visit https://tshelo-admin.vercel.app/login and complete primary sign-in; (4) on `/mfa`, choose **Set up authenticator**, scan the QR code in an authenticator app, and enter its six-digit code; (5) sign out, sign back in and complete the authenticator challenge; (6) verify role permissions and denial without MFA, then record sign-off. Never share QR/setup secrets or OTP codes.
- Hosted TOTP settings, real admin enrollment, recovery rehearsal and production enforcement remain outstanding. These steps are prospective, not evidence that enrollment has already succeeded.

## CI/CD and production builds — reported done 23 October

- **23 October:** [web release](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828), [Android release](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970697522), and [iOS release](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970703090) workflows succeeded for `ce84009`.
- Android 1.0.1 build **14** and iOS 1.0.1 build **11** finished in Expo. Neither was submitted to Play or TestFlight by those workflows; a separate later upload has not been verified.
- The web release went to https://tshelo-admin.vercel.app, which has since received later updates. Full build links and limits are in [CI/CD production-build evidence](cicd-production-build-evidence-2026-10-23.md).
