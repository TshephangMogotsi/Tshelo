# Tshelo web deployment — 16 October 2026

## Deployed and verified

- Team/project: `diginav/tshelo-admin`, project
  `prj_JDpKznplQ4uuLQNB0Ioiqz5gkZ0L`; root directory `admin`; Node 24.x.
- Production URL: **https://tshelo-admin.vercel.app**.
- Promoted deployment: `dpl_B4vb5wA6jaEmnHpM92nAi58hbD9d`, READY.
- Immutable URL: https://tshelo-admin-9aof51s3l-diginav.vercel.app.
- [Deployment overview](https://vercel.com/diginav/tshelo-admin/B4vb5wA6jaEmnHpM92nAi58hbD9d).
- Source: pushed base `40423f432af5be99a03575243b3e5353acf6a169`
  plus the six-file [release patch](releases/2026-10-16-web-release.patch)
  and [file-hash manifest](releases/2026-10-16-web-release-manifest.json).
  This was an isolated CLI source deployment, not a new Git commit. The patch
  includes receipt review completion, consent onboarding, profile mapping/query
  corrections, and the website dependency manifest/lockfile security updates.
  Unrelated local support/mobile/UI changes were excluded.

The candidate was staged with `--prod --skip-domain`, checked, then explicitly
promoted. The canonical production alias remained on
`dpl_HqeWu5PNh6P7t4PBofFp5cSCUKzf` during staging. Vercel also assigned the
generated `tshelo-admin-diginav.vercel.app` alias during staging; that generated
alias is not evidence that a custom application hostname was updated.

### Checks

| Check | Evidence |
| --- | --- |
| Isolated patched candidate | Website typecheck, lint and production build passed; two existing unused-variable lint warnings |
| API/security tests after dependency changes | 280 tests passed |
| Website DOM tests after dependency changes | 56 tests passed |
| Login, privacy and terms pages on staged build | HTTP 200 |
| Receipt-completion route on staged build | HTTP 401 JSON, `UNAUTHENTICATED`, without a bearer token |
| Public browser configuration | Expected project `albihofmlafjzbusancu.supabase.co` found |
| Browser credential scan | Nine staged JavaScript bundles; no privileged Supabase keys found |
| Runtime error inspection | Zero error records returned for the deployment in the checked 15-minute window before and after promotion |
| Post-promotion canonical login | HTTP 200 |
| Post-promotion canonical receipt completion | **HTTP 401 JSON, replacing the previous 404**; request `6612e098-0184-4d72-86ed-a4f974232b17` |
| Post-promotion canonical profile mutation | HTTP 401 JSON without a bearer token |

These unauthenticated checks establish deployed routing and guards. They do not
prove authenticated receipt/provider/payment/consent success or device delivery.

## Dependency security correction

The first staged build surfaced website advisories absent from the prior
root-package-only audit: one critical, nine high and one low finding. That
candidate (`dpl_ErRqQ2oU2exJiVaSXKzyFczyscXN`) was not promoted to the canonical
production alias. Compatible updates were applied and retested before the
replacement deployment above was promoted.

The final website uses Next.js/eslint-config-next **16.4.2**, with patched
transitive runtime packages including Sharp and DOMPurify. The final
`npm audit --omit=dev` result is **zero vulnerabilities**. Five high findings
remain in the development-only ESLint glob/braces dependency chain. npm's
suggested forced major downgrade was not applied. This is a clean runtime
audit, not a claim that the complete development dependency audit is clean.

Added a repository CI gate:
`npm audit --prefix admin --omit=dev --audit-level=high`.
The original root high-severity audit gate remains mandatory.

## Mobile application hostname remains unresolved

**https://app.tshelo.com still returns HTTP 404 for receipt completion.** Its
post-deployment profile mutation guard returns 401 JSON, but that does not link
it to this deployment.

- The logged-in account exposes only the Diginav team.
- This project's domain API lists only `tshelo-admin.vercel.app`.
- Diginav alias inspection does not list `app.tshelo.com`.
- Vercel cannot resolve that hostname to a deployment in this team, and domain
  inspection denies access in this scope.
- Public DNS CNAME: `ee020edb11b50d8e.vercel-dns-017.com.`

The mobile configuration still references `app.tshelo.com`. Its owner/correct
replacement hostname was requested from the user. No DNS, domain transfer,
mobile API-base change, EAS build, OTA update or store release was performed.
The original mobile-host 404 issue is therefore **not fully closed**, despite
the fixed endpoint on the project we can deploy.

## Approved live QA passed; device checks remain open

After the initial automatic review rejection, the user explicitly approved the
labeled synthetic live QA run. It was executed using a normal authenticated
QA session against this promoted deployment. Profile protection, all three
consent regressions, encrypted payment changes/reset/owner notice, actual
provider receipt parsing, reviewed completion and expense creation passed.
The retained receipt audit contains model/version/result/reviewed edits and a
completion timestamp. Nine synthetic consent entries were created.

The QA identity/profile are banned, its password replaced, its fund completed,
and independent database inspection confirmed zero sessions and refresh tokens.
Records remain clearly labeled and retained as approved. These results do not
establish customer consent history or device/SMS/push delivery. No historical
consent was backfilled. Full [live QA evidence](live-qa-verification-2026-10-16.md)
and [sanitized request/fixture evidence](releases/2026-10-16-live-qa-evidence.json).

Released-device checks still require a controlled device and resolution of the
mobile application's hostname. Existing rolled-back SQL evidence remains in the
[release-check report](release-checks-2026-10-16.md).

The deployment source changes, updated patch/manifest and this evidence are local
and uncommitted; no Git push was made during deployment.
