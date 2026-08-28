import { redirect } from 'next/navigation'

export default async function JoinFundPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  redirect(code ? `/account/funds?joinCode=${encodeURIComponent(code)}` : '/account/funds')
}
