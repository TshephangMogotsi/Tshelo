# Tshelo beta delivery — work completed and evidence

**As of 28 October 2026**

## 1. Android internal beta and listing

- Version 1.0.1, build 11 was recorded in internal testing, with the listing named **Tshelo**, on 24 September. [Play release tracker](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/docs/google-play-release-tracker.md)
- Android build 14 was completed on 23 October. [Build workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970697522)
- The startup crash affecting one tester remains unresolved.

## 2. Web app and tester login

- The web app is available at [tshelo-admin.vercel.app](https://tshelo-admin.vercel.app). [23 October web release](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828)
- Email registration, phone/email sign-in and web onboarding. [Web deployment](https://vercel.com/diginav/tshelo-admin/9BeZGiGaWt3M3GgFjZ62tMmqBLhD)
- Registration remains closed pending the requested admin-access and MFA verification.

## 3. Static OTP and beta testers

- All 17 beta testers have been added to the testing list, as confirmed ealier.
- Note. This does not create Supabase accounts. it simply means users were invited to the beta program

## 4. In-app feedback form

- A support-ticket feedback form was implemented on 23 October. [Implementation commit](https://github.com/TshephangMogotsi/Tshelo/commit/37da6d4852e64e5cbf072e2e4c6166f35314cf0c)
- The implementation is newer than the recorded 23 October mobile builds.

## 5. First app update

- Notification settings, PDF/report functionality, search and filters, and receipt confirmation and review/flagging have been implemented in source. [Work summary](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/docs/work-done-summary-2026-10-07.md) · [Implementation commit](https://github.com/TshephangMogotsi/Tshelo/commit/37da6d4852e64e5cbf072e2e4c6166f35314cf0c)


## 6. Sign-in recovery

- A phone-number change flow has been built for users with access to their existing number. [Phone-change implementation](https://github.com/TshephangMogotsi/Tshelo/blob/37da6d4852e64e5cbf072e2e4c6166f35314cf0c/lib/changePhone.ts)
- Email sign-in and alternate-contact recovery have been implemented locally. The web recovery portion was staged on 28 October; production activation and a mobile release remain outstanding. [Staged deployment](https://vercel.com/diginav/tshelo-admin/5NZzNhCPREDfAbriNTU1B3on9GSk)
- A separate pre-generated backup-code system is not confirmed as implemented.

## 7. Website versions of mobile features

- Web notification, PDF/report and receipt-related screens are present in the released source. [23 October web release](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828)
- Complete parity with all requested mobile features remains to be established.

## 8. Platform administrator MFA

- Authenticator-app enrolment, challenge and enforcement have been implemented. [MFA implementation run](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39893841865)
- Production database enforcement and administrator enrolment remain outstanding. Once the production prerequisites are in place, an admin signs in, opens `/mfa`, selects **Set up authenticator**, scans the QR code with an authenticator app and enters the six-digit code.

## 9. CI/CD and production builds

- **Web:** [23 October release workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828), deployed to [tshelo-admin.vercel.app](https://tshelo-admin.vercel.app).
- **Android:** version 1.0.1, build 14 — [workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970697522) · [Expo build](https://expo.dev/accounts/digital-natives/projects/tshelo/builds/5e7d075b-3ab1-4ee1-89f9-c75d9550cc52).
- **iOS:** version 1.0.1, build 11 — [workflow](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970703090) · [Expo build](https://expo.dev/accounts/digital-natives/projects/tshelo/builds/a58374a5-1aec-4cb3-8a8b-55d62a01d337).
- The workflows built the mobile artifacts; they did not upload them to Play or TestFlight. Any separate upload is not confirmed.
