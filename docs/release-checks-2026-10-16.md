# Receipt, payment and consent release checks — 16 October 2026

Current approved live API QA: **PASS** for receipt scan/review/save, encrypted
payment reset/owner notice and all three consent regressions. QA account disabled;
labeled audit records retained. [Evidence](live-qa-verification-2026-10-16.md).
Earlier empty-log and approval-pending observations below are historical.

**Later deployment update:** the patched web candidate was promoted to
`https://tshelo-admin.vercel.app` and its receipt-completion route now responds
401 JSON rather than 404. `app.tshelo.com` is outside the verified project domain
scope and still returns 404. Live QA execution was blocked by automatic approval
review pending explicit approval for persistent synthetic test records. See the
[deployment record and remaining limits](web-release-deployment-2026-10-16.md).
The no-deployment/access-block statements below describe earlier checkpoints.

## Follow-up remediation

The two API-boundary failures recorded below are now fixed. Notification
settings load/save through `api.users.me/updateMe`, use the returned server
profile, restore the previous state on failure and block overlapping saves.
The phone helper remains an explicit GoTrue Auth-only boundary: the guard now
checks that every direct Supabase member accessed there is `auth`; it still
forbids database/storage/function calls and privileged credentials.

Final full `npm run verify` passed: 555 Jest tests, 280 API/security tests,
56 website tests, 362 event-file database assertions and all configured
security/consent/vouch/bootstrap/Metro/dependency/simulator-helper suites.
The targeted phone/notification suites also passed 18 tests. The live
notification-preference columns exist and authenticated callers have the
SELECT/UPDATE permissions required by the caller-scoped API.

Prepared a separate web candidate from pushed commit
`40423f432af5be99a03575243b3e5353acf6a169` with only four overlaid files:
receipt completion UI, invitation consent payloads, profile mapping and the
profile query. The invitation form no longer submits client consent timestamps;
notification preferences are mapped/selected and absent processing consent
defaults false. These corrections include dependencies previously hidden by
the mixed working tree; unrelated support and UI changes are excluded.

The isolated candidate passed its own website typecheck, lint and production
build, with the same two existing lint warnings. Its built server returned
200 for login and 401 JSON for unauthenticated receipt parse/completion/profile
requests, proving the completion route is present in that exact candidate.
The candidate uses isolated dependency copies; no environment files were
copied into its source. Initial external-dependency symlinks were rejected by
Turbopack and replaced before the successful build.

- [Four-file deploy patch](releases/2026-10-16-web-release.patch)
- [Base commit and file-hash manifest](releases/2026-10-16-web-release-manifest.json)
- Prepared directory: `/private/tmp/tshelo-web-release-1lvsnwqz` (web app in `admin`).

**Deployment remains unperformed.** Vercel CLI cannot retrieve the linked
project, and the connector returned project-not-found for the explicit team
and project IDs. An existing work-profile browser can display the dashboard,
but this does not grant the CLI/connector access. The user was given
`vercel login` instructions for the project-owning account. Production route
and authenticated checks are not marked passed from a local build.

The user clarified that neither a disposable QA account nor a test device has
been set up. No customer account, new QA identity, credential, receipt scan or
consent event was created during these follow-up checks. Account/device setup
and a reviewed deployment remain prerequisites for released-flow closure.
The earlier failure/count evidence below is retained as the before-fix snapshot.

**Decision: keep the release held.** Candidate builds and focused tests pass,
but production receipt completion is missing and released authenticated/device
round trips are not verified. No deployment, EAS build, OTA update or store
submission was triggered. These results cover the current working tree, which
also contains unrelated uncommitted phone, notification and UI changes; they
are not evidence for an isolated committed release artifact.

## Flow results

| Flow | Verified | Still required for closure |
| --- | --- | --- |
| Receipt scan → review → save | Live SQL checks preserve model/version/result, log failures, permit owner-only edits, deny direct client writes and reject repeat completion. Mobile handler and website DOM tests verify scan-ID propagation, edited values, failure handling and retries. Fixed the website dropping the scan ID, plus retry handling in both clients. | Production completion route still 404. Release the reviewed integration, then use a controlled receipt to prove actual provider execution, saved expense and matching audit entry on the released clients. |
| Payment changes → encrypted storage → reset/notice | Live real encryption/RPC checks pass, including bank/mobile/combined writes, randomized ciphertext, exact controlled service decrypt, role denials, verification/timestamp resets, owner-notice creation, no-op behavior, clearing and isolation. API routing test confirms controlled payment RPC use and no identifier/ciphertext in the profile SELECT. Registration payment screen test confirms the submitted bank/provider payload. | Released authenticated API and device flow, fresh-auth/ownership re-verification and actual device notification delivery remain open. SQL notification creation is not proof of push delivery. Additional mobile-money-number changes remain unavailable in the current public profile API pending the verification flow. |
| Registration/preferences → consent history | Live consent regression passes: explicit first acceptance, channel-only changes, aggregate withdrawal, conflicting flags, policy versions, server timestamps, invalid requests and cross-user controls. Registration screen submits processing acceptance/versions. Website DOM tests submit channel changes and full visible-channel withdrawal. API tests route consent decisions to `record_own_consents` and propagate failures. | An actual registration/preferences round trip on the released website/mobile app with the corresponding audit rows. No historical consent was invented. |

