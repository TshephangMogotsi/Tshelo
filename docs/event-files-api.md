# Event files API

Apply `20260908100000_event_files.sql`, then
`20260908110000_event_file_upload_lifecycle.sql` before deploying this API.
The second migration supports inspection and cleanup of pending uploads,
preserves existing Phase 1 files, and routes metadata creation/removal through
caller-owned database functions. The permission key remains
`post_event_announcements`.

The shared client exposes this flow:

1. `events.createFileUploadSession(eventId, { file_name, content_type, size_bytes })`
   reserves a slot and returns `upload_id`, `object_path`, `upload_url`, and
   `expires_at`. Up to ten published files and unexpired reservations are allowed
   per event. Sessions last two hours; supported types are PDF, JPG, PNG and WEBP,
   with a 10 MB maximum.
2. PUT the binary file to `upload_url`, using the returned `content_type` in the
   `Content-Type` header and `x-upsert: false`. Do not send the API bearer token
   to this signed URL. Wait for a successful upload response.
3. `events.finalizeFile(eventId, { upload_id })` checks the session owner, event,
   active state and stored byte count/MIME type before creating an `EventFile`.
   The file ID equals `upload_id`. Retrying a successful finalisation returns
   the same file. `events.workspace(eventId)` includes the ordered `files` array.
4. `events.createFileAccess(eventId, fileId)` returns a five-minute
   `download_url` and `expires_at`. This checks current participation and only
   accepts finalised file IDs. Completed/cancelled events remain readable.
5. `events.removeFile(eventId, fileId)` removes a published file for an active
   event manager, or cancels the caller's pending upload. Passing `upload_id`
   also cancels an upload before it is finalised.

All API routes require authentication and return `Cache-Control: no-store`.
The OpenAPI document describes their paths and request/response schemas.

## Failure handling

Finalisation failures discard only the caller's still-pending session and then
delete its bytes through the Storage API. The cleanup transaction locks the
session, so it cannot delete an upload another request has already finalised.
Discarded sessions cannot be republished. Permission loss or event completion
does not prevent the original uploader from cleaning up an unpublished file.

Removal first hides the published file and saves a cleanup claim, then removes
the bytes. If Storage fails, retry `removeFile` with the same ID. Errors with
`error.details.cleanup_pending` include `upload_id` and `event_id` for recovery.
An interrupted finalisation with an uncertain outcome can also be retried with
the same upload ID. If the session was discarded, start a new upload instead.

`cleanup_pending` is returned only after the database confirms a pending-only
removal claim. If that claim itself fails or its response is lost, the API returns
a retryable `INTERNAL_ERROR` without cleanup instructions. Mobile and web retain
the upload ID and offer **Check upload**, so an uncertain finalisation cannot turn
into deletion of an already-published file.

Storage metadata is read to validate the upload, but bytes are removed through
the Storage API, following [Supabase's storage schema guidance](https://supabase.com/docs/guides/storage/schema/design).
MIME validation checks Storage's recorded content type; it is not malware
scanning or a file-content inspection service.

Signed URLs already issued can remain usable until expiry. Retain session
records until the signed upload URL expires and cleanup is confirmed. A client
that disappears without finalising/cancelling, or a late in-flight upload that
finishes after cancellation, can leave an unreferenced object; a periodic
storage sweeper is a separate operational follow-up. Expired reservations do
not block the event's file limit.

## Mobile Files tab

`EventDetailScreen` exposes Files for both standalone and linked-fund events,
including participants without access to the linked fund. Images appear in a
gallery and PDFs in document rows. Both use the announcement attachment viewer,
image zoom controls and native download/share sheet. Each preview, gallery step,
PDF open and download obtains fresh private access; failed thumbnails/previews
offer retry.

Add/delete controls use `post_event_announcements` (event creators/organisers or
delegated linked-fund managers) and require an active event. The system file
picker supports multiple PDFs, JPGs, PNGs and WEBPs. Selection is validated before
uploading; progress and failures are shown per file. Successful files remain
available if another file fails. Upload state lives at screen level so switching
tabs/workspaces does not lose it, and leaving the event is guarded while an
operation is running.

An unconfirmed save offers **Check upload**, reusing its upload ID without
re-uploading or deleting a possibly successful file. Cleanup and already-confirmed
deletion retries remain available after event completion. These recovery controls
are screen-local; they are not a persistent background upload queue.

After deploying the migrations/API, smoke-test on iOS and Android:

- Add multiple images and a PDF; switch tabs during upload and reopen the event.
- Step between image previews, zoom, open a PDF, and save/share each type.
- Cancel then confirm deletion; verify a participant can read but cannot edit.
- Complete the event; verify files remain readable and Add/delete disappear.
- Interrupt transfer/finalisation and retry; verify no duplicate published files.
- Check narrow screens, large text and dark mode, plus a failed thumbnail retry.

## Website Files tab

The event workspace supports `?tab=files` for creators, organisers and participants.
It uses the same typed API client and the shared `shared/event-files.ts` validation
and upload-recovery state machine as mobile. Files are kept at workspace level,
so switching tabs retains uploads, successful files and recovery controls.

The website reuses one `EventAttachments` component for update attachments and
event files: image gallery, PDF iframe preview, zoom, filmstrip navigation and
Blob downloads. Private images bypass Next's public image optimizer. The viewer
refreshes signed access on each interaction, supports Escape/focus restoration,
and shows retryable thumbnail, preview and download errors.

Uploads use a binary PUT with progress and a two-minute transfer timeout. Guests
and completed events stay read-only; cleanup/deletion recovery remains available.
Page unload warns about pending work; internal tab changes are safe, but recovery
state is not persisted across page loads. No new backend or storage bypass is used.

`npm run test:web` runs isolated DOM tests for the actual workspace, viewer,
file picker and upload hook with mocked API/Storage responses. This verifies UI
integration, not a live Supabase deployment or a full browser/device smoke test.

## Verification

`npm run verify` runs mobile/shared typechecking and Jest, server-side validation,
data-service and route tests, API-verifier self-tests, web DOM tests, and the
database/RLS suite. Run `npm --prefix admin run verify` for website typechecking,
lint and its production build.

`npm run test:event-files-db` executes both migrations and the actual project
permission helpers in a disposable in-memory PostgreSQL runtime using the pinned
PGlite dev dependency. It covers the role matrix, legacy backfill, private storage
policies, ownership, limits, completion and cleanup. It does not connect to
Supabase: surrounding tables and Storage metadata are simulated. It does not
verify the full deployed schema, live Storage HTTP enforcement or simultaneous
independent database connections. An alternate PGlite module path can optionally
be passed to `node scripts/test-event-files-db.mjs`.

With a running API, `API_BASE_URL=http://127.0.0.1:3100 npm run verify:api`
performs 99 unauthenticated/invalid-token checks. Supplying `API_ACCESS_TOKEN`
and `API_ADMIN_ACCESS_TOKEN` in the process environment enables authenticated
validation/read checks. Tokens must not be committed or pasted into reports.
These checks do not replace a signed-in upload/preview/download/delete smoke test.

See [Phase 5 verification results and remaining checks](event-files-verification.md).
