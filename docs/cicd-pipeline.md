# CI/CD pipeline

CI runs on every pull request and push to main. `CI / Release readiness` succeeds
only when the application/security/audit checks, disposable SQL suites, website
build/API checks and all five real MFA browser scenarios succeed. It fails for
failed, skipped or cancelled dependencies. No hosted Supabase credentials enter CI.

`Release` is a manual workflow for main only. It requires the latest CI push run
for that exact current main commit to pass, then waits for the relevant protected
GitHub environment approval. The commit is rechecked after approval. Nothing
in this change deploys production automatically or applies hosted migrations.

## Activation

Deployments are deliberately disabled: repository variable RELEASES_ENABLED is
false, and no deployment secrets were added. CI remains active. Enable releases
only after completing the setup below and explicitly deciding to activate them.


- Protect main with the `Release readiness` check and require pull requests.
- Configure `production-web` and `production-mobile` with an approval reviewer
  and deployment branch restricted to main. Initially the repository owner is the
  reviewer; self-review is permitted so the sole configured maintainer can operate.
  Nominate a second reviewer for independent approvals when available.
- In production-web set VERCEL_ORG_ID and VERCEL_PROJECT_ID to the verified
  Diginav / tshelo-admin project IDs. Store VERCEL_TOKEN as an environment secret.
- For protected Vercel deployment URLs also store VERCEL_AUTOMATION_BYPASS_SECRET
  as an environment secret. Smoke requests fail closed if protection blocks them.
- Store EXPO_TOKEN in production-mobile. Existing Expo signing credentials and
  production environment values must be configured in EAS for the chosen platform.
- Set repository variable RELEASES_ENABLED to true only after release authorization.
- Merge this branch and verify main's entire CI run before dispatching Release.
- Coordinate MFA admin enrollment, recovery arrangements and the matching database
  migration before approving a production release containing MFA enforcement.

## Web/API release

Select `web`. The pinned Vercel CLI pulls production configuration, builds and
stages production with `--skip-domain`. It checks login HTML and unauthenticated
API rejection on that exact staged URL, then promotes that same build. A failed
build or smoke check prevents promotion. No secret-bearing build directories are
uploaded. The Vercel project was verified as tshelo-admin, with root directory
admin; inspection showed no Git repository link, so no parallel Git auto-release
was found at setup time. Recheck this if the project is later linked to Git.

The staged smoke check is deliberately limited; real authenticated MFA behavior
is proven by disposable CI, and production enrollment/recovery still require
coordinated operational checks. GitHub records the released SHA and URL.

## Mobile

Select `mobile-android` or `mobile-ios`. The pinned EAS CLI builds the production
profile and waits for the native build result. A successful trigger alone does
not count as a successful build. No store submission or OTA update is performed.
Device QA and store release approval remain separate steps. Build environment
values and signing credentials are managed in EAS, not committed to Git.

## Recovery

Before release, record the current production deployment URL from the verified
Vercel project. If a release fails after promotion, inspect that project's known
previous production deployment and run `vercel rollback <verified-deployment-url>`
from its linked repository context. Confirm the owner/project first. Rollback
can disable future automatic domain assignment; resume through explicit promotion.
An app rollback does not undo Supabase migrations: review database compatibility
and restore decisions separately. Never reset the hosted database to roll back.
For mobile, retain the previous approved store version; this workflow never
submits a new build or publishes an OTA update automatically.

## Evidence and limits

The release-gate tests reject wrong commits, forks, PR runs, unrelated workflows,
failed/pending runs and reuse of a superseded success. Workflow definitions are
validated before push; the combined GitHub run is the integration evidence.
Deployment activation and a production release rehearsal require environment
secrets and explicit approval. Preparing these workflows is not evidence that a
production deployment or native build has run.

## Verification status — 23 October 2026

PR #2: https://github.com/TshephangMogotsi/Tshelo/pull/2
The first combined run passed the full application verification and size checks,
website build/API checks, website runtime audit and all five MFA scenarios. The
root dependency audit correctly failed, and the disposable consent test exposed
a missing explicit SELECT grant. A follow-up migration declares that grant while
retaining own-user RLS and denying direct writes; compatible lockfile updates
remove the fixable findings.

The two remaining upstream vulnerabilities are addressed by reviewed source fixes:

- `braces`: local unpublished `@tshelo/braces` fork, packaged as a committed
  integrity-locked tarball. Upstream proposed fix:
  https://github.com/micromatch/braces/pull/88 at
  `a795ee83ecd011131b2d618fe754ac5a8e124dae`. It bounds parser nesting and validates
  all supplied ASTs for safe depth and cycles before recursive traversal.
- `node-forge`: upstream source archive pinned to
  `85446800199c4995d3cd4b0ab5a8409df4455859`, proposed fix
  https://github.com/digitalbazaar/forge/pull/1161. Compared with the installed
  registry release, the runtime library changes only `lib/rsa.js`: reject extra
  nested DigestAlgorithm elements and nonempty NULL parameters.

