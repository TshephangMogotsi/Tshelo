// Usage: npm run test:event-files-db (optional argument: alternate PGlite module path)
// Executes the migrations in an isolated in-memory PostgreSQL database.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const { PGlite } = await import(process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : '@electric-sql/pglite')
const db = new PGlite()
const read = relative => readFile(resolve(root, relative), 'utf8')
const ids = Array.from({ length: 20 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`)
const [owner, organiser, guest, delegate, member, stranger, eventId, otherEvent, fundId, capacityEvent, closedEvent] = ids
const [limitedAdmin, pendingOrganiser, formerMember, standaloneEvent, legacyId, cancelledEvent] = ids.slice(12)
let assertions = 0
const check = (actual, expected) => { assert.deepEqual(actual, expected); assertions++ }
const query = async (sql, params = []) => (await db.query(sql, params)).rows
const actor = async user => {
  await db.exec('RESET ROLE; SET ROLE authenticated;')
  await query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user])
}
const admin = async () => db.exec('RESET ROLE')
async function rejects(sql, params, message) {
  await assert.rejects(query(sql, params), error => error.message.includes(message))
  assertions++
}
const reserve = async (target = eventId, type = 'application/pdf', size = 100) => (await query(
  "SELECT * FROM create_event_file_upload($1, 'Programme.pdf', $2, $3)", [target, type, size],
))[0]
const uploadBytes = async (upload, metadata = { mimetype: upload.content_type, size: Number(upload.size_bytes) }) => query(
  "INSERT INTO storage.objects(bucket_id, name, metadata) VALUES ('event-files', $1, $2)", [upload.object_path, JSON.stringify(metadata)],
)
const finalise = async (upload, target = eventId) => (await query('SELECT * FROM finalize_event_file_upload($1, $2)', [target, upload.id]))[0]
const discard = async (upload, pendingOnly = true, target = eventId) => (await query('SELECT prepare_event_file_removal($1, $2, $3) AS path', [target, upload.id, pendingOnly]))[0].path
const access = async (upload, action) => (await query('SELECT event_file_storage_access($1, $2) AS allowed', [upload.object_path, action]))[0].allowed

async function loadFunction(file, name) {
  const sql = await read(`supabase/migrations/${file}`)
  const pattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?AS (\\$[a-zA-Z_]*\\$)[\\s\\S]*?\\1\\s*;`)
  const match = sql.match(pattern)
  assert.ok(match, `Missing real function ${name}`)
  await db.exec(match[0])
}

