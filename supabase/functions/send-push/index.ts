import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Invoked by a Supabase Database Webhook on public.notifications (INSERT).
// See README.md in this folder for how to wire the webhook up in the dashboard.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const EXPECTED_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET')
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const MAX_WEBHOOK_BYTES = 256_000

type NotificationRow = {
  id: string
  user_id: string
  fund_id: string | null
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
}

type WebhookPayload = {
  type: 'INSERT'
  table: string
  record: NotificationRow
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  // This endpoint holds a service-role client and must fail closed. A missing
  // secret is a deployment error, never an instruction to disable auth.
  if (!EXPECTED_SECRET) return new Response('Webhook authentication is not configured', { status: 503 })
  const got = req.headers.get('x-webhook-secret')
  if (!got || got !== EXPECTED_SECRET) return new Response('Unauthorized', { status: 401 })

  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return new Response('Payload too large', { status: 413 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
    return new Response('Unexpected webhook event', { status: 400 })
  }

  const notification = payload.record
  if (!notification?.id || !notification.user_id) return new Response('Invalid notification', { status: 400 })
  if (typeof notification.title !== 'string' || typeof notification.body !== 'string') {
    return new Response('Invalid notification content', { status: 400 })
  }

  const safeTitle = notification.title.slice(0, 200)
  const safeBody = notification.body.slice(0, 1000)
  const safeData = notification.data && JSON.stringify(notification.data).length <= 4096
    ? notification.data
    : {}

  // Rows the app already surfaced as a local device notification (e.g.
  // SMS-detected money-in) only feed the in-app list — don't push twice.
  if (notification.data?.suppress_push === true) {
    return new Response('Push suppressed', { status: 200 })
  }

  const { data: tokenRows, error: tokenError } = await supabase
    .from('push_tokens')
    .select('id, expo_push_token')
    .eq('user_id', notification.user_id)

  if (tokenError) {
    console.error('push_tokens query failed', tokenError)
    return new Response('Token lookup failed', { status: 500 })
  }

  if (!tokenRows || tokenRows.length === 0) return new Response('No devices', { status: 200 })

  const messages = tokenRows.map((row: { id: string; expo_push_token: string }) => ({
    to:    row.expo_push_token,
    title: safeTitle,
    body:  safeBody,
    sound: 'default',
    data:  { ...safeData, notificationId: notification.id, fundId: notification.fund_id },
  }))

  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  })

  if (!pushRes.ok) {
    console.error('Expo push request failed', pushRes.status)
    return new Response('Push provider failed', { status: 502 })
  }

  const pushResult = await pushRes.json().catch(() => null)
  const tickets: { status: string; message?: string; details?: { error?: string } }[] =
    pushResult?.data ?? []

  // Drop tokens Expo says are dead so we stop paging them.
  const deadTokenIds = tickets
    .map((ticket, i) => (ticket.details?.error === 'DeviceNotRegistered' ? tokenRows[i]?.id : null))
    .filter((id): id is string => id !== null)

  if (deadTokenIds.length > 0) {
    await supabase.from('push_tokens').delete().in('id', deadTokenIds)
  }

  return new Response(JSON.stringify({ sent: messages.length, removed: deadTokenIds.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
