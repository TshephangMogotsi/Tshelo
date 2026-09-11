# Web → mobile feature tracker

Updated: 2026-09-10.

Track web-first changes here until their native UI and device verification are
complete. This is a forward-looking handoff, not a full audit of older platform
differences. Keep shared API behaviour consistent; do not build a separate mobile
storage or permissions path.

## Status

| Feature | Website | Shared API/database | Mobile |
| --- | --- | --- | --- |
| Event banner and focal point | Deployed 2026-09-10 | Banner and focal-point migrations hosted; shared typed API deployed | Implemented locally 2026-09-10; physical-device smoke pending |
| Event-wide Files tab (existing baseline) | Already implemented | Existing private file lifecycle reused by banners | Already implemented; not a new porting task |
| Event-list hover highlight | Deployed 2026-09-10 | No API/database changes | Web-only hover correction; no native UI change required |
| Low-data event images | Deployed 2026-09-10 | Optional private preview URLs deployed on the signed-access response | Implemented locally 2026-09-10; physical-device data-use verification pending |
| Event schedule details | Deployed 2026-09-10 | Schedule migration hosted; typed response/update fields deployed | Implemented locally 2026-09-10; physical-device calendar/layout verification pending |
| Pinned urgent update | Deployed 2026-09-10 | Atomic single-pin migration and typed API hosted | Implemented locally 2026-09-10; physical-device role/offline verification pending |
| Personal allowance and RSVP entry | Deployed 2026-09-10 | Caller-scoped allowance migration and RSVP API hosted | Implemented locally 2026-09-10; physical-device invitation/deep-link verification pending |

## WEB-001 — Private event banner

### Website behaviour to port

- One wide cover image above the event workspace tabs, visible across tabs.
- Creators, active organisers and delegated admins with
  `post_event_announcements` can add/change/remove it while the event is active.
  The existing permission label is “Manage event updates and files.”
- Choose an existing image from Files or upload one new JPG, PNG or WEBP, up to
  10 MiB (shown as 10 MB). New images consume one of the event's ten file slots;
  existing images can still be selected when the quota is full.
- Wide 4:1 presentation with a responsive 150–250 px web height. Organisers can
  click/drag an important point on a full low-data preview or use accessible
  horizontal/vertical range controls. Every crop uses that normalized point;
  preview still opens the original with the existing zoom/download viewer. This
  is display positioning only: original image bytes are never rewritten.
- Changing/removing a banner keeps the previous image in Files. Removing the
  banner requires confirmation. Deleting the underlying file also clears the
  banner, and its deletion confirmation explicitly warns about this.
- Organisers see an add-banner placeholder when none is set. Read-only viewers
  with no banner do not get a blank banner panel. With a banner, guests and
  linked-fund members can preview/download but cannot edit. Completed/cancelled
  events show the existing image with a read-only notice.
- Upload, saving, success, image-load failure/retry and API-failure states are
  explicit. A rejected change does not clear the previous database selection.
- Failed/uncertain uploads use the existing Files recovery controls. A published
  image remains in Files if selecting it as the banner fails; retry selection
  without re-uploading or deleting potentially successful work.

### Shared contract and integration

`EventWorkspace.files` contains `EventFile.is_banner` plus optional normalized
`banner_focal_x` and `banner_focal_y` values from 0 through 1. These are optional
in TypeScript for rolling compatibility; treat a missing coordinate as `0.5`.
No new workspace request or permanent/public image URL is needed.

```ts
const workspace = await api.events.workspace(eventId)
const banner = workspace.files.find(file => file.is_banner) ?? null

// Display/preview: obtain fresh private access, never persist this signed URL.
if (banner) await api.events.createFileAccess(eventId, banner.id)

// Select an existing published image, or use the file returned by finalisation.
await api.events.updateBanner(eventId, {
  file_id: imageFile.id,
  focal_x: 0.35,
  focal_y: 0.42,
})

// Remove only the banner selection, preserving the image in Files.
await api.events.updateBanner(eventId, { file_id: null })
```

The `PATCH /api/v1/events/{eventId}/banner` response contains
`{ file_id: string | null, focal_x: number, focal_y: number }`. Both coordinates
must be supplied together, are bounded to `0..1`, and default to the centre when
omitted. The database rejects cross-event, missing, pending-upload and PDF IDs,
unauthorised users, invalid coordinates and inactive events. Selection is atomic
and repeatable; only one file per event can be a banner. Direct authenticated
writes to the banner flag or focal columns are not granted.