try {
  await db.exec(await read('security/fixtures/event-files.sql'))
  for (const name of ['is_event_organiser', 'is_event_guest', 'is_fund_member', 'update_updated_at']) {
    await loadFunction('20260707053236_baseline.sql', name)
  }
  await loadFunction('20260812155000_fund_admin_permission_foundation.sql', 'has_fund_permission')
  await loadFunction('20260812160000_enforce_fund_admin_permissions.sql', 'has_linked_event_fund_permission')
  await query("INSERT INTO fund_permission_definitions(permission_key) VALUES ('post_event_announcements'), ('manage_event_guests')")
  await db.exec(await read('supabase/migrations/20260908100000_event_files.sql'))
  for (const id of [owner, organiser, guest, delegate, member, stranger, limitedAdmin, pendingOrganiser, formerMember]) await query('INSERT INTO users VALUES ($1)', [id])
  await query('INSERT INTO funds VALUES ($1, $2, NULL)', [fundId, owner])
  for (const id of [eventId, otherEvent, capacityEvent, closedEvent, cancelledEvent]) {
    await query('INSERT INTO events(id, creator_id, linked_fund_id) VALUES ($1, $2, $3)', [id, owner, fundId])
  }
  await query("INSERT INTO event_organisers VALUES ($1, $2, 'active')", [eventId, organiser])
  await query("INSERT INTO event_organisers VALUES ($1, $2, 'pending')", [eventId, pendingOrganiser])
  await query('INSERT INTO events(id, creator_id) VALUES ($1, $2)', [standaloneEvent, owner])
  await query('INSERT INTO event_guests VALUES ($1, $2)', [eventId, guest])
  await query("INSERT INTO fund_members VALUES ($1, $2, 'admin', 'joined'), ($1, $3, 'member', 'joined')", [fundId, delegate, member])
  await query("INSERT INTO fund_admin_permissions VALUES ($1, $2, 'post_event_announcements')", [fundId, delegate])
  await query("INSERT INTO fund_members VALUES ($1, $2, 'admin', 'joined'), ($1, $3, 'admin', 'removed')", [fundId, limitedAdmin, formerMember])
  await query("INSERT INTO fund_admin_permissions VALUES ($1, $2, 'manage_event_guests'), ($1, $3, 'post_event_announcements')", [fundId, limitedAdmin, formerMember])

  // Apply Phase 2 to an existing Phase 1 file, not just an empty database.
  const legacyPath = `${otherEvent}/${owner}/${legacyId}.pdf`
  await query("INSERT INTO event_files(id,event_id,uploaded_by,file_name,object_path,content_type,size_bytes) VALUES ($1,$2,$3,'Legacy.pdf',$4,'application/pdf',100)", [legacyId, otherEvent, owner, legacyPath])
  await query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('event-files',$1,'{\"mimetype\":\"application/pdf\",\"size\":100}')", [legacyPath])
  await db.exec(await read('supabase/migrations/20260908110000_event_file_upload_lifecycle.sql'))
  check((await query('SELECT status FROM event_file_uploads WHERE id=$1', [legacyId]))[0].status, 'published')
  check((await query("SELECT label FROM fund_permission_definitions WHERE permission_key='post_event_announcements'"))[0].label, 'Manage event updates and files')
  const bucket = (await query("SELECT * FROM storage.buckets WHERE id='event-files'"))[0]
  check(bucket.public, false)
  check(Number(bucket.file_size_limit), 10485760)
  check(bucket.allowed_mime_types, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

  await actor(owner)
  const first = await reserve()
  check(first.uploaded_by, owner)
  check(await access(first, 'insert'), true)
  await uploadBytes(first)
  const published = await finalise(first)
  check(published.id, first.id)
  check((await finalise(first)).id, first.id)
  check(await discard(first), null)
  check(await access(first, 'delete'), false)
  await rejects('INSERT INTO event_files(event_id, uploaded_by, file_name, object_path, content_type, size_bytes) VALUES ($1, $2, $3, $4, $5, $6)',
    [eventId, owner, 'Fake.pdf', `${eventId}/${owner}/${ids[11]}.pdf`, 'application/pdf', 100], 'permission denied')
  await rejects("SELECT * FROM create_event_file_upload($1, '../bad.pdf', 'application/pdf', 100)", [eventId], 'EVENT_FILE_INVALID')
  await rejects("SELECT * FROM create_event_file_upload($1, 'bad.pdf', 'application/pdf', 10485761)", [eventId], 'EVENT_FILE_INVALID')
  await rejects("SELECT * FROM create_event_file_upload($1, 'bad.svg', 'image/svg+xml', 100)", [eventId], 'EVENT_FILE_INVALID')

  const roles = [
    ['creator', owner, true, true], ['organiser', organiser, true, true],
    ['guest', guest, true, false], ['linked-fund member', member, true, false],
    ['delegated admin', delegate, true, true], ['admin without file grant', limitedAdmin, true, false],
    ['pending organiser', pendingOrganiser, false, false], ['removed member with stale grant', formerMember, false, false],
    ['outsider', stranger, false, false],
  ]
  for (const [name, user, canRead, canManage] of roles) {
    await actor(user)
    check((await query('SELECT can_view_event_files($1) AS view, can_manage_event_files($1) AS manage', [eventId]))[0], { view: canRead, manage: canManage })
    check((await query('SELECT id FROM event_files WHERE id=$1', [first.id])).length, canRead ? 1 : 0)
    // Exercise storage policies themselves, not just their helper predicates.
    check((await query("SELECT name FROM storage.objects WHERE bucket_id='event-files' AND name=$1", [first.object_path])).length, canRead ? 1 : 0)
    check((await query('SELECT id FROM event_file_uploads WHERE id=$1', [first.id])).length, user === owner ? 1 : 0)
    check((await query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [first.object_path])).length, 0)
    check((await query("UPDATE storage.objects SET name='stolen' WHERE name=$1 RETURNING name", [first.object_path])).length, 0)
    await rejects("UPDATE event_files SET object_path='stolen' WHERE id=$1", [first.id], 'permission denied')
    await rejects("UPDATE event_file_uploads SET status='published' WHERE id=$1", [first.id], 'permission denied')
    if (!canManage) {
      await rejects("SELECT * FROM create_event_file_upload($1, 'x.pdf', 'application/pdf', 100)", [eventId], 'EVENT_FILE_FORBIDDEN')
      await rejects('SELECT prepare_event_file_removal($1,$2,false)', [eventId, first.id], 'EVENT_FILE_FORBIDDEN')
    }
    console.log(`PASS active role: ${name} (read=${canRead}, manage=${canManage})`)
  }

  await actor(owner)
  for (const type of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']) {
    const valid = await reserve(otherEvent, type, 10485760)
    await uploadBytes(valid)
    check((await finalise(valid, otherEvent)).content_type, type)
    check(await discard(valid, false, otherEvent), valid.object_path)
    check((await query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [valid.object_path])).length, 1)
  }
  for (const [type, size] of [['text/html', 100], ['application/zip', 100], ['image/svg+xml', 100], ['application/pdf', 0], ['application/pdf', -1], ['application/pdf', null]]) {
    await rejects("SELECT * FROM create_event_file_upload($1,'bad.pdf',$2,$3)", [eventId, type, size], 'EVENT_FILE_INVALID')
  }
  const unpublished = await reserve()
  for (const path of [unpublished.object_path.replace(eventId, otherEvent), unpublished.object_path.replace(owner, guest), `${eventId}/${owner}/../file.pdf`, unpublished.object_path.replace('.pdf', '.svg')]) {
    check((await query("SELECT event_file_storage_access($1,'insert') AS allowed", [path]))[0].allowed, false)
    await rejects("INSERT INTO storage.objects(bucket_id,name) VALUES ('event-files',$1)", [path], 'row-level security')
  }
  await rejects("INSERT INTO storage.objects(bucket_id,name) VALUES ('event-announcement-files',$1)", [unpublished.object_path], 'row-level security')
  await uploadBytes(unpublished)
  await actor(organiser)
  check((await query('SELECT name FROM storage.objects WHERE name=$1', [unpublished.object_path])).length, 0)
  await rejects('SELECT * FROM finalize_event_file_upload($1,$2)', [eventId, unpublished.id], 'EVENT_FILE_NOT_FOUND')
  await rejects('SELECT prepare_event_file_removal($1,$2,false)', [eventId, unpublished.id], 'EVENT_FILE_FORBIDDEN')
  await rejects("INSERT INTO storage.objects(bucket_id,name) VALUES ('event-files',$1)", [unpublished.object_path], 'row-level security')
  await actor(owner)
  check(await discard(unpublished), unpublished.object_path)
  check((await query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [unpublished.object_path])).length, 1)
  check((await query('SELECT prepare_event_file_removal($1,$2,false) AS path', [otherEvent, legacyId]))[0].path, legacyPath)
  check((await query('SELECT id FROM event_files WHERE id=$1', [legacyId])).length, 0)

  // A fund grant does not confer access to an unrelated standalone event.
  await actor(delegate)
  check((await query('SELECT can_view_event_files($1) AS allowed', [standaloneEvent]))[0].allowed, false)
  await rejects("SELECT * FROM create_event_file_upload($1,'x.pdf','application/pdf',100)", [standaloneEvent], 'EVENT_FILE_FORBIDDEN')

  for (const user of [guest, member]) {
    await actor(user)
    check((await query('SELECT id FROM event_files WHERE id = $1', [first.id])).length, 1)
    check(await access(first, 'select'), true)
    await rejects("SELECT * FROM create_event_file_upload($1, 'x.pdf', 'application/pdf', 100)", [eventId], 'EVENT_FILE_FORBIDDEN')
    await rejects('SELECT prepare_event_file_removal($1, $2, false)', [eventId, first.id], 'EVENT_FILE_FORBIDDEN')
  }
  await actor(stranger)
  check((await query('SELECT id FROM event_files WHERE id = $1', [first.id])).length, 0)
  check(await access(first, 'select'), false)
  check(await discard(first), null)
  await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [eventId, first.id], 'EVENT_FILE_NOT_FOUND')

  for (const user of [organiser, delegate]) {
    await actor(user)
    const item = await reserve()
    await uploadBytes(item)
    check((await finalise(item)).uploaded_by, user)
    check(await discard(item, false), item.object_path)
    check(await access(item, 'select'), true)
    check(await access(item, 'delete'), true)
    check(await access(item, 'insert'), false)
    check(await discard(item, false), item.object_path)
    await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [eventId, item.id], 'EVENT_FILE_UPLOAD_EXPIRED')
  }

  await actor(owner)
  const missing = await reserve()
  await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [eventId, missing.id], 'EVENT_FILE_UPLOAD_MISSING')
  check(await discard(missing), missing.object_path)
  for (const metadata of [{ mimetype: 'image/png', size: 100 }, { mimetype: 'application/pdf', size: 99 }, { mimetype: 'application/pdf' }]) {
    const wrong = await reserve()
    await uploadBytes(wrong, metadata)
    await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [eventId, wrong.id], 'EVENT_FILE_UPLOAD_MISMATCH')
    check(await discard(wrong), wrong.object_path)
    check(await access(wrong, 'delete'), true)
  }
  const scoped = await reserve()
  check(await discard(scoped, true, otherEvent), null)
  await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [otherEvent, scoped.id], 'EVENT_FILE_NOT_FOUND')
  await actor(organiser)
  check(await access(scoped, 'select'), false)
  check(await discard(scoped), null)
  await actor(owner)
  check(await discard(scoped), scoped.object_path)

  // In-flight uploads still clean up after manager access is revoked.
  await actor(delegate)
  const revoked = await reserve()
  await uploadBytes(revoked)
  await admin()
  await query('DELETE FROM fund_admin_permissions WHERE user_id = $1', [delegate])
  await actor(delegate)
  await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [eventId, revoked.id], 'EVENT_FILE_FORBIDDEN')
  check(await discard(revoked), revoked.object_path)
  check(await access(revoked, 'delete'), true)
  check((await query('SELECT can_manage_event_files($1) AS allowed', [eventId]))[0].allowed, false)

  // Reservations and published files share the ten-slot quota.
  await actor(owner)
  const reserved = []
  for (let i = 0; i < 10; i++) reserved.push(await reserve(capacityEvent))
  await rejects("SELECT * FROM create_event_file_upload($1, 'x.pdf', 'application/pdf', 100)", [capacityEvent], 'EVENT_FILE_LIMIT_REACHED')
  await uploadBytes(reserved[0])
  check((await finalise(reserved[0], capacityEvent)).id, reserved[0].id)
  await rejects("SELECT * FROM create_event_file_upload($1, 'x.pdf', 'application/pdf', 100)", [capacityEvent], 'EVENT_FILE_LIMIT_REACHED')
  check(await discard(reserved[1], true, capacityEvent), reserved[1].object_path)
  await reserve(capacityEvent)

  // Expired sessions stop uploads and release their reserved slot.
  await admin()
  await query("UPDATE event_file_uploads SET expires_at = now() - interval '1 second' WHERE id = $1", [reserved[2].id])
  await actor(owner)
  check(await access(reserved[2], 'insert'), false)
  await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [capacityEvent, reserved[2].id], 'EVENT_FILE_UPLOAD_EXPIRED')
  await reserve(capacityEvent)

  const pending = await reserve(closedEvent)
  await uploadBytes(pending)
  await admin()
  await query("UPDATE events SET status = 'completed' WHERE id IN ($1, $2)", [eventId, closedEvent])
  await actor(owner)
  check(await access(first, 'select'), true)
  await rejects('SELECT prepare_event_file_removal($1, $2, false)', [eventId, first.id], 'EVENT_FILE_INACTIVE')
  await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [closedEvent, pending.id], 'EVENT_FILE_INACTIVE')
  check(await discard(pending, true, closedEvent), pending.object_path)
  check(await access(pending, 'delete'), true)
  for (const [name, user, canRead] of roles) {
    await actor(user)
    check((await query('SELECT id FROM event_files WHERE id=$1', [first.id])).length, canRead ? 1 : 0)
    check((await query('SELECT name FROM storage.objects WHERE name=$1', [first.object_path])).length, canRead ? 1 : 0)
    check((await query('SELECT can_manage_event_files($1) AS allowed', [eventId]))[0].allowed, false)
    await rejects("SELECT * FROM create_event_file_upload($1,'x.pdf','application/pdf',100)", [eventId], canRead ? 'EVENT_FILE_INACTIVE' : 'EVENT_FILE_FORBIDDEN')
    await rejects('SELECT prepare_event_file_removal($1,$2,false)', [eventId, first.id], canRead ? 'EVENT_FILE_INACTIVE' : 'EVENT_FILE_FORBIDDEN')
    console.log(`PASS completed role: ${name} (read=${canRead}, manage=false)`)
  }
  await actor(owner)
  check((await finalise(first)).id, first.id) // An idempotent success stays retryable after completion.
  const cancelled = await reserve(cancelledEvent)
  await uploadBytes(cancelled)
  await finalise(cancelled, cancelledEvent)
  await admin()
  await query("UPDATE events SET status='cancelled' WHERE id=$1", [cancelledEvent])
  await actor(owner)
  check(await access(cancelled, 'select'), true)
  check(await access(cancelled, 'insert'), false)
  await rejects('SELECT prepare_event_file_removal($1,$2,false)', [cancelledEvent, cancelled.id], 'EVENT_FILE_INACTIVE')
  await admin()
  await query('UPDATE events SET deleted_at = now() WHERE id = $1', [eventId])
  await actor(owner)
  check(await access(first, 'select'), false)
  await db.exec('RESET ROLE; SET ROLE anon;')
  await rejects('SELECT * FROM finalize_event_file_upload($1, $2)', [eventId, first.id], 'permission denied')
  await rejects('SELECT * FROM event_files', [], 'permission denied')
  await rejects('SELECT * FROM event_file_uploads', [], 'permission denied')
  await rejects("SELECT event_file_storage_access($1,'select')", [first.object_path], 'permission denied')

  console.log(`Event file database checks passed (${assertions} assertions; real migrations and permission helpers).`)
} finally {
  await db.close()
}
