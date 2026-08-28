import { redirect } from 'next/navigation'

export default async function JoinEventPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  redirect(code ? `/account/events?joinCode=${encodeURIComponent(code)}` : '/account/events')
}
