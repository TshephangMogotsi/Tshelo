import { createClient } from '@supabase/supabase-js'

const required = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLAY_REVIEW_EMAIL', 'GOOGLE_PLAY_REVIEW_PASSWORD']
for (const key of required) {
  if (!process.env[key]?.trim()) throw new Error(`Missing ${key}.`)
}

const email = process.env.GOOGLE_PLAY_REVIEW_EMAIL.trim().toLowerCase()
const password = process.env.GOOGLE_PLAY_REVIEW_PASSWORD
if (password.length < 16) throw new Error('GOOGLE_PLAY_REVIEW_PASSWORD must be at least 16 characters.')

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (listError) throw listError

const existing = listed.users.find(user => user.email?.toLowerCase() === email)
const reviewerMetadata = { ...(existing?.app_metadata ?? {}), google_play_reviewer: true }
const userResult = existing
  ? await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: reviewerMetadata,
    })
  : await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: reviewerMetadata,
    })

if (userResult.error || !userResult.data.user) throw userResult.error ?? new Error('Could not create the reviewer account.')

const reviewer = userResult.data.user
const { error: profileError } = await supabase.from('users').upsert({
  id: reviewer.id,
  phone: `REVIEW-${reviewer.id.slice(0, 8)}`,
  name: 'Google Play Reviewer',
  email,
  preferred_currency: 'BWP',
  notifications_enabled: false,
  profile_completed: true,
  onboarding_completed: true,
  terms_accepted_at: new Date().toISOString(),
  terms_version: '1.0',
  privacy_accepted_at: new Date().toISOString(),
  privacy_version: '1.0',
  data_processing_consent: true,
  data_processing_consent_at: new Date().toISOString(),
}, { onConflict: 'id' })

if (profileError) throw profileError

console.log(`Google Play reviewer account is ready: ${email}`)