Upload sequence is unchanged: create upload session → binary PUT → finalise →
select the returned file ID. Use the existing shared upload state machine for
ownership, limits, cleanup and uncertain-finalisation recovery. Do not send an
API bearer token with the signed Storage PUT.

Banner bytes remain in private `event-files` storage. Signed read URLs last five
minutes. `Event.cover_photo_url` is deliberately unused; public invitation pages
and event-list cards are outside this increment. MIME metadata validation is not
malware scanning; existing orphan-cleanup and signed-URL expiry limitations in
[the file API guide](event-files-api.md) still apply.

### Mobile implementation checklist — code complete; device sign-off pending

- [x] Add the banner as the first item in the scrollable native Overview in
  `screens/main/EventDetailScreen.tsx` without duplicating it on task tabs.
- [x] Derive the selected image from the screen-level file state, treating a
  missing `is_banner` as false. Reconcile it on workspace reload and file deletion.
- [x] Reuse native Files manager permissions and lifecycle. Add typed
  `events.updateBanner` handling and update local file flags only after success.
- [x] Support choose-existing and single-image upload; validate before upload,
  retain quota limits, and keep failed/uncertain work in Files recovery.
- [x] Reuse native attachment access, preview/zoom and OS download/share behaviour.
- [x] Apply `banner_focal_x`/`banner_focal_y` to the native image crop, defaulting
  to centre for older responses. Add a full-image point picker with accessible
  alternatives that works for touch and screen readers.
- [x] Add confirmed banner removal and a banner warning to underlying file deletion.
- [x] Match empty, busy, failure/retry, success and read-only states; disable
  conflicting operations and preserve work while switching tabs.
- [x] Add native component/hook regressions for selection, upload, failure,
  confirmation, deletion and all permission/completion states.
- [ ] User-owned iOS/Android device smoke: picker, image crop, zoom, share/save,
  narrow/large-text/dark-mode layouts, connection interruption and resume.
  Do not launch a simulator unless the user changes that instruction.

### Reference files

- Web UI: [event-banner.tsx](../admin/components/account-events/event-banner.tsx),
  [workspace](../admin/components/account-events/event-workspace.tsx),
  [Files hook](../admin/components/account-events/use-event-files.ts),
  [shared viewer](../admin/components/account-events/event-attachments.tsx).
- Shared: [contracts](../shared/contracts/events.ts),
  [API client](../shared/api-client/client.ts),
  [upload recovery](../shared/event-files.ts).
- Database: [event banner migration](../supabase/migrations/20260908120000_event_banners.sql)
  and [focal-point migration](../supabase/migrations/20260909140000_event_banner_focal_points.sql).
- API: [route](../admin/app/api/v1/events/[eventId]/banner/route.ts),
  [data operations](../admin/lib/data/api-event-files.ts).

### Verification and rollout

Local regression coverage includes the real web workspace/hook/viewer with mocked
API/Storage responses, typed API route/service tests, shared client serialization,
API-boundary checks and real migration execution in isolated PGlite. The banner
DB tests cover creator/organiser/delegated-admin writes, guest/member reads,
outsider/anonymous denial, cross-event/pending/PDF rejection, atomic replacement,
bounded focal coordinates, direct-update denial, clear-without-deletion,
underlying file deletion and completed/cancelled events.

These are not live multi-account Storage tests or a native-device sign-off.
No simulator has been used. The hosted banner migration was applied on
2026-09-09; the matching API/website was deployed on 2026-09-10.

Local results on 2026-09-08:

| Check | Result |
| --- | --- |
| Root/shared and website typechecking | Passed |
| Main Jest suite | 52 suites / 390 tests passed |
| API route/service regressions | 59 tests passed |
| Web DOM integration | 35 tests passed, including 19 banner cases |
| Isolated PostgreSQL migration/RLS tests | 311 assertions passed |
| API-verifier self-tests | 7 passed |
| Website lint and production build | Passed; banner PATCH route included |
| Rebuilt local HTTP API | 101 missing/invalid-credential checks passed |
| Local connected browser | Event URL redirects to rendered sign-in page, preserving its return path |
| Signed-in browser/Storage and native device smoke | Pending; automated API, component, bundle and migration checks passed |

