# CI/CD and production-build evidence — 23 October 2026

**Scope:** GitHub Actions release workflows and the native production-profile
builds created from commit `ce840092a401b3b8932f21e46ee000c07ce279fe`.
GitHub run status and Expo build metadata were checked on 28 October 2026.

| Target | GitHub Actions run | Result | Build |
| --- | --- | --- | --- |
| Web | [Release run 39970691828](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970691828) | Success; promoted to production | `ce84009` |
| Android | [Release run 39970697522](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970697522) | Success; Expo build finished | Version 1.0.1, build 14 |
| iOS | [Release run 39970703090](https://github.com/TshephangMogotsi/Tshelo/actions/runs/39970703090) | Success; Expo build finished | Version 1.0.1, build 11 |

The web release was promoted to **https://tshelo-admin.vercel.app**. That site
has received subsequent updates, so its current contents are not necessarily
the same as the 23 October release.

The native builds are recorded in Expo:

- [Android build 14](https://expo.dev/accounts/digital-natives/projects/tshelo/builds/5e7d075b-3ab1-4ee1-89f9-c75d9550cc52)
- [iOS build 11](https://expo.dev/accounts/digital-natives/projects/tshelo/builds/a58374a5-1aec-4cb3-8a8b-55d62a01d337)

The 23 October workflows built the native artifacts but **did not submit them to
Google Play or TestFlight**. A later, separate upload has not been verified.
Successful builds do not establish that the builds were installed or tested on
devices. Store distribution and device testing require separate evidence.

Supporting project records: [CI/CD pipeline](../cicd-pipeline.md) and
[CD activation evidence](cd-activation-2026-10-23.json).
