import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  // GET requests may be prefetched by Next.js. They must never mutate the
  // session, otherwise simply rendering a sign-out link can log the user out.
  return NextResponse.redirect(new URL('/login', request.url))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