During the initial 2026-09-08 verification, no production mutations were performed.
Browser inspection stopped at sign-in;
the banner interactions above were exercised in DOM integration tests, not
claimed as a signed-in browser pass. Authenticated HTTP verifier suites were
skipped because test access tokens were not supplied.

Rollout order: apply `20260908120000_event_banners.sql` after the two existing
event-files migrations, then `20260909140000_event_banner_focal_points.sql`, then
deploy the matching API/website. The file-list API selects the new columns, so
both database changes must precede the matching API deployment.
Existing native clients continue to use Files and may ignore the extra field.
Complete signed-in browser/Storage smoke tests in an approved test environment;
test replacing/removing banners while another session deletes a file or completes
the event (independent-connection concurrency is not simulated by PGlite).

### 2026-09-09 — Approved hosted database rollout

Opening an event locally failed with PostgreSQL `42703` because the local API
selected `event_files.is_banner` before its migration had been applied. A zero-row
REST check confirmed `column event_files.is_banner does not exist`. The local
website uses the hosted `albihofmlafjzbusancu` Supabase project.

With explicit user approval, applied only `20260908120000_event_banners.sql` to
that project. A dry run first confirmed it was the sole pending migration; no
seed data, role files, or vault secret updates were included. Another dry run
afterwards reported the database up to date. The 311 isolated database assertions
passed again before application.

Read-only hosted verification confirmed:

- `is_banner` is a non-null boolean defaulting to false; migration history records
  version `20260908120000`.
- The image-only constraint and unique one-banner-per-event index are valid.
- File RLS remains enabled and the bucket remains private.
- Authenticated direct updates of `is_banner` are denied; the existing filename
  rename grant remains available.
- The banner RPC is executable by authenticated users, not anonymous users; its
  internal event/permission checks remain unchanged from the tested migration.
- The same anonymous zero-row REST query now reaches the expected permission
  denial (`401` / `42501`), rather than the missing-column error.

No event records or file objects were deleted, and no banner was selected as a
test. Browser reconnection failed twice with a native-pipe startup error, so the
user was asked to refresh the event page. A signed-in browser pass is not claimed.
The local server remains available at `http://127.0.0.1:3100`. No application
deployment or Git push was performed in this rollout.

### 2026-09-10 — Native implementation and focal-point rollout

Implemented the native banner, low-data image, schedule, pinned-update and
enhanced RSVP flows described below. The banner focal-point migration
`20260909140000_event_banner_focal_points.sql` was the only pending linked
database change; an approved dry run confirmed its scope before application,
and the linked migration list now matches the repository through that version.

The complete automated verification suite and production Expo exports pass.
A local connected-browser preview also rendered the mobile web bundle without
an error overlay. Signed physical-device testing, signed Android/iOS artifacts
and store-console submission remain account-owner release steps.

## WEB-002 — Subtle event-list highlight

On 2026-09-09, replaced the event row's hard-coded near-white hover background
with a 6% purple tint mixed into the current theme's card surface. This keeps the
highlight restrained in light and dark mode, preserves readable text, and leaves
the existing keyboard-focus outline unchanged. Regression checks cover the tint
strength and title/secondary-text contrast in both themes.

This is a web-only hover fix, not a new mobile feature. When adjusting native
pressed/focused row states later, preserve the same subtle treatment and text
contrast; there is no desktop hover interaction to port.

## WEB-003 — Event workspace overview hierarchy

On 2026-09-09, redesigned the website event workspace around the existing event
flow. A compact schedule strip and event identity block sit above the existing
Overview, Guests/RSVP, Updates, Files, Budget and Settings tabs, placing the date,
time, venue, event name, type, code, status, description and role-appropriate
actions together. Organisers and delegated guest managers can copy the invitation
code or share the event invitation; attendees are taken to the existing RSVP
flow. Settings remains available through its tab rather than a duplicate top-card
button. The top identity card is the website's only event-link sharing control;
duplicate copy-link actions were removed from Guests, Settings, and event cards
on the account Overview. Native sharing sends the canonical URL without adjacent
prose so share targets cannot append copy to the code path. The invitation route
also narrowly recovers links previously malformed with Tshelo's former
“Join … on Tshelo” suffix while keeping general code validation strict. Fund
invitation controls are unchanged.

