# Event files: Phase 5 verification

Date: 2026-09-08. Scope: the local, uncommitted event-files implementation.

Story: an event participant opens Files, a permitted event manager uploads an
image or PDF through the shared API and private storage, and participants can
preview/download published files while completed events stay read-only.

## Results

| Check | Result | Evidence and scope |
| --- | --- | --- |
| Mobile/shared typecheck | Passed | `npm run typecheck` |
| Main Jest suite | Passed | 49 suites, 378 tests; includes mobile Files components/hooks, shared recovery, contracts, API-boundary and migration policy tests |
| API service/route tests | Passed | 2 suites, 45 tests; caller-scoped Supabase operations mocked |
| API-verifier self-tests | Passed | 7 tests |
| Web UI integration | Passed | 16 DOM tests for the real workspace/viewer/hooks, with mocked API and Storage responses |
| Database/RLS | Passed | 247 assertions executing both migrations and existing permission helpers with PGlite |
| Website typecheck/lint/build | Passed | `npm --prefix admin run typecheck`, `lint`, and `build`; all four Files API routes included in the build |
| Running local API | Passed, limited scope | 99 HTTP checks against the rebuilt server: missing/invalid credentials rejected with 401, consistent error envelopes and no-store headers |
| Authenticated HTTP verifier | Not run | `API_ACCESS_TOKEN` and `API_ADMIN_ACCESS_TOKEN` were not set |
| Native bundle export | Passed | Expo exported both iOS and Android Hermes bundles without launching a simulator |
| Local browser | Partial | Files deep link redirects to sign-in and preserves `next`; sign-in page rendered with no warning/error console entries. Signed-in Files flow awaits user login |
| Hosted browser | Blocked at UI | The signed-in deployed event workspace showed Overview, Guests, Updates, Budget and Settings, but no Files tab, even with `?tab=files` |
| Device smoke | User-owned | User requested no simulator; native preview, file picker and OS share/save still require device testing |

`npm run verify` now includes the database suite using a pinned, lockfile-backed
`@electric-sql/pglite` dev dependency, so no separate temporary installation is
needed for repeat runs.

## Access matrix tested

These are actual database permission-helper and RLS assertions, not live accounts.
The matrix covers file metadata and Storage-object visibility, upload-session
ownership, forbidden direct writes, reservation and removal permissions.

| Actor | Active: read | Active: add/remove | Completed: read | Completed: add/remove |
| --- | --- | --- | --- | --- |
| Event creator | Yes | Yes | Yes | No |
| Active organiser | Yes | Yes | Yes | No |
| Event guest | Yes | No | Yes | No |
| Joined linked-fund member | Yes | No | Yes | No |
| Joined delegated admin with `post_event_announcements` | Yes | Yes | Yes | No |
| Joined admin with another grant only | Yes | No | Yes | No |
| Pending organiser | No | No | No | No |
| Removed fund member with stale grant | No | No | No | No |
| Outsider | No | No | No | No |

Additionally tested: anonymous denial, unrelated standalone events, grant
revocation during upload, cancelled/deleted events, legacy-file backfill and the
unchanged permission key with its new label. Pending-upload cleanup and retries
of already-confirmed deletion remain possible after completion or grant loss.

## Security and failure coverage

- PDF/JPEG/PNG/WEBP and the exact 10 MB boundary; unsupported HTML/ZIP/SVG,
  oversized/empty/invalid sizes, malformed filenames and forged ownership fields.
- Ten-file quota across published files and unexpired reservations; discarded
  and expired reservations release capacity.
- Cross-event IDs, cross-uploader paths, traversal, extension/bucket substitution,
  unpublished-object access, immutable metadata and prohibited direct Storage
  deletion/overwrite.
- Missing uploaded bytes and mismatched Storage MIME/size; guarded finalisation
  cleanup, rejected signing, transfer failure, physical deletion failure and retry.
- Idempotent finalisation, lost responses, partial batch success, gallery/PDF
  access, viewer zoom/download, deletion confirmation, read-only and retry states.
- API-only client boundaries on both platforms, no public file URLs, no bearer
  token on the signed binary transfer, and short-lived signed access by file ID.

One recovery defect was reproduced and fixed in Phase 5. Previously, both a lost
finalisation response and a failed pending-only cleanup check could produce
`cleanup_pending`, inviting a normal DELETE of a file that might already have
published. The service now distinguishes a confirmed cleanup claim from an
unknown outcome. Unknown outcomes return retryable `INTERNAL_ERROR`; the shared
client keeps **Check upload** and the same ID. Regression tests cover rejected and
thrown claim errors, a confirmed claim followed by thrown Storage deletion, and
safe shared-client reconciliation without deletion or a second transfer.

## Remaining live checks

The full-story/browser verification workflow stopped at the first unavailable
boundary in each environment. No deployment, hosted migration, upload, deletion,
or production-data mutation was performed during this verification.

1. Apply the two event-files migrations and deploy the matching API/website in an
   approved test environment. Their hosted status has not been verified here.
2. Sign in to the local/test website. With disposable test events and the five
   requested roles, check gallery/PDF reads, permitted add/delete, forbidden
   mutations, preview/download, refresh, and completed-event read-only behaviour.
3. Exercise actual Storage HTTP uploads at and above the limit, unsupported MIME,
   incorrect paths and overwrite attempts; confirm bytes are removed after failed
   finalisation/deletion retries. Confirm private objects have no public access.
4. Run simultaneous upload reservations and finalisation/removal requests against
   real independent PostgreSQL connections. PGlite verifies locks in the SQL and
   sequential outcomes, not true multi-connection races.
5. User device checklist: add images and a PDF, switch tabs during upload, reopen,
   zoom and step between images, open PDF, save/share, cancel/confirm deletion,
   interrupt/retry upload, then verify completed-event read-only behaviour.

The local Supabase stack could not run because no Docker/Podman runtime was
available. The database fixture uses a minimal surrounding schema and simulated
Storage metadata, so its passing checks are not a hosted end-to-end claim.

Operational follow-ups remain as documented in [the API guide](event-files-api.md):
MIME checks are not malware scanning, issued signed URLs may live until expiry,
and abandoned/late uploads need a periodic orphan-object sweeper.

Dependency installation also reported 33 audit advisories (22 moderate, 11 high)
for the overall root dependency tree. They were not triaged or automatically
updated in this feature verification; this report is not a dependency-audit
clearance.
