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