The compact private banner is the Overview's first full-width item and is not
repeated on task-focused tabs. The two-column content beneath it uses a main
column for the latest update and key budget/fund values. The right rail contains
confirmed, pending and invited counts, initials for up to five confirmed guests,
a location card with an external Google Maps action, and up to four private event
images. The gallery reuses the signed preview/download viewer and opens the
existing Files tab for the full collection. No embedded map, new public image
URL, new API endpoint or change to event permissions was introduced. Events
without a banner receive a shorter, themed fallback so the hierarchy remains
intentional without pushing the useful overview cards too far down the page.
Desktop tab panels share a responsive 620px/68vh minimum canvas so switching
between sparse and populated sections does not sharply resize the page; content
can still grow naturally, and the minimum is removed on small screens.

Mobile parity checklist:

- Keep the existing native tab/navigation flow and reuse the shared workspace
  response; do not create a separate overview API.
- Add the compact schedule and identity hierarchy above native event navigation,
  including invitation-code copy and Share invite for authorised managers, plus
  RSVP for attendees; keep Settings in native navigation instead of duplicating it.
- Share the canonical invitation URL as the URL payload without adjacent prose,
  and regression-test the exact generated value through the receiving join flow.
- Place the private banner first within the native Overview rather than repeating
  it across task screens; keep its vertical footprint secondary to event content.
- Stack the latest update, budget, attendance, location and gallery cards in that
  priority order; do not reproduce the website's two-column layout on phones.
- Reuse the existing native private-file preview, zoom, download and sharing
  behaviour for the first four images and route “View all” to Files.
- Generate guest initials locally until the shared guest contract intentionally
  exposes participant avatars; do not derive or fetch profile images indirectly.
- Open an external map search from coordinates or the saved venue/address and
  continue to avoid an embedded map until its privacy and consent model is set.
- Preserve completed/cancelled read-only behaviour and every existing creator,
  organiser, guest, linked-fund-member and delegated-admin permission boundary.

Website regression coverage checks the hierarchy, preview content, safe external
map link, organiser actions, attendee RSVP action and Files-tab navigation.

The native hierarchy was implemented locally on 2026-09-11. The existing
workspace response now drives the banner-first phone stack, with the compact
schedule followed by latest/pinned update, budget, attendance, location and
gallery cards. The gallery requests no more than four private low-data previews,
does not fall back to original objects, and opens the existing full viewer or
Files tab. Guest initials are generated from event guest names only. Invitation
code and sharing controls now live in the event identity area for authorised
managers, while attendees receive the existing RSVP action. Native event sharing,
including the post-creation action, now sends only the canonical invitation URL.
Completed and cancelled events expose no invitation, announcement, banner/file,
budget-editing or completion actions from this screen; existing leave/delete
rules are unchanged.

TypeScript and the full native/shared Jest run passed after the change (68 suites,
447 tests). Component coverage checks card order/actions, up-to-five confirmed
guest initials, the four-image cap, signed thumbnail use, no original-image
fallback, retry behaviour and empty/read-only states. Shared invitation coverage
verifies that the exact native payload parses back into the event join route.
Physical-device visual, external Maps, share-target and RSVP smoke testing remains
pending and is not claimed here.

## WEB-004 — Low-data event images

On 2026-09-09, event-wide web images stopped using original private objects as
their thumbnails. The existing signed-access response now optionally includes a
480×360 quality-55 gallery URL and a width-bounded quality-60 banner URL of up to
1280 pixels. The banner source aspect ratio is retained so the browser can crop
around its saved focal point without already-discarded pixels. Supabase Storage
performs the resize/compression behind the same private participant RLS;
the bucket remains private and all URLs still expire after five minutes. The
banner preview loads eagerly because it is the first Overview item, while gallery
and filmstrip previews explicitly lazy-load. Next's public optimizer is still
bypassed because these are short-lived private URLs.

The original object is requested only when the user chooses the visible **View
full image** action or Download. If transformed preview signing is unavailable,
the page shows a retryable low-data-preview state and keeps the explicit original
action; it never silently substitutes the potentially 10 MB original as a
thumbnail. PDFs and announcement-attachment access are unchanged in this web
increment.

