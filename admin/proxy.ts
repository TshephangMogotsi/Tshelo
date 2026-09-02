import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseConfig } from './lib/config'

const APP_HOST = 'app.tshelo.com'
const ADMIN_HOST = 'admin.tshelo.com'
const ADMIN_PATHS = ['/funds', '/support', '/users']

function getHostname(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const host = (forwardedHost ?? request.headers.get('host') ?? '').split(',')[0].trim()
  return host.replace(/:\d+$/, '').toLowerCase()
}

function isPathWithin(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

function redirectToHost(request: NextRequest, hostname: string) {
  const url = request.nextUrl.clone()
  url.hostname = hostname
  url.port = ''
  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const hostname = getHostname(request)
  const { pathname } = request.nextUrl

  // The two custom domains share this deployment, but present distinct entry
  // points. Keep API routes on either host so the mobile app can continue to
  // call app.tshelo.com/api/v1 without an extra redirect.
  if (hostname === APP_HOST) {
    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/account/overview'
      return NextResponse.redirect(url)
    }

    if (ADMIN_PATHS.some(path => isPathWithin(pathname, path))) {
      return redirectToHost(request, ADMIN_HOST)
    }
  }

  if (hostname === ADMIN_HOST && isPathWithin(pathname, '/account')) {
    return redirectToHost(request, APP_HOST)
  }

  const { url, key } = getSupabaseConfig()
  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  await supabase.auth.getClaims()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