## Production boundary checks

Unauthenticated requests were sent to both `https://app.tshelo.com` and
`https://tshelo-admin.vercel.app`:

| Route | Result on both origins |
| --- | --- |
| POST `/api/v1/receipts/parse` | 401 JSON, `UNAUTHENTICATED` |
| POST `/api/v1/receipts/scan-completion` | **404 HTML** |
| PATCH `/api/v1/users/me` | 401 JSON, `UNAUTHENTICATED` |

The 401s demonstrate authentication guards, not successful authenticated
payment/consent/provider execution. The missing completion endpoint is the
first broken production receipt boundary; no claim of a passing released
scan-to-expense flow is made. Prior deployment/build provenance is recorded in
[the deployment inspection](receipt-and-waitlist-status-2026-10-15.md).

Aggregate live state after rollback tests:

- `receipt_scan_audit_log`: **0 rows, 0 completions**.
- `consent_log`: **0 rows**.
- Profiles with legacy plaintext bank/mobile-money numbers: **0**.

The SQL checks used synthetic fixtures and rolled them back. Their PASS results
do not populate real audit history or certify real acceptance/provider activity.

## Candidate fixes

- Website receipt selection now retains the parser's `audit_id`, including
  unrecognised images reviewed manually, and submits the reviewed vendor/items
  through `receipts.completeScan` before expense creation.
- Audit completion failures keep the form and prevent expense creation. After
  successful immutable completion, an expense-save retry skips completion;
  the website locks the confirmed inputs until save/reset. The mobile handler
  allows a matching retry and rejects changed values under the same completed
  audit snapshot. New scans/reset discard the prior pending state.
- Added a live-safe SQL receipt audit regression and a disposable-database CI
  step. Updated the CI guard test to validate every SQL command's local host,
  port and fail-on-error flag instead of assuming exactly two commands.

Audit completion and expense creation remain separate operations. Completion
records the confirmed review; it does not itself prove that expense creation
subsequently succeeded. The retry checks cover explicit API failures, not an
ambiguous network timeout after a server-side commit or a client restart.

## Validation evidence

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run verify` in `admin` | PASS: typecheck, lint (two existing unused-variable warnings), production build |
| Local production server smoke check | `/login` 200; parse/completion/profile mutation routes all 401 JSON without a bearer token |
| `npx expo export --platform ios --platform android --max-workers 2 --output-dir /private/tmp/tshelo-release-export-2026-10-16` | PASS; Hermes bundles generated for both platforms; no native binary or update published |
| `npm run release:preflight` | PASS; expected token-checkout-unavailable warning |
| Receipt handler + registration Jest suites | 10 tests PASS; the registration suite had one initial timeout under concurrent checks and passed on the isolated rerun and final run |
| Security screen Jest suite | 5 tests PASS |
| `npm run test:web` | 56 tests PASS, including 5 receipt and 2 consent-preference regressions |
| Focused API/security/CI suites | 22 tests PASS across profile security, financial API, profile/notification API, security remediation and CI workflow |
| `npm run test:consent-security` | PASS using the real migration in disposable PGlite |
| Live `supabase/tests/payment_identifier_encryption.sql` | PASS; fixtures rolled back |
| Live `supabase/tests/consent_audit.sql` | PASS; fixtures rolled back |
| Live `supabase/tests/receipt_scan_audit.sql` | PASS; fixtures rolled back |
| Full `npm run test:api-services` | **FAIL**: 277 tests pass, 2 fail in `mobileApiBoundary.test.ts` |
| `git diff --check` | PASS |

The remaining broad-suite failures identify direct Supabase usage in the
pre-existing uncommitted `lib/changePhone.ts` and
`screens/main/NotificationSettingsScreen.tsx` work. They were not allowlisted or
hidden to make the release gate pass. Resolve/isolate that work before approving
the full repository release. The obsolete CI command-count failure was fixed.

Docker-based full disposable-Supabase CI and manual authenticated browser/device
tests were not run here. DOM/handler tests use mocked transport; live SQL checks
exercise the database routines separately. The local built-server smoke check
only verifies routing and authentication guards. None is presented as one
complete authenticated UI → API → database → provider/device run.

## Remaining release sequence

1. Isolate/commit the reviewed release scope and resolve the two broader API
   boundary failures. Run required CI against that exact candidate.
2. Deploy the held web/API integration to the approved test/release destination
   and verify authenticated payment/consent requests there. Publish an approved
   mobile candidate with the matching receipt integration for device testing.
3. Scan a controlled receipt, change its vendor/item/amount, save it, and inspect
   one matching model/version/result/user-edits audit record plus saved expense.
4. Update synthetic bank/mobile details through the permitted flow; verify
   resets, owner notice, no client identifier exposure and device delivery.
   Complete ownership re-verification before treating that feature as closed.
5. Register a controlled user and change/withdraw communication choices; verify
   current server-timestamped consent events for that user. Keep the original
   receipt/consent review items open until this released-flow evidence exists.

No commit or push was made during these checks. New receipt fixes, tests and
this evidence remain local for review alongside the earlier uncommitted work.