Mobile parity checklist:

- [x] Consume optional `thumbnail_url` for event gallery cards and
  `banner_thumbnail_url` for the event banner; retain `download_url` for explicit
  full-image preview, save and share only.
- [x] Do not fall back from a missing/failed compressed preview to original bytes
  without a user action. Show a lightweight placeholder with retry and full-view
  choices.
- [x] Load only the first visible gallery group automatically, require a tap for
  later previews, and abort signed-preview requests when the panel unmounts.
- [x] Make **View full image** explicit and warn or confirm when appropriate on a
  constrained/mobile data connection before retrieving a large original.
- [ ] Verify byte use on real iOS/Android devices for long galleries, repeated tab
  changes, preview failure, offline recovery and signed-URL expiry. No simulator
  was used for this web increment.

Verification covers exact Storage transform options, document exclusion,
graceful transform failure, explicit lazy/eager browser attributes, transformed
thumbnail selection and original access only after an intentional full-view or
download action. The matching API/website is deployed and the native code was
completed locally on 2026-09-10; physical-device data-use verification remains.

## WEB-005 — Timezone-aware event schedule

On 2026-09-09, the web event identity card gained a compact schedule summary for
the live countdown, calculated duration, RSVP deadline and event timezone. The
timezone is shown as its IANA identifier and event-date UTC offset (for example,
`Africa/Gaborone · UTC+2`), so the saved wall-clock time is not silently
interpreted in the viewer's device zone. Countdown text refreshes once per minute.
Dates without a start time remain explicitly “to be confirmed” rather than being
invented as midnight events.

Every event can be downloaded as a standard `.ics` file from **Add to calendar**.
Timed events are converted from the stored IANA timezone to unambiguous UTC
instants; date-only events use an all-day range. The local calendar file contains
the event title, description, venue, timezone and RSVP deadline, but deliberately
does not include a private invitation code or link. It is generated only after a
user action and is not uploaded or persisted by Tshelo.

The Settings tab can save an optional RSVP deadline and IANA timezone after the
schedule migration is available. The API accepts only recognised timezone names,
valid dates and ordered deadlines. The database independently validates timezone
names, end-date/time ordering and `rsvp_deadline <= event_date`. Attendees may
respond through the full deadline day in the event timezone; subsequent RSVP
writes are rejected at the guest-table boundary. Organisers can continue managing
the guest list after the deadline. Existing deployments omit the two optional
response fields during rollout and the web safely displays the Botswana default;
editing remains disabled until the matching database fields are present.

Mobile parity checklist:

- [x] Add the same countdown, duration, deadline and timezone summary without
  changing the current native event navigation.
- [x] Interpret `event_date`/`event_time` in `Event.time_zone`, falling back to
  `Africa/Gaborone` only when an older API omits the field.
- [x] Refresh active countdowns without a high-frequency timer and pause unnecessary
  work while the screen is backgrounded.
- [x] Disable attendee RSVP after the local deadline while still handling the server
  conflict response; retain organiser guest management.
- [x] Use the native calendar integration where appropriate, preserving
  the exact event instant and making any permission denial recoverable. Never add
  the private invitation link to a calendar entry by default.
- [x] Add schedule editing with recognised IANA zones and the same deadline ordering
  rules; do not infer the event zone from the phone after it has been saved.
- [ ] Verify daylight-saving zones, cross-midnight/multi-day events, date-only events,
  expired deadlines, offline behaviour and large-text layouts on real devices.
  No simulator was used for this web increment.

Local verification covers timezone conversion, countdowns, inclusive RSVP
deadline closure, duration, UTC `.ics` output, all-day export, API validation,
web rendering and real migration/trigger execution in isolated PostgreSQL. The
hosted `20260909110000_event_schedule_details.sql` migration was applied on
2026-09-09 after a dry run confirmed it was the only pending migration; no seeds
or role changes were included. Post-apply migration history shows local and remote
at the same version. The matching application is deployed and the native code
was completed locally on 2026-09-10; physical-device calendar and layout checks
remain.

## WEB-006 — Pinned urgent event update

Organisers and delegated admins with the existing “Manage event updates and
files” permission can pin an announcement from the Updates tab. The pinned item
is moved to the top of the Updates timeline and replaces the normal latest-update
preview with a lightly highlighted **Pinned update** card on Overview. This is
intended for venue changes, time-sensitive reminders and emergencies. Unpinning
returns Overview to the newest announcement.