These are proposed upstream patches, not released or merged upstream versions.
The project temporarily owns their review and maintenance. No audit threshold,
branch requirement or advisory allowlist was weakened. The local fork has a new
package identity, so npm cannot monitor its original advisory identity; source
integrity and explicit vulnerability regression tests are mandatory in CI.

Six regression checks fail against the original vulnerable packages and pass
against the patched sources. Ten focused checks cover those failures, normal
globs and ASTs, canonical RSA signatures, altered-message rejection and real
Expo certificate/signing compatibility. Tests also check all locked copies,
source/archive integrity and actual dependency consumer resolution.

Replace these pins with compatible official releases after the fixes are
published and verified. Do not remove the regression tests when updating.
Deployments remain explicitly disabled. PR #2 must pass combined CI before merge.

## Merge evidence — 23 October 2026

All required checks passed for commit `0237145059a1eb9cf370bb12b1511c538b60adb2`:
https://github.com/TshephangMogotsi/Tshelo/actions/runs/39930444483
PR #2 merged through normal branch protection as
`504467cc476770d529eb57191e938939c58beafa`. The shared workspace was updated
to the locked fixes; all 27 dependency-security checks passed there too.
RELEASES_ENABLED remains false. No production deployment was triggered.

Post-merge CI on main passed every job, including Release readiness:
https://github.com/TshephangMogotsi/Tshelo/actions/runs/39931004084
The two dependency blockers are resolved using the documented temporary source
fixes; replace them after compatible official patched releases are verified.

## EAS signing inspection — 23 October 2026

Read-only Expo metadata confirms the linked project is @digital-natives/tshelo
(project a0f76b53-0427-41d9-b5a1-a59024570558). Android com.tshelo.app has a
default build credential with a JKS keystore. iOS com.datasentinels.tshelo has
APP_STORE and AD_HOC credentials, each with a certificate and active provisioning
profile. Both certificate/profile pairs expire on 13 April 2027 at 10:21:43 UTC.

Only presence/status/expiry metadata was queried; no private keys, passwords or
credential files were retrieved. No credentials were changed and no build started.
This verifies stored EAS configuration, not current Apple portal revocation status
or a successful native build. A later approved build must verify actual usability.
GitHub secret names have been confirmed in their intended environments; their
values/authentication have not been exercised. Releases remain disabled.

## Native signing-build results — 23 October 2026

Both production-profile EAS builds from tested main commit 504467c finished
successfully with artifacts: Android 1.0.1 build 13 (68716f37-f58b-45ab-b340-3ca7286098c3),
iOS 1.0.1 build 10 (e6d80f7a-3924-41eb-a449-a1615fc31d83). Signing credentials
were frozen during the builds. Device runtime, GitHub-secret authentication and
store submission remain outside this evidence. No OTA publication was performed.
Sanitized results: releases/native-signing-builds-2026-10-23.json.

## Approved CD activation — 23 October 2026

The user explicitly approved enabling releases, publishing tshelo-admin through
GitHub, and validating both native workflows without store submission.
RELEASES_ENABLED is now true. PR #4 fixed an invalid tracked local-worktree gitlink
that blocked checkout with persisted credentials disabled; it also preserved
the hash-verified live waitlist/receipt/consent behavior, passed the Vercel token
to the build step, froze EAS credentials, and separated target concurrency.
All required main CI passed for ce840092a401b3b8932f21e46ee000c07ce279fe.

Approved workflow runs:
- Web: 39970691828 — failed at production configuration pull with Vercel project/team authorization error (403); no staging or promotion occurred. A Diginav-team-scoped VERCEL_TOKEN replacement has been requested.
- Android: 39970697522 — authenticated using GitHub EXPO_TOKEN and submitted EAS build 5e7d075b-3ab1-4ee1-89f9-c75d9550cc52 (build 14); completion pending.
- iOS: 39970703090 — authenticated using GitHub EXPO_TOKEN and submitted EAS build a58374a5-1aec-4cb3-8a8b-55d62a01d337 (build 11); completion pending.

Each run reached the configured approval gate and was approved using the user's
explicit authorization. The previous live deployment remains
dpl_6RCb45M48KH64ZdEYKYi4DcEotR5, with tshelo-admin.vercel.app and
tshelo-admin-diginav.vercel.app aliases. Web CD is not yet validated; do not
report overall CD completion until the credential correction and runs pass.

Latest checkpoint: the replacement Diginav-scoped VERCEL_TOKEN passed configuration pull. Web attempt 2 is building its production candidate; Android is still running; the iOS GitHub workflow passed. Monitoring stopped at the user’s request to conserve usage. The approved web workflow will continue through smoke tests and promotion automatically if those checks pass. Final live deployment and Android results still need confirmation.

Follow-up check: web workflow 39970691828 completed successfully, including candidate smoke tests and production promotion. iOS workflow 39970703090 passed; Android workflow 39970697522 remains in progress.

Final workflow check: Android run 39970697522 completed successfully. Web, Android and iOS release workflows have now all passed on ce840092a401b3b8932f21e46ee000c07ce279fe. Web was promoted to production; mobile builds were not submitted to stores. Device testing remains separate.
