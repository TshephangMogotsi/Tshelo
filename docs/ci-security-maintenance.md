# CI security maintenance

## September 2026 CI failures

The root `Verify` workflow failed in two independent jobs:

- Database setup ran `supabase init` over the committed `supabase/config.toml`.
  The CLI refused to overwrite the file, so migrations and SQL tests never ran.
  The workflow now checks that the config exists and starts the disposable local
  stack with that config. It never links to or pushes migrations to production.
- `npm audit --audit-level=high` reported 11 high-severity dependency findings.
  The root causes were Browserslist, fast-uri, PostCSS, and image-size, with the
  latter two inherited by Expo/Metro packages. The audit gate remains mandatory.

Once setup was repaired, the database job exposed a third failure: the historical
`20260818132000_add_support_platform_admin.sql` one-off data grant required a
specific production user on an empty database. Its replay now returns without
granting access only when `public.users` is completely empty. Populated databases
still enforce the original missing/deleted/banned-user and active-super-admin
checks, and successful grants still write the attributed audit record.

This is a narrow replay correction to an already-applied data migration, not a
new production schema change. A later migration cannot fix an earlier replay
failure. Do not reapply it or repair/reset the hosted migration history: the
existing production grant is unchanged. `npm run test:db-bootstrap` exercises the
real grant and platform-admin schema in disposable PostgreSQL, including both
the empty-database case and all existing validation paths.

After migrations could run, the granular permission matrix exposed a fixture
error: it changed an admin membership's status while retaining its privileged
role and acting as that admin. The existing trigger correctly requires the
fund owner. The test now asserts that rejection, prepares the inactive fixture
as the owner, and switches back to the admin to verify access was revoked.
No production permission rule was relaxed.

## Compatible security updates

Expo remains on SDK 54 and React Native on 0.81.5. No SDK-major migration or
native release is part of this repair.

| Dependency | Previously locked | Updated |
| --- | --- | --- |
| Metro package family | 0.83.3 | 0.83.8 |
| Expo's PostCSS | 8.4.49 | 8.5.28 |
| Browserslist | 4.28.2 | 4.28.9 |
| fast-uri | 3.1.5 | 3.1.7 |
| xmldom | 0.8.13 / 0.9.10 | 0.8.15 / 0.9.12 |

Metro's [0.83.8 maintenance release](https://github.com/react/metro/releases/tag/v0.83.8)
replaces the vulnerable external image-size dependency with vendored parsers.
The Expo 54 wrapper pins Metro packages to 0.83.3, so `package.json` overrides
keep the whole Metro family on the same patched 0.83.x version. Do not upgrade
only `metro` and leave its related packages on older versions.

Expo's Metro config also restricts PostCSS to 8.4.x, excluding patched 8.5.x.
The override is scoped to `@expo/metro-config`. The
[upstream Expo issue](https://github.com/expo/expo/issues/45620) documents this
dependency-range problem; 8.5.28 also includes the later source-map fixes.

Keep these overrides until Expo's own compatible dependencies incorporate the
fixes. Re-evaluate them as part of a deliberate SDK upgrade. Do not use
`npm audit fix --force`: its proposed SDK-major changes require separate native
compatibility testing. Moderate advisories still need separate review; passing
the high-severity gate is not a claim that the dependency tree has no advisories.

## Verification

Run `npm ci`, `npm run verify`, `npm run bundle:size`, and
`npm audit --audit-level=high`. `verify` includes regression checks for the CI
configuration, reading existing assets with Metro, and bounded rejection of
malformed unsupported image data. The audit is not filtered or allowlisted.

The complete SQL integration jobs require Docker and run on GitHub Actions.
Mobile bundle exports do not replace the user's device smoke testing. Do not
launch a simulator for this release; the user is handling that check.