Only one announcement can be pinned per event. A partial unique database index
enforces that invariant, while the authenticated `set_event_announcement_pin`
function locks the event and atomically clears the previous pin before setting a
new one. The API returns the RPC acknowledgement directly and reloads the
workspace; it does not risk reporting failure through a redundant post-commit
read. The function reuses `can_manage_event_announcements`, rejects missing or
cross-event announcement IDs, and blocks pin changes after an event is completed
or cancelled. Direct authenticated writes to `is_pinned` are not granted. The
web asks for confirmation before replacing an existing pin.

Mobile parity checklist:

- [x] Render the pinned announcement prominently near the start of the native
  Overview, while preserving the existing event flow and announcement viewer.
- [x] Sort the pinned item first in Updates and show a restrained pinned badge.
- [x] Add pin/unpin controls only for active-event users with the existing
  `post_event_announcements` capability; confirm replacement of another pin.
- [x] Call the shared `events.setAnnouncementPin` client operation and reload from
  the server after success rather than maintaining a separate native pin state.
- [x] Treat a missing `is_pinned` field as false during a rolling deployment and
  surface forbidden, inactive-event and network failures without hiding updates.
- [ ] Verify creator, organiser, delegated admin, guest and linked-fund member roles,
  concurrent replacement, offline retry and large-text layouts on real devices.
  No simulator should be launched unless the user changes that instruction.

Local verification covers strict pin-request validation, shared-client request
serialization, caller-scoped API service errors, Overview prominence, replacement
confirmation, the unique database invariant, atomic replacement and role/inactive
event enforcement using the real migration in isolated PostgreSQL. The hosted
migration was applied on 2026-09-09 after a dry run confirmed it was the only
pending change. The matching application is deployed and the native code was
completed locally on 2026-09-10; physical-device role/offline checks remain.

## WEB-007 — Personal allowance and RSVP during invitation entry

The website invitation flow now tells an authenticated guest whether their
invitation is for them alone or includes up to a specific number of additional
guests. The caller-scoped invitation preview obtains that allowance only from an
existing guest row belonging to the caller or an unclaimed guest invitation that
matches the caller's verified phone number. A general or forwarded event link
returns an allowance of zero rather than exposing another invitee's allocation.

Before entering the event workspace, a new guest chooses Yes, Maybe or No,
selects a plus-one count from zero through their allowance, and can add a name
for each selected guest. The form writes through the existing typed RSVP API and
`respond_event_rsvp` database function. The database remains authoritative and
rejects a forged count above the invitation allowance. The attendee Guests tab
repeats the allowance message above its existing constrained selector. Event
invitation emails also state the same allowance, including when none is granted.

Mobile parity checklist:

- [x] Add `allowedPlusOnes` to the native invite preview model from the shared
  `EventInvitePreview.allowed_plus_ones` field.
- [x] Replace the native one-tap Join action with Yes/Maybe/No, a selector capped at
  the returned allowance, and optional guest-name fields before Event Detail.
- [x] Submit through `api.events.respondRsvp` with the invitation code so the same
  database claim and limit enforcement is used; keep `join` only for legacy flow
  compatibility until all clients have migrated.
- [x] Repeat the personal allowance prominently in the native attendee RSVP screen.
- [ ] Treating a missing allowance as zero and the zero/one/multiple allowance
  cases are covered by regression tests. Verify forwarded links,
  mismatched phone numbers, forged counts, zero/one/multiple allowances, and
  offline recovery on real devices. No simulator should be launched unless the
  user changes that instruction.

The additive `20260909130000_event_invite_plus_one_preview.sql` migration was
applied to the linked Supabase database on 2026-09-09 after a dry run confirmed
it was the only pending change and contained no seeds or role changes. A
post-apply dry run reports the remote database is up to date. The application
is deployed and the native code was completed locally on 2026-09-10; physical-
device invitation/deep-link and offline checks remain.

## Maintaining this tracker

For each new web-first feature, add an identifier, web behaviour, shared contract
changes, mobile checklist, verification evidence and rollout requirements. Mark
mobile complete only after native implementation, regression tests and user
device smoke are done. Keep feature completion separate from deployment status.
